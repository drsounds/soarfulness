#!/usr/bin/env node
// VOICE (src/apps/voice): builds src/apps/voice/settingCatalog.generated.ts
// from every <SettingRow> in the settings UI, so voice commands know each
// setting's on-screen label (an i18n key, spoken in the app's language) and
// the same min / max / step as its slider.
//
//   node scripts/gen-voice-catalog.mjs          write the file
//   node scripts/gen-voice-catalog.mjs --check  exit 1 when it is out of date
//
// It reads the rows as text (prettier formats every row the same way), so it
// only understands the common shapes:
//   label={t("dial.x")}  rawValue={key}  onSet={setKey}  min={0}  max={mx("key")}  step={0.5}
//   onInc={() => setKey(true)}                       (an on/off row)
//   onSelectIndex={(i) => setKey(OPTIONS[i])}        (a list row)
// Rows it can't read are skipped; voice still reaches those settings by their
// key name (see src/apps/voice/settingTargets.ts).

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "src/apps/voice/settingCatalog.generated.ts");

function sources() {
  const files = [join(root, "src/components/SettingsPanel.tsx")];
  const appsDir = join(root, "src/apps");
  for (const app of readdirSync(appsDir).sort()) {
    const dir = join(appsDir, app);
    for (const f of readdirSync(dir).sort()) {
      if (f.endsWith(".tsx")) files.push(join(dir, f));
    }
  }
  return files;
}

const setterKey = (setter) => setter.charAt(3).toLowerCase() + setter.slice(4);

function num(src, prop) {
  const m = src.match(new RegExp(`\\b${prop}=\\{(-?[0-9.]+)\\}`));
  return m ? Number(m[1]) : undefined;
}

function parseRow(block) {
  const label = block.match(/\blabel=\{t\("([^"]+)"\)\}/)?.[1];
  if (!label) return null;
  const entry = { key: "", label };

  const raw = block.match(/\brawValue=\{(?:[a-zA-Z_]+\.)?([a-zA-Z_][a-zA-Z0-9_]*)\}/)?.[1];
  let onSetSetter = block.match(/\bonSet=\{(set[A-Z][a-zA-Z0-9]*)\}/)?.[1];
  let onSetHandle = block.match(/\bonSet=\{s\.([a-zA-Z0-9]+)\}/)?.[1];
  let scaled = false;
  let int = false;
  // onSet={(v) => setKey(v)} / onSet={(v) => s.key(Math.max(0, v))}: same units as the slider
  // unless the value is scaled on the way in.
  const arrow = block.match(
    /\bonSet=\{\(v\) => (?:(set[A-Z][a-zA-Z0-9]*)|s\.([a-zA-Z0-9]+))\((.*)\)\}\s*$/m,
  );
  if (!onSetSetter && !onSetHandle && arrow) {
    onSetSetter = arrow[1];
    onSetHandle = arrow[2];
    const arg = arrow[3];
    scaled = /[/*{]|Ref\b/.test(arg) || !/\bv\b/.test(arg);
    int = /Math\.round/.test(arg);
  }
  const boolSetter = block.match(/\bonInc=\{\(\) => (set[A-Z][a-zA-Z0-9]*)\(true\)\}/)?.[1];
  const boolHandle = block.match(/\bonInc=\{\(\) => s\.([a-zA-Z0-9]+)\(true\)\}/)?.[1];
  const select = block.match(
    /\bonSelectIndex=\{\(i\) => (set[A-Z][a-zA-Z0-9]*)\(([A-Z_][A-Z0-9_]*)\[i\]/,
  );

  if (raw && !scaled && (onSetSetter ? setterKey(onSetSetter) === raw : onSetHandle === raw)) {
    entry.key = raw;
    if (int) entry.int = true;
    const min = num(block, "min");
    const max = num(block, "max");
    const step = num(block, "step");
    const limit = block.match(/\bmax=\{mx\("([a-zA-Z]+)"\)\}/)?.[1];
    if (min !== undefined) entry.min = min;
    if (max !== undefined) entry.max = max;
    if (limit) entry.maxLimit = limit;
    if (step !== undefined) entry.step = step;
  } else if (onSetSetter || onSetHandle) {
    // A slider showing a scaled value (percent, degrees...): the key is known,
    // its range in stored units is not.
    entry.key = onSetSetter ? setterKey(onSetSetter) : onSetHandle;
  } else if (boolSetter || boolHandle) {
    entry.key = boolSetter ? setterKey(boolSetter) : boolHandle;
    entry.bool = true;
  } else if (select) {
    entry.key = setterKey(select[1]);
    entry.options = select[2];
  } else {
    return null;
  }
  return entry;
}

function rows(text) {
  const lines = text.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^(\s*)<SettingRow\b/);
    if (!open) continue;
    const indent = open[1];
    let j = i;
    while (j < lines.length && !(lines[j].startsWith(indent) && lines[j].trim() === "/>")) {
      if (j > i && /^\s*<SettingRow\b/.test(lines[j])) break;
      j++;
    }
    out.push(lines.slice(i, j + 1).join("\n"));
    i = j;
  }
  return out;
}

function build() {
  const byKey = new Map();
  for (const file of sources()) {
    for (const block of rows(readFileSync(file, "utf8"))) {
      const e = parseRow(block);
      if (!e || !e.key) continue;
      const prev = byKey.get(e.key);
      // First row wins, unless a later one knows the range.
      if (!prev || (prev.min === undefined && e.min !== undefined)) byKey.set(e.key, e);
    }
  }
  const entries = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  const body = entries
    .map((e) => {
      const parts = [`key: ${JSON.stringify(e.key)}`, `label: ${JSON.stringify(e.label)}`];
      for (const k of ["min", "max", "step"]) if (e[k] !== undefined) parts.push(`${k}: ${e[k]}`);
      if (e.maxLimit) parts.push(`maxLimit: ${JSON.stringify(e.maxLimit)}`);
      if (e.int) parts.push("int: true");
      if (e.bool) parts.push("bool: true");
      if (e.options) parts.push(`options: ${JSON.stringify(e.options)}`);
      return `  { ${parts.join(", ")} },`;
    })
    .join("\n");
  return `// GENERATED by scripts/gen-voice-catalog.mjs from the <SettingRow>s in the
// settings UI. Do not edit by hand: run \`node scripts/gen-voice-catalog.mjs\`.

export type CatalogEntry = {
  /** Persisted settings key. */
  key: string;
  /** i18n key of the row's label. */
  label: string;
  min?: number;
  max?: number;
  /** max = limitMax(maxLimit, extreme) (lib/extremeLimits.ts). */
  maxLimit?: string;
  step?: number;
  /** Whole numbers only. */
  int?: true;
  /** An on/off row. */
  bool?: true;
  /** Name of the option list the row picks from (see enumOptions.ts). */
  options?: string;
};

export const SETTING_CATALOG: CatalogEntry[] = [
${body}
];
`;
}

const next = build();
if (process.argv.includes("--check")) {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (cur !== next) {
    console.error(
      "settingCatalog.generated.ts is out of date: run node scripts/gen-voice-catalog.mjs",
    );
    process.exit(1);
  }
} else {
  writeFileSync(OUT, next);
  console.log(`wrote ${OUT}`);
}
