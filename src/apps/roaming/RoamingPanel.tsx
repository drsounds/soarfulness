import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { Findable } from "@/components/settingsNav";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import {
  DEFAULT_ROAMING_GESTURE_MAP_CODE,
  ROAMING_ACTION_GROUPS,
  ROAMING_GESTURE_GROUPS,
  decodeGestureMap,
  gestureFor,
  setGestureAction,
  type RoamingAction,
} from "./gestures";
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
  const {
    roamingOn,
    roamingStrength,
    roamingAccel,
    roamingGlide,
    roamingSideways,
    roamingWalkSpeed,
    roamingRunSpeed,
    roamingLeanSpeed,
    roamingGestureMap,
    roamingRepeat,
    roamingWaveAmpStep,
    roamingWaveDirStep,
    roamingSwayStep,
    roamingSwayDirStep,
    roamingDebug,
  } = roaming.values;
  const s = roaming.setters;
  const {
    roamingOn: setRoamingOn,
    roamingStrength: setRoamingStrength,
    roamingAccel: setRoamingAccel,
    roamingGlide: setRoamingGlide,
    roamingSideways: setRoamingSideways,
    roamingDebug: setRoamingDebug,
  } = roaming.setters;
  const available = roamingAvailable();
  const [last, setLast] = useState<RoamingMotionEvent | null>(() => lastRoamingMotion());
  useEffect(() => {
    if (!roamingOn) return;
    return onRoamingMotion(setLast);
  }, [roamingOn]);
  const map = useMemo(() => decodeGestureMap(roamingGestureMap), [roamingGestureMap]);
  const liveGesture = last ? gestureFor(last) : null;
  const hint =
    "max-w-[16rem] self-center text-center text-[10px] font-light leading-snug ui-ink-faint";
  const btn =
    "pointer-events-auto rounded-full border px-2 py-0.5 text-[9px] tracking-wider ui-line-2 ui-press transition active:scale-95";
  /** A percent dial (share of ROAMING SPEED). */
  const pct = (
    label: string,
    v: number,
    set: (u: number | ((p: number) => number)) => void,
    max = 3,
  ) => (
    <SettingRow
      label={label}
      mode="number"
      value={`${Math.round(v * 100)}%`}
      rawValue={v}
      onSet={(x) => set(x)}
      min={0}
      max={max}
      step={0.05}
      onDec={() => set((p) => step(p, -0.05, 0, max))}
      onInc={() => set((p) => step(p, 0.05, 0, max))}
    />
  );

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
          {pct(t("dial.roaming.walkSpeed"), roamingWalkSpeed, s.roamingWalkSpeed)}
          {pct(t("dial.roaming.runSpeed"), roamingRunSpeed, s.roamingRunSpeed)}
          {roamingSideways &&
            pct(t("dial.roaming.leanSpeed"), roamingLeanSpeed, s.roamingLeanSpeed)}
          <p className={hint}>{t("dial.roaming.speedHint")}</p>

          <SettingRow
            label={t("dial.roaming.repeat")}
            mode="number"
            value={roamingRepeat > 0 ? `${roamingRepeat.toFixed(2)}s` : t("dial.roaming.once")}
            rawValue={roamingRepeat}
            onSet={(v) => s.roamingRepeat(Math.max(0, v))}
            min={0}
            max={5}
            step={0.05}
            onDec={() => s.roamingRepeat((v) => step(v, -0.05, 0, 5))}
            onInc={() => s.roamingRepeat((v) => step(v, 0.05, 0, 5))}
          />
          <SettingRow
            label={t("dial.roaming.waveAmpStep")}
            mode="number"
            value={`${roamingWaveAmpStep.toFixed(2)}m`}
            rawValue={roamingWaveAmpStep}
            onSet={(v) => s.roamingWaveAmpStep(Math.max(0, v))}
            min={0}
            max={5}
            step={0.05}
            onDec={() => s.roamingWaveAmpStep((v) => step(v, -0.05, 0, 5))}
            onInc={() => s.roamingWaveAmpStep((v) => step(v, 0.05, 0, 5))}
          />
          <SettingRow
            label={t("dial.roaming.waveDirStep")}
            mode="number"
            value={`${Math.round(roamingWaveDirStep)}°`}
            rawValue={roamingWaveDirStep}
            onSet={(v) => s.roamingWaveDirStep(Math.min(180, Math.max(0, v)))}
            min={0}
            max={180}
            step={1}
            onDec={() => s.roamingWaveDirStep((v) => step(v, -5, 0, 180))}
            onInc={() => s.roamingWaveDirStep((v) => step(v, 5, 0, 180))}
          />
          <SettingRow
            label={t("dial.roaming.swayStep")}
            mode="number"
            value={`${roamingSwayStep.toFixed(2)}m`}
            rawValue={roamingSwayStep}
            onSet={(v) => s.roamingSwayStep(Math.max(0, v))}
            min={0}
            max={5}
            step={0.05}
            onDec={() => s.roamingSwayStep((v) => step(v, -0.1, 0, 5))}
            onInc={() => s.roamingSwayStep((v) => step(v, 0.1, 0, 5))}
          />
          <SettingRow
            label={t("dial.roaming.swayDirStep")}
            mode="number"
            value={`${Math.round(roamingSwayDirStep)}°`}
            rawValue={roamingSwayDirStep}
            onSet={(v) => s.roamingSwayDirStep(Math.min(180, Math.max(0, v)))}
            min={0}
            max={180}
            step={1}
            onDec={() => s.roamingSwayDirStep((v) => step(v, -5, 0, 180))}
            onInc={() => s.roamingSwayDirStep((v) => step(v, 5, 0, 180))}
          />

          <Findable label={t("dial.roaming.mapping")}>
            <div className="flex w-full max-w-[22rem] flex-col gap-2 self-center pt-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[10px] tracking-[0.2em] ui-ink">
                  {t("dial.roaming.mapping")}
                </span>
                <button
                  type="button"
                  className={btn}
                  disabled={roamingGestureMap === DEFAULT_ROAMING_GESTURE_MAP_CODE}
                  onClick={() => s.roamingGestureMap(DEFAULT_ROAMING_GESTURE_MAP_CODE)}
                >
                  {t("dial.roaming.resetMapping")}
                </button>
              </div>
              <p className="text-[10px] font-light leading-snug ui-ink-faint">
                {t("dial.roaming.mappingHint")}
              </p>
              {ROAMING_GESTURE_GROUPS.map((g) => (
                <div key={g.id} className="flex flex-col gap-1">
                  <span className="text-[9px] tracking-[0.25em] ui-ink-muted">
                    {t(`dial.roaming.gestureGroup.${g.id}`)}
                  </span>
                  {g.gestures.map((gesture) => (
                    <label
                      key={gesture}
                      data-roaming-gesture={gesture}
                      className={`flex items-center gap-2 rounded-xl border px-2 py-1 ui-line-2 ${
                        liveGesture === gesture ? "ui-surface" : ""
                      }`}
                    >
                      <span className="min-w-[7rem] flex-1 text-[10px] ui-ink">
                        {liveGesture === gesture && "● "}
                        {t(`dial.roaming.gesture.${gesture.replace(":", "_")}`)}
                      </span>
                      <select
                        className="pointer-events-auto max-w-[11rem] rounded-full border bg-transparent px-2 py-0.5 text-[10px] ui-line-2 ui-ink"
                        value={map[gesture]}
                        onChange={(e) =>
                          s.roamingGestureMap((code) =>
                            setGestureAction(code, gesture, e.target.value as RoamingAction),
                          )
                        }
                      >
                        <option value="none">{t("dial.roaming.action.none")}</option>
                        {ROAMING_ACTION_GROUPS.map((ag) => (
                          <optgroup key={ag.id} label={t(`dial.roaming.actionGroup.${ag.id}`)}>
                            {ag.actions.map((a) => (
                              <option key={a} value={a}>
                                {t(`dial.roaming.action.${a}`)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </Findable>
        </>
      )}
      <SettingRow
        label={t("dial.roaming.debugWindow")}
        value={onOff(roamingDebug)}
        onDec={() => setRoamingDebug(false)}
        onInc={() => setRoamingDebug(true)}
      />
      <p className="max-w-[16rem] self-center pb-1 text-center text-[10px] font-light leading-snug ui-ink-faint">
        {t("dial.roaming.debugHint")}
      </p>
    </>
  );
}
