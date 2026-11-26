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

function dispatch(raw: RawRoamingMotion) {
  const e = parseRoamingMotion(raw);
  lastEvent = e;
  for (const l of listeners) l(e);
}

function onDomEvent(ev: Event) {
  dispatch((ev as CustomEvent<RawRoamingMotion>).detail);
}

function connect() {
  if (typeof window !== "undefined") window.addEventListener(ROAMING_DOM_EVENT, onDomEvent);
  if (!roamingAvailable()) return;
  nativeHandle = RoamingMotionNative.addListener("motion", dispatch);
  RoamingMotionNative.start().catch(() => {});
}

function disconnect() {
  if (typeof window !== "undefined") window.removeEventListener(ROAMING_DOM_EVENT, onDomEvent);
  const h = nativeHandle;
  nativeHandle = null;
  if (h) {
    void h.then((x) => x.remove()).catch(() => {});
    RoamingMotionNative.stop().catch(() => {});
  }
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
