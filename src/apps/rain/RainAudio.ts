// REGN's sound (see Rainfall.ts for the streaks and splashes).

type AudioCtor = typeof AudioContext;

/**
 * WebAudio-synthesized rain: a steady hiss (filtered noise) under a patter
 * of individual drops (a looped buffer of short random clicks). Its own small
 * AudioContext like FireworksAudio, created the first time it's wanted and
 * suspended again while the rain or its sound is off.
 */
export class RainAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lp: BiquadFilterNode | null = null;
  private hissGain: GainNode | null = null;
  private patterGain: GainNode | null = null;
  private enabled = false;
  private unlockBound = false;

  private readonly onGesture = () => {
    if (this.enabled && this.ctx && this.ctx.state !== "running") {
      this.ctx.resume().catch(() => undefined);
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
      const rate = ctx.sampleRate;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 12000;
      lp.Q.value = 0.4;
      const master = ctx.createGain();
      master.gain.value = 0;
      lp.connect(master).connect(ctx.destination);

      // Hiss: pinkish noise, band-limited to where rain lives.
      const len = Math.floor(rate * 3);
      const hissBuf = ctx.createBuffer(2, len, rate);
      for (let c = 0; c < 2; c++) {
        const ch = hissBuf.getChannelData(c);
        let b0 = 0,
          b1 = 0,
          b2 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + w * 0.099046;
          b1 = 0.963 * b1 + w * 0.2965164;
          b2 = 0.57 * b2 + w * 1.0526913;
          ch[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
        }
      }
      const hiss = ctx.createBufferSource();
      hiss.buffer = hissBuf;
      hiss.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 400;
      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.5;
      hiss.connect(hp).connect(hissGain).connect(lp);

      // Patter: thousands of tiny decaying clicks at random times, levels
      // and pitches, spread over the stereo field.
      const pLen = Math.floor(rate * 4);
      const patterBuf = ctx.createBuffer(2, pLen, rate);
      const drops = 1400;
      for (let c = 0; c < 2; c++) {
        const ch = patterBuf.getChannelData(c);
        for (let d = 0; d < drops; d++) {
          const at = Math.floor(Math.random() * pLen);
          const amp = Math.pow(Math.random(), 2.5) * 0.6;
          const decay = rate * (0.0015 + Math.random() * 0.004);
          const freq = 1800 + Math.random() * 5000;
          const n = Math.floor(decay * 5);
          for (let i = 0; i < n; i++) {
            const idx = (at + i) % pLen;
            ch[idx] += Math.sin((i / rate) * freq * 6.2831853) * amp * Math.exp(-i / decay);
          }
        }
      }
      const patter = ctx.createBufferSource();
      patter.buffer = patterBuf;
      patter.loop = true;
      const patterGain = ctx.createGain();
      patterGain.gain.value = 0.5;
      patter.connect(patterGain).connect(lp);

      hiss.start();
      patter.start();
      this.ctx = ctx;
      this.master = master;
      this.lp = lp;
      this.hissGain = hissGain;
      this.patterGain = patterGain;
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

  /**
   * @param volume 0..~1.3, already scaled by how hard it rains.
   * @param underwater 0..1, muffles the rain heard from below the surface.
   * @param heaviness 0..1, shifts the mix from patter toward a roaring hiss.
   */
  update(enabled: boolean, volume: number, underwater: number, heaviness: number) {
    const on = enabled && volume > 0;
    if (on !== this.enabled) {
      this.enabled = on;
      if (on) {
        this.ensure()
          ?.resume()
          .catch(() => undefined);
      } else if (this.ctx && this.ctx.state === "running") {
        const ctx = this.ctx;
        this.master?.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        window.setTimeout(() => {
          if (!this.enabled) ctx.suspend().catch(() => undefined);
        }, 900);
      }
    }
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.lp || !this.enabled) return;
    const uw = Math.max(0, Math.min(1, underwater));
    const h = Math.max(0, Math.min(1, heaviness));
    const now = ctx.currentTime;
    this.master.gain.setTargetAtTime(Math.min(1.3, volume) * (1 - 0.55 * uw), now, 0.25);
    this.lp.frequency.setTargetAtTime(12000 * Math.pow(0.03, uw), now, 0.15);
    this.hissGain?.gain.setTargetAtTime(0.25 + h * 0.6, now, 0.3);
    this.patterGain?.gain.setTargetAtTime(0.75 - h * 0.3, now, 0.3);
  }

  dispose() {
    this.enabled = false;
    if (typeof window !== "undefined" && this.unlockBound) {
      window.removeEventListener("pointerdown", this.onGesture, true);
      window.removeEventListener("keydown", this.onGesture, true);
      window.removeEventListener("touchend", this.onGesture, true);
    }
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
