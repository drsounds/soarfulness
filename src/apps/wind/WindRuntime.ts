import * as THREE from "three";
import type { AppRuntime } from "@/core/apps/types";
import { WindAudio } from "./WindAudio";
import type { WindSettings } from "./settings";
import { WindField, altitudeMix, getWindAt, hearWind, steerWaveDir } from "./wind";

/**
 * VIND inside the render loop. Wind has no scene objects of its own; it
 * feeds the host's wave direction, sway, position and sound. The host calls
 * these in frame order:
 *
 *   update()         once per frame, before the waves: advances the wind
 *   waveDirection()  right after: the wave heading, steered by the wind
 *   current()        in the physics step: the surface current's push
 *   sound()          after the camera is placed: the wind in the ears
 */
export class WindRuntime implements AppRuntime<WindSettings> {
  readonly field = new WindField();
  readonly audio = new WindAudio();

  /** This frame's sway offset from the wind (added to the SVAJ targets). */
  swayOffset = { x: 0, z: 0 };
  /** True while the wave direction is steered by the wind (or still easing
   *  back), so CPU wave sampling must follow the shader's direction. */
  steersWaves = false;

  private wind = { x: 0, z: 0, speed: 0, bearing: 0, gust: 0 };
  private readonly camPrev = new THREE.Vector3();
  private camPrevOk = false;
  private readonly camVel = { x: 0, z: 0 };
  private readonly fwd = new THREE.Vector3();

  /** Advances the live wind and its sway. */
  update(dt: number, s: Readonly<WindSettings>) {
    this.wind = this.field.update(dt, s.winds);
    this.swayOffset = this.field.sway(dt, s.windSwayOn, s.windSwayStrength);
  }

  /**
   * The wave heading (radians) for this frame: eases `currentRad` toward the
   * VÅGRIKTNING dial (`waveDirDeg`), or toward where the wind blows when
   * VÅGRIKTNING follows the wind. Takes the shortest angular path.
   */
  waveDirection(dt: number, waveDirDeg: number, currentRad: number, s: Readonly<WindSettings>) {
    const steer = s.windWavesOn && this.wind.speed > 0.05;
    const targetRad = steer
      ? steerWaveDir(waveDirDeg, this.wind, s.windWaveStrength)
      : (waveDirDeg * Math.PI) / 180;
    let delta = targetRad - currentRad;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.steersWaves = steer || (this.steersWaves && Math.abs(delta) > 0.002);
    // Wind turns the swell slowly; the dial itself stays snappy.
    return currentRad + delta * Math.min(1, dt * (steer ? 0.6 : 4));
  }

  /** VIND STRÖM: the surface current's push this physics step (m). `allowed`
   *  is false in modes that own the camera position (GUNGA). */
  current(physDt: number, allowed: boolean, s: Readonly<WindSettings>) {
    return this.field.current(physDt, s.windCurrentOn && allowed, s.windCurrentStrength);
  }

  /**
   * VIND sound: the air rushing past the ears — the wind at this height
   * minus the camera's own motion (running into the wind is louder), panned
   * and brightened by where it meets the head. HÖJDLJUD adds the surface
   * noise just above the water and a breeze that grows with altitude.
   * `depth` is how far the camera is under the surface (m, negative above).
   */
  sound(
    dt: number,
    camera: THREE.Camera,
    depth: number,
    audioOn: boolean,
    s: Readonly<WindSettings>,
  ) {
    const cp = camera.position;
    if (this.camPrevOk && dt > 0) {
      const vx = (cp.x - this.camPrev.x) / dt;
      const vz = (cp.z - this.camPrev.z) / dt;
      // Ignore teleports (VÄRLDSGRÄNS wrap, respawn).
      if (Math.hypot(vx, vz) < 400) {
        const k = 1 - Math.exp(-dt / 0.25);
        this.camVel.x += (vx - this.camVel.x) * k;
        this.camVel.z += (vz - this.camVel.z) * k;
      }
    }
    this.camPrev.copy(cp);
    this.camPrevOk = true;
    const altOn = s.windAltitudeAudioOn;
    const soundOn = s.windSoundOn;
    const alt = altitudeMix(-depth);
    const w = getWindAt(-depth);
    camera.getWorldDirection(this.fwd);
    const hearing = hearWind(
      soundOn ? w : { x: 0, z: 0 },
      this.camVel,
      { x: this.fwd.x, z: this.fwd.z },
      altOn ? alt.breeze : 0,
    );
    this.audio.update({
      enabled: (soundOn || altOn) && audioOn,
      volume: s.windSoundVolume,
      hearing,
      // Own motion alone (no winds, no HÖJDLJUD) makes no wind sound.
      windLevel: (soundOn && w.speed > 0.05) || (altOn && alt.breeze > 0.05) ? 1 : 0,
      surfaceLevel: altOn ? alt.surface : 0,
      underwater: depth > 0 ? Math.min(1, depth / 0.6) : 0,
    });
  }

  dispose() {
    this.audio.dispose();
    this.field.reset();
  }
}
