import type { CameraMode } from "@/lib/settingsShared";
import type { SettingTarget } from "./settingTargets";
import { parseSpokenNumber, parseSpokenValue } from "./spokenValue";
import { bestNameMatch, tokens } from "./textMatch";
import type { VoiceAction, VoiceDirectionTarget } from "./voiceActions";
import {
  VoiceCommandRegistry,
  type Slots,
  type VoiceCommand,
  type VoiceResolution,
} from "./VoiceCommandRegistry";

// VOICE: every command. Two kinds:
//
// - Mode and motion commands ("swing", "swing higher", "fly", "soar faster",
//   "change sway to north", "whirlpool"), written out below.
// - Generic setting commands over every persisted setting ("set <setting> to
//   <value>", "increase <setting>", "<setting> on", "reset <setting>"),
//   built from SettingTarget (settingTargets.ts), so a new setting is
//   reachable by voice without touching this file.
//
// Phrases are English and Swedish; matching ignores accents, so Swedish
// phrases are written without them.

export type VoiceContext = {
  /** Current value of a persisted setting. */
  get(key: string): unknown;
  settings: SettingResolver;
  /** VOICE STEP multiplier for increase / decrease. */
  stepScale: number;
};

/** Finds the setting a few spoken words name, with a cache per phrase. */
export class SettingResolver {
  private readonly cache = new Map<string, { target: SettingTarget; score: number } | null>();
  private readonly byKey: Map<string, SettingTarget>;

  constructor(readonly targets: SettingTarget[]) {
    this.byKey = new Map(targets.map((t) => [t.key, t]));
  }

  get(key: string): SettingTarget | undefined {
    return this.byKey.get(key);
  }

  resolve(words: string[]): { target: SettingTarget; score: number } | null {
    const k = words.join(" ");
    if (this.cache.has(k)) return this.cache.get(k) ?? null;
    let best: { target: SettingTarget; score: number } | null = null;
    for (const target of this.targets) {
      const { score } = bestNameMatch(words, target.names);
      if (score >= 0.6 && (!best || score > best.score)) best = { target, score };
    }
    if (this.cache.size > 500) this.cache.clear();
    this.cache.set(k, best);
    return best;
  }
}

export const fmt = (v: unknown): string =>
  typeof v === "number" ? String(+v.toFixed(Math.abs(v) >= 100 ? 0 : 2)) : String(v);

const clamp = (t: SettingTarget, v: number): number => {
  let out = v;
  if (t.min !== undefined) out = Math.max(t.min, out);
  if (t.max !== undefined) out = Math.min(t.max, out);
  if (t.int) out = Math.round(out);
  return +out.toFixed(6);
};

/**
 * A relative change from `cur` toward `next`, clamped to the row's range,
 * but never against its direction: a value already past the slider's max
 * (typed in, or a default above the everyday max) is not pulled down by
 * "higher", it may go on up to the EXTREME max.
 */
export const stepTo = (t: SettingTarget, cur: number, next: number): number => {
  const max =
    t.max === undefined ? undefined : cur >= t.max ? Math.max(cur, t.hardMax ?? cur) : t.max;
  const min = t.min === undefined ? undefined : Math.min(t.min, cur);
  let out = next;
  if (min !== undefined) out = Math.max(min, out);
  if (max !== undefined) out = Math.min(max, out);
  if (t.int) out = Math.round(out);
  return +out.toFixed(6);
};

function setTo(t: SettingTarget, value: unknown, score: number): VoiceResolution {
  return {
    score,
    outcome: { label: `${t.label} → ${fmt(value)}`, patch: { [t.key]: value } },
  };
}

