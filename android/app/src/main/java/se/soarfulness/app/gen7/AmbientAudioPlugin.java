package se.soarfulness.app.gen7;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS-facing bridge to AmbientAudioService, which owns the actual MediaPlayer/audio-focus/
 * notification logic — see that class's doc comment for why playback lives in a real
 * foreground Service rather than plain fields on this Plugin. This class only binds to it
 * and forwards calls.
 */
@CapacitorPlugin(name = "AmbientAudio")
public class AmbientAudioPlugin extends Plugin {

    private AmbientAudioService service;
    private boolean bound = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            service = ((AmbientAudioService.LocalBinder) binder).getService();
            bound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            service = null;
            bound = false;
        }
    };

    @Override
    public void load() {
        Intent intent = new Intent(getContext(), AmbientAudioService.class);
        getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
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
        if (!bound || service == null) {
            call.reject("AmbientAudioService not bound");
            return;
        }

        service.play(source, isAsset, loop, (float) volume, (float) rate);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (bound && service != null) {
            service.stop();
        }
        call.resolve();
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double volume = call.getDouble("volume");
        if (volume != null && bound && service != null) {
            service.setVolume(volume.floatValue());
        }
        call.resolve();
    }

    @PluginMethod
    public void setPlaybackRate(PluginCall call) {
        Double rate = call.getDouble("rate");
        if (rate != null && bound && service != null) {
            service.setPlaybackRate(rate.floatValue());
        }
        call.resolve();
    }

    @PluginMethod
    public void setDepth(PluginCall call) {
        Double gain = call.getDouble("gain");
        Double lowpass = call.getDouble("lowpass");
        if (bound && service != null) {
            service.setDepth(
                gain != null ? gain.floatValue() : null,
                lowpass != null ? lowpass.floatValue() : null
            );
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (bound) {
            getContext().unbindService(connection);
            bound = false;
        }
    }
}
