// Spoken values for VOICE: "five", "2.5", "two point five", "fem komma fem",
// "50 percent", "on", "av", "max", "default". Words come in normalized
// (textMatch.normalize: lowercase, no accents, so "två" is "tva").

export type SpokenValue =
  | { kind: "number"; value: number; percent: boolean }
  | { kind: "bool"; value: boolean }
  | { kind: "limit"; which: "max" | "min" | "default" };

const UNITS: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  a: 1,
  an: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  // Swedish (accents folded)
  noll: 0,
  en: 1,
  ett: 1,
  tva: 2,
  tre: 3,
  fyra: 4,
  fem: 5,
  sex: 6,
  sju: 7,
  atta: 8,
  nio: 9,
  tio: 10,
  elva: 11,
  tolv: 12,
  tretton: 13,
  fjorton: 14,
  femton: 15,
  sexton: 16,
  sjutton: 17,
  arton: 18,
  nitton: 19,
  tjugo: 20,
  trettio: 30,
  fyrtio: 40,
  femtio: 50,
  sextio: 60,
  sjuttio: 70,
  attio: 80,
  nittio: 90,
};
const SCALES: Record<string, number> = {
  hundred: 100,
  hundra: 100,
  thousand: 1000,
  tusen: 1000,
};
const POINT = new Set(["point", "dot", "komma", "punkt", "comma"]);
const NEGATIVE = new Set(["minus", "negative"]);
const PERCENT = new Set(["%", "percent", "procent", "prosent"]);
const FILLER = new Set([
  "and",
  "och",
  "meter",
  "meters",
  "metre",
  "metres",
  "m",
  "degrees",
  "degree",
  "grader",
  "grad",
  "times",
  "ganger",
  "x",
  "°",
  "seconds",
  "second",
  "sekunder",
  "s",
  "the",
  "to",
  "till",
  "at",
  "pa",
  "by",
  "med",
]);
const HALF = new Set(["half", "halv", "halva"]);
const ON = new Set([
  "on",
  "yes",
  "true",
  "enabled",
  "enable",
  "start",
  "pa",
  "ja",
  "igang",
  "show",
]);
const OFF = new Set([
  "off",
  "no",
  "false",
  "disabled",
  "disable",
  "stop",
  "av",
  "nej",
  "hide",
  "of",
]);
const MAX = new Set(["max", "maximum", "maximal", "maximalt", "full", "highest", "hogsta"]);
const MIN = new Set(["min", "minimum", "minimal", "minimalt", "lowest", "lagsta", "none"]);
const DEFAULT = new Set(["default", "standard", "reset", "normal", "aterstall"]);

function isNumberToken(w: string): boolean {
  return /^-?\d+(\.\d+)?%?$/.test(w) || w in UNITS || w in SCALES || POINT.has(w) || HALF.has(w);
}

/** Parses a number out of words like ["two", "point", "five"] or ["2.5"]. */
export function parseSpokenNumber(words: string[]): number | null {
  let sign = 1;
  let total = 0;
  let current = 0;
  let seen = false;
  let decimals: string | null = null;
  for (const w0 of words) {
    const w = w0.endsWith("%") && w0.length > 1 ? w0.slice(0, -1) : w0;
    if (FILLER.has(w) || PERCENT.has(w)) continue;
    if (NEGATIVE.has(w) && !seen) {
      sign = -1;
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(w)) {
      if (decimals !== null) decimals += w.replace(/[^0-9]/g, "");
      else current += Number(w);
      seen = true;
      continue;
    }
    if (POINT.has(w) && seen && decimals === null) {
      decimals = "";
      continue;
    }
    if (HALF.has(w)) {
      current += 0.5;
      seen = true;
      continue;
    }
    if (w in UNITS) {
      if (decimals !== null) decimals += String(UNITS[w]);
      else current += UNITS[w];
      seen = true;
      continue;
    }
    if (w in SCALES) {
      current = (current || 1) * SCALES[w];
      if (SCALES[w] >= 1000) {
        total += current;
        current = 0;
      }
      seen = true;
      continue;
    }
    return null; // a word that isn't part of a number
  }
  if (!seen) return null;
  let value = total + current;
  if (decimals) value = Number(`${Math.trunc(value)}.${decimals}`) + (value % 1);
  return sign * value;
}

/** What a spoken value (the words after "to" in "set X to ...") means. */
export function parseSpokenValue(words: string[]): SpokenValue | null {
  const ws = words.filter((w) => w !== "the" && w !== "to" && w !== "till");
  if (ws.length === 0) return null;
  if (ws.length <= 2) {
    const w = ws[ws.length - 1];
    if (ON.has(w) || ws.join(" ") === "turned on") return { kind: "bool", value: true };
    if (OFF.has(w)) return { kind: "bool", value: false };
    if (MAX.has(w)) return { kind: "limit", which: "max" };
    if (MIN.has(w)) return { kind: "limit", which: "min" };
    if (DEFAULT.has(w)) return { kind: "limit", which: "default" };
  }
  if (!ws.every((w) => isNumberToken(w) || FILLER.has(w) || PERCENT.has(w) || NEGATIVE.has(w)))
    return null;
  const n = parseSpokenNumber(ws);
  if (n === null || !Number.isFinite(n)) return null;
  const percent = ws.some((w) => PERCENT.has(w) || (w.endsWith("%") && w.length > 1));
  return { kind: "number", value: n, percent };
}