/** "set <setting> to <value>" for any kind of setting. */
function resolveSet(slots: Slots, ctx: VoiceContext): VoiceResolution | null {
  const found = ctx.settings.resolve(slots.setting ?? []);
  const words = slots.value ?? [];
  if (!found || words.length === 0) return null;
  const { target: t, score } = found;
  if (t.kind === "enum") {
    const names = t.options!.map((o) => o.names).flat();
    const owners = t.options!.flatMap((o) => o.names.map(() => o.value));
    const m = bestNameMatch(words, names);
    if (m.score < 0.7) return null;
    return setTo(t, owners[m.index], score * m.score);
  }
  const v = parseSpokenValue(words);
  if (!v) return null;
  if (t.kind === "bool") {
    if (v.kind === "bool") return setTo(t, v.value, score);
    if (v.kind === "limit" && v.which === "default") return setTo(t, t.defaultValue, score);
    if (v.kind === "number" && (v.value === 0 || v.value === 1))
      return setTo(t, v.value === 1, score);
    return null;
  }
  // number
  if (v.kind === "bool") return null;
  if (v.kind === "limit") {
    const target =
      v.which === "default" ? (t.defaultValue as number) : v.which === "max" ? t.max : t.min;
    if (target === undefined) return null;
    return setTo(t, target, score);
  }
  let n = v.value;
  if (v.percent && t.min !== undefined && t.max !== undefined) {
    n = t.min + ((t.max - t.min) * n) / 100;
  } else if (v.percent) {
    n = n / 100;
  }
  return setTo(t, clamp(t, n), score);
}

/** "increase / decrease <setting> [a lot] [by <amount>]". */
function resolveStep(dir: 1 | -1, factor: number) {
  return (slots: Slots, ctx: VoiceContext): VoiceResolution | null => {
    const found = ctx.settings.resolve(slots.setting ?? []);
    if (!found) return null;
    const { target: t, score } = found;
    if (t.kind === "bool") {
      // "more snow" / "less rain": treat as on / off.
      return setTo(t, dir > 0, score * 0.95);
    }
    if (t.kind === "enum") {
      const opts = t.options!;
      const cur = opts.findIndex((o) => o.value === ctx.get(t.key));
      const next = opts[(cur + dir + opts.length) % opts.length];
      return setTo(t, next.value, score);
    }
    const cur = Number(ctx.get(t.key));
    if (!Number.isFinite(cur)) return null;
    let delta = t.step * ctx.stepScale * factor;
    if (slots.amount) {
      const n = parseSpokenNumber(slots.amount);
      if (n === null) return null;
      delta = Math.abs(n);
    }
    return setTo(t, stepTo(t, cur, cur + dir * delta), score);
  };
}

function resolveBool(on: boolean | "toggle") {
  return (slots: Slots, ctx: VoiceContext): VoiceResolution | null => {
    const found = ctx.settings.resolve(slots.setting ?? []);
    if (!found || found.target.kind !== "bool") return null;
    const value = on === "toggle" ? !ctx.get(found.target.key) : on;
    return setTo(found.target, value, found.score);
  };
}

function resolveReset(slots: Slots, ctx: VoiceContext): VoiceResolution | null {
  const found = ctx.settings.resolve(slots.setting ?? []);
  if (!found) return null;
  return setTo(found.target, found.target.defaultValue, found.score);
}

// ------------------------------------------------------------ directions --

const COMPASS: [number, string[]][] = [
  [0, ["north", "nord", "norr", "norrut"]],
  [45, ["north east", "northeast", "nordost", "nordostlig"]],
  [90, ["east", "ost", "oster", "osterut"]],
  [135, ["south east", "southeast", "sydost"]],
  [180, ["south", "syd", "soder", "soderut"]],
  [225, ["south west", "southwest", "sydvast"]],
  [270, ["west", "vast", "vaster", "vasterut"]],
  [315, ["north west", "northwest", "nordvast"]],
];
const RELATIVE: [number, string[]][] = [
  [0, ["forward", "forwards", "ahead", "front", "straight", "framat", "fram"]],
  [90, ["right", "hoger"]],
  [180, ["back", "backward", "backwards", "behind", "bakat", "bak"]],
  [-90, ["left", "vanster"]],
];

