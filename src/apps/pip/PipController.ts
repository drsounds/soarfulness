import {
  DocumentPipWindow,
  PIP_ROOT_SELECTOR,
  documentPipAvailable,
  type PipPlaceholderText,
} from "./DocumentPipWindow";
import { enterNativePip, nativePipAvailable } from "./pipNative";
import { pipStatus, setPipStatus, type PipKind } from "./pipState";
import { PIP_DEFAULTS, pipAspectRatio, clampPipRatio, type PipSettings } from "./settings";
import { VideoPip, videoPipAvailable } from "./VideoPip";

/** The longer side of a web PiP window, CSS px (the browser may resize it). */
const WEB_PIP_SIZE = 420;

/**
 * Picks and drives the Picture-in-Picture this platform has: the Android
 * activity's own PiP inside the app, Document PiP in desktop Chrome, video PiP
 * of the canvas elsewhere. One per page (`pipController`); usePictureInPicture
 * feeds it the settings, PipPanel's SHOW NOW button calls enter().
 */
export class PipController {
  private settings: PipSettings = PIP_DEFAULTS;
  private enabled = false;
  private text: PipPlaceholderText = { message: "", back: "" };
  private readonly doc = new DocumentPipWindow(() => this.closed("document"));
  private readonly video = new VideoPip(() => this.closed("video"));

  configure(settings: PipSettings, enabled: boolean, text: PipPlaceholderText): void {
    this.settings = settings;
    this.enabled = enabled;
    this.text = text;
  }

  /** Which PiP enter() would use here, or null when there's none. */
  mode(): PipKind | null {
    if (nativePipAvailable()) return "native";
    if (documentPipAvailable()) return "document";
    if (videoPipAvailable()) return "video";
    return null;
  }

  get on(): boolean {
    return this.enabled && this.settings.pipOn;
  }

  /** Width / height of the floating window. */
  ratio(): number {
    return clampPipRatio(
      pipAspectRatio(this.settings.pipAspect, window.innerWidth, window.innerHeight),
    );
  }

  /** Shows the bath in PiP. Web modes need a click (or Chrome's auto-enter). */
  async enter(): Promise<boolean> {
    if (!this.on || pipStatus().kind) return !!pipStatus().kind;
    const mode = this.mode();
    if (mode === "native") return enterNativePip();
    if (mode === "document") {
      const r = this.ratio();
      const size =
        r >= 1
          ? { width: WEB_PIP_SIZE, height: WEB_PIP_SIZE / r }
          : { width: WEB_PIP_SIZE * r, height: WEB_PIP_SIZE };
      try {
        const win = await this.doc.open(size, this.text);
        if (!win) return false;
        setPipStatus({ kind: "document", frameWindow: win });
        return true;
      } catch {
        return false;
      }
    }
    if (mode === "video") {
      const canvas = document.querySelector<HTMLCanvasElement>(
        `${PIP_ROOT_SELECTOR} [data-pip-canvas] > canvas`,
      );
      if (!canvas) return false;
      const ok = await this.video.open(canvas, this.settings.pipFps);
      if (ok) setPipStatus({ kind: "video", frameWindow: null });
      return ok;
    }
    return false;
  }

  /** Closes a web PiP window (the Android one is closed by the system). */
  exit(): void {
    const { kind } = pipStatus();
    if (kind === "document") this.doc.close();
    else if (kind === "video") this.video.close();
  }

  private closed(kind: PipKind): void {
    if (pipStatus().kind === kind) setPipStatus({ kind: null, frameWindow: null });
  }
}

export const pipController = new PipController();
