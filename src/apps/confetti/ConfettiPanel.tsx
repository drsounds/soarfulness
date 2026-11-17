import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { limitMax, useExtremeLimits, type LimitedControl } from "@/lib/extremeLimits";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import { CONFETTI_PALETTES, type ConfettiSettings } from "./settings";

// Confetti dials (moved out of components/SettingsPanel.tsx). Reads and writes
// the app's settings handle (`useAppSettings(CONFETTI_DEFAULTS, ...)` in routes/index.tsx).

export function ConfettiPanel({ confetti }: { confetti: AppSettingsHandle<ConfettiSettings> }) {
  const { t } = useTranslation();
  const [extremeLimits] = useExtremeLimits();
  const mx = (control: LimitedControl) => limitMax(control, extremeLimits);
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const { confettiOn, confettiAmount, confettiIntensity, confettiPalette, confettiFlutter } =
    confetti.values;
  const {
    confettiOn: setConfettiOn,
    confettiAmount: setConfettiAmount,
    confettiIntensity: setConfettiIntensity,
    confettiPalette: setConfettiPalette,
    confettiFlutter: setConfettiFlutter,
  } = confetti.setters;
  return (
    <>
      <SettingRow
        label={t("dial.env.confetti")}
        value={onOff(confettiOn)}
        onDec={() => setConfettiOn(false)}
        onInc={() => setConfettiOn(true)}
      />
      {confettiOn && (
        <>
          <SettingRow
            label={t("dial.env.confettiAmount")}
            mode="number"
            value={`${Math.round(confettiAmount)}`}
            rawValue={confettiAmount}
            onSet={(v) => setConfettiAmount(Math.round(v))}
            min={0}
            max={mx("confettiAmount")}
            step={500}
            onDec={() => setConfettiAmount((v) => Math.max(0, Math.round(v - 500)))}
            onInc={() =>
              setConfettiAmount((v) => Math.min(mx("confettiAmount"), Math.round(v + 500)))
            }
          />
          <SettingRow
            label={t("dial.env.confettiIntensity")}
            mode="number"
            value={`${Math.round(confettiIntensity * 100)}%`}
            rawValue={confettiIntensity}
            onSet={(v) => setConfettiIntensity(v)}
            min={0}
            max={mx("confettiIntensity")}
            step={0.05}
            onDec={() => setConfettiIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() =>
              setConfettiIntensity((v) => Math.min(mx("confettiIntensity"), +(v + 0.05).toFixed(2)))
            }
          />
          <SettingRow
            label={t("dial.env.confettiPalette")}
            value={t(`dial.env.confettiPaletteValue.${confettiPalette}`)}
            options={CONFETTI_PALETTES.map((p) => t(`dial.env.confettiPaletteValue.${p}`))}
            selectedIndex={Math.max(0, CONFETTI_PALETTES.indexOf(confettiPalette))}
            onSelectIndex={(i) => setConfettiPalette(CONFETTI_PALETTES[i])}
            onDec={() =>
              setConfettiPalette(
                (p) =>
                  CONFETTI_PALETTES[
                    (Math.max(0, CONFETTI_PALETTES.indexOf(p)) - 1 + CONFETTI_PALETTES.length) %
                      CONFETTI_PALETTES.length
                  ],
              )
            }
            onInc={() =>
              setConfettiPalette(
                (p) =>
                  CONFETTI_PALETTES[
                    (Math.max(0, CONFETTI_PALETTES.indexOf(p)) + 1) % CONFETTI_PALETTES.length
                  ],
              )
            }
          />
          <SettingRow
            label={t("dial.env.confettiFlutter")}
            mode="number"
            value={`${Math.round(confettiFlutter * 100)}%`}
            rawValue={confettiFlutter}
            onSet={(v) => setConfettiFlutter(v)}
            min={0}
            max={2}
            step={0.05}
            onDec={() => setConfettiFlutter((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setConfettiFlutter((v) => Math.min(2, +(v + 0.05).toFixed(2)))}
          />
        </>
      )}
    </>
  );
}
