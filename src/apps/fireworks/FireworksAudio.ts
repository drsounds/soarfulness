import type * as THREE from "three";

// FYRVERKERI's sound (see Fireworks.ts for the visuals and lights).

// Speed of sound in air (m/s): every sound is delayed by its distance.
const SPEED_OF_SOUND = 343;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

// ---------------------------------------------------------------------------
// Sound

type AudioCtor = typeof AudioContext;

/**
 * WebAudio-synthesized fireworks sound. Its own small AudioContext, separate
 * from the ambient water sound's graph. Created lazily the first time sound
 * is wanted and suspended again when it isn't, so it costs nothing while
 * FYRVERKERI or its sound is off.
 */
export class FireworksAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lp: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = false;
  private volume = 0.7;
  private unlockBound = false;
  // Rough count of voices still sounding, to drop crackle when it's busy.
  private voices = 0;

  private readonly onGesture = () => {
    if (this.enabled && this.ctx && this.ctx.state !== "running") {
      this.ctx.resume().catch(() => {
        /* noop */
      });
    }
  };

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const Ctx: AudioCtor | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      const ctx = new Ctx();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 20000;
      lp.Q.value = 0.5;
      const master = ctx.createGain();
      master.gain.value = 0;
      // A gentle compressor keeps a big finale from clipping.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      lp.connect(master).connect(comp).connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.lp = lp;
      this.noise = buf;
    } catch {
      return null;
    }
    if (!this.unlockBound) {
      // Browsers only start audio after a user gesture.
      this.unlockBound = true;
      window.addEventListener("pointerdown", this.onGesture, true);
      window.addEventListener("keydown", this.onGesture, true);
      window.addEventListener("touchend", this.onGesture, true);
    }
    return this.ctx;
  }

  update(enabled: boolean, volume: number, underwater: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (enabled !== this.enabled) {
      this.enabled = enabled;
      if (enabled) {
        const ctx = this.ensure();
        ctx?.resume().catch(() => {
          /* waits for a gesture */
        });
      } else if (this.ctx && this.ctx.state === "running") {
        const ctx = this.ctx;
        this.master?.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        // Let the fade finish before suspending.
        window.setTimeout(() => {
          if (!this.enabled) ctx.suspend().catch(() => undefined);
        }, 300);
      }
    }
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.lp || !this.enabled) return;
    const uw = Math.max(0, Math.min(1, underwater));
    this.master.gain.setTargetAtTime(this.volume * (1 - 0.6 * uw), ctx.currentTime, 0.1);
    this.lp.frequency.setTargetAtTime(20000 * Math.pow(0.03, uw), ctx.currentTime, 0.1);
  }

  private ready(): AudioContext | null {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || ctx.state !== "running" || this.volume <= 0) return null;
    return ctx;
  }

  // Distance, pan and arrival time of a sound at `pos`.
  private place(pos: THREE.Vector3, cam: THREE.Vector3, right: THREE.Vector3) {
    const dx = pos.x - cam.x;
    const dy = pos.y - cam.y;
    const dz = pos.z - cam.z;
    const dist = Math.max(1, Math.hypot(dx, dy, dz));
    const pan = Math.max(-0.9, Math.min(0.9, (dx * right.x + dz * right.z) / dist));
    const gain = Math.min(1.6, 160 / (dist + 40));
    // Air soaks up the highs over distance.
    const cutoff = Math.max(900, Math.min(18000, 18000 * Math.pow(120 / dist, 0.9)));
    return { dist, pan, gain, cutoff, delay: dist / SPEED_OF_SOUND };
  }

  private out(ctx: AudioContext, pan: number, cutoff: number): AudioNode {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    if (typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      f.connect(p);
      p.connect(this.lp!);
    } else {
      f.connect(this.lp!);
    }
    return f;
  }

  private noiseSrc(ctx: AudioContext) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  private track(src: AudioScheduledSourceNode) {
    this.voices++;
    src.onended = () => {
      this.voices--;
    };
  }

  launch(
    pos: THREE.Vector3,
    cam: THREE.Vector3,
    right: THREE.Vector3,
    delay: number,
    flight: number,
  ) {
    const ctx = this.ready();
    if (!ctx) return;
    const pl = this.place(pos, cam, right);
    const t0 = ctx.currentTime + delay + pl.delay;
    const out = this.out(ctx, pl.pan, pl.cutoff);
    const dur = Math.min(2.2, Math.max(0.9, flight * 0.5));

    // Whoosh: band-passed noise sweeping up as the rocket climbs.
    const src = this.noiseSrc(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(350, t0);
    bp.frequency.exponentialRampToValueAtTime(2600, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35 * pl.gain, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(out);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
    this.track(src);

    // Some rockets whistle.
    if (Math.random() < 0.3) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const f0 = rand(900, 1400);
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(f0 * rand(1.8, 2.6), t0 + flight * 0.8);
      const wg = ctx.createGain();
      wg.gain.setValueAtTime(0.0001, t0);
      wg.gain.exponentialRampToValueAtTime(0.06 * pl.gain, t0 + 0.15);
      wg.gain.setValueAtTime(0.06 * pl.gain, t0 + flight * 0.6);
      wg.gain.exponentialRampToValueAtTime(0.0001, t0 + flight * 0.85);
      osc.connect(wg).connect(out);
      osc.start(t0);
      osc.stop(t0 + flight * 0.9);
      this.track(osc);
    }
  }

  burst(
    pos: THREE.Vector3,
    cam: THREE.Vector3,
    right: THREE.Vector3,
    size: number,
    extra: "crackle" | "strobe" | null,
    starLife: number,
  ) {
    const ctx = this.ready();
    if (!ctx) return;
    const pl = this.place(pos, cam, right);
    const t0 = ctx.currentTime + pl.delay;
    const out = this.out(ctx, pl.pan, pl.cutoff);
    const amp = pl.gain * Math.max(0.2, size);

    // Boom: a sharp crack of noise falling into a low rumble…
    const src = this.noiseSrc(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(5000, t0);
    lp.frequency.exponentialRampToValueAtTime(180, t0 + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.9 * amp, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.25 * amp, t0 + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    src.connect(lp).connect(g).connect(out);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + 1.7);
    this.track(src);

    // …over a low thump…
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(rand(70, 95), t0);
    osc.frequency.exponentialRampToValueAtTime(32, t0 + 0.6);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.8 * amp, t0 + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    osc.connect(og).connect(out);
    osc.start(t0);
    osc.stop(t0 + 1);
    this.track(osc);

    // …and its echo rolling back over the water.
    const echo = this.noiseSrc(ctx);
    const elp = ctx.createBiquadFilter();
    elp.type = "lowpass";
    elp.frequency.value = 420;
    const eg = ctx.createGain();
    const te = t0 + rand(0.5, 1.2);
    eg.gain.setValueAtTime(0.0001, te);
    eg.gain.exponentialRampToValueAtTime(0.22 * amp, te + 0.08);
    eg.gain.exponentialRampToValueAtTime(0.0001, te + 2.2);
    echo.connect(elp).connect(eg).connect(out);
    echo.start(te, Math.random() * 1.5);
    echo.stop(te + 2.3);
    this.track(echo);

    if (extra && this.voices < 160) this.crackle(ctx, out, t0, amp, starLife, extra === "strobe");
  }

  // Crackle (or a strobe's softer sizzle): many tiny clicks scattered over
  // the stars' burn time.
  private crackle(
    ctx: AudioContext,
    out: AudioNode,
    t0: number,
    amp: number,
    starLife: number,
    soft: boolean,
  ) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = soft ? 3500 : 1600;
    hp.connect(out);
    const n = soft ? 30 : 45;
    const start = soft ? 0.15 : starLife * 0.75;
    const span = soft ? starLife * 0.8 : 0.6;
    for (let i = 0; i < n; i++) {
      const t = t0 + start + Math.random() * span;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const g = ctx.createGain();
      const d = rand(0.006, soft ? 0.012 : 0.025);
      const peak = (soft ? 0.12 : 0.45) * amp * rand(0.4, 1);
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(g).connect(hp);
      src.start(t, Math.random() * 1.9, d + 0.01);
      this.track(src);
    }
  }

  dispose() {
    if (typeof window !== "undefined" && this.unlockBound) {
      window.removeEventListener("pointerdown", this.onGesture, true);
      window.removeEventListener("keydown", this.onGesture, true);
      window.removeEventListener("touchend", this.onGesture, true);
    }
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
