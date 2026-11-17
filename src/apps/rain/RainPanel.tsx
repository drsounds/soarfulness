import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { limitMax, useExtremeLimits, type LimitedControl } from "@/lib/extremeLimits";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import { RAIN_COLORS, type RainSettings } from "./settings";

// Rain dials (moved out of components/SettingsPanel.tsx). Reads and writes
// the app's settings handle (`useAppSettings(RAIN_DEFAULTS, ...)` in routes/index.tsx).

export function RainPanel({ rain }: { rain: AppSettingsHandle<RainSettings> }) {
  const { t } = useTranslation();
  const [extremeLimits] = useExtremeLimits();
  const mx = (control: LimitedControl) => limitMax(control, extremeLimits);
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const {
    rainOn,
    rainAmount,
    rainIntensity,
    rainDropLength,
    rainDropSize,
    rainOpacity,
    rainColor,
    rainSplashesOn,
    rainSoundOn,
    rainVolume,
  } = rain.values;
  const {
    rainOn: setRainOn,
    rainAmount: setRainAmount,
    rainIntensity: setRainIntensity,
    rainDropLength: setRainDropLength,
    rainDropSize: setRainDropSize,
    rainOpacity: setRainOpacity,
    rainColor: setRainColor,
    rainSplashesOn: setRainSplashesOn,
    rainSoundOn: setRainSoundOn,
    rainVolume: setRainVolume,
  } = rain.setters;
  return (
    <>
      <SettingRow
        label={t("dial.env.rain")}
        value={onOff(rainOn)}
        onDec={() => setRainOn(false)}
        onInc={() => setRainOn(true)}
      />
      {rainOn && (
        <>
          <SettingRow
            label={t("dial.env.rainAmount")}
            mode="number"
            value={`${Math.round(rainAmount)}`}
            rawValue={rainAmount}
            onSet={(v) => setRainAmount(Math.max(0, Math.min(mx("rainAmount"), Math.round(v))))}
            min={0}
            max={mx("rainAmount")}
            step={500}
            onDec={() => setRainAmount((v) => Math.max(0, Math.round(v - 500)))}
            onInc={() => setRainAmount((v) => Math.min(mx("rainAmount"), Math.round(v + 500)))}
          />
          <SettingRow
            label={t("dial.env.rainIntensity")}
            mode="number"
            value={`${Math.round(rainIntensity * 100)}%`}
            rawValue={rainIntensity}
            onSet={(v) => setRainIntensity(Math.max(0, Math.min(mx("rainIntensity"), v)))}
            min={0}
            max={mx("rainIntensity")}
            step={0.05}
            onDec={() => setRainIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() =>
              setRainIntensity((v) => Math.min(mx("rainIntensity"), +(v + 0.05).toFixed(2)))
            }
          />
          <SettingRow
            label={t("dial.env.rainDropLength")}
            mode="number"
            value={`${Math.round(rainDropLength * 100)}%`}
            rawValue={rainDropLength}
            onSet={(v) => setRainDropLength(Math.max(0.1, Math.min(4, v)))}
            min={0.1}
            max={4}
            step={0.1}
            onDec={() => setRainDropLength((v) => Math.max(0.1, +(v - 0.1).toFixed(2)))}
            onInc={() => setRainDropLength((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.rainDropSize")}
            mode="number"
            value={`${Math.round(rainDropSize * 100)}%`}
            rawValue={rainDropSize}
            onSet={(v) => setRainDropSize(Math.max(0.1, Math.min(4, v)))}
            min={0.1}
            max={4}
            step={0.1}
            onDec={() => setRainDropSize((v) => Math.max(0.1, +(v - 0.1).toFixed(2)))}
            onInc={() => setRainDropSize((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.rainOpacity")}
            mode="number"
            value={`${Math.round(rainOpacity * 100)}%`}
            rawValue={rainOpacity}
            onSet={(v) => setRainOpacity(Math.max(0, Math.min(1, v)))}
            min={0}
            max={1}
            step={0.05}
            onDec={() => setRainOpacity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setRainOpacity((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.env.rainColor")}
            value={t(`dial.env.rainColorValue.${rainColor}`)}
            options={RAIN_COLORS.map((c) => t(`dial.env.rainColorValue.${c}`))}
            selectedIndex={Math.max(0, RAIN_COLORS.indexOf(rainColor))}
            onSelectIndex={(i) => setRainColor(RAIN_COLORS[i])}
            onDec={() =>
              setRainColor(
                (c) =>
                  RAIN_COLORS[
                    (Math.max(0, RAIN_COLORS.indexOf(c)) - 1 + RAIN_COLORS.length) %
                      RAIN_COLORS.length
                  ],
              )
            }
            onInc={() =>
              setRainColor(
                (c) => RAIN_COLORS[(Math.max(0, RAIN_COLORS.indexOf(c)) + 1) % RAIN_COLORS.length],
              )
            }
          />
          <SettingRow
            label={t("dial.env.rainSplashes")}
            value={onOff(rainSplashesOn)}
            onDec={() => setRainSplashesOn(false)}
            onInc={() => setRainSplashesOn(true)}
          />
          <SettingRow
            label={t("dial.env.rainSound")}
            value={onOff(rainSoundOn)}
            onDec={() => setRainSoundOn(false)}
            onInc={() => setRainSoundOn(true)}
          />
          {rainSoundOn && (
            <SettingRow
              label={t("dial.env.rainVolume")}
              mode="number"
              value={`${Math.round(rainVolume * 100)}%`}
              rawValue={rainVolume}
              onSet={(v) => setRainVolume(Math.max(0, Math.min(1, v)))}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setRainVolume((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setRainVolume((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
          )}
        </>
      )}
    </>
  );
}
