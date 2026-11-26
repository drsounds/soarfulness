import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/SettingRow";
import { Findable } from "@/components/settingsNav";
import type { AppSettingsHandle } from "@/core/apps/useAppSettings";
import {
  DEFAULT_GAMEPAD_BINDINGS_CODE,
  GAMEPAD_ACTION_GROUPS,
  bindInput,
  bindingCode,
  bindingLabel,
  decodeBindings,
  encodeBindings,
  unbindInput,
  type GamepadAction,
} from "./bindings";
import {
  captureNextInput,
  gamepadApiAvailable,
  onPadsChanged,
  readPads,
  type PadInfo,
} from "./gamepadInput";
import type { GamepadSettings } from "./settings";

// GAMEPAD dials and the button mapping. Reads and writes the app's settings
// handle (`useAppSettings(GAMEPAD_DEFAULTS, ...)` in routes/index.tsx).

const step = (v: number, d: number, min: number, max: number) =>
  Math.min(max, Math.max(min, +(v + d).toFixed(2)));

/** Connected pads, refreshed on connect/disconnect and once a second. */
export function useConnectedPads(): PadInfo[] {
  const [pads, setPads] = useState<PadInfo[]>(() => readPads());
  useEffect(() => {
    const off = onPadsChanged(setPads);
    const id = window.setInterval(() => {
      const next = readPads();
      setPads((prev) =>
        prev.map((p) => p.id).join("|") === next.map((p) => p.id).join("|") ? prev : next,
      );
    }, 1000);
    return () => {
      off();
      window.clearInterval(id);
    };
  }, []);
  return pads;
}

