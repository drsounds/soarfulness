import { useEffect, useState } from "react";
import { pipController } from "./PipController";
import { setPipFpsCap } from "./pipFrames";
import {
  configureNativePip,
  nativePipAvailable,
  nativePipSupported,
  onNativePipChange,
} from "./pipNative";
import { onPipStatus, pipStatus, setPipStatus, type PipKind } from "./pipState";
import { pipRatioParts, type PipSettings } from "./settings";
import type { PipPlaceholderText } from "./DocumentPipWindow";

type MediaSessionWithPip = MediaSession & {
  setActionHandler(action: string, handler: (() => void) | null): void;
};

/**
 * PIP wiring for the page: keeps pipController and the Android activity's PiP
 * params in step with the settings, follows native PiP enter/leave, and in
 * Chrome registers the "enterpictureinpicture" media action so the browser
 * can open the Document PiP window by itself when you switch tab (Chrome
 * only offers that while the page plays sound). Returns the active PiP kind.
 */
export function usePictureInPicture(
  settings: PipSettings,
  appEnabled: boolean,
  text: PipPlaceholderText,
): PipKind | null {
  const [active, setActive] = useState<PipKind | null>(() => pipStatus().kind);
  const on = appEnabled && settings.pipOn;
  const { pipAuto, pipAspect, pipFps } = settings;

  useEffect(() => onPipStatus((s) => setActive(s.kind)), []);

  useEffect(() => {
    pipController.configure(settings, appEnabled, text);
    setPipFpsCap(pipFps);
  });

  // Android: PiP params (enabled, auto-enter on Home, aspect ratio). With the
  // "screen" shape they follow rotation, but not while in PiP (the window is
  // the small one then).
  useEffect(() => {
    if (!nativePipAvailable()) return;
    let timer = 0;
    const push = () => {
      if (pipStatus().kind === "native") return;
      const { width, height } = pipRatioParts(pipController.ratio());
      void configureNativePip({
        enabled: on,
        autoEnter: on && pipAuto,
        aspectWidth: width,
        aspectHeight: height,
      });
    };
    push();
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(push, 300);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [on, pipAuto, pipAspect]);

  useEffect(() => {
    if (!nativePipAvailable()) return;
    void nativePipSupported().then((s) => {
      if (s.active) setPipStatus({ kind: "native", frameWindow: null });
    });
    return onNativePipChange((isIn) =>
      setPipStatus(
        isIn ? { kind: "native", frameWindow: null } : { kind: null, frameWindow: null },
      ),
    );
  }, []);

  // Web: Chrome's automatic Picture-in-Picture for Document PiP.
  useEffect(() => {
    if (!on || !pipAuto || pipController.mode() !== "document") return;
    const session = (typeof navigator !== "undefined" ? navigator.mediaSession : undefined) as
      MediaSessionWithPip | undefined;
    if (!session) return;
    try {
      session.setActionHandler("enterpictureinpicture", () => void pipController.enter());
    } catch {
      return; // this Chrome doesn't know the action
    }
    return () => {
      try {
        session.setActionHandler("enterpictureinpicture", null);
      } catch {
        /* ignore */
      }
    };
  }, [on, pipAuto]);

  // Leaving the page: the scene must be back in it before React unmounts it.
  useEffect(() => () => pipController.exit(), []);

  // Switched off while showing: close the web window.
  useEffect(() => {
    if (!on) pipController.exit();
  }, [on]);

  return active;
}
