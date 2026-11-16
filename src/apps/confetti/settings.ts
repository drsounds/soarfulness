// Confetti settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

// KONFETTIFÄRGER: which colors the falling confetti (KONFETTI) is cut from.
//  - "rainbow"  colorful mix (FÄRGGLAD)
//  - "pastel"   soft pastels
//  - "gold"     gold and silver foil that glints as it turns
//  - "white"    plain white paper
export type ConfettiPalette = "rainbow" | "pastel" | "gold" | "white";
export const CONFETTI_PALETTES: ConfettiPalette[] = ["rainbow", "pastel", "gold", "white"];

export type ConfettiSettings = {
  // KONFETTI: confetti falling like snow (apps/confetti/Confetti.ts).
  // confettiAmount = number of pieces, confettiIntensity = fall speed, size
  // and wind, confettiFlutter = how much the pieces spin, tumble and sway.
  confettiOn: boolean;
  confettiAmount: number;
  confettiIntensity: number;
  confettiPalette: ConfettiPalette;
  confettiFlutter: number;
};

export const CONFETTI_DEFAULTS: ConfettiSettings = {
  // KONFETTI: confetti falling like snow (apps/confetti/Confetti.ts), with
  // the same amount/intensity dials as SNÖ plus KONFETTIFÄRGER (palette) and
  // FLADDER (how much the pieces spin, tumble and sway).
  confettiOn: false,
  confettiAmount: 3000,
  confettiIntensity: 0.5,
  confettiPalette: "rainbow",
  confettiFlutter: 0.6,
};

/** Every key ConfettiSettings owns, in declaration order (presets, sharing). */
export const CONFETTI_SETTING_KEYS = Object.keys(CONFETTI_DEFAULTS) as (keyof ConfettiSettings)[];
