import type { VoiceContext } from "../commands";
import type { SettingTarget } from "../settingTargets";
import { tokens } from "../textMatch";
import {
  describeSetting,
  type JsonSchema,
  type ToolCall,
  type ToolInfo,
  type VoiceToolbox,
} from "./VoiceToolbox";

// VOICE → LLM: what the on-device model is shown, and how its answer is read.
//
// One short request per phrase, no chat history: a system message with the
// action tools, the fixed command ids, and the dozen settings whose names
// come closest to what was heard (with their ranges and current values),
// then the phrase itself. The answer is constrained by a JSON schema built
// from the same tools (WebLLM compiles it to a grammar), so the model can
// only name tools, command ids and setting keys that exist.

export type ChatMessage = { role: "system" | "user"; content: string };

/** Settings always shown when nothing heard names one. */
const FALLBACK_KEYS = [
  "waveAmp",
  "swayAmp",
  "swingIntensity",
  "snowOn",
  "rainOn",
  "auroraOn",
  "timeOfDay",
  "freakOutOn",
];
export const MAX_CALLS = 3;
const MAX_CANDIDATES = 12;

const EXAMPLES = [
  [
    "make the waves a bit bigger",
    '{"calls":[{"tool":"adjust_setting","args":{"key":"waveAmp","direction":"up"}}]}',
  ],
  ["i want to go up", '{"calls":[{"tool":"run_command","args":{"command":"fly.soar"}}]}'],
  [
    "let the sway come from the east and make it stronger",
    '{"calls":[{"tool":"point_direction","args":{"target":"sway","compass":"east"}},{"tool":"adjust_setting","args":{"key":"swayAmp","direction":"up"}}]}',
  ],
  ["what a lovely day", '{"calls":[]}'],
];

function signature(t: ToolInfo): string {
  const props = (t.inputSchema.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((t.inputSchema.required as string[] | undefined) ?? []);
  const args = Object.keys(props)
    .map((k) => (required.has(k) ? k : `${k}?`))
    .join(", ");
  return `- ${t.name}(${args}): ${t.description}`;
}

/** The action tools: what the model may call. */
export function actionTools(toolbox: VoiceToolbox, ctx: VoiceContext): ToolInfo[] {
  return toolbox.listTools(ctx).filter((t) => !t.readOnly);
}

/**
 * Everyday words that mean a setting without naming it ("calmer sea",
 * "make it night"). Only for picking what the model is shown.
 */
const CONCEPTS: [RegExp, string[]][] = [
  [
    /^(sea|ocean|water|calm\w*|rough\w*|stormy?|choppy|hav\w*|lugn\w*)$/,
    ["waveAmp", "waveSpeed", "swayAmp", "surgeAmp"],
  ],
  [/^(night|day|dark\w*|sun\w*|morning|evening|dusk|dawn|natt|dag|kvall|morgon)$/, ["timeOfDay"]],
  [/^(cold\w*|winter|frost\w*|kall\w*|vinter)$/, ["snowOn", "snowAmount"]],
  [/^(wet|storm\w*|drizzl\w*)$/, ["rainOn"]],
  [/^(spin\w*|carousel|ride|karusell)$/, ["freakOutOn", "freakOutRotationSpeed"]],
  [/^(see|view|zoom\w*|wider|narrower)$/, ["camFov"]],
];

/** The settings most likely meant by `text`: what the model is shown and may name. */
export function candidateTargets(
  text: string,
  toolbox: VoiceToolbox,
  ctx: VoiceContext,
): SettingTarget[] {
  const out = new Set<SettingTarget>();
  for (const w of tokens(text))
    for (const [re, keys] of CONCEPTS)
      if (re.test(w))
        for (const k of keys) {
          const t = ctx.settings.get(k);
          if (t) out.add(t);
        }
  for (const t of toolbox.rankSettings(text, ctx.settings.targets)) {
    if (out.size >= MAX_CANDIDATES) break;
    out.add(t);
  }
  if (out.size === 0)
    for (const k of FALLBACK_KEYS) {
      const t = ctx.settings.get(k);
      if (t) out.add(t);
    }
  return [...out].slice(0, MAX_CANDIDATES);
}

/** The candidates as the model sees them. */
export function candidateSettings(
  text: string,
  toolbox: VoiceToolbox,
  ctx: VoiceContext,
): string[] {
  return candidateTargets(text, toolbox, ctx).map((t) => describeSetting(t, ctx.get(t.key)));
}

/** Messages and answer schema for one phrase. */
export function buildRequest(
  text: string,
  toolbox: VoiceToolbox,
  ctx: VoiceContext,
): { messages: ChatMessage[]; schema: JsonSchema } {
  const keys = candidateTargets(text, toolbox, ctx).map((t) => t.key);
  return { messages: buildMessages(text, toolbox, ctx), schema: replySchema(toolbox, ctx, keys) };
}

export function buildMessages(
  text: string,
  toolbox: VoiceToolbox,
  ctx: VoiceContext,
): ChatMessage[] {
  const tools = actionTools(toolbox, ctx).map(signature).join("\n");
  const commands = toolbox
    .commandList()
    .map((c) => `${c.id} "${c.phrase}"`)
    .join(", ");
  const settings = candidateSettings(text, toolbox, ctx).join("\n");
  const examples = EXAMPLES.map(([q, a]) => `"${q}" → ${a}`).join("\n");
  const system = [
    "You turn what someone said to a meditative ocean app into tool calls.",
    `Answer with JSON only: {"calls":[{"tool":"<name>","args":{...}}]}, at most ${MAX_CALLS} calls.`,
    'If nothing fits, answer {"calls":[]}. Use only the keys and command ids listed.',
    "",
    "Tools:",
    tools,
    "",
    `Commands for run_command: ${commands}`,
    "",
    'Settings that may be meant (key "LABEL" kind range = current value):',
    settings,
    "",
    "Examples:",
    examples,
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: text },
  ];
}

