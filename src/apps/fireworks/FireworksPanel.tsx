import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { limitMax, useExtremeLimits, type LimitedControl } from "@/lib/extremeLimits";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import type { FireworksSettings } from "./settings";

// Fireworks dials (moved out of components/SettingsPanel.tsx). Reads and writes
// the app's settings handle (`useAppSettings(FIREWORKS_DEFAULTS, ...)` in routes/index.tsx).

export function FireworksPanel({ fireworks }: { fireworks: AppSettingsHandle<FireworksSettings> }) {
  const { t } = useTranslation();
  const [extremeLimits] = useExtremeLimits();
  const mx = (control: LimitedControl) => limitMax(control, extremeLimits);
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const {
    fireworksOn,
    fireworksIntensity,
    fireworksRate,
    fireworksDistance,
    fireworksLightsOn,
    fireworksLightStrength,
    fireworksSoundOn,
    fireworksVolume,
  } = fireworks.values;
  const {
    fireworksOn: setFireworksOn,
    fireworksIntensity: setFireworksIntensity,
    fireworksRate: setFireworksRate,
    fireworksDistance: setFireworksDistance,
    fireworksLightsOn: setFireworksLightsOn,
    fireworksLightStrength: setFireworksLightStrength,
    fireworksSoundOn: setFireworksSoundOn,
    fireworksVolume: setFireworksVolume,
  } = fireworks.setters;
  return (
    <>
      <SettingRow
        label={t("dial.env.fireworks")}
        value={onOff(fireworksOn)}
        onDec={() => setFireworksOn(false)}
        onInc={() => setFireworksOn(true)}
      />
      {fireworksOn && (
        <>
          <SettingRow
            label={t("dial.env.fireworksIntensity")}
            mode="number"
            value={`${Math.round(fireworksIntensity * 100)}%`}
            rawValue={fireworksIntensity}
            onSet={(v) => setFireworksIntensity(v)}
            min={0}
            max={mx("fireworksIntensity")}
            step={0.05}
            onDec={() => setFireworksIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() =>
              setFireworksIntensity((v) =>
                Math.min(mx("fireworksIntensity"), +(v + 0.05).toFixed(2)),
              )
            }
          />
          <SettingRow
            label={t("dial.env.fireworksRate")}
            mode="number"
            value={`${Math.round(fireworksRate)}`}
            rawValue={fireworksRate}
            onSet={(v) => setFireworksRate(Math.round(v))}
            min={1}
            max={mx("fireworksRate")}
            step={1}
            onDec={() => setFireworksRate((v) => Math.max(1, Math.round(v - 2)))}
            onInc={() => setFireworksRate((v) => Math.min(mx("fireworksRate"), Math.round(v + 2)))}
          />
          <SettingRow
            label={t("dial.env.fireworksDistance")}
            mode="number"
            value={`${Math.round(fireworksDistance)} m`}
            rawValue={fireworksDistance}
            onSet={(v) => setFireworksDistance(Math.round(v))}
            min={50}
            max={1500}
            step={25}
            onDec={() => setFireworksDistance((v) => Math.max(50, Math.round(v - 25)))}
            onInc={() => setFireworksDistance((v) => Math.min(1500, Math.round(v + 25)))}
          />
          <SettingRow
            label={t("dial.env.fireworksLights")}
            value={onOff(fireworksLightsOn)}
            onDec={() => setFireworksLightsOn(false)}
            onInc={() => setFireworksLightsOn(true)}
          />
          {fireworksLightsOn && (
            <SettingRow
              label={t("dial.env.fireworksLightStrength")}
              mode="number"
              value={`${Math.round(fireworksLightStrength * 100)}%`}
              rawValue={fireworksLightStrength}
              onSet={(v) => setFireworksLightStrength(v)}
              min={0}
              max={3}
              step={0.1}
              onDec={() => setFireworksLightStrength((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
              onInc={() => setFireworksLightStrength((v) => Math.min(3, +(v + 0.1).toFixed(2)))}
            />
          )}
          <SettingRow
            label={t("dial.env.fireworksSound")}
            value={onOff(fireworksSoundOn)}
            onDec={() => setFireworksSoundOn(false)}
            onInc={() => setFireworksSoundOn(true)}
          />
          {fireworksSoundOn && (
            <SettingRow
              label={t("dial.env.fireworksVolume")}
              mode="number"
              value={`${Math.round(fireworksVolume * 100)}%`}
              rawValue={fireworksVolume}
              onSet={(v) => setFireworksVolume(v)}
              min={0}
              max={1}
              step={0.05}
              onDec={() => setFireworksVolume((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
              onInc={() => setFireworksVolume((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
            />
          )}
        </>
      )}
    </>
  );
}
