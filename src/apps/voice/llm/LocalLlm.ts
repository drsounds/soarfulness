import { useSyncExternalStore } from "react";
import type { VoiceLlmModel } from "../settings";
import type { LlmEngine } from "./LlmInterpreter";
import { LLM_MODELS } from "./models";
import type { ChatMessage } from "./prompt";
import type { JsonSchema } from "./VoiceToolbox";
import type { WorkerReply, WorkerRequest } from "./workerProtocol";

// VOICE → LLM: the on-device model, from the page's side. The model runs in
// a worker (llmWorker.ts, WebLLM on WebGPU), which is created only when the
// LLM interpreter is switched on, and whose network is closed while it
// answers. The WebLLM code is in the worker's chunk only, so it is not part
// of the app bundle.
//
// Lifecycle (status):
//   off           interpreter is "rules" or voice is off: no worker
//   unsupported   no WebGPU here
//   checking      looking in cache storage for the model
//   absent        not downloaded: the panel offers DOWNLOAD (never automatic)
//   downloading   fetching the weights (progress 0–1), then loading them
//   loading       loading a cached model onto the GPU
//   ready         answering phrases
//   error         see `error`; DOWNLOAD retries

export type LocalLlmStatus =
  | "off"
  | "unsupported"
  | "checking"
  | "absent"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

export type LocalLlmState = {
  status: LocalLlmStatus;
  model: VoiceLlmModel | null;
  progress: number;
  /** WebLLM's progress text while downloading / loading. */
  detail: string;
  error: string | null;
};

type Pending = { resolve(v: unknown): void; reject(e: Error): void };

const MAX_TOKENS = 160;

export type WorkerLike = Pick<Worker, "postMessage" | "terminate"> & {
  onmessage: ((ev: MessageEvent<WorkerReply>) => void) | null;
};

function defaultWorker(): WorkerLike {
  return new Worker(new URL("./llmWorker.ts", import.meta.url), {
    type: "module",
    name: "voice-llm",
  }) as unknown as WorkerLike;
}

async function defaultGpu(): Promise<boolean> {
  const gpu = (globalThis.navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } })
    ?.gpu;
  if (!gpu) return false;
  try {
    return !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

export class LocalLlm implements LlmEngine {
  private state: LocalLlmState = {
    status: "off",
    model: null,
    progress: 0,
    detail: "",
    error: null,
  };
  private readonly listeners = new Set<() => void>();
  private worker: WorkerLike | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  /** Bumped on every sync change, so a stale check/load can't overwrite a newer state. */
  private generation = 0;

  constructor(
    private readonly createWorker: () => WorkerLike = defaultWorker,
    private readonly gpuAvailable: () => Promise<boolean> = defaultGpu,
  ) {}

  get = (): LocalLlmState => this.state;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private emit(patch: Partial<LocalLlmState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  isReady(): boolean {
    return this.state.status === "ready";
  }

  /**
   * Called every frame by VoiceRuntime: `on` when voice listens with an LLM
   * interpreter. Starts the worker and loads a model already in the cache;
   * a model that isn't there waits for download().
   */
  sync(on: boolean, model: VoiceLlmModel): void {
    if (!on) {
      if (this.state.status !== "off") this.shutdown();
      return;
    }
    if (this.state.model === model && this.state.status !== "off") return;
    this.generation++;
    this.emit({ status: "checking", model, progress: 0, detail: "", error: null });
    void this.check(model, this.generation);
  }

  private async check(model: VoiceLlmModel, gen: number): Promise<void> {
    if (!(await this.gpuAvailable())) {
      if (gen === this.generation) this.emit({ status: "unsupported" });
      return;
    }
    try {
      const cached = (await this.call({
        type: "check",
        modelId: LLM_MODELS[model].webllmId,
      })) as boolean;
      if (gen !== this.generation) return;
      if (!cached) {
        this.emit({ status: "absent" });
        return;
      }
      await this.load(model, gen, "loading");
    } catch (e) {
      if (gen === this.generation) this.emit({ status: "error", error: String(e) });
    }
  }

  private async load(model: VoiceLlmModel, gen: number, status: "loading" | "downloading") {
    this.emit({ status, progress: 0, detail: "", error: null });
    await this.call({ type: "load", modelId: LLM_MODELS[model].webllmId });
    if (gen === this.generation) this.emit({ status: "ready", progress: 1, detail: "" });
  }

  /** VOICE → DOWNLOAD MODEL: fetch the weights once, then load them. */
  async download(): Promise<void> {
    const model = this.state.model;
    if (!model || this.state.status === "downloading" || this.state.status === "ready") return;
    const gen = ++this.generation;
    try {
      await this.load(model, gen, "downloading");
    } catch (e) {
      if (gen === this.generation) this.emit({ status: "error", error: String(e) });
    }
  }

  /** VOICE → DELETE MODEL: frees the storage; the rules take over. */
  async remove(): Promise<void> {
    const model = this.state.model;
    if (!model) return;
    const gen = ++this.generation;
    try {
      await this.call({ type: "remove", modelId: LLM_MODELS[model].webllmId });
      if (gen === this.generation) this.emit({ status: "absent", progress: 0 });
    } catch (e) {
      if (gen === this.generation) this.emit({ status: "error", error: String(e) });
    }
  }

  async complete(messages: ChatMessage[], schema: JsonSchema | null): Promise<string> {
    if (!this.isReady()) throw new Error("model not ready");
    return (await this.call({
      type: "complete",
      messages,
      schema: schema ? JSON.stringify(schema) : null,
      maxTokens: MAX_TOKENS,
    })) as string;
  }

  interrupt(): void {
    this.worker?.postMessage({ type: "interrupt" } satisfies WorkerRequest);
  }

  /** Stops the worker: the model leaves GPU memory (it stays in the cache). */
  shutdown(): void {
    this.generation++;
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) p.reject(new Error("stopped"));
    this.pending.clear();
    this.emit({ status: "off", model: null, progress: 0, detail: "", error: null });
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const w = this.createWorker();
    w.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "progress") {
        if (this.state.status === "downloading" || this.state.status === "loading")
          this.emit({ progress: m.progress, detail: m.text });
        return;
      }
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (m.ok) p.resolve(m.value);
      else p.reject(new Error(m.error));
    };
    this.worker = w;
    return w;
  }

  private call(req: DistributiveOmit<Exclude<WorkerRequest, { type: "interrupt" }>, "id">) {
    const w = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      w.postMessage({ ...req, id } as WorkerRequest);
    });
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** The app's one on-device model. */
export const localLlm = new LocalLlm();

export function useLocalLlmState(): LocalLlmState {
  return useSyncExternalStore(localLlm.subscribe, localLlm.get, localLlm.get);
}
