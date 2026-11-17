import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import { RETRO_PALETTES, type RetroPalette, type RetroSettings } from "./settings";

// Retro dials (moved out of components/SettingsPanel.tsx). Reads and writes
// the app's settings handle (`useAppSettings(RETRO_DEFAULTS, ...)` in routes/index.tsx).

export function RetroPanel({ retro }: { retro: AppSettingsHandle<RetroSettings> }) {
  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const { retroOn, retroPalette, retroPixelSize, retroDither, retroScanlines } = retro.values;
  const {
    retroOn: setRetroOn,
    retroPalette: setRetroPalette,
    retroPixelSize: setRetroPixelSize,
    retroDither: setRetroDither,
    retroScanlines: setRetroScanlines,
  } = retro.setters;
  return (
    <>
      <SettingRow
        label={t("dial.camera.retro")}
        value={onOff(retroOn)}
        onDec={() => setRetroOn(false)}
        onInc={() => setRetroOn(true)}
      />
      {retroOn && (
        <>
          <SettingRow
            label={t("dial.camera.retroPalette")}
            value={t(`dial.camera.retroPaletteValue.${retroPalette}`)}
            options={RETRO_PALETTES.map((m) => t(`dial.camera.retroPaletteValue.${m}`))}
            selectedIndex={Math.max(0, RETRO_PALETTES.indexOf(retroPalette))}
            onSelectIndex={(i) => setRetroPalette(RETRO_PALETTES[i] as RetroPalette)}
            onDec={() =>
              setRetroPalette(
                (m) =>
                  RETRO_PALETTES[
                    (RETRO_PALETTES.indexOf(m) - 1 + RETRO_PALETTES.length) % RETRO_PALETTES.length
                  ],
              )
            }
            onInc={() =>
              setRetroPalette(
                (m) => RETRO_PALETTES[(RETRO_PALETTES.indexOf(m) + 1) % RETRO_PALETTES.length],
              )
            }
          />
          <SettingRow
            label={t("dial.camera.retroPixelSize")}
            mode="number"
            value={`${retroPixelSize}px`}
            rawValue={retroPixelSize}
            onSet={(v) => setRetroPixelSize(Math.max(1, v))}
            min={1}
            max={8}
            step={1}
            onDec={() => setRetroPixelSize((v) => Math.max(1, +(v - 1).toFixed(0)))}
            onInc={() => setRetroPixelSize((v) => Math.min(8, +(v + 1).toFixed(0)))}
          />
          <SettingRow
            label={t("dial.camera.retroDither")}
            mode="number"
            value={`${Math.round(retroDither * 100)}%`}
            rawValue={retroDither}
            onSet={(v) => setRetroDither(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setRetroDither((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setRetroDither((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.camera.retroScanlines")}
            mode="number"
            value={`${Math.round(retroScanlines * 100)}%`}
            rawValue={retroScanlines}
            onSet={(v) => setRetroScanlines(v)}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setRetroScanlines((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setRetroScanlines((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
        </>
      )}
    </>
  );
}
