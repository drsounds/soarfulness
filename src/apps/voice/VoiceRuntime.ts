import i18n from "@/lib/i18n";
import type { AppRuntime, FrameContext } from "@/core/apps/types";
import { createSpeechEngine, type EngineStatus, type SpeechEngine } from "./speechEngines";
import type { VoiceLang, VoiceSettings } from "./settings";
import { voiceBus } from "./voiceBus";

// VOICE inside the app host: keeps the recognizer running while the app is
// on and VOICE → LISTEN is on, in the chosen language, and feeds what it
// hears to voiceBus, whose handler (routes/index.tsx) runs the commands.
// frame() only compares a couple of values, so it is cheap to call every
// frame; shutdown() (app switched off) and dispose() stop the microphone.

const APP_LANG_TO_SPEECH: Record<string, string> = {
  sv: "sv-SE",
  en: "en-US",
  no: "nb-NO",
  da: "da-DK",
  fi: "fi-FI",
};

/** The BCP 47 language to listen in: "auto" follows the app's own language. */
export function speechLang(lang: VoiceLang, appLanguage = i18n.language): string {
  if (lang !== "auto") return lang;
  return APP_LANG_TO_SPEECH[(appLanguage ?? "en").slice(0, 2)] ?? "en-US";
}

export class VoiceRuntime implements AppRuntime<VoiceSettings> {
  private engine: SpeechEngine | null = null;
  private listeningLang: string | null = null;
  private restartToken = 0;

  frame(_frame: FrameContext, settings: Readonly<VoiceSettings>): void {
    this.sync(settings.voiceOn, speechLang(settings.voiceLang));
  }

  /** Start, restart in another language, or stop the recognizer. */
  sync(on: boolean, lang: string): void {
    if (!on) {
      this.stop();
      return;
    }
    if (this.listeningLang === lang && this.restartToken === voiceBus.restartToken) return;
    this.restartToken = voiceBus.restartToken;
    this.stop();
    this.listeningLang = lang;
    this.engine = createSpeechEngine({
      onInterim: (text) => voiceBus.setInterim(text),
      onFinal: (alts) => voiceBus.submit(alts, "speech"),
      onStatus: (status: EngineStatus, error?: string) =>
        voiceBus.setStatus(status, {
          engine: this.engine?.name ?? null,
          lang,
          error: error ?? null,
        }),
    });
    if (!this.engine) {
      voiceBus.setStatus("unsupported", { engine: null, lang, error: null });
      return;
    }
    voiceBus.setStatus("starting", { engine: this.engine.name, lang, error: null });
    this.engine.start(lang);
  }

  private stop(): void {
    this.engine?.stop();
    this.engine = null;
    if (this.listeningLang !== null) voiceBus.setStatus("off", { error: null });
    this.listeningLang = null;
    voiceBus.setInterim("");
  }

  startup(): void {}

  shutdown(): void {
    this.stop();
  }

  dispose(): void {
    this.stop();
  }
}
