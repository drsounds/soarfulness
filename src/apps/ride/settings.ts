// Ride settings: this app's slice of the persisted settings snapshot
// (lib/settingsShared.ts `Persisted` is the intersection of every app's
// slice). The defaults are spread into DEFAULTS in routes/index.tsx.

import type { FreakOutAxis, TornadoDirection } from "@/lib/settingsShared";

export type RideSettings = {
  // FREAK OUT: an optional carousel ride, its own toggle like TORNADO —
  // available in every camera mode and layered on top of whatever that
  // mode does (with GUNGA both swings combine) — the camera rides one seat
  // of a ring of sofas hanging freakOutSwingLength meters below a pivot,
  // swinging up to ±freakOutSwingAngle degrees about a horizontal axis whose
  // bearing is freakOutSwingAxis (0° = sideways axis, so the arm swings
  // forward/back; 90° = forward axis, so it swings side to side). A second,
  // independently angled swing plane can be enabled with freakOutSwingAngle2;
  // it is a quarter-cycle out of phase to swing in four directions. With
  // freakOutRotationOn the ring itself also spins about freakOutRotationAxis
  // at freakOutRotationSpeed, and with freakOutRotationOscillate that spin
  // smoothly reverses back and forth at freakOutRotationOscillateSpeed. The
  // view tilts/turns with the seat. See freakOutPose() and the swing branch
  // of the physics loop in routes/index.tsx. Off by default.
  freakOutOn: boolean;
  freakOutSwingAxis: number;
  freakOutSwingAngle: number;
  /** Bearing and maximum angle of the quarter-cycle-offset second swing plane. */
  freakOutSwingAxis2: number;
  freakOutSwingAngle2: number;
  freakOutSwingSpeed: number;
  freakOutSwingLength: number;
  freakOutRingRadius: number;
  freakOutRotationOn: boolean;
  freakOutRotationAxis: FreakOutAxis;
  freakOutRotationSpeed: number;
  freakOutRotationPeakSpeed: number;
  freakOutRotationRecovery: number;
  freakOutRotationOscillate: boolean;
  freakOutRotationOscillateSpeed: number;
  // While the arm swings, alternate at every other turnaround instead of
  // at every one.
  freakOutRotationOscillateEveryOther: boolean;
  // PEAK SPIN-UP (TOPPSTÖT): the seat ring's spin builds up gradually
  // toward each peak of the swing (both directions), up to
  // 1 + freakOutRotationKick times ROTATION SPEED at the peak, and winds
  // back down on the way to the middle. Smooth, never a jolt.
  freakOutRotationKickOn: boolean;
  freakOutRotationKick: number;
  // RIDE in SIMMARE (float) mode: the whole ride, view and rig, sits this
  // many meters higher, so the gondola swings clear of the waves.
  freakOutFloatYOffset: number;
  // RIDE OVERLAY: quick on-screen sliders (swing speed/angle/axis, spin
  // speed/axis, peak kick) while the ride is on.
  freakOutOverlayOn: boolean;
  // Spin direction of the gondola ring (before any back-and-forth
  // alternation from freakOutRotationOscillate).
  // By default the view rides the ring like the real ride's seat: it turns
  // with the ring's spin, so the arm and hub stay put relative to the rider.
  // FIXED HEADING instead keeps the heading while the seat travels around
  // the ring's center.
  freakOutViewFixedHeading: boolean;
  // FREAK OUT's visible ride structure (see freakOutRigRef in
  // routes/index.tsx), each part toggleable: the swing ARM from the pivot
  // down to the gondola, the TOP RING where the arm meets the gondola, and
  // the HUB in the middle with spokes out to the seat ring under the
  // camera. All on by default; only shown while FREAK OUT is.
  freakOutShowArm: boolean;
  // SWING FRAME: the swing set the arm hangs from (a beam on two A-shaped
  // legs), sized from the arm's length. Off by default.
  freakOutShowFrame: boolean;
  freakOutShowTopRing: boolean;
  freakOutShowHub: boolean;
  // By default the gondola ring is rigid with the swinging arm: it tilts
  // with the arm and only spins about the arm's own (local) axis, so the
  // ring always stays in line with the arm and the spin never changes the
  // arm's swing. LEVEL RING instead keeps the ring level and only carries
  // its center along the arm's arc (the view still tilts with the arm).
  freakOutRingLevel: boolean;
  // SEATS on the gondola ring: freakOutSeatCount seats spread evenly round
  // the ring, each a post standing up from it with the Bathing Suit model
  // (public/apps/suit) as the seat. freakOutCameraSeat (1-based) picks which
  // of them the view rides in. Off by default; while off, the view rides
  // where it always has (seat 1).
  freakOutSeatsOn: boolean;
  freakOutSeatCount: number;
  freakOutCameraSeat: number;
  // How long each seat's post is, from the seat ring down to the suit (the
  // ring rises with it, since the view stays in the seat), and the colors
  // of the seats, the rings/hub/spokes, the seat posts and the swing arm.
  freakOutSeatPostLength: number;
  freakOutSeatColor: string;
  freakOutRingColor: string;
  freakOutPostColor: string;
  freakOutArmColor: string;
  freakOutFrameColor: string;
  freakOutRotationDirection: TornadoDirection;
};

export const RIDE_DEFAULTS: RideSettings = {
  // FREAK OUT carousel layered on GUNGA — off by default.
  freakOutOn: false,
  freakOutSwingAxis: 114,
  freakOutSwingAngle: 125,
  freakOutSwingAxis2: 24,
  freakOutSwingAngle2: 0,
  freakOutSwingSpeed: 1.25,
  freakOutSwingLength: 800,
  freakOutRingRadius: 3.28,
  freakOutRotationOn: true,
  freakOutRotationAxis: "y",
  freakOutRotationSpeed: 0.26,
  freakOutRotationPeakSpeed: 1,
  freakOutRotationRecovery: 0.25,
  freakOutRotationOscillate: false,
  freakOutRotationOscillateSpeed: 1,
  freakOutRotationOscillateEveryOther: true,
  freakOutRotationKickOn: false,
  freakOutRotationKick: 1.5,
  freakOutFloatYOffset: 10,
  freakOutOverlayOn: true,
  freakOutRotationDirection: "ccw",
  freakOutViewFixedHeading: false,
  freakOutShowArm: false,
  freakOutShowFrame: false,
  freakOutShowTopRing: false,
  freakOutShowHub: false,
  freakOutRingLevel: false,
  freakOutSeatsOn: true,
  freakOutSeatCount: 16,
  freakOutCameraSeat: 2,
  freakOutSeatPostLength: 0.77,
  freakOutSeatColor: "#ff00ff",
  freakOutRingColor: "#d8dde3",
  freakOutPostColor: "#d8dde3",
  freakOutArmColor: "#d8dde3",
  freakOutFrameColor: "#8b5a2b",
};

/** Every key RideSettings owns, in declaration order (presets, sharing). */
export const RIDE_SETTING_KEYS = Object.keys(RIDE_DEFAULTS) as (keyof RideSettings)[];
