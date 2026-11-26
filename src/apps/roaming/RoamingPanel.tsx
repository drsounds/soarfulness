import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import { lastRoamingMotion, onRoamingMotion, roamingAvailable } from "./roamingBridge";
import type { RoamingMotionEvent } from "./RoamingMotion";
import type { RoamingSettings } from "./settings";

// ROAMING dials. Reads and writes the app's settings handle
// (`useAppSettings(ROAMING_DEFAULTS, ...)` in routes/index.tsx).

const step = (v: number, d: number, min: number, max: number) =>
  Math.min(max, Math.max(min, +(v + d).toFixed(2)));

export function RoamingPanel({ roaming }: { roaming: AppSettingsHandle<RoamingSettings> }) {
  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const { roamingOn, roamingStrength, roamingAccel, roamingGlide, roamingSideways } =
    roaming.values;
  const {
    roamingOn: setRoamingOn,
    roamingStrength: setRoamingStrength,
    roamingAccel: setRoamingAccel,
    roamingGlide: setRoamingGlide,
    roamingSideways: setRoamingSideways,
  } = roaming.setters;
  const available = roamingAvailable();
  const [last, setLast] = useState<RoamingMotionEvent | null>(() => lastRoamingMotion());
  useEffect(() => {
    if (!roamingOn) return;
    return onRoamingMotion(setLast);
  }, [roamingOn]);

  return (
    <>
      <SettingRow
        label={t("dial.roaming.on")}
        value={onOff(roamingOn)}
        onDec={() => setRoamingOn(false)}
        onInc={() => setRoamingOn(true)}
      />
      {roamingOn && (
        <>
          <p className="max-w-[16rem] self-center text-center text-[10px] font-light leading-snug ui-ink-faint">
            {!available
              ? t("dial.roaming.unavailable")
              : last
                ? t("dial.roaming.last", {
                    type: t(`dial.roaming.type.${last.motionType}`),
                    intensity: Math.round(last.intensity * 100),
                  })
                : t("dial.roaming.waiting")}
          </p>
          <SettingRow
            label={t("dial.roaming.strength")}
            mode="number"
            value={`${Math.round(roamingStrength * 100)}%`}
            rawValue={roamingStrength}
            onSet={(v) => setRoamingStrength(v)}
            min={0}
            max={3}
            step={0.05}
            onDec={() => setRoamingStrength((v) => step(v, -0.05, 0, 3))}
            onInc={() => setRoamingStrength((v) => step(v, 0.05, 0, 3))}
          />
          <SettingRow
            label={t("dial.roaming.accel")}
            mode="number"
            value={`${roamingAccel.toFixed(1)}s`}
            rawValue={roamingAccel}
            onSet={(v) => setRoamingAccel(v)}
            min={0.1}
            max={5}
            step={0.1}
            onDec={() => setRoamingAccel((v) => step(v, -0.1, 0.1, 5))}
            onInc={() => setRoamingAccel((v) => step(v, 0.1, 0.1, 5))}
          />
          <SettingRow
            label={t("dial.roaming.glide")}
            mode="number"
            value={`${roamingGlide.toFixed(1)}s`}
            rawValue={roamingGlide}
            onSet={(v) => setRoamingGlide(v)}
            min={0.1}
            max={10}
            step={0.1}
            onDec={() => setRoamingGlide((v) => step(v, -0.1, 0.1, 10))}
            onInc={() => setRoamingGlide((v) => step(v, 0.1, 0.1, 10))}
          />
          <SettingRow
            label={t("dial.roaming.sideways")}
            value={onOff(roamingSideways)}
            onDec={() => setRoamingSideways(false)}
            onInc={() => setRoamingSideways(true)}
          />
        </>
      )}
    </>
  );
}
