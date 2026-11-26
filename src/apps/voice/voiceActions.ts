import type { CameraMode } from "@/lib/settingsShared";

// VOICE: what a command asks the host (routes/index.tsx) to do besides
// changing settings. Settings changes go through the host's
// applySettingsPatch(); these need the host's own state and refs.

export type VoiceDirectionTarget = "sway" | "waves";

export type VoiceAction =
  /** Switch camera mode (SIMMARE = float, FLYG = noclip, GUNGA = swing, ...). */
  | { type: "mode"; mode: CameraMode }
  /** GUNGA with the TORNADO / water whirlpool on or off. */
  | { type: "whirlpool"; on: boolean }
  /** FLYG: keep rising, keep sinking, or hold height (switches to FLYG first). */
  | { type: "vertical"; dir: "up" | "down" | "stop" }
  /**
   * Point the sway or the waves: `bearing` is a compass bearing (0 = north,
   * the app's world -z), `view` an offset from where the camera looks
   * (-90 = to the left), `turn` an offset from the current direction.
   */
  | {
      type: "direction";
      target: VoiceDirectionTarget;
      bearing?: number;
      view?: number;
      turn?: number;
    }
  | { type: "settings"; open: boolean }
  | { type: "cycleMode"; dir: 1 | -1 }
  /** Sleep (ignore everything but "wake up") or wake up. */
  | { type: "listen"; awake: boolean }
  /** Show / hide the voice debug window with every command. */
  | { type: "help"; open: boolean };
