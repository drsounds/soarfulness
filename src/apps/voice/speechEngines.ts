import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// VOICE: the two ways to hear the user, behind one interface. PRIVACY RULE:
// audio never leaves the device. Both engines only ever run a recognizer
// that works on the device; when there is none they refuse to listen
// ("nolocal") instead of falling back to a cloud service.
//
// - "android": android/.../VoiceRecognitionPlugin.java, Android's on-device
//   SpeechRecognizer (SpeechRecognizer.createOnDeviceSpeechRecognizer,
//   Android 12+), restarted after every phrase so it listens continuously.
//   Used inside the Android app, where the WebView has no Web Speech API.
// - "web-speech": the browser's SpeechRecognition with `processLocally =
//   true` (Chrome's on-device Web Speech). Plain Web Speech (no
//   processLocally) sends audio to a server, so a browser without the
//   on-device API is treated as having no recognizer.
//
// The on-device language pack may need a download first ("download"):
// installSpeechModel() asks the browser / Android for it.

export type EngineStatus =
  "starting" | "listening" | "denied" | "error" | "off" | "nolocal" | "download";

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
  isAvailable(): Promise<{ available: boolean; onDevice: boolean }>;
  start(options: { lang: string }): Promise<void>;
  stop(): Promise<void>;
  downloadModel(options: { lang: string }): Promise<void>;
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

const ENGINE_STATUSES: readonly EngineStatus[] = [
  "starting",
  "listening",
  "denied",
  "error",
  "off",
  "nolocal",
  "download",
];

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
        const s = ENGINE_STATUSES.find((x) => x === e.status);
        if (s) this.cb.onStatus(s, e.error);
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
  processLocally?: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  abort(): void;
};
type LocalOptions = { langs: string[]; processLocally: true };
type Availability = "unavailable" | "downloadable" | "downloading" | "available";
type RecognitionCtor = {
  new (): Recognition;
  /** On-device Web Speech (Chrome): is a local model there for these languages? */
  available?(options: LocalOptions): Promise<Availability>;
  /** Downloads the local model (needs a user gesture). */
  install?(options: LocalOptions): Promise<boolean>;
};

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the browser can recognize speech on the device (not just via a server). */
export function webSpeechOnDeviceAvailable(): boolean {
  const C = recognitionCtor();
  return !!C && typeof C.available === "function";
}

class WebSpeechEngine implements SpeechEngine {
  readonly name = "web-speech" as const;
  private rec: Recognition | null = null;
  private wanted = false;
  private lang = "en-US";
  private restartTimer: number | null = null;
  private startedAt = 0;
  private quickEnds = 0;
  private generation = 0;

  constructor(private readonly cb: EngineCallbacks) {}

  start(lang: string) {
    this.stop();
    this.wanted = true;
    this.lang = lang;
    this.quickEnds = 0;
    this.cb.onStatus("starting");
    const gen = ++this.generation;
    const C = recognitionCtor();
    if (!C || typeof C.available !== "function") {
      this.wanted = false;
      this.cb.onStatus("nolocal");
      return;
    }
    C.available({ langs: [lang], processLocally: true })
      .then((a) => {
        if (gen !== this.generation || !this.wanted) return;
        if (a === "available") this.open();
        else if (a === "downloadable" || a === "downloading") this.cb.onStatus("download", a);
        else this.cb.onStatus("nolocal", lang);
      })
      .catch((err: unknown) => this.cb.onStatus("nolocal", String((err as Error)?.message ?? err)));
  }

  stop() {
    this.wanted = false;
    this.generation++;
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
    }
    this.cb.onStatus("off");
  }

  private open() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      this.cb.onStatus("nolocal");
      return;
    }
    const rec = new Ctor();
    // On the device only. A browser that ignores this property would send
    // audio to a server, so refuse to listen when it doesn't stick.
    rec.processLocally = true;
    if (rec.processLocally !== true) {
      this.wanted = false;
      this.cb.onStatus("nolocal");
      return;
    }
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
      } else if (e.error === "language-not-supported") {
        this.wanted = false;
        this.cb.onStatus("nolocal", this.lang);
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

/** The engine for this platform, or null when there is no on-device one. */
export function createSpeechEngine(cb: EngineCallbacks): SpeechEngine | null {
  if (nativeVoiceAvailable()) return new AndroidEngine(cb);
  if (webSpeechOnDeviceAvailable()) return new WebSpeechEngine(cb);
  return null;
}

/** True when this platform may have an on-device recognizer. */
export function speechSupported(): boolean {
  return nativeVoiceAvailable() || webSpeechOnDeviceAvailable();
}

/**
 * Downloads the on-device language pack for `lang` (call from a click: the
 * browser needs a user gesture). Resolves true when the download started or
 * finished.
 */
export async function installSpeechModel(lang: string): Promise<boolean> {
  if (nativeVoiceAvailable()) {
    await VoiceRecognitionNative.downloadModel({ lang });
    return true;
  }
  const C = recognitionCtor();
  if (!C || typeof C.install !== "function") return false;
  return C.install({ langs: [lang], processLocally: true });
}
