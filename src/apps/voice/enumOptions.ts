import { AURORA_PALETTES } from "@/apps/aurora/settings";
import { CONFETTI_PALETTES } from "@/apps/confetti/settings";
import { NEON_MODES } from "@/apps/neon/settings";
import { OPEN_DRIFT_CURVES, OPEN_DRIFT_DIRECTIONS } from "@/apps/open-drift/OpenDrift";
import { RAIN_COLORS } from "@/apps/rain/settings";
import { RETRO_PALETTES } from "@/apps/retro/settings";
import { UNDERWATER_FOG_BLENDS } from "@/apps/underwater-fog/settings";
import {
  DEPTH_SINE_WAVEFORMS,
  FREAK_OUT_AXES,
  INTERVAL_SESSION_TYPES,
  SURGE_ROTATION_MODES,
  SWING_Y_WAVEFORMS,
  TORNADO_DIRECTIONS,
} from "@/lib/settingsShared";
import { VOICE_LANGS } from "./settings";

// VOICE: the option lists that list rows pick from, by the name the
// generated catalog records (settingCatalog.generated.ts `options`). A list
// row whose list is missing here can still be set by voice, but only by
// the option's own id ("set neon mode to fade").

export const ENUM_OPTIONS: Record<string, readonly string[]> = {
  AURORA_PALETTES,
  CONFETTI_PALETTES,
  DEPTH_SINE_WAVEFORMS,
  FREAK_OUT_AXES,
  INTERVAL_SESSION_TYPES,
  NEON_MODES,
  OPEN_DRIFT_CURVES,
  OPEN_DRIFT_DIRECTIONS,
  RAIN_COLORS,
  RETRO_PALETTES,
  SURGE_ROTATION_MODES,
  SWING_Y_WAVEFORMS,
  TORNADO_DIRECTIONS,
  UNDERWATER_FOG_BLENDS,
  VOICE_LANGS,
};

/** Option lists for settings that have no list row of their own. */
export const EXTRA_ENUM_KEYS: Record<string, string> = {
  voiceLang: "VOICE_LANGS",
};

/** Other ways to say an option id. */
export const OPTION_ALIASES: Record<string, string[]> = {
  cw: ["clockwise", "medurs", "right"],
  ccw: ["counterclockwise", "counter clockwise", "anticlockwise", "moturs", "left"],
  auto: ["automatic", "automatiskt"],
  "en-US": ["english", "american english", "engelska"],
  "en-GB": ["british english", "british"],
  "sv-SE": ["swedish", "svenska"],
  "nb-NO": ["norwegian", "norska", "norsk"],
  "da-DK": ["danish", "danska", "dansk"],
  "fi-FI": ["finnish", "finska", "suomi"],
};
