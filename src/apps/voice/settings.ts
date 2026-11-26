// VOICE settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.
//
// Like GAMEPAD these belong to the device, not to a bath: they are left out
// of presets and bath links (see routes/bathing.$payload.bathe.tsx).

/** Recognition language: "auto" follows the app's own language. */
export type VoiceLang = "auto" | "en-US" | "en-GB" | "sv-SE" | "nb-NO" | "da-DK" | "fi-FI";
export const VOICE_LANGS: VoiceLang[] = [
  "auto",
  "en-US",
  "en-GB",
  "sv-SE",
  "nb-NO",
  "da-DK",
  "fi-FI",
];

/**
 * Who turns what was heard into commands:
 * - "rules": the phrase matcher (commands.ts), instant, the default;
 * - "hybrid": the rules first, and a small on-device LLM for phrases they
 *   don't understand ("it's too cold, make it snow less");
 * - "llm": the on-device LLM for every phrase, the rules when it is not
 *   ready, too slow or finds nothing.
 * The LLM runs in the browser (WebGPU): nothing it reads or writes leaves
 * the device (see llm/LocalLlm.ts).
 */
export type VoiceInterpreter = "rules" | "hybrid" | "llm";
export const VOICE_INTERPRETERS: VoiceInterpreter[] = ["rules", "hybrid", "llm"];

/** Models that run in the page with WebGPU (llm/models.ts, llm/LocalLlm.ts). */
export type WebLlmModel = "qwen2.5-0.5b" | "llama-3.2-1b" | "qwen2.5-1.5b";
export const WEB_LLM_MODELS: WebLlmModel[] = ["qwen2.5-0.5b", "llama-3.2-1b", "qwen2.5-1.5b"];

/**
 * On-device models the LLM interpreter can use:
 * - "auto": Gemini Nano in the Android app when the phone has it, otherwise
 *   the smallest WebGPU model;
 * - "gemini-nano": Android's own on-device Gemini Nano (ML Kit GenAI Prompt
 *   API on AICore), through the native OnDeviceLlm plugin (llm/NativeLlm.ts);
 * - a WebGPU model, downloaded into the app.
 */
export type VoiceLlmModel = "auto" | "gemini-nano" | WebLlmModel;
export const VOICE_LLM_MODELS: VoiceLlmModel[] = ["auto", "gemini-nano", ...WEB_LLM_MODELS];

export type VoiceSettings = {
  /**
   * Listen for commands. Off by default, so the microphone is never opened
   * until someone switches this on (SETTINGS → VOICE).
   */
  voiceOn: boolean;
  voiceLang: VoiceLang;
  /** How close (0.5–1) what was heard must be to a command; 1 = exact words only. */
  voiceMatchThreshold: number;
  /**
   * Act on what is being heard once its words have stayed the same this
   * long (ms), instead of waiting for the recognizer to finish the phrase,
   * which waits for a stretch of silence. 0 = wait for the final result.
   */
  voiceEarlyMs: number;
  /** Multiplier on the step of "increase / decrease <setting>" (the slider's own step = 1). */
  voiceStepScale: number;
  /** Show the last heard phrase and what it did, at the bottom of the screen. */
  voiceTranscriptOn: boolean;
  /** Show the floating window with every phrase, its score and a test box. */
  voiceDebug: boolean;
  /** Rules (default), rules then on-device LLM, or on-device LLM first. */
  voiceInterpreter: VoiceInterpreter;
  /** Which on-device model; downloaded only when asked for (VOICE → DOWNLOAD MODEL). */
  voiceLlmModel: VoiceLlmModel;
  /** Give up on the LLM after this long (ms) and use the rules' answer. */
  voiceLlmTimeoutMs: number;
};

export const VOICE_DEFAULTS: VoiceSettings = {
  voiceOn: false,
  // English: the language most likely to have an on-device model.
  voiceLang: "en-US",
  voiceMatchThreshold: 0.72,
  voiceEarlyMs: 400,
  voiceStepScale: 1,
  voiceTranscriptOn: true,
  voiceDebug: false,
  voiceInterpreter: "rules",
  // Gemini Nano where Android has it, else the smallest WebGPU model.
  voiceLlmModel: "auto",
  voiceLlmTimeoutMs: 2500,
};

/** Every key VoiceSettings owns, in declaration order (presets, sharing). */
export const VOICE_SETTING_KEYS = Object.keys(VOICE_DEFAULTS) as (keyof VoiceSettings)[];
