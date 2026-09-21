package se.soarfulness.app.gen7;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.PlaybackParams;
import android.media.audiofx.Equalizer;
import android.net.Uri;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import java.io.IOException;

/**
 * Owns the ambient/ocean sound's actual android.media.MediaPlayer, as a real foreground
 * Service rather than plain object state inside AmbientAudioPlugin (which now just binds
 * to this and forwards calls). Two reasons, both serving the same goal this whole plugin
 * exists for — playback nothing interrupts:
 *
 * 1. A background process with no foreground service and no visible notification is a
 *    prime target for the OS to kill outright to reclaim memory, which would silently
 *    stop "uninterruptible" ambient audio far more thoroughly than any audio-focus event
 *    ever could. A foreground service with an active notification is Android's documented
 *    way to say "this process is doing something the user asked for, don't kill it."
 * 2. The notification is also a visible, always-current "yes, ambient audio is really
 *    still playing" signal — for the user's own convenience, and to make future audio
 *    bugs (like the focus-loss one this plugin exists to fix) far easier to diagnose
 *    without adb/logcat: if the notification is gone, the service died; if it's there but
 *    silent, the bug is in MediaPlayer/Equalizer, not process lifecycle.
 *
 * Bound to (never independently started) by AmbientAudioPlugin — a bound-only service has
 * no "call startForeground() within 5 seconds" deadline the way one launched via
 * startForegroundService() would, so it's fine for this to go foreground only once
 * MediaPlayer.prepareAsync() actually finishes, whenever that is. The notification's own
 * Stop action fires ACTION_STOP via PendingIntent.getService(), which still reaches
 * onStartCommand() on this same (bound) instance regardless of how it was created.
 */
public class AmbientAudioService extends Service {

    private static final String CHANNEL_ID = "ambient_audio";
    private static final int NOTIFICATION_ID = 8420;
    public static final String ACTION_STOP = "se.soarfulness.app.gen7.AmbientAudioService.STOP";

    public class LocalBinder extends Binder {
        AmbientAudioService getService() {
            return AmbientAudioService.this;
        }
    }

    private final IBinder binder = new LocalBinder();

    private MediaPlayer mediaPlayer;
    private Equalizer equalizer;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private final AudioManager.OnAudioFocusChangeListener focusListener = focusChange -> {
        // Deliberately empty: this is the whole point of the plugin/service. We ask
        // for focus once so the system knows we're an active audio app (and other
        // apps may duck for *us*), but we never pause/duck in response to losing it.
    };

    private float baseVolume = 1f;
    private float depthGainMultiplier = 1f;

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannel();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stop();
        }
        return START_NOT_STICKY;
    }

    public void play(String source, boolean isAsset, boolean loop, float volume, float rate) {
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
                // at build time (see CAPACITOR_APP.md) — the plugin passes a path
                // relative to that "public" root (leading slash already stripped).
                try (AssetFileDescriptor afd = getAssets().openFd("public/" + source)) {
                    player.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                }
            } else {
                player.setDataSource(this, Uri.parse(source));
            }

            player.setLooping(loop);
            player.setOnPreparedListener(mp -> {
                requestAudioFocus();
                mp.start();
                showPlayingNotification();
            });
            player.prepareAsync();

            try {
                equalizer = new Equalizer(0, player.getAudioSessionId());
                equalizer.setEnabled(true);
            } catch (Exception e) {
                equalizer = null;
            }

            mediaPlayer = player;
            baseVolume = clamp01(volume);
            depthGainMultiplier = 1f;
            applyVolume();
            setPlaybackRateInternal(rate);
        } catch (IOException | IllegalStateException | IllegalArgumentException e) {
            // Best-effort: leave the service idle rather than crash it — the next
            // play() call (e.g. the user toggling audio off/on) gets a clean retry.
        }
    }

    public void stop() {
        releasePlayer();
        stopForeground(STOP_FOREGROUND_REMOVE);
    }

    public void setVolume(float volume) {
        baseVolume = clamp01(volume);
        applyVolume();
    }

    public void setPlaybackRate(float rate) {
        setPlaybackRateInternal(rate);
    }

    /**
     * Approximates the web build's depth-based effect (louder + more muffled as the
     * camera goes deeper): `gain` is folded into the MediaPlayer volume, `lowpass`
     * (a target cutoff frequency, 500-18000Hz) is approximated by pulling down the
     * Equalizer's upper bands proportionally — a real biquad lowpass isn't available
     * on plain MediaPlayer, but this reads as "more muffled" at low cutoffs, which is
     * the perceptible effect being reproduced.
     */
    public void setDepth(Float gain, Float lowpass) {
        if (gain != null) {
            depthGainMultiplier = Math.max(0f, gain);
            applyVolume();
        }
        if (lowpass != null && equalizer != null) {
            applyMuffle(lowpass);
        }
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

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.ambient_audio_notification_channel),
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void showPlayingNotification() {
        Intent stopIntent = new Intent(this, AmbientAudioService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.ambient_audio_notification_text))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(0, getString(R.string.ambient_audio_notification_stop), stopPendingIntent)
            .build();

        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        );
    }

    private static float clamp01(float v) {
        return Math.max(0f, Math.min(1f, v));
    }

    @Override
    public void onDestroy() {
        releasePlayer();
        super.onDestroy();
    }
}
