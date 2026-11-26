import i18n from "@/lib/i18n";
import type { AppRuntime, FrameContext } from "@/core/apps/types";
import { onDeviceLlm } from "./llm/onDeviceLlm";
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
    voiceBus.setEarlyMs(settings.voiceEarlyMs);
    this.sync(settings.voiceOn, speechLang(settings.voiceLang));
    // The on-device LLM (VOICE → INTERPRETER) is loaded only while voice
    // listens with it; otherwise its worker and GPU memory are released.
    onDeviceLlm.sync(
      settings.voiceOn && settings.voiceInterpreter !== "rules",
      settings.voiceLlmModel,
    );
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
      // Partials go to voiceBus too: it acts on them once they settle
      // (VOICE → ACT EARLY) instead of waiting for the final result.
      onInterim: (text) => voiceBus.partial(text),
      onFinal: (alts) => voiceBus.final(alts),
      onSpeech: (phase) => voiceBus.speech(phase),
      onStatus: (status: EngineStatus, error?: string) => {
        // Android starts a new session after every phrase ("listening"):
        // a phrase still waiting to settle is kept, so it can run early.
        if (status !== "listening" && status !== "starting") voiceBus.newSession();
        voiceBus.setStatus(status, {
          engine: this.engine?.name ?? null,
          lang,
          error: error ?? null,
        });
      },
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
    voiceBus.newSession();
    voiceBus.setInterim("");
  }

  startup(): void {}

  shutdown(): void {
    this.stop();
    onDeviceLlm.shutdown();
  }

  dispose(): void {
    this.stop();
    onDeviceLlm.shutdown();
  }
}
