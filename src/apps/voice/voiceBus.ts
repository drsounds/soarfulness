import { useSyncExternalStore } from "react";
import type { VoiceMatch } from "./VoiceCommandRegistry";

// VOICE: the shared state between the recognizer (VoiceRuntime), the host's
// command handler (routes/index.tsx) and the UI (transcript, panel, debug
// window). A tiny external store, like the roaming bridge's event log.
//
// For testing without a microphone, phrases can be fed in by hand:
//   window.dispatchEvent(new CustomEvent("voice:text", { detail: "swing higher" }))

export const VOICE_DOM_EVENT = "voice:text";

export type VoiceStatus =
  | "off"
  | "starting"
  | "listening"
  | "unsupported"
  | "denied"
  | "error"
  /** No on-device recognizer for this language: voice refuses to use a cloud one. */
  | "nolocal"
  /** An on-device language pack exists but has to be downloaded first. */
  | "download";

export type VoiceLogEntry = {
  id: number;
  at: number;
  /** What the recognizer heard, most likely first. */
  alternatives: string[];
  source: "speech" | "typed";
  match: VoiceMatch | null;
};

export type VoiceState = {
  status: VoiceStatus;
  /** "web-speech" or "android". */
  engine: string | null;
  lang: string | null;
  error: string | null;
  /** The phrase being heard right now (not final yet). */
  interim: string;
  /** "stop listening": only "wake up" is acted on until then. */
  asleep: boolean;
  log: VoiceLogEntry[];
};

/** What can be said, for the debug window's command list. */
export type VoiceVocabulary = {
  commands: { id: string; phrases: string[] }[];
  settings: { key: string; label: string; kind: string; names: string[] }[];
};

/** Runs a heard phrase: returns the match it acted on (or null). */
export type VoiceHandler = (alternatives: string[]) => VoiceMatch | null;

const MAX_LOG = 60;
let state: VoiceState = {
  status: "off",
  engine: null,
  lang: null,
  error: null,
  interim: "",
  asleep: false,
  log: [],
};
let nextId = 1;
let handler: VoiceHandler | null = null;
let vocabulary: VoiceVocabulary = { commands: [], settings: [] };
const listeners = new Set<() => void>();

function emit(patch: Partial<VoiceState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const voiceBus = {
  get: (): VoiceState => state,
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setStatus(
    status: VoiceStatus,
    extra: Partial<Pick<VoiceState, "engine" | "lang" | "error">> = {},
  ) {
    emit({ status, ...extra });
  },
  setAsleep(asleep: boolean) {
    if (asleep !== state.asleep) emit({ asleep });
  },
  /** Bumped to make the runtime start the recognizer again (after a model download). */
  restartToken: 0,
  requestRestart() {
    this.restartToken++;
    emit({});
  },
  setInterim(interim: string) {
    if (interim !== state.interim) emit({ interim });
  },
  /** The host's command handler (set on every render, so it sees fresh state). */
  setHandler(h: VoiceHandler | null) {
    handler = h;
  },
  setVocabulary(v: VoiceVocabulary) {
    vocabulary = v;
  },
  vocabulary: (): VoiceVocabulary => vocabulary,
  /** A final phrase from the recognizer, or one typed in the debug window. */
  submit(alternatives: string[], source: VoiceLogEntry["source"] = "speech"): VoiceMatch | null {
    const alts = alternatives.map((a) => a.trim()).filter(Boolean);
    if (alts.length === 0) return null;
    let match: VoiceMatch | null = null;
    try {
      match = handler ? handler(alts) : null;
    } catch (e) {
      console.warn("[voice] command failed", e);
    }
    const entry: VoiceLogEntry = {
      id: nextId++,
      at: Date.now(),
      alternatives: alts,
      source,
      match,
    };
    emit({ interim: "", log: [entry, ...state.log].slice(0, MAX_LOG) });
    return match;
  },
  clearLog() {
    emit({ log: [] });
  },
};

if (typeof window !== "undefined") {
  window.addEventListener(VOICE_DOM_EVENT, (e) => {
    const detail = (e as CustomEvent<unknown>).detail;
    const alts = Array.isArray(detail) ? detail.map(String) : [String(detail ?? "")];
    voiceBus.submit(alts, "typed");
  });
}

export function useVoiceState(): VoiceState {
  return useSyncExternalStore(voiceBus.subscribe, voiceBus.get, voiceBus.get);
}
