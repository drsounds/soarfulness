import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { Findable } from "@/components/settingsNav";
import {
  SKY_LOOK_DEFAULTS,
  SUN_TINT_COLOR_MODES,
  setSkyLook,
  useSkyLook,
  type SkyLook,
} from "@/lib/skyLook";

// HIMMELSLJUS settings. Self-contained: they read and write the sky-look
// store directly (lib/skyLook.ts), so the settings panel only mounts them.
//   part="tint"    — SOLTONING's color, strength, timing and spread
//   part="skybox"  — skybox rotation and the optional sun in the sky
//   part="light"   — how strongly the sun and sky light a loaded scene

type NumKey = {
  [K in keyof SkyLook]: SkyLook[K] extends number ? K : never;
}[keyof SkyLook];

const colorLabel =
  "flex items-center gap-2 rounded-full border ui-line-1 ui-surface py-1 pl-3 pr-1 backdrop-blur-md";
const colorInput = "h-7 w-9 cursor-pointer rounded-full border ui-line-2 bg-transparent p-0";

export function SkyLookSettings({ part }: { part: "tint" | "skybox" | "light" }) {
  const { t } = useTranslation();
  const look = useSkyLook();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));

  // Typed values are stored as-is (past the slider's range); only the
  // +/- buttons stay within min..max.
  const num = (
    key: NumKey,
    label: string,
    min: number,
    max: number,
    step: number,
    fmt: (v: number) => string,
  ) => (
    <SettingRow
      key={key}
      label={label}
      mode="number"
      value={fmt(look[key])}
      rawValue={look[key]}
      onSet={(v) => setSkyLook({ [key]: v })}
      min={min}
      max={max}
      step={step}
      onDec={() => setSkyLook({ [key]: Math.max(min, +(look[key] - step).toFixed(3)) })}
      onInc={() => setSkyLook({ [key]: Math.min(max, +(look[key] + step).toFixed(3)) })}
    />
  );
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const deg = (v: number) => `${Math.round(v * 10) / 10}°`;

  if (part === "tint") {
    const modes = SUN_TINT_COLOR_MODES;
    const mi = Math.max(0, modes.indexOf(look.tintColorMode));
    return (
      <>
        {num("tintStrength", t("skyLook.tintStrength"), 0, 3, 0.05, pct)}
        {num("tintWidth", t("skyLook.tintWidth"), 0.05, 1, 0.01, (v) =>
          pct(v / SKY_LOOK_DEFAULTS.tintWidth),
        )}
        {num("tintSpread", t("skyLook.tintSpread"), 0, 1, 0.05, pct)}
        <SettingRow
          label={t("skyLook.tintColorMode")}
          value={t(`skyLook.tintColorModeValue.${look.tintColorMode}`)}
          options={modes.map((m) => t(`skyLook.tintColorModeValue.${m}`))}
          selectedIndex={mi}
          onSelectIndex={(i) => setSkyLook({ tintColorMode: modes[i] })}
          onDec={() => setSkyLook({ tintColorMode: modes[(mi - 1 + modes.length) % modes.length] })}
          onInc={() => setSkyLook({ tintColorMode: modes[(mi + 1) % modes.length] })}
        />
        {look.tintColorMode === "custom" && (
          <Findable label={t("skyLook.tintColor")}>
            <label className={colorLabel}>
              <span className="text-[9px] font-light tracking-[0.28em] ui-ink-muted">
                {t("skyLook.tintColor")}
              </span>
              <input
                type="color"
                value={look.tintColor}
                onChange={(e) => setSkyLook({ tintColor: e.target.value })}
                className={colorInput}
              />
            </label>
          </Findable>
        )}
      </>
    );
  }

  if (part === "skybox") {
    return (
      <>
        {num("rotationDeg", t("skyLook.rotation"), -180, 180, 5, deg)}
        <SettingRow
          label={t("skyLook.sunDisc")}
          value={onOff(look.sunDiscOn)}
          onDec={() => setSkyLook({ sunDiscOn: false })}
          onInc={() => setSkyLook({ sunDiscOn: true })}
        />
        {look.sunDiscOn && (
          <>
            {num("sunDiscSize", t("skyLook.sunDiscSize"), 0.5, 15, 0.5, deg)}
            {num("sunDiscGlow", t("skyLook.sunDiscGlow"), 0, 2, 0.05, pct)}
          </>
        )}
      </>
    );
  }

  return (
    <>
      {num("sceneSunLight", t("skyLook.sceneSunLight"), 0, 3, 0.05, pct)}
      {num("sceneSkyLight", t("skyLook.sceneSkyLight"), 0, 3, 0.05, pct)}
    </>
  );
}
