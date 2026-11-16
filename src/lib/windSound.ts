// VINDLJUD: WebAudio-synthesized wind, with its own small AudioContext like
// the fireworks sound (lib/sceneFx/fireworks.ts), separate from the ambient
// water track's graph. Created lazily the first time it's wanted and
// suspended again when nothing is audible.
//
// Graph: one looping noise buffer feeds
//   - a "rush" band (bandpass) whose centre rises with the apparent wind
//     speed — the main body of the wind,
//   - a narrow resonant "whistle" an octave or so above it that only comes
//     in at speed and when the wind meets the face,
//   - a broadband "surface" noise (surf and air just above the water) for
//     HÖJDLJUD's transition out of the water.
// Wind and whistle share a stereo panner, so a side wind sits on that ear.

import type { WindHearing } from "@/lib/wind";

type AudioCtor = typeof AudioContext;

export type WindSoundFrame = {
  /** Wind sound wanted at all (LJUD + VINDLJUD or HÖJDLJUD). */
  enabled: boolean;
  volume: number;
  hearing: WindHearing;
  /** 0..1 how much of the wind is heard (VINDLJUD on and/or altitude breeze). */
  windLevel: number;
  /** 0..1 level of the surface noise (HÖJDLJUD). */
  surfaceLevel: number;
  /** 0..1, 1 = fully under water (muffles and mutes). */
  underwater: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Rush gain, rush/whistle centre frequencies for an apparent wind. Pure. */
export function windVoice(apparent: number, facing: number) {
  const s = Math.max(0, apparent);
  // Barely there below ~1.5 m/s, a steady roar by ~25 m/s.
  const loud = clamp(Math.pow(s / 25, 1.3), 0, 1.25);
  const face = 0.72 + 0.28 * clamp(facing, -1, 1);
  const bright = 1 + 0.3 * clamp(facing, -1, 1);
  return {
    gain: loud * face,
    rushHz: clamp((220 + 55 * s) * bright, 120, 5200),
    whistleHz: clamp((700 + 95 * s) * bright, 400, 9000),
    whistleGain: clamp((s - 8) / 22, 0, 1) * clamp(0.4 + 0.6 * facing, 0, 1) * 0.35,
  };
}

export class WindAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rushBp: BiquadFilterNode | null = null;
  private rushGain: GainNode | null = null;
  private whistleBp: BiquadFilterNode | null = null;
  private whistleGain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;
  private surfGain: GainNode | null = null;
  private lp: BiquadFilterNode | null = null;
  private src: AudioBufferSourceNode | null = null;
  private enabled = false;
  private unlockBound = false;
  private lastSet = 0;

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
      // 4 s of pink-ish noise (Paul Kellet's filter), looped.
      const len = Math.floor(ctx.sampleRate * 4);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const ch = buf.getChannelData(c);
        let b0 = 0,
          b1 = 0,
          b2 = 0,
          b3 = 0,
          b4 = 0,
          b5 = 0,
          b6 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          ch[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
        // Cross-fade the loop seam.
        const fade = Math.floor(ctx.sampleRate * 0.05);
        for (let i = 0; i < fade; i++) {
          const k = i / fade;
          ch[i] = ch[i] * k + ch[len - fade + i] * (1 - k);
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopEnd = (len - Math.floor(ctx.sampleRate * 0.05)) / ctx.sampleRate;

      const rushBp = ctx.createBiquadFilter();
      rushBp.type = "bandpass";
      rushBp.Q.value = 0.9;
      const rushGain = ctx.createGain();
      rushGain.gain.value = 0;
      const whistleBp = ctx.createBiquadFilter();
      whistleBp.type = "bandpass";
      whistleBp.Q.value = 9;
      const whistleGain = ctx.createGain();
      whistleGain.gain.value = 0;
      const panner = ctx.createStereoPanner();

      const surfLp = ctx.createBiquadFilter();
      surfLp.type = "lowpass";
      surfLp.frequency.value = 2600;
      surfLp.Q.value = 0.4;
      const surfHp = ctx.createBiquadFilter();
      surfHp.type = "highpass";
      surfHp.frequency.value = 140;
      const surfGain = ctx.createGain();
      surfGain.gain.value = 0;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 18000;
      lp.Q.value = 0.5;
      const master = ctx.createGain();
      master.gain.value = 0;

      src.connect(rushBp).connect(rushGain).connect(panner);
      src.connect(whistleBp).connect(whistleGain).connect(panner);
      panner.connect(lp);
      src.connect(surfHp).connect(surfLp).connect(surfGain).connect(lp);
      lp.connect(master).connect(ctx.destination);
      src.start();

      this.ctx = ctx;
      this.src = src;
      this.master = master;
      this.rushBp = rushBp;
      this.rushGain = rushGain;
      this.whistleBp = whistleBp;
      this.whistleGain = whistleGain;
      this.panner = panner;
      this.surfGain = surfGain;
      this.lp = lp;
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

  update(f: WindSoundFrame) {
    const uw = clamp(f.underwater, 0, 1);
    const voice = windVoice(f.hearing.apparent, f.hearing.facing);
    const windAmt = voice.gain * clamp(f.windLevel, 0, 1);
    const surfAmt = clamp(f.surfaceLevel, 0, 1) * 0.55;
    const audible = f.enabled && f.volume > 0 && (windAmt > 0.002 || surfAmt > 0.002) && uw < 0.98;
    if (audible !== this.enabled) {
      this.enabled = audible;
      if (audible) {
        const ctx = this.ensure();
        ctx?.resume().catch(() => {
          /* waits for a gesture */
        });
      } else if (this.ctx && this.ctx.state === "running") {
        const ctx = this.ctx;
        this.master?.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        window.setTimeout(() => {
          if (!this.enabled) ctx.suspend().catch(() => undefined);
        }, 900);
      }
    }
    const ctx = this.ctx;
    if (!ctx || !this.enabled || !this.master) return;
    // Parameter changes ~20×/s are plenty and keep the audio thread quiet.
    const now = ctx.currentTime;
    if (now - this.lastSet < 0.05) return;
    this.lastSet = now;
    const tc = 0.25;
    this.master.gain.setTargetAtTime(clamp(f.volume, 0, 1) * (1 - uw), now, 0.12);
    this.lp!.frequency.setTargetAtTime(18000 * Math.pow(0.03, uw), now, 0.1);
    this.rushGain!.gain.setTargetAtTime(windAmt * 0.9, now, tc);
    this.rushBp!.frequency.setTargetAtTime(voice.rushHz, now, tc);
    this.whistleGain!.gain.setTargetAtTime(voice.whistleGain * clamp(f.windLevel, 0, 1), now, tc);
    this.whistleBp!.frequency.setTargetAtTime(voice.whistleHz, now, tc);
    this.panner!.pan.setTargetAtTime(clamp(f.hearing.pan, -1, 1) * 0.7, now, tc);
    this.surfGain!.gain.setTargetAtTime(surfAmt, now, 0.3);
  }

  dispose() {
    if (this.unlockBound && typeof window !== "undefined") {
      window.removeEventListener("pointerdown", this.onGesture, true);
      window.removeEventListener("keydown", this.onGesture, true);
      window.removeEventListener("touchend", this.onGesture, true);
      this.unlockBound = false;
    }
    try {
      this.src?.stop();
    } catch {
      /* noop */
    }
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.enabled = false;
  }
}