export function GamepadPanel({ gamepad }: { gamepad: AppSettingsHandle<GamepadSettings> }) {
  const { t } = useTranslation();
  const onOff = (v: boolean) => (v ? t("common.on") : t("common.off"));
  const {
    gamepadOn,
    gamepadDeadZone,
    gamepadMoveSensitivity,
    gamepadLookSensitivity,
    gamepadInvertLookY,
    gamepadBoost,
    gamepadBindings,
    gamepadDebug,
  } = gamepad.values;
  const s = gamepad.setters;
  const pads = useConnectedPads();
  const bindings = useMemo(() => decodeBindings(gamepadBindings), [gamepadBindings]);
  const [capturing, setCapturing] = useState<GamepadAction | null>(null);

  // Wait for the next button / stick push while an action is capturing.
  useEffect(() => {
    if (!capturing) return;
    const cancel = captureNextInput((binding) => {
      s.gamepadBindings((code) =>
        encodeBindings(bindInput(decodeBindings(code), capturing, binding)),
      );
      setCapturing(null);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setCapturing(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancel();
      window.removeEventListener("keydown", onKey, true);
    };
  }, [capturing, s]);

  const btn =
    "pointer-events-auto rounded-full border px-2 py-0.5 text-[9px] tracking-wider ui-line-2 ui-press transition active:scale-95";
  const hint =
    "max-w-[16rem] self-center text-center text-[10px] font-light leading-snug ui-ink-faint";
  const isDefault = gamepadBindings === DEFAULT_GAMEPAD_BINDINGS_CODE;

  return (
    <>
      <SettingRow
        label={t("dial.gamepad.on")}
        value={onOff(gamepadOn)}
        onDec={() => s.gamepadOn(false)}
        onInc={() => s.gamepadOn(true)}
      />
      {gamepadOn && (
        <>
          <p className={hint}>
            {!gamepadApiAvailable()
              ? t("dial.gamepad.unavailable")
              : pads.length === 0
                ? t("dial.gamepad.waiting")
                : pads.map((p) => (
                    <span key={p.index} className="block">
                      🎮 {p.id}
                      {p.mapping !== "standard" && ` · ${t("dial.gamepad.nonStandard")}`}
                    </span>
                  ))}
          </p>
          <SettingRow
            label={t("dial.gamepad.deadZone")}
            mode="number"
            value={`${Math.round(gamepadDeadZone * 100)}%`}
            rawValue={gamepadDeadZone}
            onSet={(v) => s.gamepadDeadZone(Math.min(0.9, Math.max(0, v)))}
            min={0}
            max={0.9}
            step={0.01}
            onDec={() => s.gamepadDeadZone((v) => step(v, -0.01, 0, 0.9))}
            onInc={() => s.gamepadDeadZone((v) => step(v, 0.01, 0, 0.9))}
          />
          <SettingRow
            label={t("dial.gamepad.moveSensitivity")}
            mode="number"
            value={`${Math.round(gamepadMoveSensitivity * 100)}%`}
            rawValue={gamepadMoveSensitivity}
            onSet={(v) => s.gamepadMoveSensitivity(v)}
            min={0.1}
            max={3}
            step={0.05}
            onDec={() => s.gamepadMoveSensitivity((v) => step(v, -0.05, 0.1, 3))}
            onInc={() => s.gamepadMoveSensitivity((v) => step(v, 0.05, 0.1, 3))}
          />
          <SettingRow
            label={t("dial.gamepad.lookSensitivity")}
            mode="number"
            value={`${Math.round(gamepadLookSensitivity * 100)}%`}
            rawValue={gamepadLookSensitivity}
            onSet={(v) => s.gamepadLookSensitivity(v)}
            min={0.1}
            max={3}
            step={0.05}
            onDec={() => s.gamepadLookSensitivity((v) => step(v, -0.05, 0.1, 3))}
            onInc={() => s.gamepadLookSensitivity((v) => step(v, 0.05, 0.1, 3))}
          />
          <SettingRow
            label={t("dial.gamepad.invertLookY")}
            value={onOff(gamepadInvertLookY)}
            onDec={() => s.gamepadInvertLookY(false)}
            onInc={() => s.gamepadInvertLookY(true)}
          />
          <SettingRow
            label={t("dial.gamepad.boost")}
            mode="number"
            value={`×${gamepadBoost.toFixed(1)}`}
            rawValue={gamepadBoost}
            onSet={(v) => s.gamepadBoost(v)}
            min={1}
            max={5}
            step={0.1}
            onDec={() => s.gamepadBoost((v) => step(v, -0.1, 1, 5))}
            onInc={() => s.gamepadBoost((v) => step(v, 0.1, 1, 5))}
          />

          <Findable label={t("dial.gamepad.mapping")}>
            <div className="flex w-full max-w-[22rem] flex-col gap-2 self-center pt-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[10px] tracking-[0.2em] ui-ink">
                  {t("dial.gamepad.mapping")}
                </span>
                <button
                  type="button"
                  className={btn}
                  disabled={isDefault}
                  onClick={() => {
                    setCapturing(null);
                    s.gamepadBindings(DEFAULT_GAMEPAD_BINDINGS_CODE);
                  }}
                >
                  {t("dial.gamepad.resetMapping")}
                </button>
              </div>
              <p className="text-[10px] font-light leading-snug ui-ink-faint">
                {t("dial.gamepad.mappingHint")}
              </p>
              {GAMEPAD_ACTION_GROUPS.map((g) => (
                <div key={g.id} className="flex flex-col gap-1">
                  <span className="text-[9px] tracking-[0.25em] ui-ink-muted">
                    {t(`dial.gamepad.group.${g.id}`)}
                  </span>
                  {g.actions.map((act) => (
                    <div
                      key={act}
                      className="flex flex-wrap items-center gap-1 rounded-xl border px-2 py-1 ui-line-2"
                      data-gamepad-action={act}
                    >
                      <span className="min-w-[7rem] flex-1 text-[10px] ui-ink">
                        {t(`dial.gamepad.action.${act}`)}
                      </span>
                      {capturing === act ? (
                        <>
                          <span className="animate-pulse text-[10px] ui-ink">
                            {t("dial.gamepad.pressNow")}
                          </span>
                          <button type="button" className={btn} onClick={() => setCapturing(null)}>
                            {t("dial.gamepad.cancel")}
                          </button>
                        </>
                      ) : (
                        <>
                          {bindings[act].length === 0 && (
                            <span className="text-[10px] ui-ink-faint">
                              {t("dial.gamepad.unbound")}
                            </span>
                          )}
                          {bindings[act].map((b) => (
                            <span
                              key={bindingCode(b)}
                              className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] ui-line-2 ui-surface ui-ink"
                            >
                              {bindingLabel(b)}
                              <button
                                type="button"
                                aria-label={t("dial.gamepad.remove", { input: bindingLabel(b) })}
                                className="ui-ink-muted"
                                onClick={() =>
                                  s.gamepadBindings((code) =>
                                    encodeBindings(unbindInput(decodeBindings(code), act, b)),
                                  )
                                }
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            className={btn}
                            disabled={pads.length === 0}
                            title={pads.length === 0 ? t("dial.gamepad.waiting") : undefined}
                            onClick={() => setCapturing(act)}
                          >
                            {t("dial.gamepad.bind")}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Findable>
        </>
      )}
      <SettingRow
        label={t("dial.gamepad.debugWindow")}
        value={onOff(gamepadDebug)}
        onDec={() => s.gamepadDebug(false)}
        onInc={() => s.gamepadDebug(true)}
      />
      <p className={`${hint} pb-1`}>{t("dial.gamepad.debugHint")}</p>
    </>
  );
}
