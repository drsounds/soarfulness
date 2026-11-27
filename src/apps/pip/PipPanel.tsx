import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { Findable } from "@/components/settingsNav";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import { pipController } from "./PipController";
import { nativePipSupported } from "./pipNative";
import { onPipStatus, pipStatus, type PipKind } from "./pipState";
import { PIP_ASPECTS, type PipSettings } from "./settings";

// PIP dials. Reads and writes the app's settings handle
// (`useAppSettings(PIP_DEFAULTS, ...)` in routes/index.tsx).

export function PipPanel({ pip }: { pip: AppSettingsHandle<PipSettings> }) {
  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const { pipOn, pipAuto, pipAspect, pipFps } = pip.values;
  const s = pip.setters;
  const mode = pipController.mode();
  const [nativeOk, setNativeOk] = useState(true);
  const [active, setActive] = useState<PipKind | null>(() => pipStatus().kind);
  const [failed, setFailed] = useState(false);
  useEffect(() => onPipStatus((st) => setActive(st.kind)), []);
  useEffect(() => {
    if (mode === "native") void nativePipSupported().then((r) => setNativeOk(r.supported));
  }, [mode]);

  const hint =
    "max-w-[16rem] self-center text-center text-[10px] font-light leading-snug ui-ink-faint";
  const btn =
    "pointer-events-auto self-center rounded-full border px-3 py-1 text-[10px] tracking-[0.2em] ui-line-2 ui-press transition active:scale-95 disabled:opacity-40";
  const cycle = (d: number) => {
    const i = PIP_ASPECTS.indexOf(pipAspect);
    s.pipAspect(PIP_ASPECTS[(i + d + PIP_ASPECTS.length) % PIP_ASPECTS.length]);
  };
  const aspectLabel = (a: PipSettings["pipAspect"]) =>
    a === "screen" ? t("dial.pip.aspectScreen") : a;
  const howKey =
    mode === "native"
      ? nativeOk
        ? "native"
        : "nativeOff"
      : mode === "document"
        ? "document"
        : mode === "video"
          ? "video"
          : "none";

  return (
    <>
      <SettingRow
        label={t("dial.pip.on")}
        value={onOff(pipOn)}
        onDec={() => s.pipOn(false)}
        onInc={() => s.pipOn(true)}
      />
      <p className={hint}>{t(`dial.pip.how.${howKey}`)}</p>
      {pipOn && mode && (
        <>
          {mode !== "video" && (
            <SettingRow
              label={t("dial.pip.auto")}
              value={onOff(pipAuto)}
              onDec={() => s.pipAuto(false)}
              onInc={() => s.pipAuto(true)}
            />
          )}
          <SettingRow
            label={t("dial.pip.aspect")}
            value={aspectLabel(pipAspect)}
            onDec={() => cycle(-1)}
            onInc={() => cycle(1)}
            options={PIP_ASPECTS.map(aspectLabel)}
            selectedIndex={Math.max(0, PIP_ASPECTS.indexOf(pipAspect))}
            onSelectIndex={(i) => s.pipAspect(PIP_ASPECTS[i])}
          />
          <SettingRow
            label={t("dial.pip.fps")}
            mode="number"
            value={pipFps <= 0 ? t("dial.pip.fpsNoCap") : `${pipFps}`}
            rawValue={pipFps}
            onSet={(x) => s.pipFps(Math.max(0, Math.min(120, Math.round(x))))}
            min={0}
            max={120}
            step={5}
            onDec={() => s.pipFps((v) => Math.max(0, v - 5))}
            onInc={() => s.pipFps((v) => Math.min(120, v + 5))}
          />
          <Findable label={t("dial.pip.showNow")}>
            <button
              type="button"
              className={btn}
              disabled={mode === "native" && !nativeOk}
              onClick={() => {
                setFailed(false);
                if (active) pipController.exit();
                else void pipController.enter().then((ok) => setFailed(!ok));
              }}
            >
              {active ? t("dial.pip.close") : t("dial.pip.showNow")}
            </button>
          </Findable>
          {failed && <p className={hint}>{t("dial.pip.failed")}</p>}
        </>
      )}
    </>
  );
}
