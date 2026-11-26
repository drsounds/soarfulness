import type { VoiceLlmModel, WebLlmModel } from "../settings";
import type { ChatMessage } from "./prompt";
import type { LlmEngine } from "./LlmInterpreter";
import type { LocalLlm, LocalLlmState } from "./LocalLlm";
import type { NativeLlm } from "./NativeLlm";
import type { JsonSchema } from "./VoiceToolbox";

// VOICE → LLM: the one model the interpreter talks to, picked from
// VOICE → AI MODEL. "gemini-nano" is Android's Gemini Nano (NativeLlm); the
// rest run in the page on WebGPU (LocalLlm). "auto" takes Gemini Nano in the
// Android app (the plugin is there) and the smallest WebGPU model elsewhere.
// Only the chosen backend is ever started.

export type ResolvedLlmModel = "gemini-nano" | WebLlmModel;

export function resolveLlmModel(model: VoiceLlmModel, nativeAvailable: boolean): ResolvedLlmModel {
  if (model === "auto") return nativeAvailable ? "gemini-nano" : "qwen2.5-0.5b";
  return model;
}

const OFF: LocalLlmState = { status: "off", model: null, progress: 0, detail: "", error: null };

export class LlmSwitch implements LlmEngine {
  private active: LocalLlm | NativeLlm | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly web: LocalLlm,
    private readonly native: NativeLlm,
    private readonly nativeAvailable: () => boolean,
  ) {
    const forward = () => this.listeners.forEach((l) => l());
    web.subscribe(forward);
    native.subscribe(forward);
  }

  /** The chosen backend's state; "unsupported" for Gemini Nano outside the Android app. */
  get = (): LocalLlmState => this.active?.get() ?? this.offState;

  private offState: LocalLlmState = OFF;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  /** Called every frame by VoiceRuntime. */
  sync(on: boolean, model: VoiceLlmModel): void {
    if (!on) {
      this.web.sync(false, "qwen2.5-0.5b");
      this.native.sync(false);
      this.active = null;
      this.setOff(OFF);
      return;
    }
    const native = this.nativeAvailable();
    const resolved = resolveLlmModel(model, native);
    if (resolved === "gemini-nano") {
      this.web.sync(false, "qwen2.5-0.5b");
      if (!native) {
        // Chosen by hand in a browser: there is no Gemini Nano here.
        this.native.sync(false);
        this.active = null;
        this.setOff({ ...OFF, status: "unsupported", model: "gemini-nano" });
        return;
      }
      this.active = this.native;
      this.native.sync(true);
    } else {
      this.native.sync(false);
      this.active = this.web;
      this.web.sync(true, resolved);
    }
  }

  private setOff(s: LocalLlmState) {
    if (this.offState.status === s.status && this.offState.model === s.model) return;
    this.offState = s;
    this.listeners.forEach((l) => l());
  }

  isReady(): boolean {
    return !!this.active?.isReady();
  }

  complete(messages: ChatMessage[], schema: JsonSchema | null): Promise<string> {
    if (!this.active) return Promise.reject(new Error("no model"));
    return this.active.complete(messages, schema);
  }

  interrupt(): void {
    this.active?.interrupt();
  }

  download(): Promise<void> {
    return this.active?.download() ?? Promise.resolve();
  }

  remove(): Promise<void> {
    return this.active?.remove() ?? Promise.resolve();
  }

  shutdown(): void {
    this.sync(false, "auto");
  }
}
