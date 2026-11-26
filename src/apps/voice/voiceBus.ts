import { useSyncExternalStore } from "react";
import type { VoiceMatch } from "./VoiceCommandRegistry";
import { isNewEffect, type VoiceTiming } from "./utterance";

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
  /** Speech only: when it was heard, acted on and finished (utterance.ts). */
  timing?: VoiceTiming;
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

/**
 * The host's side: match() finds the command for a phrase without doing
 * anything (it runs on partial results too), run() does what it says.
 */
export type VoiceHandler = {
  match(alternatives: string[]): VoiceMatch | null;
  run(match: VoiceMatch): void;
};

/** Default VOICE → ACT EARLY: how long partial words must stay the same. */
export const DEFAULT_EARLY_MS = 400;

/** The phrase being heard right now (see utterance.ts). */
type Utterance = {
  spokeAt: number;
  quietAt: number;
  endAt: number | null;
  text: string;
  fired: VoiceMatch[];
  /** Log entry of the last early run, which the final result then updates. */
  entryId: number | null;
  timer: ReturnType<typeof setTimeout> | null;
};

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
let earlyMs = DEFAULT_EARLY_MS;
let utt: Utterance | null = null;
const listeners = new Set<() => void>();

function emit(patch: Partial<VoiceState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function newUtterance(now: number): Utterance {
  return {
    spokeAt: now,
    quietAt: now,
    endAt: null,
    text: "",
    fired: [],
    entryId: null,
    timer: null,
  };
}

function dropUtterance() {
  if (utt?.timer) clearTimeout(utt.timer);
  utt = null;
}

/** handler.match, timed, never throwing. */
function matchTimed(alts: string[]): { match: VoiceMatch | null; ms: number } {
  const t0 = performance.now();
  let match: VoiceMatch | null = null;
  try {
    match = handler ? handler.match(alts) : null;
  } catch (e) {
    console.warn("[voice] matching failed", e);
  }
  return { match, ms: performance.now() - t0 };
}

function runSafe(match: VoiceMatch): boolean {
  try {
    handler?.run(match);
    return true;
  } catch (e) {
    console.warn("[voice] command failed", e);
    return false;
  }
}

function addEntry(entry: Omit<VoiceLogEntry, "id">): number {
  const id = nextId++;
  emit({ interim: "", log: [{ id, ...entry }, ...state.log].slice(0, MAX_LOG) });
  return id;
}

function updateEntry(id: number, patch: (e: VoiceLogEntry) => VoiceLogEntry) {
  emit({ interim: "", log: state.log.map((e) => (e.id === id ? patch(e) : e)) });
}

/** The partial words have not changed for earlyMs: act on them now. */
function actEarly(u: Utterance) {
  u.timer = null;
  if (u !== utt || !u.text) return;
  const { match, ms } = matchTimed([u.text]);
  if (!match || !isNewEffect(match, u.fired)) return;
  if (!runSafe(match)) return;
  u.fired.push(match);
  const now = Date.now();
  u.entryId = addEntry({
    at: now,
    alternatives: [u.text],
    source: "speech",
    match,
    timing: {
      spokeAt: u.spokeAt,
      quietAt: u.quietAt,
      endAt: u.endAt,
      firedAt: now,
      finalAt: null,
      early: true,
      matchMs: ms,
    },
  });
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
  /** VOICE → ACT EARLY in ms; 0 waits for the recognizer's final result. */
  setEarlyMs(ms: number) {
    earlyMs = Math.max(0, ms);
  },
  earlyMs: (): number => earlyMs,
  /** The recognizer's partial result: the words heard so far in this phrase. */
  partial(text: string, now = Date.now()) {
    const words = text.trim();
    if (!words) {
      this.setInterim("");
      return;
    }
    if (!utt) utt = newUtterance(now);
    // Recognizers repeat the same partial: only a change restarts the wait.
    if (words === utt.text) return;
    utt.text = words;
    utt.quietAt = now;
    this.setInterim(text);
    if (utt.timer) clearTimeout(utt.timer);
    utt.timer = null;
    if (earlyMs > 0) {
      const u = utt;
      u.timer = setTimeout(() => actEarly(u), earlyMs);
    }
  },
  /** The recognizer heard speech begin / end (Android, Web Speech). */
  speech(phase: "begin" | "end", now = Date.now()) {
    if (phase === "begin") {
      if (!utt) utt = newUtterance(now);
    } else if (utt) {
      utt.endAt = now;
    }
  },
  /** A new recognizer session: whatever was half heard is gone. */
  newSession() {
    dropUtterance();
  },
  /**
   * The recognizer's final result for the phrase. Runs it unless an early
   * run of this phrase already did the same (utterance.ts).
   */
  final(alternatives: string[], now = Date.now()): VoiceMatch | null {
    const u = utt ?? newUtterance(now);
    if (u.timer) clearTimeout(u.timer);
    utt = null;
    const alts = alternatives.map((a) => a.trim()).filter(Boolean);
    if (alts.length === 0) {
      this.setInterim("");
      return null;
    }
    if (!u.text) u.quietAt = now;
    const { match, ms } = matchTimed(alts);
    const isNew = !!match && isNewEffect(match, u.fired);
    if (u.entryId !== null && !isNew) {
      // Already done early: just note the final words and when they came.
      updateEntry(u.entryId, (e) => ({
        ...e,
        alternatives: alts,
        timing: e.timing ? { ...e.timing, finalAt: now, endAt: u.endAt } : e.timing,
      }));
      return null;
    }
    const ran = isNew && match ? runSafe(match) : false;
    addEntry({
      at: now,
      alternatives: alts,
      source: "speech",
      match: isNew ? match : null,
      timing: {
        spokeAt: u.spokeAt,
        quietAt: u.quietAt,
        endAt: u.endAt,
        firedAt: ran ? now : null,
        finalAt: now,
        early: false,
        matchMs: ms,
      },
    });
    return isNew ? match : null;
  },
  /** The host's command handler (set on every render, so it sees fresh state). */
  setHandler(h: VoiceHandler | null) {
    handler = h;
  },
  setVocabulary(v: VoiceVocabulary) {
    vocabulary = v;
  },
  vocabulary: (): VoiceVocabulary => vocabulary,
  /** A whole phrase typed in the debug window (or fed in by a test): runs it. */
  submit(alternatives: string[], source: VoiceLogEntry["source"] = "typed"): VoiceMatch | null {
    if (source === "speech") return this.final(alternatives);
    const alts = alternatives.map((a) => a.trim()).filter(Boolean);
    if (alts.length === 0) return null;
    const { match } = matchTimed(alts);
    const ran = match ? runSafe(match) : false;
    addEntry({ at: Date.now(), alternatives: alts, source, match: ran ? match : null });
    return ran ? match : null;
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
