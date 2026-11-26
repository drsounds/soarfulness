import type { VoiceContext } from "../commands";
import type { VoiceMatch, VoiceOutcome } from "../VoiceCommandRegistry";
import { buildRequest, parseReply, type ChatMessage } from "./prompt";
import { VoiceToolbox, type JsonSchema, type ToolCall } from "./VoiceToolbox";

// VOICE → LLM: one phrase in, one VoiceMatch out. Asks the on-device model
// (an LlmEngine, normally LocalLlm) for tool calls, runs them through the
// toolbox (the app's internal MCP tools) and merges what they do into one
// outcome, which the host runs exactly like a rules match.
//
// Latency: phrases are answered one at a time, each with its own deadline
// from when it was heard (VOICE → LLM TIMEOUT). A phrase whose deadline
// passes, waiting or generating, gives up (the generation is interrupted)
// and the caller falls back to the rules.

/** What the interpreter needs from a model. */
export interface LlmEngine {
  isReady(): boolean;
  /** The model's answer text; `schema` constrains it when the engine can. */
  complete(messages: ChatMessage[], schema: JsonSchema | null): Promise<string>;
  /** Stop the generation in progress (its complete() then resolves early). */
  interrupt(): void;
}

export type LlmStatus = "ok" | "none" | "timeout" | "error" | "unavailable";

export type LlmResult = {
  match: VoiceMatch | null;
  status: LlmStatus;
  /** From the phrase being handed over to the answer being read. */
  ms: number;
  calls: ToolCall[];
  /** Calls the toolbox refused, with why. */
  refused: string[];
  error?: string;
};

export class LlmInterpreter {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly engine: LlmEngine,
    readonly toolbox: VoiceToolbox = new VoiceToolbox(),
  ) {}

  interpret(text: string, ctx: VoiceContext, timeoutMs: number): Promise<LlmResult> {
    const t0 = performance.now();
    const deadline = t0 + Math.max(0, timeoutMs);
    const result = (status: LlmStatus, extra: Partial<LlmResult> = {}): LlmResult => ({
      match: null,
      status,
      ms: performance.now() - t0,
      calls: [],
      refused: [],
      ...extra,
    });
    const job = this.queue.then(async (): Promise<LlmResult> => {
      if (!this.engine.isReady()) return result("unavailable");
      const left = deadline - performance.now();
      if (left <= 0) return result("timeout");
      const { messages, schema } = buildRequest(text, this.toolbox, ctx);
      const completion = this.engine.complete(messages, schema);
      let timer: ReturnType<typeof setTimeout> | null = null;
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), left);
      });
      let reply: string | "timeout";
      try {
        reply = await Promise.race([completion, timeout]);
      } catch (e) {
        return result("error", { error: String(e) });
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (reply === "timeout") {
        this.engine.interrupt();
        // Let the interrupted generation finish before the next phrase starts.
        await completion.catch(() => undefined);
        return result("timeout");
      }
      const calls = parseReply(reply);
      const { outcome, refused } = this.run(calls, ctx);
      if (!outcome) return result("none", { calls, refused });
      return result("ok", {
        calls,
        refused,
        match: {
          commandId: `llm:${calls.map((c) => c.tool).join("+")}`,
          phrase: "LLM",
          heard: text,
          score: 1,
          outcome,
        },
      });
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  /** Runs the calls through the toolbox and merges what they do. */
  run(calls: ToolCall[], ctx: VoiceContext): { outcome: VoiceOutcome | null; refused: string[] } {
    const readOnly = new Set(
      this.toolbox
        .listTools(ctx)
        .filter((t) => t.readOnly)
        .map((t) => t.name),
    );
    const labels: string[] = [];
    const patch: Record<string, unknown> = {};
    const actions: NonNullable<VoiceOutcome["actions"]> = [];
    const refused: string[] = [];
    for (const call of calls) {
      if (readOnly.has(call.tool)) {
        refused.push(`${call.tool}: read-only`);
        continue;
      }
      const res = this.toolbox.callTool(call.tool, call.args, ctx);
      if (res.isError || !res.outcome) {
        refused.push(`${call.tool}: ${res.text}`);
        continue;
      }
      labels.push(res.outcome.label);
      Object.assign(patch, res.outcome.patch ?? {});
      actions.push(...(res.outcome.actions ?? []));
    }
    if (labels.length === 0) return { outcome: null, refused };
    const outcome: VoiceOutcome = { label: labels.join(" · ") };
    if (Object.keys(patch).length) outcome.patch = patch;
    if (actions.length) outcome.actions = actions;
    return { outcome, refused };
  }
}
