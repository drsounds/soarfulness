import type { AppRuntime } from "@/core/apps/types";
import { onRoamingMotion } from "./roamingBridge";
import { RoamingMotion } from "./RoamingMotion";
import type { RoamingSettings } from "./settings";

/**
 * ROAMING inside the physics step: listens to Roaming's broadcasts while
 * switched on and returns the world-space push (m) for this step. The motion
 * is camera-relative like the NAV stick (forward = where you look); the host
 * adds the push to the player position and the camera together.
 */
export class RoamingRuntime implements AppRuntime<RoamingSettings> {
  readonly motion = new RoamingMotion();
  private unsubscribe: (() => void) | null = null;
  private sideways = true;

  private listen(on: boolean) {
    if (on && !this.unsubscribe) {
      this.unsubscribe = onRoamingMotion((e) => this.motion.push(e, this.sideways));
    } else if (!on && this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      // Keep the velocity, so switching off glides to a stop; drop the target.
      this.motion.target.x = this.motion.target.z = 0;
    }
  }

  /**
   * @param navSpeed top speed (m/s) of the NAV stick right now
   * @param yaw camera yaw (radians), for camera-relative motion
   * @param allowed false while another mode holds the player in place
   */
  step(
    physDt: number,
    allowed: boolean,
    navSpeed: number,
    yaw: number,
    s: Readonly<RoamingSettings>,
  ): { dx: number; dz: number } {
    this.sideways = s.roamingSideways;
    this.listen(s.roamingOn);
    const on = s.roamingOn && allowed;
    const d = this.motion.step(physDt, {
      on,
      maxSpeed: navSpeed * Math.max(0, s.roamingStrength),
      accel: s.roamingAccel,
      glide: s.roamingGlide,
      sideways: s.roamingSideways,
    });
    if (d.dx === 0 && d.dz === 0) return d;
    // Same basis as the NAV stick in routes/index.tsx.
    const fwdX = -Math.sin(yaw),
      fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw),
      rightZ = -Math.sin(yaw);
    return {
      dx: d.dx * rightX + d.dz * fwdX,
      dz: d.dx * rightZ + d.dz * fwdZ,
    };
  }

  shutdown() {
    this.listen(false);
  }

  dispose() {
    this.listen(false);
    this.motion.reset();
  }
}
