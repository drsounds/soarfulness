import { clamp, fixedVoiceCommands, fmt, parseDirection, setTo, stepTo } from "../commands";
import type { VoiceContext } from "../commands";
import type { SettingTarget } from "../settingTargets";
import { parseSpokenValue } from "../spokenValue";
import { bestNameMatch, tokens } from "../textMatch";
import type { VoiceAction, VoiceDirectionTarget } from "../voiceActions";
import type { VoiceCommand, VoiceOutcome } from "../VoiceCommandRegistry";

// VOICE → LLM: the app's internal MCP server. The on-device LLM never
// touches the app directly: it asks for tool calls, and this toolbox checks
// them against the settings registry (the same SettingTargets the rules
// matcher uses, with the sliders' ranges and steps and the lists' options)
// and turns them into the same VoiceOutcome (settings patch + host actions)
// a rules match produces. A call that names an unknown setting or a value
// of the wrong kind is refused, never guessed into something else.
//
// It follows the shape of MCP's tools/list and tools/call (name,
// description, JSON Schema inputSchema; content text and isError), but it
// is in-process only: there is no transport, nothing is served, and
// nothing leaves the page.

export type JsonSchema = Record<string, unknown>;

export type ToolInfo = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** Only reads (list_settings, get_setting): not offered to the LLM as an action. */
  readOnly?: boolean;
};

export type ToolResult = {
  /** MCP-style text content for the caller. */
  text: string;
  isError?: boolean;
  /** What the call does to the app (action tools). */
  outcome?: VoiceOutcome;
};

export type ToolCall = { tool: string; args: Record<string, unknown> };

const COMPASS = [
  "north",
  "north east",
  "east",
  "south east",
  "south",
  "south west",
  "west",
  "north west",
];
const RELATIVE = ["forward", "right", "back", "left"];
const MAX_LIST = 40;
/** Words that never name a setting ("can you make it a bit ..."). */
const STOPWORDS = new Set(
  "a an the it its it's is be to of and or in on at for with my me i you we can could would please " +
    "make made let lets want like bit little lot much more less too very some just now so " +
    "set turn get go put give do does this that there here up down ".split(/\s+/).filter(Boolean),
);

/** One line about a setting for the model: key, label, kind, range, value. */
export function describeSetting(t: SettingTarget, value: unknown): string {
  let range = "";
  if (t.kind === "number") {
    const lo = t.min ?? "-∞";
    const hi = t.max ?? "∞";
    range = ` ${lo}..${hi} step ${fmt(t.step)}`;
  } else if (t.kind === "enum") {
    range = ` one of ${t.options!.map((o) => o.value).join("|")}`;
  }
  return `${t.key} "${t.label}" ${t.kind}${range} = ${fmt(value)}`;
}

const err = (text: string): ToolResult => ({ text, isError: true });

export class VoiceToolbox {
  private readonly commands: VoiceCommand<VoiceContext>[];
  private readonly byId: Map<string, VoiceCommand<VoiceContext>>;
  private schemaCache: { targets: SettingTarget[]; tools: ToolInfo[] } | null = null;

  constructor(commands: VoiceCommand<VoiceContext>[] = fixedVoiceCommands()) {
    this.commands = commands.filter((c) => !c.whileAsleep);
    this.byId = new Map(this.commands.map((c) => [c.id, c]));
  }

  /** The fixed commands run_command can run, with their first phrase. */
  commandList(): { id: string; phrase: string }[] {
    return this.commands.map((c) => ({ id: c.id, phrase: c.phrases[0] }));
  }

