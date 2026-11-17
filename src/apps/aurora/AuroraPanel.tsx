import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { limitMax, useExtremeLimits, type LimitedControl } from "@/lib/extremeLimits";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import { AURORA_PALETTES, type AuroraSettings } from "./settings";

// Aurora dials (moved out of components/SettingsPanel.tsx). Reads and writes
// the app's settings handle (`useAppSettings(AURORA_DEFAULTS, ...)` in routes/index.tsx).

export function AuroraPanel({ aurora }: { aurora: AppSettingsHandle<AuroraSettings> }) {
  const { t } = useTranslation();
  const [extremeLimits] = useExtremeLimits();
  const mx = (control: LimitedControl) => limitMax(control, extremeLimits);
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const {
    auroraOn,
    auroraIntensity,
    auroraAmount,
    auroraSpeed,
    auroraHeight,
    auroraPalette,
    auroraColorMain,
    auroraColorTop,
    auroraDaylightOn,
  } = aurora.values;
  const {
    auroraOn: setAuroraOn,
    auroraIntensity: setAuroraIntensity,
    auroraAmount: setAuroraAmount,
    auroraSpeed: setAuroraSpeed,
    auroraHeight: setAuroraHeight,
    auroraPalette: setAuroraPalette,
    auroraColorMain: setAuroraColorMain,
    auroraColorTop: setAuroraColorTop,
    auroraDaylightOn: setAuroraDaylightOn,
  } = aurora.setters;
  return (
    <>
      <SettingRow
        label={t("dial.env.aurora")}
        value={onOff(auroraOn)}
        onDec={() => setAuroraOn(false)}
        onInc={() => setAuroraOn(true)}
      />
      {auroraOn && (
        <>
          <SettingRow
            label={t("dial.env.auroraIntensity")}
            mode="number"
            value={`${Math.round(auroraIntensity * 100)}%`}
            rawValue={auroraIntensity}
            onSet={(v) => setAuroraIntensity(v)}
            min={0}
            max={mx("auroraIntensity")}
            step={0.05}
            onDec={() => setAuroraIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() =>
              setAuroraIntensity((v) => Math.min(mx("auroraIntensity"), +(v + 0.05).toFixed(2)))
            }
          />
          <SettingRow
            label={t("dial.env.auroraAmount")}
            mode="number"
            value={`${Math.round(auroraAmount * 100)}%`}
            rawValue={auroraAmount}
            onSet={(v) => setAuroraAmount(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setAuroraAmount((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setAuroraAmount((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.auroraSpeed")}
            mode="number"
            value={`${Math.round(auroraSpeed * 100)}%`}
            rawValue={auroraSpeed}
            onSet={(v) => setAuroraSpeed(v)}
            min={0}
            max={3}
            step={0.05}
            onDec={() => setAuroraSpeed((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setAuroraSpeed((v) => Math.min(3, +(v + 0.05).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.auroraHeight")}
            mode="number"
            value={`${Math.round(auroraHeight * 100)}%`}
            rawValue={auroraHeight}
            onSet={(v) => setAuroraHeight(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setAuroraHeight((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setAuroraHeight((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.auroraPalette")}
            value={t(`dial.env.auroraPaletteValue.${auroraPalette}`)}
            options={AURORA_PALETTES.map((p) => t(`dial.env.auroraPaletteValue.${p}`))}
            selectedIndex={Math.max(0, AURORA_PALETTES.indexOf(auroraPalette))}
            onSelectIndex={(i) => setAuroraPalette(AURORA_PALETTES[i])}
            onDec={() =>
              setAuroraPalette(
                (p) =>
                  AURORA_PALETTES[
                    (Math.max(0, AURORA_PALETTES.indexOf(p)) - 1 + AURORA_PALETTES.length) %
                      AURORA_PALETTES.length
                  ],
              )
            }
            onInc={() =>
              setAuroraPalette(
                (p) =>
                  AURORA_PALETTES[
                    (Math.max(0, AURORA_PALETTES.indexOf(p)) + 1) % AURORA_PALETTES.length
                  ],
              )
            }
          />
          {auroraPalette === "custom" && (
            <>
              <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                  {t("dial.env.auroraColorMain")}
                </span>
                <input
                  type="color"
                  value={auroraColorMain}
                  onChange={(e) => setAuroraColorMain(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                />
              </label>
              <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                  {t("dial.env.auroraColorTop")}
                </span>
                <input
                  type="color"
                  value={auroraColorTop}
                  onChange={(e) => setAuroraColorTop(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                />
              </label>
            </>
          )}
          <SettingRow
            label={t("dial.env.auroraDaylight")}
            value={onOff(auroraDaylightOn)}
            onDec={() => setAuroraDaylightOn(false)}
            onInc={() => setAuroraDaylightOn(true)}
          />
        </>
      )}
    </>
  );
}
