// Tornado settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

import type { TornadoDirection, TornadoSequenceExitMode } from "@/lib/settingsShared";

export type TornadoSettings = {
  // TORNADO: one unified toggle shared by every applicable camera mode —
  // "float" (FRI/swimming), "swing" (GUNGA) and "noclip"/"watercraft"
  // (flying) — instead of the old standalone "whirlpool" camera mode plus
  // the separate swingTornado*/noclipTornado* schemas this replaced.
  // Radius/Speed/Direction/Opening all mean the same thing regardless of
  // which mode is active. While floating or swinging, turning this on also
  // opens a real water whirlpool centered at the same xz spot as the orbit
  // itself (see tornadoOpening and the vortexBlendRef-gated branches of the
  // physics loop in routes/index.tsx); while flying, only the camera's
  // circular orbit applies (no water effect). Activating/deactivating eases
  // in/out over time (tornadoBlendRef/vortexBlendRef in routes/index.tsx)
  // rather than snapping instantly.
  tornadoOn: boolean;
  tornadoRadius: number;
  tornadoSpeed: number;
  tornadoDirection: TornadoDirection;
  // Width of the water whirlpool's throat while floating or swinging — has
  // no effect while flying (noclip/watercraft never show the water vortex).
  tornadoOpening: number;
  // Whether the camera's look direction eases toward facing the tornado/
  // whirlpool's center (like looking down into the vortex) instead of
  // keeping whatever forward direction NAV/LOOK already has it facing.
  tornadoFollowCenter: boolean;
  // TORNADO CLOUD: optional visible funnel-shaped cloud mesh wrapping the
  // active tornado orbit, sized off tornadoRadius — see tornadoCloudMeshRef
  // in routes/index.tsx. Purely cosmetic; the orbit itself works
  // identically whether or not this is on.
  tornadoCloudOn: boolean;
  // While swinging or flying, the TORNADO CLOUD's vertical position is
  // pinned to the real water surface at its own xz spot (not to the
  // camera's/swing's own altitude — a tornado should look rooted in the
  // water, not bob around with wherever the camera happens to be) plus this
  // adjustable offset in meters; its height (vertical extent) is swingHeight
  // regardless of which of those two modes is active. Has no effect while
  // floating, where the cloud still simply follows the camera's own height.
  tornadoCloudYOffset: number;
  // Manual radial control (all tornado-applicable modes, whenever tornadoOn):
  // NAV's y-axis and the mode's own "current" dial (STRÖM for float, DRIFT XZ
  // for noclip/watercraft) both push the camera's live orbit radius in/out
  // between a small inner minimum and tornadoRadius — see tornadoLiveRadiusRef
  // in routes/index.tsx. Purely a runtime position, not itself persisted;
  // only the toggle/tuning for the automatic sequence below lives here.
  //
  // TORNADO SEQUENCE: an optional automatic cycle layered on top of that same
  // live radius — drags the camera in to the center over
  // tornadoSequenceDragDuration (at tornadoSequenceDragSpeed), holds it there
  // for tornadoSequenceStayDuration (default 5s), then either pulls it back
  // out to tornadoRadius ("outer") or lifts it straight up by
  // tornadoSequenceLiftHeight, pauses for tornadoSequencePauseDuration, and
  // sends it back down to that cycle's own drag-in starting position ("lift")
  // — see tornadoSequenceExitMode/TornadoSequenceExitMode above. Loops
  // continuously for as long as it's on. Manual NAV/current input above still
  // works alongside it (added on top of the sequence's own radius), but the
  // sequence resumes control of the baseline each cycle.
  tornadoSequenceOn: boolean;
  tornadoSequenceDragSpeed: number;
  tornadoSequenceDragDuration: number;
  tornadoSequenceStayDuration: number;
  tornadoSequenceExitMode: TornadoSequenceExitMode;
  tornadoSequenceExitSpeed: number;
  tornadoSequenceLiftHeight: number;
  tornadoSequencePauseDuration: number;
};

export const TORNADO_DEFAULTS: TornadoSettings = {
  // Unified TORNADO toggle for GUNGA (swing) and flying (noclip/watercraft):
  // off by default (plain pendulum arc / plain free flight).
  tornadoOn: false,
  tornadoRadius: 66.25,
  tornadoSpeed: 13.38,
  tornadoDirection: "ccw",
  tornadoOpening: 16.5,
  // On by default: camera eases toward staring at the tornado/whirlpool
  // center (like the old standalone VIRVEL mode always did) instead of
  // keeping whatever forward direction NAV/LOOK has it facing.
  tornadoFollowCenter: true,
  // TORNADO CLOUD: off by default — purely cosmetic.
  tornadoCloudOn: false,
  tornadoCloudYOffset: 0,
  // TORNADO SEQUENCE: off by default — the automatic drag-in/stay/exit cycle
  // is opt-in on top of the always-available manual NAV+current radial pull.
  tornadoSequenceOn: false,
  tornadoSequenceDragSpeed: 5.45,
  tornadoSequenceDragDuration: 4,
  tornadoSequenceStayDuration: 5,
  tornadoSequenceExitMode: "outer",
  tornadoSequenceExitSpeed: 15,
  tornadoSequenceLiftHeight: 60,
  tornadoSequencePauseDuration: 3,
};

/** Every key TornadoSettings owns, in declaration order (presets, sharing). */
export const TORNADO_SETTING_KEYS = Object.keys(TORNADO_DEFAULTS) as (keyof TornadoSettings)[];