  /** MCP tools/list. Schemas come from the current settings targets. */
  listTools(ctx: VoiceContext): ToolInfo[] {
    const targets = ctx.settings.targets;
    if (this.schemaCache?.targets === targets) return this.schemaCache.tools;
    const keys = targets.map((t) => t.key);
    const key = { type: "string", enum: keys, description: "Setting key" };
    const target = { type: "string", enum: ["sway", "waves"] };
    const tools: ToolInfo[] = [
      {
        name: "run_command",
        description:
          "Run one of the app's fixed commands: switch mode (swim, fly, swing, whirlpool, bodyflight, watercraft), swing higher/lower/faster/slower, soar/sink/hover while flying, fly faster/slower, open/close settings, help, stop listening.",
        inputSchema: {
          type: "object",
          properties: { command: { type: "string", enum: this.commands.map((c) => c.id) } },
          required: ["command"],
        },
      },
      {
        name: "set_setting",
        description:
          'Set a setting to a value: a number within its range, true/false for on/off settings, one of its options for list settings, or "min", "max", "default".',
        inputSchema: {
          type: "object",
          properties: {
            key,
            value: { type: ["number", "boolean", "string"] },
          },
          required: ["key", "value"],
        },
      },
      {
        name: "adjust_setting",
        description:
          "Make a setting higher or lower by slider steps (default 1; 5 for 'a lot'), or by an exact amount. On/off settings: up = on, down = off. List settings: next/previous option.",
        inputSchema: {
          type: "object",
          properties: {
            key,
            direction: { type: "string", enum: ["up", "down"] },
            steps: { type: "number" },
            amount: { type: "number" },
          },
          required: ["key", "direction"],
        },
      },
      {
        name: "toggle_setting",
        description: "Flip an on/off setting.",
        inputSchema: { type: "object", properties: { key }, required: ["key"] },
      },
      {
        name: "reset_setting",
        description: "Put a setting back to its default.",
        inputSchema: { type: "object", properties: { key }, required: ["key"] },
      },
      {
        name: "point_direction",
        description:
          "Point the sway or the waves: a compass direction, a bearing in degrees (0 = north), or relative to where the camera looks.",
        inputSchema: {
          type: "object",
          properties: {
            target,
            compass: { type: "string", enum: COMPASS },
            bearing: { type: "number" },
            relative: { type: "string", enum: RELATIVE },
          },
          required: ["target"],
        },
      },
      {
        name: "turn_direction",
        description: "Turn the sway or the waves 45 degrees left or right.",
        inputSchema: {
          type: "object",
          properties: { target, side: { type: "string", enum: ["left", "right"] } },
          required: ["target", "side"],
        },
      },
      {
        name: "list_settings",
        description:
          "Find settings by words in their name; returns key, label, kind, range and value.",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" }, limit: { type: "number" } },
        },
        readOnly: true,
      },
      {
        name: "get_setting",
        description: "Read one setting's current value and range.",
        inputSchema: { type: "object", properties: { key }, required: ["key"] },
        readOnly: true,
      },
    ];
    this.schemaCache = { targets, tools };
    return tools;
  }

  /** MCP tools/call. Never throws: a bad call comes back with isError. */
  callTool(name: string, rawArgs: unknown, ctx: VoiceContext): ToolResult {
    const args = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;
    try {
      switch (name) {
        case "run_command":
          return this.runCommand(args, ctx);
        case "set_setting":
          return this.withTarget(args, ctx, (t) => this.set(t, args.value));
        case "adjust_setting":
          return this.withTarget(args, ctx, (t) => this.adjust(t, args, ctx));
        case "toggle_setting":
          return this.withTarget(args, ctx, (t) =>
            t.kind === "bool"
              ? ok(setTo(t, !ctx.get(t.key), 1).outcome)
              : err(`${t.key} is not an on/off setting`),
          );
        case "reset_setting":
          return this.withTarget(args, ctx, (t) => ok(setTo(t, t.defaultValue, 1).outcome));
        case "point_direction":
          return this.point(args);
        case "turn_direction":
          return this.turn(args);
        case "list_settings":
          return {
            text: this.findSettings(String(args.query ?? ""), ctx, Number(args.limit) || 15).join(
              "\n",
            ),
          };
        case "get_setting":
          return this.withTarget(args, ctx, (t) => ({ text: describeSetting(t, ctx.get(t.key)) }));
        default:
          return err(`unknown tool ${name}`);
      }
    } catch (e) {
      return err(String(e));
    }
  }

  /** Settings whose names best match some of `query`'s words, most likely first. */
  findSettings(query: string, ctx: VoiceContext, limit = 15): string[] {
    return this.rankSettings(query, ctx.settings.targets)
      .slice(0, Math.min(limit, MAX_LIST))
      .map((t) => describeSetting(t, ctx.get(t.key)));
  }

  /**
   * Targets ranked by how well any of their names matches any run of one
   * to three words of `query`, or failing that shares a word stem with it
   * ("snowing" → SNOW AMOUNT). A feature's on/off setting brings its
   * siblings along (snowOn → snowAmount, snowSpeed...). With no query:
   * every target, in order.
   */
  rankSettings(query: string, targets: readonly SettingTarget[], floor = 0.6): SettingTarget[] {
    const words = tokens(query).filter((w) => !STOPWORDS.has(w));
    if (words.length === 0) return tokens(query).length ? [] : [...targets];
    const grams: string[][] = [];
    for (let n = 1; n <= 3; n++)
      for (let i = 0; i + n <= words.length; i++) grams.push(words.slice(i, i + n));
    const stems = words.filter((w) => w.length >= 4);
    const scores = new Map<SettingTarget, number>();
    for (const t of targets) {
      let best = 0;
      for (const g of grams) {
        const { score } = bestNameMatch(g, t.names);
        // Longer matches say more: "wave height" beats "wave".
        best = Math.max(best, score * (1 + 0.05 * (g.length - 1)));
      }
      for (const name of t.names) {
        const shared = name.filter(
          (w) => w.length >= 4 && stems.some((h) => h.startsWith(w) || w.startsWith(h)),
        ).length;
        if (shared) best = Math.max(best, 0.55 + (0.1 * shared) / name.length);
      }
      if (best >= floor) scores.set(t, best);
    }
    for (const [t, score] of [...scores]) {
      if (t.kind !== "bool" || !/On$/.test(t.key)) continue;
      const prefix = t.key.slice(0, -2);
      for (const s of targets)
        if (s !== t && s.key.startsWith(prefix) && !scores.has(s)) scores.set(s, score * 0.9);
    }
    return [...scores].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }

  private runCommand(args: Record<string, unknown>, ctx: VoiceContext): ToolResult {
    const c = this.byId.get(String(args.command ?? ""));
    if (!c) return err(`unknown command ${String(args.command)}`);
    const res = c.resolve({}, ctx);
    return res ? ok(res.outcome) : err(`${c.id} can't run now`);
  }

  /** The setting `args.key` names: a key, or failing that a spoken name. */
  private withTarget(
    args: Record<string, unknown>,
    ctx: VoiceContext,
    f: (t: SettingTarget) => ToolResult,
  ): ToolResult {
    const raw = String(args.key ?? "");
    let t = ctx.settings.get(raw);
    if (!t) {
      const found = ctx.settings.resolve(tokens(raw));
      if (found && found.score >= 0.8) t = found.target;
    }
    return t ? f(t) : err(`unknown setting ${raw}`);
  }

  private set(t: SettingTarget, value: unknown): ToolResult {
    if (value === undefined || value === null) return err("value missing");
    if (t.kind === "enum") {
      const s = String(value);
      const exact = t.options!.find((o) => o.value === s);
      if (exact) return ok(setTo(t, exact.value, 1).outcome);
      if (s === "default") return ok(setTo(t, t.defaultValue, 1).outcome);
      const names = t.options!.flatMap((o) => o.names);
      const owners = t.options!.flatMap((o) => o.names.map(() => o.value));
      const m = bestNameMatch(tokens(s), names);
      if (m.score < 0.75) return err(`${s} is not an option of ${t.key}`);
      return ok(setTo(t, owners[m.index], 1).outcome);
    }
    if (t.kind === "bool") {
      if (typeof value === "boolean") return ok(setTo(t, value, 1).outcome);
      if (value === 1 || value === 0) return ok(setTo(t, value === 1, 1).outcome);
      const v = parseSpokenValue(tokens(String(value)));
      if (v?.kind === "bool") return ok(setTo(t, v.value, 1).outcome);
      if (v?.kind === "limit" && v.which === "default")
        return ok(setTo(t, t.defaultValue, 1).outcome);
      return err(`${t.key} takes true or false`);
    }
    // number
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return err("not a number");
      return ok(setTo(t, clamp(t, value), 1).outcome);
    }
    if (typeof value === "boolean") return err(`${t.key} takes a number`);
    const v = parseSpokenValue(tokens(String(value)));
    if (!v || v.kind === "bool") return err(`${t.key} takes a number`);
    if (v.kind === "limit") {
      const to =
        v.which === "default" ? (t.defaultValue as number) : v.which === "max" ? t.max : t.min;
      return to === undefined ? err(`${t.key} has no ${v.which}`) : ok(setTo(t, to, 1).outcome);
    }
    let n = v.value;
    if (v.percent && t.min !== undefined && t.max !== undefined)
      n = t.min + ((t.max - t.min) * n) / 100;
    else if (v.percent) n = n / 100;
    return ok(setTo(t, clamp(t, n), 1).outcome);
  }

  private adjust(t: SettingTarget, args: Record<string, unknown>, ctx: VoiceContext): ToolResult {
    const dir = args.direction === "down" ? -1 : args.direction === "up" ? 1 : 0;
    if (!dir) return err("direction must be up or down");
    if (t.kind === "bool") return ok(setTo(t, dir > 0, 1).outcome);
    if (t.kind === "enum") {
      const opts = t.options!;
      const cur = opts.findIndex((o) => o.value === ctx.get(t.key));
      return ok(setTo(t, opts[(cur + dir + opts.length) % opts.length].value, 1).outcome);
    }
    const cur = Number(ctx.get(t.key));
    if (!Number.isFinite(cur)) return err(`${t.key} has no value`);
    const amount = Number(args.amount);
    const steps = Number(args.steps);
    const delta =
      Number.isFinite(amount) && amount !== 0
        ? Math.abs(amount)
        : t.step * ctx.stepScale * (Number.isFinite(steps) && steps > 0 ? Math.min(steps, 50) : 1);
    return ok(setTo(t, stepTo(t, cur, cur + dir * delta), 1).outcome);
  }

  private point(args: Record<string, unknown>): ToolResult {
    const target = directionTarget(args.target);
    if (!target) return err("target must be sway or waves");
    const name = target === "sway" ? "SWAY" : "WAVES";
    let action: VoiceAction | null = null;
    let what = "";
    if (typeof args.bearing === "number" && Number.isFinite(args.bearing)) {
      const b = ((args.bearing % 360) + 360) % 360;
      action = { type: "direction", target, bearing: b };
      what = `${b}°`;
    } else {
      const words = String(args.compass ?? args.relative ?? "");
      const d = parseDirection(tokens(words));
      if (d) {
        action = { type: "direction", target, ...d.dir };
        what = "bearing" in d.dir ? `${d.dir.bearing}°` : words.toUpperCase();
      }
    }
    if (!action) return err("give a compass direction, a bearing or a relative direction");
    return ok({ label: `${name} → ${what}`, actions: [action] });
  }

  private turn(args: Record<string, unknown>): ToolResult {
    const target = directionTarget(args.target);
    if (!target) return err("target must be sway or waves");
    const turn = args.side === "left" ? -45 : args.side === "right" ? 45 : 0;
    if (!turn) return err("side must be left or right");
    const name = target === "sway" ? "SWAY" : "WAVES";
    return ok({
      label: `${name} ${turn > 0 ? "↻" : "↺"} 45°`,
      actions: [{ type: "direction", target, turn }],
    });
  }
}

function ok(outcome: VoiceOutcome): ToolResult {
  return { text: outcome.label, outcome };
}

function directionTarget(v: unknown): VoiceDirectionTarget | null {
  return v === "sway" || v === "waves" ? v : null;
}
