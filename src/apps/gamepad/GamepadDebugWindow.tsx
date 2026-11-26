import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GAMEPAD_ACTIONS, bindingLabel } from "./bindings";
import { readPads, type PadInfo } from "./gamepadInput";
import { IDLE_GAMEPAD_FRAME, buttonValue, type GamepadFrame } from "./GamepadMapper";
import { currentGamepadRuntime } from "./GamepadRuntime";

// GAMEPAD debug window: a small floating panel with every connected pad's
// raw axes and buttons and what the mapping makes of them (action values,
// the NAV/LOOK/HÖJD it feeds), so you can see which index a button has and
// whether the dead zone eats a worn stick. Opened with GAMEPAD → DEBUG
// WINDOW.

type Live = { pads: PadInfo[]; frame: GamepadFrame; suppressed: boolean; running: boolean };

function useLive(): Live {
  const [live, setLive] = useState<Live>({
    pads: [],
    frame: IDLE_GAMEPAD_FRAME,
    suppressed: false,
    running: false,
  });
  useEffect(() => {
    const tick = () => {
      const rt = currentGamepadRuntime();
      // The runtime only reads pads while the app is on; show the raw pads anyway.
      const pads = rt && rt.lastPads.length > 0 ? rt.lastPads : readPads();
      setLive({
        pads,
        frame: rt?.lastFrame ?? IDLE_GAMEPAD_FRAME,
        suppressed: rt?.suppressed ?? false,
        running: !!rt,
      });
    };
    tick();
    const id = window.setInterval(tick, 66);
    return () => window.clearInterval(id);
  }, []);
  return live;
}

const f2 = (v: number) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));

function AxisBar({ value }: { value: number }) {
  const v = Math.max(-1, Math.min(1, value));
  return (
    <span className="relative inline-block h-2 w-16 overflow-hidden rounded-full bg-white/10 align-middle">
      <span
        className="absolute top-0 h-full bg-sky-300/80"
        style={
          v >= 0 ? { left: "50%", width: `${v * 50}%` } : { right: "50%", width: `${-v * 50}%` }
        }
      />
      <span className="absolute left-1/2 top-0 h-full w-px bg-white/40" />
    </span>
  );
}

export function GamepadDebugWindow({
  appEnabled,
  onClose,
}: {
  appEnabled: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const { pads, frame, suppressed, running } = useLive();
  // Opened from a saved setting, so the server render (no localStorage)
  // never has it: show it only after hydration to keep the markup in step.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const yesNo = (v: boolean) => (v ? t("dial.gamepad.debug.yes") : t("dial.gamepad.debug.no"));
  const btn =
    "rounded-full border px-2 py-0.5 text-[9px] tracking-wider ui-line-2 ui-press active:scale-95";

  return (
    <div
      role="log"
      aria-label={t("dial.gamepad.debug.title")}
      className="pointer-events-auto fixed left-2 top-24 z-[60] flex max-h-[70vh] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border font-mono text-[10px] leading-snug bg-black/55 backdrop-blur-md ui-line-2 ui-surface ui-ink"
    >
      <div className="flex items-center gap-2 border-b px-3 py-1.5 ui-line-2">
        <span className="flex-1 font-sans text-[10px] tracking-[0.2em]">
          {t("dial.gamepad.debug.title")}
        </span>
        <button type="button" className={btn} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "+" : "–"}
        </button>
        <button type="button" className={btn} aria-label={t("common.close")} onClick={onClose}>
          ×
        </button>
      </div>
      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-0.5 border-b px-3 py-1.5 ui-line-2">
            <div>
              {t("dial.gamepad.debug.app")}: {yesNo(appEnabled)} · {t("dial.gamepad.debug.scene")}:{" "}
              {yesNo(running)} · {t("dial.gamepad.debug.pads")}: {pads.length}
              {suppressed && ` · ${t("dial.gamepad.debug.capturing")}`}
            </div>
            <div>
              NAV →{f2(frame.move.x)} ↑{f2(frame.move.y)}
              {frame.boost && " BOOST"} · LOOK →{f2(frame.look.x)} ↑{f2(frame.look.y)} · ↕
              {f2(frame.rise)}
            </div>
          </div>
          {pads.length === 0 && (
            <div className="px-3 py-1.5 ui-ink-muted">{t("dial.gamepad.waiting")}</div>
          )}
          {pads.map((p) => (
            <div key={p.index} className="space-y-1 border-b px-3 py-1.5 ui-line-2">
              <div className="break-all">
                #{p.index} {p.id} <span className="ui-ink-muted">({p.mapping || "—"})</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {p.axes.map((v, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="w-5 ui-ink-muted">a{i}</span>
                    <AxisBar value={v} />
                    <span className="w-9 text-right">{f2(v)}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-0.5">
                {p.buttons.map((b, i) => {
                  const v = buttonValue(b);
                  return (
                    <span
                      key={i}
                      title={bindingLabel({ kind: "button", index: i })}
                      className={`rounded border px-1 ui-line-2 ${v > 0 ? "bg-sky-300/70 text-black" : "ui-ink-muted"}`}
                    >
                      b{i}
                      {v > 0 && v < 1 ? ` ${v.toFixed(1)}` : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-x-3 px-3 py-1.5">
            {GAMEPAD_ACTIONS.map((act) => (
              <div key={act} className={frame.values[act] > 0 ? "" : "ui-ink-muted"}>
                {t(`dial.gamepad.action.${act}`)} {f2(frame.values[act])}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
