import { phraseSimilarity, tokens } from "./textMatch";
import type { VoiceAction } from "./voiceActions";

// VOICE: the list of commands and the matcher that picks one for a heard
// phrase. A command has one or more phrases made of words and {slots}:
//
//   "swing higher"                 a fixed phrase
//   "set {setting} to {value}"     slots take the words between the fixed ones
//
// Fixed words are compared fuzzily (textMatch.phraseSimilarity), extra words
// before or after the phrase ("okay", "please") cost a little, and the
// command's resolve() turns the slot words into what to do, with its own
// confidence. The best score over every phrase of every command wins.

/** What a matched command does: settings to change and/or host actions. */
export type VoiceOutcome = {
  /** Short feedback for the transcript, e.g. "WAVE HEIGHT → 3.5". */
  label: string;
  patch?: Record<string, unknown>;
  actions?: VoiceAction[];
};

export type VoiceResolution = { score: number; outcome: VoiceOutcome };

export type Slots = Record<string, string[]>;

export type VoiceCommand<C> = {
  id: string;
  phrases: string[];
  /** Turns slot words into an outcome, or null when they make no sense. */
  resolve(slots: Slots, ctx: C): VoiceResolution | null;
  /** Still heard while voice control sleeps ("wake up"). */
  whileAsleep?: boolean;
};

export type VoiceMatch = {
  commandId: string;
  phrase: string;
  heard: string;
  score: number;
  outcome: VoiceOutcome;
};

type Part = { lit: string[] } | { slot: string };
type Compiled<C> = { command: VoiceCommand<C>; phrase: string; parts: Part[]; litWords: number };
type Candidate = { score: number; slots: Slots };

/** Cost of each heard word that is not part of the phrase. */
const FILLER_PENALTY = 0.96;
/** A fixed part of a phrase scoring below this is not considered at all. */
const LITERAL_FLOOR = 0.6;

function compile(phrase: string): { parts: Part[]; litWords: number } {
  const parts: Part[] = [];
  let litWords = 0;
  for (const raw of phrase.split(/\s+/).filter(Boolean)) {
    const slot = raw.match(/^\{(\w+)\}$/);
    if (slot) {
      parts.push({ slot: slot[1] });
      continue;
    }
    const words = tokens(raw);
    litWords += words.length;
    const last = parts[parts.length - 1];
    if (last && "lit" in last) last.lit.push(...words);
    else parts.push({ lit: words });
  }
  return { parts, litWords };
}

/**
 * Every way `parts` can be laid over the heard words, with the fixed words'
 * similarity (weighted by length) and the filler penalty as the score.
 */
export function matchParts(parts: Part[], heard: string[]): Candidate[] {
  const out: Candidate[] = [];
  const n = heard.length;
  const walk = (
    pi: number,
    ti: number,
    simSum: number,
    litLen: number,
    filler: number,
    slots: Slots,
  ) => {
    if (out.length > 400) return;
    if (pi === parts.length) {
      const f = filler + (n - ti);
      const sim = litLen > 0 ? simSum / litLen : 1;
      out.push({ score: sim * Math.pow(FILLER_PENALTY, f), slots: { ...slots } });
      return;
    }
    const part = parts[pi];
    if ("lit" in part) {
      const m = part.lit.length;
      const starts = pi === 0 ? range(ti, n) : [ti];
      for (const s of starts) {
        for (const len of [m, m - 1, m + 1]) {
          if (len < 1 || s + len > n) continue;
          const sim = phraseSimilarity(heard.slice(s, s + len), part.lit);
          if (sim < LITERAL_FLOOR) continue;
          walk(pi + 1, s + len, simSum + sim * m, litLen + m, filler + (s - ti), slots);
        }
      }
      return;
    }
    // A slot takes at least one word; the last part takes the rest.
    const lastPart = pi === parts.length - 1;
    const ends = lastPart ? [n] : range(ti + 1, n);
    for (const e of ends) {
      if (e <= ti) continue;
      slots[part.slot] = heard.slice(ti, e);
      walk(pi + 1, e, simSum, litLen, filler, slots);
      delete slots[part.slot];
    }
  };
  walk(0, 0, 0, 0, 0, {});
  return out;
}

function range(a: number, b: number): number[] {
  const r: number[] = [];
  for (let i = a; i < b; i++) r.push(i);
  return r;
}

export class VoiceCommandRegistry<C> {
  private readonly compiled: Compiled<C>[] = [];

  constructor(commands: VoiceCommand<C>[] = []) {
    commands.forEach((c) => this.register(c));
  }

  register(command: VoiceCommand<C>): void {
    for (const phrase of command.phrases) {
      const { parts, litWords } = compile(phrase);
      if (parts.length) this.compiled.push({ command, phrase, parts, litWords });
    }
  }

  get commands(): VoiceCommand<C>[] {
    return [...new Set(this.compiled.map((c) => c.command))];
  }

  /**
   * The best command for any of the recognizer's alternatives (most likely
   * first), or null when nothing reaches `threshold`. While `asleep`, only
   * commands marked whileAsleep are considered.
   */
  match(
    alternatives: readonly string[],
    ctx: C,
    opts: { threshold: number; asleep?: boolean },
  ): VoiceMatch | null {
    let best: VoiceMatch | null = null;
    let bestRank = -Infinity;
    alternatives.forEach((text, altIndex) => {
      const heard = tokens(text);
      if (heard.length === 0) return;
      // Later alternatives are less likely: a small handicap.
      const altFactor = Math.pow(0.97, altIndex);
      for (const c of this.compiled) {
        if (opts.asleep && !c.command.whileAsleep) continue;
        for (const cand of matchParts(c.parts, heard)) {
          if (cand.score * altFactor < opts.threshold) continue;
          const res = c.command.resolve(cand.slots, ctx);
          if (!res) continue;
          const score = cand.score * res.score * altFactor;
          if (score < opts.threshold) continue;
          // Ties go to the more specific phrase (more fixed words).
          const rank = score + c.litWords * 0.002;
          if (rank > bestRank) {
            bestRank = rank;
            best = {
              commandId: c.command.id,
              phrase: c.phrase,
              heard: text,
              score,
              outcome: res.outcome,
            };
          }
        }
      }
    });
    return best;
  }
}
