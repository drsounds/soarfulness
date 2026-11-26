import { EXTREME_MAX, limitMax, type LimitedControl } from "@/lib/extremeLimits";
import { SETTING_ALIASES, VOICE_EXCLUDED_KEYS } from "./aliases";
import { ENUM_OPTIONS, EXTRA_ENUM_KEYS, OPTION_ALIASES } from "./enumOptions";
import type { CatalogEntry } from "./settingCatalog.generated";
import { keyWords, tokens } from "./textMatch";

// VOICE: every persisted setting as something voice can change. Built from
// the full defaults object (so every setting is reachable, with or without a
// settings row) plus the generated row catalog (labels, ranges, option
// lists) plus the hand-written aliases.

export type SettingTarget = {
  key: string;
  kind: "bool" | "number" | "enum";
  /** What the transcript shows, e.g. "WAVE". */
  label: string;
  /** Spoken names, tokenized. */
  names: string[][];
  min?: number;
  max?: number;
  /**
   * The EXTREME max of a limited control. A value already past `max` (typed
   * in, or a default above the everyday max) can still be stepped up to it.
   */
  hardMax?: number;
  step: number;
  int: boolean;
  options?: { value: string; names: string[][] }[];
  defaultValue: unknown;
};

export type BuildTargetsInput = {
  defaults: Record<string, unknown>;
  catalog: readonly CatalogEntry[];
  /** The row label of an i18n key in the app's language and in English. */
  labels(i18nKey: string): string[];
  extreme: boolean;
};

/** A round step about 1/20 of `span`: 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10... */
export function niceStep(span: number): number {
  if (!(span > 0)) return 0.1;
  const raw = span / 20;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const nice = m < 1.5 ? 1 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10;
  return +(nice * p).toPrecision(3);
}

function uniqueNames(list: string[]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const s of list) {
    const t = tokens(s);
    const k = t.join(" ");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** "ROAMING (MOVE WITH YOUR BODY)" → also "ROAMING"; "BOUNDARY HEIGHT (Y)" → "BOUNDARY HEIGHT". */
function labelVariants(label: string): string[] {
  const out = [label];
  const noParen = label.replace(/\([^)]*\)/g, " ").trim();
  if (noParen && noParen !== label) out.push(noParen);
  if (label.includes("/")) out.push(label.replace(/\//g, " "));
  return out;
}

export function buildSettingTargets(input: BuildTargetsInput): SettingTarget[] {
  const byKey = new Map(input.catalog.map((e) => [e.key, e]));
  const targets: SettingTarget[] = [];
  for (const [key, def] of Object.entries(input.defaults)) {
    if (VOICE_EXCLUDED_KEYS.has(key)) continue;
    const entry = byKey.get(key);
    const optionsName = entry?.options ?? EXTRA_ENUM_KEYS[key];
    const optionList = optionsName ? ENUM_OPTIONS[optionsName] : undefined;
    let kind: SettingTarget["kind"];
    if (typeof def === "boolean") kind = "bool";
    else if (typeof def === "number" && Number.isFinite(def)) kind = "number";
    else if (typeof def === "string" && optionList) kind = "enum";
    else continue;

    const rowLabels = entry ? input.labels(entry.label).filter(Boolean) : [];
    const words = keyWords(key);
    const nameList = [
      ...rowLabels.flatMap(labelVariants),
      words,
      // "aurora on" → "aurora" for on/off settings.
      kind === "bool" ? words.replace(/ (on|enabled)$/, "") : "",
      ...(SETTING_ALIASES[key] ?? []),
    ];
    const label = (rowLabels[0] ?? words).toUpperCase();

    const t: SettingTarget = {
      key,
      kind,
      label,
      names: uniqueNames(nameList),
      step: 1,
      int: false,
      defaultValue: def,
    };

    if (kind === "number") {
      const d = def as number;
      const limitKey = (entry?.maxLimit ?? (key in EXTREME_MAX ? key : undefined)) as
        LimitedControl | undefined;
      t.min = entry?.min ?? (d >= 0 ? 0 : undefined);
      t.max = entry?.max ?? (limitKey ? limitMax(limitKey, input.extreme) : undefined);
      if (limitKey) t.hardMax = limitMax(limitKey, true);
      t.step =
        entry?.step ??
        (t.min !== undefined && t.max !== undefined
          ? niceStep(t.max - t.min)
          : niceStep(Math.max(Math.abs(d), 1) * 2));
      t.int =
        !!entry?.int ||
        (Number.isInteger(t.step) && Number.isInteger(d) && entry?.step !== undefined);
    }
    if (kind === "enum" && optionList) {
      t.options = optionList.map((value) => ({
        value,
        names: uniqueNames([value, keyWords(value), ...(OPTION_ALIASES[value] ?? [])]),
      }));
    }
    targets.push(t);
  }
  return targets;
}
