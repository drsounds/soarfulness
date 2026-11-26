import type { ChatMessage } from "./prompt";

// VOICE → LLM: messages between LocalLlm (page) and llmWorker.ts.

export type WorkerRequest =
  | { type: "check"; id: number; modelId: string }
  | { type: "load"; id: number; modelId: string }
  | { type: "remove"; id: number; modelId: string }
  | { type: "unload"; id: number }
  | {
      type: "complete";
      id: number;
      messages: ChatMessage[];
      /** JSON schema as a string, or null for plain JSON mode. */
      schema: string | null;
      maxTokens: number;
    }
  | { type: "interrupt" };

export type WorkerReply =
  | { type: "progress"; progress: number; text: string }
  | { type: "result"; id: number; ok: true; value: unknown }
  | { type: "result"; id: number; ok: false; error: string };
