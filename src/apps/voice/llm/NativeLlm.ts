import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { LlmEngine } from "./LlmInterpreter";
import type { LocalLlmState } from "./LocalLlm";
import type { ChatMessage } from "./prompt";
import type { JsonSchema } from "./VoiceToolbox";

// VOICE → LLM: Android's own on-device model, Gemini Nano, through the
// native OnDeviceLlm plugin (android/.../OnDeviceLlmPlugin.java, ML Kit
// GenAI Prompt API on AICore). Google documents that input, inference and
// output stay on the device; the plugin sends nothing anywhere itself.
//
// Gemini Nano is installed and updated by Android (AICore), not by the app:
//   UNAVAILABLE  → "unsupported" (phone without Gemini Nano, unlocked bootloader...)
//   DOWNLOADABLE → "absent": DOWNLOAD MODEL asks AICore to fetch it
//   DOWNLOADING  → "downloading"
//   AVAILABLE    → "ready"
// There is no DELETE: AICore shares the model between apps.
//
// The Java API has no JSON-schema constraint, so the answer is only asked
// for as JSON; parseReply() is tolerant and the toolbox validates every call.
// AICore only answers while the app is in the foreground, with a per-app
// quota (BUSY): such errors make the interpreter fall back to the rules.

type NativeStatus = "unavailable" | "downloadable" | "downloading" | "available";

export interface OnDeviceLlmPlugin {
  status(): Promise<{ status: NativeStatus; error?: string }>;
  /** Resolves when AICore has the model. */
  download(): Promise<void>;
  generate(opts: { prompt: string; temperature: number }): Promise<{ text: string }>;
  cancel(): Promise<void>;
  addListener(
    event: "download",
    listener: (e: {
      phase: "started" | "progress" | "done" | "failed";
      bytes?: number;
      error?: string;
    }) => void,
  ): Promise<PluginListenerHandle>;
}

const OnDeviceLlmNative = registerPlugin<OnDeviceLlmPlugin>("OnDeviceLlm");

/** The Android app with the OnDeviceLlm plugin (not: browsers, older app builds). */
export function nativeLlmAvailable(): boolean {
  return (
    Capacitor.getPlatform() === "android" &&
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable("OnDeviceLlm")
  );
}

/** One prompt for an API that takes plain text: the instructions, then the phrase. */
export function flattenMessages(messages: ChatMessage[]): string {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const user = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  return `${system}\n\nWhat was said: "${user}"\nJSON:`;
}

export class NativeLlm implements LlmEngine {
  private state: LocalLlmState = {
    status: "off",
    model: null,
    progress: 0,
    detail: "",
    error: null,
    canRemove: false,
  };
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private progressHandle: PluginListenerHandle | null = null;

  constructor(private readonly plugin: OnDeviceLlmPlugin = OnDeviceLlmNative) {}

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

  sync(on: boolean): void {
    if (!on) {
      if (this.state.status !== "off") this.shutdown();
      return;
    }
    if (this.state.status !== "off") return;
    const gen = ++this.generation;
    this.emit({ status: "checking", model: "gemini-nano", progress: 0, detail: "", error: null });
    void this.check(gen);
  }

  private async check(gen: number): Promise<void> {
    try {
      const { status, error } = await this.plugin.status();
      if (gen !== this.generation) return;
      if (status === "available") this.emit({ status: "ready", progress: 1 });
      else if (status === "downloadable") this.emit({ status: "absent" });
      else if (status === "downloading") void this.download();
      else this.emit({ status: "unsupported", error: error ?? null });
    } catch (e) {
      if (gen === this.generation) this.emit({ status: "error", error: String(e) });
    }
  }

  /** VOICE → DOWNLOAD MODEL: asks AICore for Gemini Nano (or waits for a download in progress). */
  async download(): Promise<void> {
    if (this.state.status === "ready" || this.state.status === "off") return;
    const gen = ++this.generation;
    this.emit({ status: "downloading", progress: -1, detail: "", error: null });
    this.progressHandle ??= await this.plugin.addListener("download", (e) => {
      if (this.state.status !== "downloading") return;
      if (e.bytes !== undefined) this.emit({ detail: `${Math.round(e.bytes / 1e6)} MB` });
    });
    try {
      await this.plugin.download();
      if (gen === this.generation) this.emit({ status: "ready", progress: 1, detail: "" });
    } catch (e) {
      if (gen === this.generation) this.emit({ status: "error", error: String(e) });
    }
  }

  /** Android manages Gemini Nano; nothing to delete from the app. */
  async remove(): Promise<void> {}

  async complete(messages: ChatMessage[], _schema: JsonSchema | null): Promise<string> {
    if (!this.isReady()) throw new Error("model not ready");
    const { text } = await this.plugin.generate({
      prompt: flattenMessages(messages),
      temperature: 0,
    });
    return text;
  }

  interrupt(): void {
    void this.plugin.cancel().catch(() => undefined);
  }

  shutdown(): void {
    this.generation++;
    void this.progressHandle?.remove();
    this.progressHandle = null;
    this.emit({ status: "off", model: null, progress: 0, detail: "", error: null });
  }
}
