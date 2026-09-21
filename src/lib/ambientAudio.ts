import { registerPlugin } from "@capacitor/core";

// Native (Android-only for now) counterpart to the Web Audio ocean-sound graph
// in src/routes/index.tsx. It exists purely to survive audio-focus loss:
// Chromium's WebView pauses/ducks HTML5 <audio>/Web Audio playback on its own
// whenever focus is lost or reduced (notifications, other apps' short sounds,
// even transient system sounds), with no public toggle to disable that. A
// plain android.media.MediaPlayer outside the WebView's own media pipeline
// can request focus once and simply never react to losing it — see
// android/app/src/main/java/.../AmbientAudioPlugin.java. Browser/PWA builds
// (and any source this plugin can't play — see resolveNativeAudioSource
// below, e.g. an installed app's audio track loaded via a blob: URL) keep
// using the Web Audio graph unchanged.
export interface AmbientAudioPlugin {
  /** Starts (or restarts, replacing whatever was playing) the looping ambient track. */
  play(options: {
    source: string;
    isAsset: boolean;
    loop: boolean;
    volume: number;
    rate: number;
  }): Promise<void>;
  stop(): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  setPlaybackRate(options: { rate: number }): Promise<void>;
  /** Approximates the web graph's depth-based gain + lowpass. Both optional. */
  setDepth(options: { gain?: number; lowpass?: number }): Promise<void>;
}

const AmbientAudio = registerPlugin<AmbientAudioPlugin>("AmbientAudio");

export default AmbientAudio;

/**
 * Maps a WATER_SOUNDS-style URL to what the native plugin needs, or `null` when
 * the native plugin can't play it (e.g. a blob: URL from an installed app's own
 * audio track) — callers should fall back to the Web Audio graph in that case.
 */
export function resolveNativeAudioSource(url: string): { source: string; isAsset: boolean } | null {
  if (url.startsWith("/")) {
    // A path served straight out of webDir — bundled at
    // android/app/src/main/assets/public/... at build time (see
    // CAPACITOR_APP.md), which is exactly where AmbientAudioPlugin looks
    // for "asset" sources.
    return { source: url.slice(1), isAsset: true };
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return { source: url, isAsset: false };
  }
  return null;
}
