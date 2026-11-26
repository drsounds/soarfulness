import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  clearRoamingLog,
  onRoamingLog,
  onRoamingMotion,
  roamingLog,
  roamingStatus,
  sendRoamingTestEvent,
  type RawRoamingMotion,
} from "./roamingBridge";
import { targetFor } from "./RoamingMotion";
import { currentRoamingRuntime } from "./RoamingRuntime";

// ROAMING debug window: a small floating panel that lists every motion event
// the web app receives (raw extras, how it was parsed, the target it set) and
// the live state of the motion physics, so you can trace whether a broadcast
// from the Roaming app arrives and is handled. Opened with ROAMING → DEBUG
// WINDOW. While it's open it keeps the receiver registered, even with ROAMING
// itself off, so you can see events arrive before letting them move you.

type Live = {
  fwd: number;
  right: number;
  speed: number;
  targetFwd: number;
  targetRight: number;
  sinceEvent: number;
  on: boolean;
  allowed: boolean;
  maxSpeed: number;
};

const TESTS: { label: string; raw: RawRoamingMotion }[] = [
  { label: "WALK", raw: { motion_type: "walking", direction: "forward", intensity: 0.5 } },
  { label: "RUN", raw: { motion_type: "running", direction: "forward", intensity: 0.9 } },
  { label: "LEAN ←", raw: { motion_type: "leaning", direction: "left", intensity: 0.8 } },
  { label: "IDLE", raw: { motion_type: "idle", direction: "none", intensity: 0 } },
];

function time(at: number) {
  const d = new Date(at);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

const f2 = (v: number) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));

function useRoamingLog() {
  // The log array is mutated in place, so the snapshot is a version counter.
  const [, setVersion] = useState(0);
  useEffect(() => onRoamingLog(() => setVersion((v) => v + 1)), []);
  return { entries: roamingLog(), status: roamingStatus() };
}

/** The motion physics' live state, polled 10 times a second. */
function useLive(): Live | null {
  const [live, setLive] = useState<Live | null>(null);
  useEffect(() => {
    const tick = () => {
      const rt = currentRoamingRuntime();
      if (!rt) return setLive(null);
      const { motion: m, lastStep: s } = rt;
      setLive({
        fwd: m.vel.z,
        right: m.vel.x,
        speed: m.speed,
        targetFwd: m.target.z * s.maxSpeed,
        targetRight: m.target.x * s.maxSpeed,
        sinceEvent: Math.min(99, m.sinceEvent),
        on: s.on,
        allowed: s.allowed,
        maxSpeed: s.maxSpeed,
      });
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, []);
  return live;
}

export function RoamingDebugWindow({
  appEnabled,
  sideways,
  onClose,
}: {
  appEnabled: boolean;
  sideways: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const { entries, status } = useRoamingLog();
  const live = useLive();
  // Keep the receiver registered while the window is open.
  useEffect(() => onRoamingMotion(() => {}), []);

  const yesNo = (v: boolean) => (v ? t("dial.roaming.debug.yes") : t("dial.roaming.debug.no"));
  const btn =
    "rounded-full border px-2 py-0.5 text-[9px] tracking-wider ui-line-2 ui-press active:scale-95";

  return (
    <div
      role="log"
      aria-label={t("dial.roaming.debug.title")}
      className="pointer-events-auto fixed left-2 top-24 z-[60] flex max-h-[60vh] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border font-mono text-[10px] leading-snug bg-black/55 backdrop-blur-md ui-line-2 ui-surface ui-ink"
    >
      <div className="flex items-center gap-2 border-b px-3 py-1.5 ui-line-2">
        <span className="flex-1 font-sans text-[10px] tracking-[0.2em]">
          {t("dial.roaming.debug.title")}
        </span>
        <button type="button" className={btn} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "+" : "–"}
        </button>
        <button type="button" className={btn} aria-label={t("common.close")} onClick={onClose}>
          ×
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="space-y-0.5 border-b px-3 py-1.5 ui-line-2">
            <div>
              {t("dial.roaming.debug.plugin")}: {yesNo(status.available)} ·{" "}
              {t("dial.roaming.debug.listening")}: {yesNo(status.listening)} ·{" "}
              {t("dial.roaming.debug.app")}: {yesNo(appEnabled)}
            </div>
            {status.error && <div className="text-amber-400/90">{status.error}</div>}
            {live ? (
              <>
                <div>
                  ROAMING: {yesNo(live.on)}
                  {!live.allowed && ` · ${t("dial.roaming.debug.held")}`} ·{" "}
                  {t("dial.roaming.debug.top")} {f2(live.maxSpeed)} m/s
                </div>
                <div>
                  {t("dial.roaming.debug.target")} ↑{f2(live.targetFwd)} →{f2(live.targetRight)} ·{" "}
                  {t("dial.roaming.debug.velocity")} ↑{f2(live.fwd)} →{f2(live.right)} (
                  {f2(live.speed)} m/s)
                </div>
                <div className="ui-ink-muted">
                  {t("dial.roaming.debug.since", {
                    s: live.sinceEvent >= 99 ? "—" : live.sinceEvent.toFixed(1),
                  })}
                </div>
              </>
            ) : (
              <div className="ui-ink-muted">{t("dial.roaming.debug.noScene")}</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 border-b px-3 py-1.5 ui-line-2">
            <span className="ui-ink-muted">{t("dial.roaming.debug.test")}</span>
            {TESTS.map((x) => (
              <button
                key={x.label}
                type="button"
                className={btn}
                onClick={() => sendRoamingTestEvent(x.raw)}
              >
                {x.label}
              </button>
            ))}
            <button type="button" className={`${btn} ml-auto`} onClick={clearRoamingLog}>
              {t("dial.roaming.debug.clear")}
            </button>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
            {entries.length === 0 && (
              <li className="py-1 ui-ink-muted">{t("dial.roaming.debug.empty")}</li>
            )}
            {entries.map((e) => {
              const tg = targetFor(e.parsed, sideways);
              return (
                <li key={e.seq} className="border-b border-white/5 py-0.5 last:border-0">
                  <span className="ui-ink-muted">{time(e.at)}</span>{" "}
                  <span className={e.via === "test" ? "text-sky-300/90" : ""}>
                    {e.via === "test" ? "TEST" : (e.raw.source ?? "native")}
                  </span>{" "}
                  <b>{e.raw.motion_type ?? "?"}</b> {e.raw.direction ?? "?"}{" "}
                  {Number(e.raw.intensity ?? 0).toFixed(2)}
                  {e.unknown && (
                    <span className="text-amber-400/90">
                      {" "}
                      ⚠ {e.parsed.motionType}/{e.parsed.direction}
                    </span>
                  )}
                  <span className="ui-ink-muted">
                    {" "}
                    → ↑{f2(tg.z)} →{f2(tg.x)}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