export type SpokenDirection = { bearing: number } | { view: number };

export function parseDirection(words: string[]): { dir: SpokenDirection; score: number } | null {
  const ws = words.filter(
    (w) => !["the", "to", "till", "mot", "towards", "facing", "at"].includes(w),
  );
  if (ws.length === 0) return null;
  const n = parseSpokenNumber(ws);
  if (n !== null) return { dir: { bearing: ((n % 360) + 360) % 360 }, score: 1 };
  let best: { dir: SpokenDirection; score: number } | null = null;
  for (const [deg, names] of COMPASS) {
    const m = bestNameMatch(
      ws,
      names.map((s) => tokens(s)),
    );
    if (m.score >= 0.75 && (!best || m.score > best.score))
      best = { dir: { bearing: deg }, score: m.score };
  }
  for (const [deg, names] of RELATIVE) {
    const m = bestNameMatch(
      ws,
      names.map((s) => tokens(s)),
    );
    if (m.score >= 0.75 && (!best || m.score > best.score))
      best = { dir: { view: deg }, score: m.score };
  }
  return best;
}

function resolveDirection(target: VoiceDirectionTarget, name: string) {
  return (slots: Slots): VoiceResolution | null => {
    const d = parseDirection(slots.direction ?? []);
    if (!d) return null;
    const action: VoiceAction = { type: "direction", target, ...d.dir };
    const what =
      "bearing" in d.dir ? `${d.dir.bearing}°` : (slots.direction ?? []).join(" ").toUpperCase();
    return { score: d.score, outcome: { label: `${name} → ${what}`, actions: [action] } };
  };
}

function resolveTurn(target: VoiceDirectionTarget, name: string) {
  return (slots: Slots): VoiceResolution | null => {
    const ws = slots.side ?? [];
    const right = bestNameMatch(ws, [["right"], ["hoger"], ["clockwise"], ["medurs"]]).score;
    const left = bestNameMatch(ws, [["left"], ["vanster"], ["counterclockwise"], ["moturs"]]).score;
    const score = Math.max(right, left);
    if (score < 0.75) return null;
    const turn = right >= left ? 45 : -45;
    return {
      score,
      outcome: {
        label: `${name} ${turn > 0 ? "↻" : "↺"} 45°`,
        actions: [{ type: "direction", target, turn }],
      },
    };
  };
}

// ------------------------------------------------------------------ build --

const fixed = (
  id: string,
  phrases: string[],
  label: string,
  actions: VoiceAction[],
  extra: Partial<VoiceCommand<VoiceContext>> = {},
): VoiceCommand<VoiceContext> => ({
  id,
  phrases,
  resolve: () => ({ score: 1, outcome: { label, actions } }),
  ...extra,
});

const mode = (
  id: string,
  phrases: string[],
  label: string,
  m: CameraMode,
  more: VoiceAction[] = [],
) => fixed(id, phrases, label, [{ type: "mode", mode: m }, ...more]);

/** Multiplies a number setting (clamped), plus optional actions. */
function scale(
  id: string,
  phrases: string[],
  key: string,
  factor: number,
  actions: VoiceAction[] = [],
): VoiceCommand<VoiceContext> {
  return {
    id,
    phrases,
    resolve: (_slots, ctx) => {
      const t = ctx.settings.get(key);
      const cur = Number(ctx.get(key));
      if (!t || !Number.isFinite(cur)) return null;
      const next = stepTo(t, cur, cur * factor);
      return {
        score: 1,
        outcome: { label: `${t.label} → ${fmt(next)}`, patch: { [key]: next }, actions },
      };
    },
  };
}

