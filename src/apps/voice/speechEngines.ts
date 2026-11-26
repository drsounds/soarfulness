import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// VOICE: the two ways to hear the user, behind one interface.
//
// - "android": android/.../VoiceRecognitionPlugin.java, Android's own
//   SpeechRecognizer, restarted after every phrase so it listens
//   continuously. Used inside the Android app, where the WebView has no Web
//   Speech API.
// - "web-speech": the browser's SpeechRecognition (Chrome, Edge, Safari),
//   continuous with interim results, restarted when the browser ends it.
//
// Both report interim text, final phrases (with alternatives, most likely
// first) and their status.

export type EngineStatus = "starting" | "listening" | "denied" | "error" | "off";

export type EngineCallbacks = {
  onInterim(text: string): void;
  onFinal(alternatives: string[]): void;
  onStatus(status: EngineStatus, error?: string): void;
};

export interface SpeechEngine {
  readonly name: "android" | "web-speech";
  start(lang: string): void;
  stop(): void;
}

// ------------------------------------------------------------- android ----

interface VoiceRecognitionPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(options: { lang: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: "partial",
    listener: (e: { text?: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "result",
    listener: (e: { alternatives?: string[] }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "status",
    listener: (e: { status?: string; error?: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const VoiceRecognitionNative = registerPlugin<VoiceRecognitionPlugin>("VoiceRecognition");

export function nativeVoiceAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("VoiceRecognition");
}

class AndroidEngine implements SpeechEngine {
  readonly name = "android" as const;
  private handles: Promise<PluginListenerHandle>[] = [];

  constructor(private readonly cb: EngineCallbacks) {}

  start(lang: string) {
    this.stop();
    this.cb.onStatus("starting");
    this.handles = [
      VoiceRecognitionNative.addListener("partial", (e) => this.cb.onInterim(e.text ?? "")),
      VoiceRecognitionNative.addListener("result", (e) => this.cb.onFinal(e.alternatives ?? [])),
      VoiceRecognitionNative.addListener("status", (e) => {
        const s = e.status;
        if (s === "listening" || s === "denied" || s === "error" || s === "off" || s === "starting")
          this.cb.onStatus(s, e.error);
      }),
    ];
    VoiceRecognitionNative.start({ lang }).catch((err: unknown) =>
      this.cb.onStatus("error", String((err as Error)?.message ?? err)),
    );
  }

  stop() {
    if (this.handles.length === 0) return;
    for (const h of this.handles) h.then((x) => x.remove()).catch(() => {});
    this.handles = [];
    VoiceRecognitionNative.stop().catch(() => {});
    this.cb.onStatus("off");
  }
}

// ----------------------------------------------------------- web speech ----

type SpeechAlternative = { transcript: string; confidence: number };
type SpeechResult = { isFinal: boolean; length: number; [i: number]: SpeechAlternative };
type SpeechResultEvent = {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechResult };
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function webSpeechAvailable(): boolean {
  return recognitionCtor() !== null;
}

class WebSpeechEngine implements SpeechEngine {
  readonly name = "web-speech" as const;
  private rec: Recognition | null = null;
  private wanted = false;
  private lang = "en-US";
  private restartTimer: number | null = null;
  private startedAt = 0;
  private quickEnds = 0;

  constructor(private readonly cb: EngineCallbacks) {}

  start(lang: string) {
    this.stop();
    this.wanted = true;
    this.lang = lang;
    this.quickEnds = 0;
    this.cb.onStatus("starting");
    this.open();
  }

  stop() {
    this.wanted = false;
    if (this.restartTimer !== null) window.clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.rec) {
      const r = this.rec;
      this.rec = null;
      r.onend = null;
      r.onerror = null;
      r.onresult = null;
      try {
        r.abort();
      } catch {
        /* already stopped */
      }
      this.cb.onStatus("off");
    }
  }

  private open() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      this.cb.onStatus("error", "unsupported");
      return;
    }
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.onstart = () => {
      this.startedAt = Date.now();
      this.cb.onStatus("listening");
    };
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const alts: string[] = [];
          for (let j = 0; j < r.length; j++) alts.push(r[j].transcript);
          this.cb.onFinal(alts);
        } else {
          interim += r[0]?.transcript ?? "";
        }
      }
      this.cb.onInterim(interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.wanted = false;
        this.cb.onStatus("denied", e.error);
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        this.cb.onStatus("error", e.error);
      }
    };
    rec.onend = () => {
      this.rec = null;
      if (!this.wanted) return;
      // Browsers end continuous recognition now and then (silence, a minute
      // passed): start again, slower when it keeps ending right away.
      this.quickEnds = Date.now() - this.startedAt < 1500 ? this.quickEnds + 1 : 0;
      const delay = Math.min(5000, 150 * Math.pow(2, this.quickEnds));
      this.restartTimer = window.setTimeout(() => {
        this.restartTimer = null;
        if (this.wanted) this.open();
      }, delay);
    };
    this.rec = rec;
    try {
      rec.start();
    } catch (err) {
      this.cb.onStatus("error", String((err as Error)?.message ?? err));
    }
  }
}

/** The engine for this platform, or null when there is none. */
export function createSpeechEngine(cb: EngineCallbacks): SpeechEngine | null {
  if (nativeVoiceAvailable()) return new AndroidEngine(cb);
  if (webSpeechAvailable()) return new WebSpeechEngine(cb);
  return null;
}

export function speechSupported(): boolean {
  return nativeVoiceAvailable() || webSpeechAvailable();
}
