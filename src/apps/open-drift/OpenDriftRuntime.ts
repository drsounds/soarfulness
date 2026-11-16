import type { AppRuntime } from "@/core/apps/types";
import { OpenDrift } from "./OpenDrift";
import type { OpenDriftSettings } from "./settings";

/**
 * HAVSDRIFT inside the physics step: the open water keeps carrying the
 * player in a circle or a random wander. The host adds the returned offset
 * to the player position and the camera together, so it never turns the
 * view.
 */
export class OpenDriftRuntime implements AppRuntime<OpenDriftSettings> {
  readonly drift = new OpenDrift();

  /** This physics step's push (m). `allowed` is false while another mode
   *  holds the player in place (GUNGA with the cord on). */
  step(physDt: number, allowed: boolean, s: Readonly<OpenDriftSettings>) {
    return this.drift.step(physDt, {
      on: s.openDriftOn && allowed,
      curve: s.openDriftCurve,
      radius: s.openDriftRadius,
      cycleSpeed: s.openDriftCycleSpeed,
      magnitude: s.openDriftMagnitude,
      direction: s.openDriftDirection,
    });
  }

  dispose() {}
}
