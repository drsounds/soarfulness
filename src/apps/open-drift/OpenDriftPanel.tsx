import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { limitMax, useExtremeLimits, type LimitedControl } from "@/lib/extremeLimits";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import { OPEN_DRIFT_CURVES, OPEN_DRIFT_DIRECTIONS } from "./OpenDrift";
import type { OpenDriftSettings } from "./settings";

// OpenDrift dials (moved out of components/SettingsPanel.tsx). Reads and writes
// the app's settings handle (`useAppSettings(OPEN_DRIFT_DEFAULTS, ...)` in routes/index.tsx).

export function OpenDriftPanel({ openDrift }: { openDrift: AppSettingsHandle<OpenDriftSettings> }) {
  const { t } = useTranslation();
  const [extremeLimits] = useExtremeLimits();
  const mx = (control: LimitedControl) => limitMax(control, extremeLimits);
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const {
    openDriftOn,
    openDriftCurve,
    openDriftRadius,
    openDriftCycleSpeed,
    openDriftMagnitude,
    openDriftDirection,
  } = openDrift.values;
  const {
    openDriftOn: setOpenDriftOn,
    openDriftCurve: setOpenDriftCurve,
    openDriftRadius: setOpenDriftRadius,
    openDriftCycleSpeed: setOpenDriftCycleSpeed,
    openDriftMagnitude: setOpenDriftMagnitude,
    openDriftDirection: setOpenDriftDirection,
  } = openDrift.setters;
  return (
    <>
      <SettingRow
        label={t("dial.wave.openDrift")}
        value={onOff(openDriftOn)}
        onDec={() => setOpenDriftOn(false)}
        onInc={() => setOpenDriftOn(true)}
      />
      {openDriftOn && (
        <>
          <SettingRow
            label={t("dial.wave.openDriftCurve")}
            value={t(`dial.wave.openDriftCurveValue.${openDriftCurve}`)}
            options={OPEN_DRIFT_CURVES.map((c) => t(`dial.wave.openDriftCurveValue.${c}`))}
            selectedIndex={Math.max(0, OPEN_DRIFT_CURVES.indexOf(openDriftCurve))}
            onSelectIndex={(i) => setOpenDriftCurve(OPEN_DRIFT_CURVES[i])}
            onDec={() => setOpenDriftCurve((c) => (c === "circle" ? "wander" : "circle"))}
            onInc={() => setOpenDriftCurve((c) => (c === "circle" ? "wander" : "circle"))}
          />
          {openDriftCurve === "circle" && (
            <>
              <SettingRow
                label={t("dial.wave.openDriftRadius")}
                mode="number"
                value={`${openDriftRadius.toFixed(openDriftRadius < 10 ? 1 : 0)}m`}
                rawValue={openDriftRadius}
                onSet={(v) => setOpenDriftRadius(v)}
                min={1}
                max={mx("openDriftRadius")}
                step={1}
                onDec={() =>
                  setOpenDriftRadius((v) => Math.max(1, +(v - (v > 50 ? 10 : 1)).toFixed(1)))
                }
                onInc={() =>
                  setOpenDriftRadius((v) =>
                    Math.min(mx("openDriftRadius"), +(v + (v >= 50 ? 10 : 1)).toFixed(1)),
                  )
                }
              />
              <SettingRow
                label={t("dial.wave.openDriftDirection")}
                value={t(`dial.wave.openDriftDirectionValue.${openDriftDirection}`)}
                options={OPEN_DRIFT_DIRECTIONS.map((d) =>
                  t(`dial.wave.openDriftDirectionValue.${d}`),
                )}
                selectedIndex={Math.max(0, OPEN_DRIFT_DIRECTIONS.indexOf(openDriftDirection))}
                onSelectIndex={(i) => setOpenDriftDirection(OPEN_DRIFT_DIRECTIONS[i])}
                onDec={() => setOpenDriftDirection((d) => (d === "cw" ? "ccw" : "cw"))}
                onInc={() => setOpenDriftDirection((d) => (d === "cw" ? "ccw" : "cw"))}
              />
            </>
          )}
          <SettingRow
            label={t("dial.wave.openDriftCycleSpeed")}
            mode="number"
            value={`${openDriftCycleSpeed.toFixed(2)}/min`}
            rawValue={openDriftCycleSpeed}
            onSet={(v) => setOpenDriftCycleSpeed(v)}
            min={0}
            max={10}
            step={0.05}
            onDec={() => setOpenDriftCycleSpeed((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setOpenDriftCycleSpeed((v) => Math.min(10, +(v + 0.05).toFixed(2)))}
          />
          <SettingRow
            label={t("dial.wave.openDriftMagnitude")}
            mode="number"
            value={`${Math.round(openDriftMagnitude * 100)}%`}
            rawValue={openDriftMagnitude}
            onSet={(v) => setOpenDriftMagnitude(v)}
            min={0}
            max={mx("openDriftMagnitude")}
            step={0.05}
            onDec={() => setOpenDriftMagnitude((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() =>
              setOpenDriftMagnitude((v) =>
                Math.min(mx("openDriftMagnitude"), +(v + 0.05).toFixed(2)),
              )
            }
          />
        </>
      )}
    </>
  );
}
