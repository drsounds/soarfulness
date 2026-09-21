package se.soarfulness.app.gen7;

import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.PlaybackParams;
import android.media.audiofx.Equalizer;
import android.os.Build;
import android.content.res.AssetFileDescriptor;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;

/**
 * Plays the app's looping ambient/ocean sound with plain android.media.MediaPlayer
 * instead of the WebView's own <audio>/Web Audio pipeline, specifically so it survives
 * transient audio-focus loss (notifications, other apps' short sounds, etc). Chromium's
 * WebView pauses/ducks HTML5 audio on its own whenever focus is lost or reduced, with no
 * public toggle to disable that — this plugin sidesteps it entirely by requesting focus
 * once and then simply never reacting to focus-change callbacks.
 */
@CapacitorPlugin(name = "AmbientAudio")
public class AmbientAudioPlugin extends Plugin {

    private MediaPlayer mediaPlayer;
    private Equalizer equalizer;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private final AudioManager.OnAudioFocusChangeListener focusListener = focusChange -> {
        // Deliberately empty: this is the whole point of the plugin. We ask for
        // focus once so the system knows we're an active audio app (and other apps
        // may duck for *us*), but we never pause/duck in response to losing it.
    };

    private float baseVolume = 1f;
    private float depthGainMultiplier = 1f;

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void play(PluginCall call) {
        String source = call.getString("source");
        boolean isAsset = Boolean.TRUE.equals(call.getBoolean("isAsset", false));
        boolean loop = Boolean.TRUE.equals(call.getBoolean("loop", true));
        double volume = call.getDouble("volume", 1.0);
        double rate = call.getDouble("rate", 1.0);

        if (source == null || source.isEmpty()) {
            call.reject("source is required");
            return;
        }

        releasePlayer();

        try {
            MediaPlayer player = new MediaPlayer();
            player.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            );

            if (isAsset) {
                // Assets are copied from webDir into android/app/src/main/assets/public
                // at build time (see CAPACITOR_APP.md) — JS passes a path relative to
                // that "public" root (leading slash already stripped).
                try (AssetFileDescriptor afd = getContext().getAssets().openFd("public/" + source)) {
                    player.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                }
            } else {
                player.setDataSource(getContext(), android.net.Uri.parse(source));
            }

            player.setLooping(loop);
            player.setOnPreparedListener(mp -> {
                requestAudioFocus();
                mp.start();
            });
            player.prepareAsync();

            try {
                equalizer = new Equalizer(0, player.getAudioSessionId());
                equalizer.setEnabled(true);
            } catch (Exception e) {
                equalizer = null;
            }

            mediaPlayer = player;
            baseVolume = clamp01((float) volume);
            depthGainMultiplier = 1f;
            applyVolume();
            setPlaybackRateInternal((float) rate);

            call.resolve();
        } catch (IOException | IllegalStateException | IllegalArgumentException e) {
            call.reject("Failed to start ambient audio: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        releasePlayer();
        call.resolve();
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double volume = call.getDouble("volume");
        if (volume != null) {
            baseVolume = clamp01(volume.floatValue());
            applyVolume();
        }
        call.resolve();
    }

    @PluginMethod
    public void setPlaybackRate(PluginCall call) {
        Double rate = call.getDouble("rate");
        if (rate != null) {
            setPlaybackRateInternal(rate.floatValue());
        }
        call.resolve();
    }

    /**
     * Approximates the web build's depth-based effect (louder + more muffled as the
     * camera goes deeper): `gain` is folded into the MediaPlayer volume, `lowpass`
     * (a target cutoff frequency, 500-18000Hz) is approximated by pulling down the
     * Equalizer's upper bands proportionally — a real biquad lowpass isn't available
     * on plain MediaPlayer, but this reads as "more muffled" at low cutoffs, which is
     * the perceptible effect being reproduced.
     */
    @PluginMethod
    public void setDepth(PluginCall call) {
        Double gain = call.getDouble("gain");
        Double lowpass = call.getDouble("lowpass");

        if (gain != null) {
            depthGainMultiplier = Math.max(0f, gain.floatValue());
            applyVolume();
        }
        if (lowpass != null && equalizer != null) {
            applyMuffle(lowpass.floatValue());
        }
        call.resolve();
    }

    private void applyMuffle(float lowpassHz) {
        try {
            // 18000Hz (or above) => no muffling; 500Hz => maximum muffling.
            float t = 1f - clamp01((lowpassHz - 500f) / (18000f - 500f));
            short bands = equalizer.getNumberOfBands();
            short[] range = equalizer.getBandLevelRange();
            short minLevel = range[0];
            for (short band = (short) Math.max(0, bands - 2); band < bands; band++) {
                short level = (short) (minLevel * t);
                equalizer.setBandLevel(band, level);
            }
        } catch (Exception e) {
            // Equalizer support varies by device/manufacturer — muffling is a nice-to-have,
            // never worth failing playback over.
        }
    }

    private void setPlaybackRateInternal(float rate) {
        if (mediaPlayer == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                boolean wasPlaying = mediaPlayer.isPlaying();
                PlaybackParams params = mediaPlayer.getPlaybackParams();
                params.setSpeed(Math.max(0.2f, Math.min(5f, rate)));
                mediaPlayer.setPlaybackParams(params);
                if (wasPlaying && !mediaPlayer.isPlaying()) {
                    mediaPlayer.start();
                }
            } catch (Exception e) {
                // Some devices reject playback params mid-stream; leave rate at 1x rather
                // than crash — same "best effort" stance as the muffle effect above.
            }
        }
    }

    private void applyVolume() {
        if (mediaPlayer == null) return;
        float v = clamp01(baseVolume * depthGainMultiplier);
        try {
            mediaPlayer.setVolume(v, v);
        } catch (IllegalStateException e) {
            // Player not in a state that accepts volume changes yet (still preparing) —
            // the next setVolume/setDepth call (or the prepared-listener path) will
            // reapply it.
        }
    }

    private void requestAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setOnAudioFocusChangeListener(focusListener)
                .build();
            audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            //noinspection deprecation
            audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
    }

    private void abandonAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
            audioFocusRequest = null;
        } else {
            //noinspection deprecation
            audioManager.abandonAudioFocus(focusListener);
        }
    }

    private void releasePlayer() {
        if (equalizer != null) {
            try {
                equalizer.release();
            } catch (Exception e) {
                /* noop */
            }
            equalizer = null;
        }
        if (mediaPlayer != null) {
            try {
                mediaPlayer.stop();
            } catch (Exception e) {
                /* noop */
            }
            try {
                mediaPlayer.release();
            } catch (Exception e) {
                /* noop */
            }
            mediaPlayer = null;
        }
        abandonAudioFocus();
    }

    private static float clamp01(float v) {
        return Math.max(0f, Math.min(1f, v));
    }

    @Override
    protected void handleOnDestroy() {
        releasePlayer();
        super.handleOnDestroy();
    }
}
