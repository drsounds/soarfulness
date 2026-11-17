import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import { UNDERWATER_FOG_BLENDS, type UnderwaterFogSettings } from "./settings";

// UnderwaterFog dials (moved out of components/SettingsPanel.tsx). Reads and writes
// the app's settings handle (`useAppSettings(UNDERWATER_FOG_DEFAULTS, ...)` in routes/index.tsx).

export function UnderwaterFogPanel({
  underwaterFog,
}: {
  underwaterFog: AppSettingsHandle<UnderwaterFogSettings>;
}) {
  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const {
    underwaterFogOn,
    underwaterFogColor,
    underwaterFogOpacity,
    underwaterFogWaterColorAuto,
    underwaterFogWaterColor,
    underwaterFogWaterOpacity,
    underwaterFogIntensity,
    underwaterFogSpread,
    underwaterFogCurve,
    underwaterFogFeather,
    underwaterFogDistance,
    underwaterFogOffset,
    underwaterFogSubmergedOnly,
    underwaterFogBlend,
  } = underwaterFog.values;
  const {
    underwaterFogOn: setUnderwaterFogOn,
    underwaterFogColor: setUnderwaterFogColor,
    underwaterFogOpacity: setUnderwaterFogOpacity,
    underwaterFogWaterColorAuto: setUnderwaterFogWaterColorAuto,
    underwaterFogWaterColor: setUnderwaterFogWaterColor,
    underwaterFogWaterOpacity: setUnderwaterFogWaterOpacity,
    underwaterFogIntensity: setUnderwaterFogIntensity,
    underwaterFogSpread: setUnderwaterFogSpread,
    underwaterFogCurve: setUnderwaterFogCurve,
    underwaterFogFeather: setUnderwaterFogFeather,
    underwaterFogDistance: setUnderwaterFogDistance,
    underwaterFogOffset: setUnderwaterFogOffset,
    underwaterFogSubmergedOnly: setUnderwaterFogSubmergedOnly,
    underwaterFogBlend: setUnderwaterFogBlend,
  } = underwaterFog.setters;
  return (
    <>
      <SettingRow
        label={t("dial.env.underwaterFog")}
        value={onOff(underwaterFogOn)}
        onDec={() => setUnderwaterFogOn(false)}
        onInc={() => setUnderwaterFogOn(true)}
      />
      {underwaterFogOn && (
        <>
          <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
            <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
              {t("dial.env.underwaterFogColor")}
            </span>
            <input
              type="color"
              value={underwaterFogColor}
              onChange={(e) => setUnderwaterFogColor(e.target.value)}
              className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
            />
          </label>
          <SettingRow
            label={t("dial.env.underwaterFogOpacity")}
            mode="number"
            value={`${Math.round(underwaterFogOpacity * 100)}%`}
            rawValue={underwaterFogOpacity}
            onSet={(v) => setUnderwaterFogOpacity(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setUnderwaterFogOpacity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setUnderwaterFogOpacity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.underwaterFogWaterColorMode")}
            value={t(
              `dial.env.underwaterFogWaterColorValue.${underwaterFogWaterColorAuto ? "auto" : "custom"}`,
            )}
            onDec={() => setUnderwaterFogWaterColorAuto((v) => !v)}
            onInc={() => setUnderwaterFogWaterColorAuto((v) => !v)}
          />
          {!underwaterFogWaterColorAuto && (
            <>
              <label className="flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md">
                <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                  {t("dial.env.underwaterFogWaterColorPick")}
                </span>
                <input
                  type="color"
                  value={underwaterFogWaterColor}
                  onChange={(e) => setUnderwaterFogWaterColor(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0"
                />
              </label>
            </>
          )}
          <SettingRow
            label={t("dial.env.underwaterFogWaterOpacity")}
            mode="number"
            value={`${Math.round(underwaterFogWaterOpacity * 100)}%`}
            rawValue={underwaterFogWaterOpacity}
            onSet={(v) => setUnderwaterFogWaterOpacity(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setUnderwaterFogWaterOpacity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setUnderwaterFogWaterOpacity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.underwaterFogIntensity")}
            mode="number"
            value={`${Math.round(underwaterFogIntensity * 100)}%`}
            rawValue={underwaterFogIntensity}
            onSet={(v) => setUnderwaterFogIntensity(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setUnderwaterFogIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setUnderwaterFogIntensity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.underwaterFogSpread")}
            mode="number"
            value={`${Math.round(underwaterFogSpread * 100)}%`}
            rawValue={underwaterFogSpread}
            onSet={(v) => setUnderwaterFogSpread(v)}
            min={0.05}
            max={1}
            step={0.05}
            onDec={() => setUnderwaterFogSpread((v) => Math.max(0.05, +(v - 0.05).toFixed(2)))}
            onInc={() => setUnderwaterFogSpread((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.underwaterFogCurve")}
            mode="number"
            value={underwaterFogCurve.toFixed(1)}
            rawValue={underwaterFogCurve}
            onSet={(v) => setUnderwaterFogCurve(v)}
            min={0.2}
            max={4}
            step={0.1}
            onDec={() => setUnderwaterFogCurve((v) => Math.max(0.2, +(v - 0.1).toFixed(2)))}
            onInc={() => setUnderwaterFogCurve((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.underwaterFogFeather")}
            mode="number"
            value={`${Math.round(underwaterFogFeather * 100)}%`}
            rawValue={underwaterFogFeather}
            onSet={(v) => setUnderwaterFogFeather(v)}
            min={0}
            max={0.3}
            step={0.01}
            onDec={() => setUnderwaterFogFeather((v) => Math.max(0, +(v - 0.01).toFixed(2)))}
            onInc={() => setUnderwaterFogFeather((v) => Math.min(0.3, +(v + 0.01).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.underwaterFogDistance")}
            mode="number"
            value={`${Math.round(underwaterFogDistance)} m`}
            rawValue={underwaterFogDistance}
            onSet={(v) => setUnderwaterFogDistance(v)}
            min={2}
            max={500}
            step={1}
            onDec={() => setUnderwaterFogDistance((v) => Math.max(2, +(v - 1).toFixed(2)))}
            onInc={() => setUnderwaterFogDistance((v) => Math.min(500, +(v + 1).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.underwaterFogOffset")}
            mode="number"
            value={`${Math.round(underwaterFogOffset * 100)}%`}
            rawValue={underwaterFogOffset}
            onSet={(v) => setUnderwaterFogOffset(v)}
            min={-0.5}
            max={0.5}
            step={0.01}
            onDec={() => setUnderwaterFogOffset((v) => Math.max(-0.5, +(v - 0.01).toFixed(2)))}
            onInc={() => setUnderwaterFogOffset((v) => Math.min(0.5, +(v + 0.01).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.underwaterFogSubmergedOnly")}
            value={onOff(underwaterFogSubmergedOnly)}
            onDec={() => setUnderwaterFogSubmergedOnly(false)}
            onInc={() => setUnderwaterFogSubmergedOnly(true)}
          />
          <SettingRow
            label={t("dial.env.underwaterFogBlend")}
            value={t(`dial.env.underwaterFogBlendValue.${underwaterFogBlend}`)}
            options={UNDERWATER_FOG_BLENDS.map((b) => t(`dial.env.underwaterFogBlendValue.${b}`))}
            selectedIndex={Math.max(0, UNDERWATER_FOG_BLENDS.indexOf(underwaterFogBlend))}
            onSelectIndex={(i) => setUnderwaterFogBlend(UNDERWATER_FOG_BLENDS[i])}
            onDec={() =>
              setUnderwaterFogBlend(
                (b) =>
                  UNDERWATER_FOG_BLENDS[
                    (Math.max(0, UNDERWATER_FOG_BLENDS.indexOf(b)) -
                      1 +
                      UNDERWATER_FOG_BLENDS.length) %
                      UNDERWATER_FOG_BLENDS.length
                  ],
              )
            }
            onInc={() =>
              setUnderwaterFogBlend(
                (b) =>
                  UNDERWATER_FOG_BLENDS[
                    (Math.max(0, UNDERWATER_FOG_BLENDS.indexOf(b)) + 1) %
                      UNDERWATER_FOG_BLENDS.length
                  ],
              )
            }
          />
        </>
      )}
    </>
  );
}