/** Steps a number setting by `steps` × its row step × VOICE STEP. */
function nudge(
  id: string,
  phrases: string[],
  key: string,
  steps: number,
  actions: VoiceAction[] = [],
): VoiceCommand<VoiceContext> {
  return {
    id,
    phrases,
    resolve: (_slots, ctx) => {
      const t = ctx.settings.get(key);
      const cur = Number(ctx.get(key));
      if (!t || !Number.isFinite(cur)) return null;
      const next = stepTo(t, cur, cur + steps * t.step * ctx.stepScale);
      return {
        score: 1,
        outcome: { label: `${t.label} → ${fmt(next)}`, patch: { [key]: next }, actions },
      };
    },
  };
}

export function voiceCommands(): VoiceCommand<VoiceContext>[] {
  const up: VoiceAction[] = [{ type: "vertical", dir: "up" }];
  const down: VoiceAction[] = [{ type: "vertical", dir: "down" }];
  return [
    // --- modes
    mode(
      "mode.swim",
      ["swim", "swim mode", "swimming", "float", "simma", "simlage", "simmare"],
      "SWIM",
      "float",
    ),
    mode(
      "mode.fly",
      ["fly", "fly mode", "flying", "flight", "flyg", "flyga", "fluglage"],
      "FLY",
      "noclip",
    ),
    mode("mode.swing", ["swing", "swing mode", "swinging", "gunga", "gunglage"], "SWING", "swing", [
      { type: "whirlpool", on: false },
    ]),
    mode(
      "mode.bodyflight",
      ["bodyflight", "body flight", "skydive", "skydiving", "fallskarm"],
      "BODYFLIGHT",
      "bodyflight",
    ),
    mode(
      "mode.watercraft",
      ["watercraft", "boat", "jet ski", "farkost", "bat"],
      "WATERCRAFT",
      "watercraft",
    ),
    fixed(
      "mode.whirlpool",
      ["whirlpool", "whirlpool mode", "tornado mode", "virvel", "virvellage", "malstrom"],
      "WHIRLPOOL",
      [{ type: "whirlpool", on: true }],
    ),
    fixed(
      "mode.whirlpoolOff",
      ["stop whirlpool", "whirlpool off", "no whirlpool", "stoppa virvel", "virvel av"],
      "WHIRLPOOL OFF",
      [{ type: "whirlpool", on: false }],
    ),
    fixed("mode.next", ["next mode", "nasta lage"], "NEXT MODE", [{ type: "cycleMode", dir: 1 }]),
    fixed("mode.prev", ["previous mode", "last mode", "forra lage"], "PREVIOUS MODE", [
      { type: "cycleMode", dir: -1 },
    ]),

    // --- swing
    nudge(
      "swing.higher",
      ["swing higher", "higher", "swing more", "gunga hogre", "hogre"],
      "swingIntensity",
      3,
    ),
    nudge(
      "swing.lower",
      ["swing lower", "lower", "swing less", "gunga lagre", "lagre"],
      "swingIntensity",
      -3,
    ),
    nudge(
      "swing.muchHigher",
      ["swing much higher", "swing a lot higher", "gunga mycket hogre"],
      "swingIntensity",
      10,
    ),
    nudge(
      "swing.muchLower",
      ["swing much lower", "swing a lot lower", "gunga mycket lagre"],
      "swingIntensity",
      -10,
    ),
    scale("swing.faster", ["swing faster", "gunga fortare", "gunga snabbare"], "swingSpeed", 1.25),
    scale("swing.slower", ["swing slower", "gunga langsammare"], "swingSpeed", 0.8),

    // --- fly: soar / sink / hold, and their speed
    fixed(
      "fly.soar",
      [
        "soar",
        "sore",
        "soaring",
        "rise",
        "climb",
        "go up",
        "up",
        "ascend",
        "stig",
        "stiga",
        "uppat",
        "upp",
      ],
      "SOAR ↑",
      up,
    ),
    fixed(
      "fly.sink",
      ["sink", "descend", "dive", "go down", "down", "fall", "sjunk", "sjunka", "nedat", "ner"],
      "SINK ↓",
      down,
    ),
    fixed(
      "fly.stop",
      ["stop", "hover", "hold", "stay", "level", "halt", "stanna", "sväva", "svava"],
      "HOVER",
      [{ type: "vertical", dir: "stop" }],
    ),
    scale(
      "fly.soarFaster",
      ["soar faster", "rise faster", "climb faster", "stig fortare", "stig snabbare"],
      "noclipFallRiseSpeed",
      1.5,
      up,
    ),
    scale(
      "fly.soarSlower",
      ["soar slower", "rise slower", "climb slower", "stig langsammare"],
      "noclipFallRiseSpeed",
      1 / 1.5,
      up,
    ),
    scale(
      "fly.sinkFaster",
      ["sink faster", "fall faster", "dive faster", "sjunk fortare", "sjunk snabbare"],
      "noclipFallRiseSpeed",
      1.5,
      down,
    ),
    scale(
      "fly.sinkSlower",
      ["sink slower", "fall slower", "dive slower", "sjunk langsammare"],
      "noclipFallRiseSpeed",
      1 / 1.5,
      down,
    ),
    scale(
      "fly.faster",
      ["fly faster", "faster", "flyg fortare", "fortare", "snabbare"],
      "noclipSpeed",
      1.25,
    ),
    scale(
      "fly.slower",
      ["fly slower", "slower", "flyg langsammare", "langsammare"],
      "noclipSpeed",
      0.8,
    ),

    // --- sway and wave direction
    {
      id: "sway.direction",
      phrases: [
        "change sway to {direction}",
        "change the sway to {direction}",
        "set sway direction to {direction}",
        "sway direction {direction}",
        "sway {direction}",
        "sway to {direction}",
        "andra svaj till {direction}",
        "svaj mot {direction}",
        "svaj {direction}",
      ],
      resolve: resolveDirection("sway", "SWAY"),
    },
    {
      id: "sway.turn",
      phrases: [
        "turn sway {side}",
        "turn the sway {side}",
        "rotate sway {side}",
        "vrid svaj {side}",
        "vrid svajet at {side}",
      ],
      resolve: resolveTurn("sway", "SWAY"),
    },
    {
      id: "waves.direction",
      phrases: [
        "change waves to {direction}",
        "change the waves to {direction}",
        "change wave direction to {direction}",
        "wave direction {direction}",
        "waves {direction}",
        "waves from {direction}",
        "andra vagor till {direction}",
        "vagriktning {direction}",
      ],
      resolve: resolveDirection("waves", "WAVES"),
    },
    {
      id: "waves.turn",
      phrases: [
        "turn waves {side}",
        "turn the waves {side}",
        "rotate waves {side}",
        "vrid vagorna {side}",
      ],
      resolve: resolveTurn("waves", "WAVES"),
    },

    // --- app and listening
    fixed(
      "ui.openSettings",
      ["open settings", "settings", "show settings", "oppna installningar", "installningar"],
      "SETTINGS",
      [{ type: "settings", open: true }],
    ),
    fixed(
      "ui.closeSettings",
      ["close settings", "hide settings", "stang installningar"],
      "SETTINGS ✕",
      [{ type: "settings", open: false }],
    ),
    fixed(
      "ui.help",
      ["what can i say", "voice help", "help", "show commands", "hjalp", "vad kan jag saga"],
      "HELP",
      [{ type: "help", open: true }],
    ),
    fixed(
      "voice.sleep",
      ["stop listening", "go to sleep", "voice off", "sleep", "sluta lyssna", "sov"],
      "SLEEPING",
      [{ type: "listen", awake: false }],
    ),
    fixed(
      "voice.wake",
      ["wake up", "start listening", "listen", "voice on", "vakna", "lyssna", "borja lyssna"],
      "LISTENING",
      [{ type: "listen", awake: true }],
      { whileAsleep: true },
    ),

    // --- every setting
    {
      id: "setting.set",
      phrases: [
        "set {setting} to {value}",
        "set the {setting} to {value}",
        "change {setting} to {value}",
        "change the {setting} to {value}",
        "make {setting} {value}",
        "put {setting} to {value}",
        "{setting} to {value}",
        "{setting} {value}",
        "satt {setting} till {value}",
        "stall {setting} pa {value}",
        "andra {setting} till {value}",
        "{setting} till {value}",
      ],
      resolve: resolveSet,
    },
    {
      id: "setting.increase",
      phrases: [
        "increase {setting}",
        "increase the {setting}",
        "raise {setting}",
        "more {setting}",
        "turn up {setting}",
        "turn up the {setting}",
        "{setting} up",
        "{setting} higher",
        "higher {setting}",
        "bigger {setting}",
        "oka {setting}",
        "hoj {setting}",
        "mer {setting}",
        "hogre {setting}",
        "storre {setting}",
      ],
      resolve: resolveStep(1, 1),
    },
    {
      id: "setting.decrease",
      phrases: [
        "decrease {setting}",
        "decrease the {setting}",
        "reduce {setting}",
        "less {setting}",
        "turn down {setting}",
        "turn down the {setting}",
        "{setting} down",
        "{setting} lower",
        "lower {setting}",
        "smaller {setting}",
        "minska {setting}",
        "sank {setting}",
        "mindre {setting}",
        "lagre {setting}",
      ],
      resolve: resolveStep(-1, 1),
    },
    {
      id: "setting.increaseMuch",
      phrases: [
        "increase {setting} a lot",
        "much more {setting}",
        "oka {setting} mycket",
        "mycket mer {setting}",
      ],
      resolve: resolveStep(1, 5),
    },
    {
      id: "setting.decreaseMuch",
      phrases: [
        "decrease {setting} a lot",
        "much less {setting}",
        "minska {setting} mycket",
        "mycket mindre {setting}",
      ],
      resolve: resolveStep(-1, 5),
    },
    {
      id: "setting.increaseBy",
      phrases: [
        "increase {setting} by {amount}",
        "raise {setting} by {amount}",
        "oka {setting} med {amount}",
      ],
      resolve: resolveStep(1, 1),
    },
    {
      id: "setting.decreaseBy",
      phrases: [
        "decrease {setting} by {amount}",
        "lower {setting} by {amount}",
        "minska {setting} med {amount}",
      ],
      resolve: resolveStep(-1, 1),
    },
    {
      id: "setting.on",
      phrases: [
        "turn on {setting}",
        "turn on the {setting}",
        "turn {setting} on",
        "switch on {setting}",
        "enable {setting}",
        "start {setting}",
        "start the {setting}",
        "show {setting}",
        "{setting} on",
        "sla pa {setting}",
        "starta {setting}",
        "visa {setting}",
        "{setting} pa",
      ],
      resolve: resolveBool(true),
    },
    {
      id: "setting.off",
      phrases: [
        "turn off {setting}",
        "turn off the {setting}",
        "turn {setting} off",
        "switch off {setting}",
        "disable {setting}",
        "stop {setting}",
        "stop the {setting}",
        "hide {setting}",
        "no {setting}",
        "{setting} off",
        "sla av {setting}",
        "stang av {setting}",
        "stoppa {setting}",
        "dolj {setting}",
        "{setting} av",
      ],
      resolve: resolveBool(false),
    },
    {
      id: "setting.toggle",
      phrases: ["toggle {setting}", "vaxla {setting}"],
      resolve: resolveBool("toggle"),
    },
    {
      id: "setting.reset",
      phrases: [
        "reset {setting}",
        "reset the {setting}",
        "default {setting}",
        "aterstall {setting}",
      ],
      resolve: resolveReset,
    },
  ];
}

export function createVoiceRegistry(): VoiceCommandRegistry<VoiceContext> {
  return new VoiceCommandRegistry(voiceCommands());
}
