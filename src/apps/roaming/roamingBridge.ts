import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { RoamingDirection, RoamingMotionEvent, RoamingMotionType } from "./RoamingMotion";

// The JS side of android/.../RoamingMotionPlugin.java: a BroadcastReceiver for
// the Roaming app's `se.spacify.app.roaming.event.MOTION` broadcasts, which it
// forwards to the WebView as "motion" events. The receiver is only registered
// while something here listens (ROAMING switched on) and the app is visible.
//
// Outside the Android app the plugin doesn't exist and nothing native runs.
// For testing in a browser, the same events can be fed in by hand:
//   window.dispatchEvent(new CustomEvent("roaming:motion", { detail:
//     { motion_type: "running", direction: "forward", intensity: 0.8 } }))

export const ROAMING_ACTION = "se.spacify.app.roaming.event.MOTION";
export const ROAMING_DOM_EVENT = "roaming:motion";

/** What the native plugin (or the DOM test event) delivers: Roaming's flat extras. */
export type RawRoamingMotion = {
  motion_type?: string;
  direction?: string;
  intensity?: number | string;
  source?: string;
};

interface RoamingMotionPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: "motion",
    listener: (event: RawRoamingMotion) => void,
  ): Promise<PluginListenerHandle>;
}

const RoamingMotionNative = registerPlugin<RoamingMotionPlugin>("RoamingMotion");

/** True inside the Android app, where Roaming's broadcasts can be received. */
export function roamingAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("RoamingMotion");
}

const TYPES: readonly RoamingMotionType[] = [
  "idle",
  "step",
  "walking",
  "running",
  "jumping",
  "squatting",
  "leaning",
  "arms_raised",
  "raising",
];
const DIRECTIONS: readonly RoamingDirection[] = [
  "none",
  "forward",
  "backward",
  "left",
  "right",
  "up",
  "down",
];

/** Normalizes one broadcast; unknown values fall back to idle / none / 0. */
export function parseRoamingMotion(raw: RawRoamingMotion | null | undefined): RoamingMotionEvent {
  const type = TYPES.find((t) => t === raw?.motion_type) ?? "idle";
  const direction = DIRECTIONS.find((d) => d === raw?.direction) ?? "none";
  const n = Number(raw?.intensity);
  return {
    motionType: type,
    direction,
    intensity: Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0,
    source: typeof raw?.source === "string" ? raw.source : undefined,
  };
}

type Listener = (e: RoamingMotionEvent) => void;
const listeners = new Set<Listener>();
let nativeHandle: Promise<PluginListenerHandle> | null = null;
let lastEvent: RoamingMotionEvent | null = null;

/** One received broadcast, for the debug window. */
export type RoamingLogEntry = {
  /** Running number, so a list can key on it. */
  seq: number;
  /** Date.now() when it reached the web app. */
  at: number;
  /** "native" = a real Roaming broadcast, "test" = a DOM test event. */
  via: "native" | "test";
  raw: RawRoamingMotion;
  parsed: RoamingMotionEvent;
  /** The raw motion_type / direction weren't known values (fell back to idle / none). */
  unknown: boolean;
};

/** How many events the log keeps. */
export const ROAMING_LOG_SIZE = 60;
const log: RoamingLogEntry[] = [];
let seq = 0;
const logListeners = new Set<() => void>();
/** Status of the native receiver, for the debug window. */
export type RoamingStatus = {
  available: boolean;
  listening: boolean;
  /** Last error from the native plugin's start(), if any. */
  error: string | null;
};
let status: RoamingStatus = { available: false, listening: false, error: null };

function setStatus(patch: Partial<RoamingStatus>) {
  status = { ...status, ...patch };
  for (const l of logListeners) l();
}

function dispatch(raw: RawRoamingMotion, via: RoamingLogEntry["via"]) {
  const e = parseRoamingMotion(raw);
  lastEvent = e;
  log.unshift({
    seq: ++seq,
    at: Date.now(),
    via,
    raw: { ...raw },
    parsed: e,
    unknown: e.motionType !== raw?.motion_type || e.direction !== (raw?.direction ?? "none"),
  });
  if (log.length > ROAMING_LOG_SIZE) log.length = ROAMING_LOG_SIZE;
  for (const l of listeners) l(e);
  for (const l of logListeners) l();
}

function onDomEvent(ev: Event) {
  dispatch((ev as CustomEvent<RawRoamingMotion>).detail ?? {}, "test");
}

function connect() {
  if (typeof window !== "undefined") window.addEventListener(ROAMING_DOM_EVENT, onDomEvent);
  const available = roamingAvailable();
  setStatus({ available, listening: available, error: null });
  if (!available) return;
  nativeHandle = RoamingMotionNative.addListener("motion", (raw) => dispatch(raw, "native"));
  RoamingMotionNative.start().catch((err: unknown) =>
    setStatus({ listening: false, error: err instanceof Error ? err.message : String(err) }),
  );
}

function disconnect() {
  if (typeof window !== "undefined") window.removeEventListener(ROAMING_DOM_EVENT, onDomEvent);
  const h = nativeHandle;
  nativeHandle = null;
  if (h) {
    void h.then((x) => x.remove()).catch(() => {});
    RoamingMotionNative.stop().catch(() => {});
  }
  setStatus({ listening: false });
}

/** Listen to Roaming's motion events. Returns the unsubscribe function. */
export function onRoamingMotion(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) connect();
  return () => {
    if (!listeners.delete(listener)) return;
    if (listeners.size === 0) disconnect();
  };
}

/** The most recent event received (any listener), or null. */
export function lastRoamingMotion(): RoamingMotionEvent | null {
  return lastEvent;
}

/** The received events, newest first (at most ROAMING_LOG_SIZE). */
export function roamingLog(): readonly RoamingLogEntry[] {
  return log;
}

export function clearRoamingLog() {
  log.length = 0;
  for (const l of logListeners) l();
}

export function roamingStatus(): RoamingStatus {
  return status;
}

/** Called after every logged event, clear or status change. Returns the unsubscribe. */
export function onRoamingLog(listener: () => void): () => void {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
}

/** Feeds a test event, as if Roaming had sent it (used by the debug window). */
export function sendRoamingTestEvent(raw: RawRoamingMotion) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(ROAMING_DOM_EVENT, { detail: raw }));
}
