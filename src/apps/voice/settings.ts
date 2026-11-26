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

export type VoiceSettings = {
  /**
   * Listen for commands. Off by default, so the microphone is never opened
   * until someone switches this on (SETTINGS → VOICE).
   */
  voiceOn: boolean;
  voiceLang: VoiceLang;
  /** How close (0.5–1) what was heard must be to a command; 1 = exact words only. */
  voiceMatchThreshold: number;
  /** Multiplier on the step of "increase / decrease <setting>" (the slider's own step = 1). */
  voiceStepScale: number;
  /** Show the last heard phrase and what it did, at the bottom of the screen. */
  voiceTranscriptOn: boolean;
  /** Show the floating window with every phrase, its score and a test box. */
  voiceDebug: boolean;
};

export const VOICE_DEFAULTS: VoiceSettings = {
  voiceOn: false,
  voiceLang: "auto",
  voiceMatchThreshold: 0.72,
  voiceStepScale: 1,
  voiceTranscriptOn: true,
  voiceDebug: false,
};

/** Every key VoiceSettings owns, in declaration order (presets, sharing). */
export const VOICE_SETTING_KEYS = Object.keys(VOICE_DEFAULTS) as (keyof VoiceSettings)[];
