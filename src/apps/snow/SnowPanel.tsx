import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { limitMax, useExtremeLimits } from "@/lib/extremeLimits";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import type { SnowSettings } from "./settings";

// SNÖ settings (MILJÖ tab): falling snow, and SNÖTÄCKE (snow cover) with its
// strength and the gray backdrop option. Reads and writes the app's settings
// handle (`useAppSettings(SNOW_DEFAULTS, ...)` in routes/index.tsx).

export function SnowPanel({ snow }: { snow: AppSettingsHandle<SnowSettings> }) {
  const { t } = useTranslation();
  const [extremeLimits] = useExtremeLimits();
  const mx = (control: "snowAmount" | "snowIntensity") => limitMax(control, extremeLimits);
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const { snowOn, snowAmount, snowIntensity, snowCoverOn, snowCoverStrength, snowGrayBackdropOn } =
    snow.values;
  const {
    snowOn: setSnowOn,
    snowAmount: setSnowAmount,
    snowIntensity: setSnowIntensity,
    snowCoverOn: setSnowCoverOn,
    snowCoverStrength: setSnowCoverStrength,
    snowGrayBackdropOn: setSnowGrayBackdropOn,
  } = snow.setters;
  return (
    <>
      <SettingRow
        label={t("dial.env.snow")}
        value={onOff(snowOn)}
        onDec={() => setSnowOn(false)}
        onInc={() => setSnowOn(true)}
      />
      {snowOn && (
        <>
          <SettingRow
            label={t("dial.env.snowAmount")}
            mode="number"
            value={`${Math.round(snowAmount)}`}
            rawValue={snowAmount}
            onSet={(v) => setSnowAmount(Math.max(0, Math.round(v)))}
            min={0}
            max={mx("snowAmount")}
            step={500}
            onDec={() => setSnowAmount((v) => Math.max(0, Math.round(v - 500)))}
            onInc={() => setSnowAmount((v) => Math.min(mx("snowAmount"), Math.round(v + 500)))}
          />
          <SettingRow
            label={t("dial.env.snowIntensity")}
            mode="number"
            value={`${Math.round(snowIntensity * 100)}%`}
            rawValue={snowIntensity}
            onSet={(v) => setSnowIntensity(v)}
            min={0}
            max={mx("snowIntensity")}
            step={0.05}
            onDec={() => setSnowIntensity((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() =>
              setSnowIntensity((v) => Math.min(mx("snowIntensity"), +(v + 0.05).toFixed(2)))
            }
          />
        </>
      )}
      <SettingRow
        label={t("dial.env.snowCover")}
        value={onOff(snowCoverOn)}
        onDec={() => setSnowCoverOn(false)}
        onInc={() => setSnowCoverOn(true)}
      />
      {snowCoverOn && (
        <SettingRow
          label={t("dial.env.snowGrayBackdrop")}
          value={onOff(snowGrayBackdropOn)}
          onDec={() => setSnowGrayBackdropOn(false)}
          onInc={() => setSnowGrayBackdropOn(true)}
        />
      )}
      {snowCoverOn && (
        <SettingRow
          label={t("dial.env.snowCoverStrength")}
          mode="number"
          value={`${Math.round(snowCoverStrength * 100)}%`}
          rawValue={snowCoverStrength}
          onSet={(v) => setSnowCoverStrength(v)}
          min={0}
          max={1}
          step={0.05}
          onDec={() => setSnowCoverStrength((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
          onInc={() => setSnowCoverStrength((v) => Math.min(1, +(v + 0.05).toFixed(2)))}
        />
      )}
    </>
  );
}