/**
 * The JSON schema the answer must follow (one anyOf branch per action
 * tool). With `keys`, setting keys are limited to those (the candidates the
 * model was shown), which also keeps the grammar small and quick to build.
 */
export function replySchema(toolbox: VoiceToolbox, ctx: VoiceContext, keys?: string[]): JsonSchema {
  const branches = actionTools(toolbox, ctx).map((t) => ({
    type: "object",
    properties: {
      tool: { type: "string", enum: [t.name] },
      args: {
        ...t.inputSchema,
        additionalProperties: false,
        properties: limitKeys(t.inputSchema, keys),
      },
    },
    required: ["tool", "args"],
    additionalProperties: false,
  }));
  return {
    type: "object",
    properties: {
      calls: { type: "array", maxItems: MAX_CALLS, items: { anyOf: branches } },
    },
    required: ["calls"],
    additionalProperties: false,
  };
}

function limitKeys(schema: JsonSchema, keys?: string[]): JsonSchema {
  const props = (schema.properties ?? {}) as Record<string, JsonSchema>;
  if (!keys || !props.key) return props;
  return { ...props, key: { ...props.key, enum: keys.length ? keys : ["none"] } };
}

/**
 * The tool calls in the model's answer. Tolerant of what small models do
 * without a grammar: text around the JSON, a bare array, a single call.
 */
export function parseReply(reply: string): ToolCall[] {
  const start = reply.search(/[[{]/);
  if (start < 0) return [];
  const end = Math.max(reply.lastIndexOf("}"), reply.lastIndexOf("]"));
  let data: unknown;
  try {
    data = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return [];
  }
  const list: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { calls?: unknown }).calls)
      ? (data as { calls: unknown[] }).calls
      : [data];
  const calls: ToolCall[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { tool, args, name, arguments: a } = item as Record<string, unknown>;
    const toolName = typeof tool === "string" ? tool : typeof name === "string" ? name : null;
    const toolArgs = args ?? a ?? {};
    if (!toolName || typeof toolArgs !== "object" || toolArgs === null) continue;
    calls.push({ tool: toolName, args: toolArgs as Record<string, unknown> });
    if (calls.length >= MAX_CALLS) break;
  }
  return calls;
}
