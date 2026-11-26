/// <reference lib="webworker" />
import {
  CreateMLCEngine,
  deleteModelAllInfoInCache,
  hasModelInCache,
  type InitProgressReport,
  type MLCEngine,
} from "@mlc-ai/web-llm";
import { closeOtherChannels, guardFetch } from "./networkGuard";
import type { WorkerReply, WorkerRequest } from "./workerProtocol";

// VOICE → LLM: the worker the on-device model runs in (WebLLM on WebGPU).
//
// Privacy: this worker's network is closed except while a model is being
// downloaded, loaded or removed, and then only GET requests to
// the model hosts (models.ts MODEL_HOSTS) are let through. While it answers
// a phrase, every fetch is refused, and sockets, XHR and beacons are not
// available at all, so nothing the model reads (the phrase, the settings)
// or writes can leave the device from here.

declare const self: DedicatedWorkerGlobalScope;

let netOpen = false;
self.fetch = guardFetch(self.fetch.bind(self), () => netOpen);
closeOtherChannels(self as unknown as Record<string, unknown>);

let engine: MLCEngine | null = null;
let loadedId: string | null = null;
let schemaWorks = true;

const reply = (r: WorkerReply) => self.postMessage(r);

async function withNetwork<T>(f: () => Promise<T>): Promise<T> {
  netOpen = true;
  try {
    return await f();
  } finally {
    netOpen = false;
  }
}

async function load(modelId: string): Promise<void> {
  if (engine && loadedId === modelId) return;
  await unload();
  engine = await withNetwork(() =>
    CreateMLCEngine(modelId, {
      initProgressCallback: (p: InitProgressReport) =>
        reply({ type: "progress", progress: p.progress, text: p.text }),
      logLevel: "WARN",
    }),
  );
  loadedId = modelId;
}

async function unload(): Promise<void> {
  if (!engine) return;
  const e = engine;
  engine = null;
  loadedId = null;
  await e.unload();
}

async function complete(
  messages: { role: "system" | "user"; content: string }[],
  schema: string | null,
  maxTokens: number,
): Promise<string> {
  if (!engine) throw new Error("no model loaded");
  const ask = async (withSchema: boolean) => {
    const res = await engine!.chat.completions.create({
      messages,
      temperature: 0,
      max_tokens: maxTokens,
      stream: false,
      response_format:
        withSchema && schema ? { type: "json_object", schema } : { type: "json_object" },
    });
    return res.choices[0]?.message?.content ?? "";
  };
  if (schemaWorks) {
    try {
      return await ask(true);
    } catch (e) {
      // A schema the grammar compiler can't take: plain JSON mode from now on.
      if (!/grammar|schema|json/i.test(String(e))) throw e;
      schemaWorks = false;
    }
  }
  return ask(false);
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const m = ev.data;
  if (m.type === "interrupt") {
    engine?.interruptGenerate();
    return;
  }
  try {
    switch (m.type) {
      case "check": {
        // Cache storage only: the network stays closed.
        const cached = await hasModelInCache(m.modelId).catch(() => false);
        reply({ type: "result", id: m.id, ok: true, value: cached });
        break;
      }
      case "load":
        await load(m.modelId);
        reply({ type: "result", id: m.id, ok: true, value: true });
        break;
      case "remove":
        if (loadedId === m.modelId) await unload();
        await withNetwork(() => deleteModelAllInfoInCache(m.modelId));
        reply({ type: "result", id: m.id, ok: true, value: true });
        break;
      case "unload":
        await unload();
        reply({ type: "result", id: m.id, ok: true, value: true });
        break;
      case "complete": {
        const text = await complete(m.messages, m.schema, m.maxTokens);
        reply({ type: "result", id: m.id, ok: true, value: text });
        break;
      }
    }
  } catch (e) {
    reply({ type: "result", id: m.id, ok: false, error: String(e) });
  }
};
