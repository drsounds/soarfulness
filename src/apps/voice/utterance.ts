import type { VoiceMatch } from "./VoiceCommandRegistry";

// VOICE: acting before the recognizer has finished a phrase.
//
// Speech recognizers wait for a stretch of silence before they call a phrase
// final, and the on-device ones wait long (often one to two seconds, plus the
// time to finish decoding). The words themselves are usually there much
// earlier, as partial results. So voiceBus runs a command as soon as the
// partial text has stopped changing for a short while (VOICE → ACT EARLY),
// and the final result only confirms it.
//
// One phrase (an "utterance") may then match more than once: early on a
// partial, again as the words change, and once more on the final result.
// isNewEffect() decides whether such a later match does anything new:
//
//   - a different command, setting or action runs ("swing" … "swing higher");
//   - the same relative command never runs twice in one phrase, so
//     "increase wave height" steps once, not once per partial plus final;
//   - the same absolute command runs again only with a different value
//     ("set wave height to 3" … "35").

/** What a match changes, ignoring the values: command, setting keys, actions. */
export function effectKey(m: VoiceMatch): string {
  return [
    m.commandId,
    Object.keys(m.outcome.patch ?? {})
      .sort()
      .join(","),
    JSON.stringify(m.outcome.actions ?? []),
  ].join("|");
}

/** Should `m` run, given the matches this utterance has already run? */
export function isNewEffect(m: VoiceMatch, fired: readonly VoiceMatch[]): boolean {
  const key = effectKey(m);
  let last: VoiceMatch | null = null;
  for (const f of fired) if (effectKey(f) === key) last = f;
  if (!last) return true;
  if (!m.absolute) return false;
  return JSON.stringify(last.outcome.patch ?? {}) !== JSON.stringify(m.outcome.patch ?? {});
}

/** How long one phrase took, all in Date.now() milliseconds. */
export type VoiceTiming = {
  /** First partial (or the recognizer's "speech began"). */
  spokeAt: number;
  /** When the heard words last changed: roughly when the speaker stopped. */
  quietAt: number;
  /** The recognizer's own "end of speech", when it reports one. */
  endAt: number | null;
  /** When the command ran (null: nothing ran). */
  firedAt: number | null;
  /** When the final result arrived (null: not yet). */
  finalAt: number | null;
  /** Ran on a partial result, before the final one. */
  early: boolean;
  /** Time spent matching the words to a command. */
  matchMs: number;
};

/** Milliseconds from "words stopped changing" to the command running. */
export function reactionMs(t: VoiceTiming): number | null {
  return t.firedAt === null ? null : Math.max(0, t.firedAt - t.quietAt);
}

/** Median and count of the reaction times of the most recent phrases. */
export function latencySummary(
  timings: readonly (VoiceTiming | undefined)[],
  max = 10,
): { medianMs: number; count: number } | null {
  const ms: number[] = [];
  for (const t of timings) {
    if (!t) continue;
    const r = reactionMs(t);
    if (r !== null) ms.push(r);
    if (ms.length >= max) break;
  }
  if (ms.length === 0) return null;
  ms.sort((a, b) => a - b);
  const mid = ms.length >> 1;
  const medianMs = ms.length % 2 ? ms[mid] : (ms[mid - 1] + ms[mid]) / 2;
  return { medianMs, count: ms.length };
}
