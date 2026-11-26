// Fuzzy text matching for VOICE: speech recognizers mishear ("sore" for
// "soar", "wave hight"), so commands are compared word by word with an edit
// distance instead of exact strings.

/** Lowercase, fold accents (å→a, ö→o, é→e), drop punctuation, collapse spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/(\d)[,](\d)/g, "$1.$2")
    .replace(/[^a-z0-9.\-%° ]+/g, " ")
    .replace(/(^|\s)[.-]+|[.-]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

/** Splits a camelCase settings key into words: "swayAmp" → "sway amp". */
export function keyWords(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** 1 = same word, 0 = nothing alike. Short words must match closer. */
export function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const len = Math.max(a.length, b.length);
  if (len === 0) return 1;
  // A number only matches the same number.
  if (/\d/.test(a) || /\d/.test(b)) return 0;
  const sim = 1 - levenshtein(a, b) / len;
  return len <= 3 ? (sim >= 0.66 ? sim * 0.9 : 0) : sim;
}

/**
 * How well a spoken word sequence matches a phrase's words, 0–1. Words are
 * aligned in order (an edit distance over words, where a substitution costs
 * 1 - wordSimilarity), so "increase the wave height" still matches
 * "increase wave height" closely, and two words heard as one ("wave height"
 * as "waveheight") match too.
 */
export function phraseSimilarity(heard: string[], phrase: string[]): number {
  if (heard.length === 0 || phrase.length === 0) return heard.length === phrase.length ? 1 : 0;
  // Joined forms catch split / merged words.
  const joinedSim = wordSimilarity(heard.join(""), phrase.join(""));
  const n = heard.length;
  const m = phrase.length;
  // Cost of skipping a heard word (filler like "the", "please") is lower than
  // missing a phrase word.
  const SKIP_HEARD = 0.35;
  const SKIP_PHRASE = 1;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) d[i][0] = i * SKIP_HEARD;
  for (let j = 1; j <= m; j++) d[0][j] = j * SKIP_PHRASE;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + SKIP_HEARD,
        d[i][j - 1] + SKIP_PHRASE,
        d[i - 1][j - 1] + (1 - wordSimilarity(heard[i - 1], phrase[j - 1])),
      );
    }
  }
  const wordSim = Math.max(0, 1 - d[n][m] / m);
  return Math.max(wordSim, joinedSim * 0.98);
}

/** Best similarity of `heard` against any of `names` (each already tokenized). */
export function bestNameMatch(
  heard: string[],
  names: readonly string[][],
): { score: number; index: number } {
  let best = { score: 0, index: -1 };
  names.forEach((name, index) => {
    const score = phraseSimilarity(heard, name);
    if (score > best.score) best = { score, index };
  });
  return best;
}
