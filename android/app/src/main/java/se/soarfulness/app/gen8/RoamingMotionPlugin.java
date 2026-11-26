package se.soarfulness.app.gen8;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ROAMING (src/apps/roaming): receives the motion broadcasts of the Roaming app
 * (drsounds/roaming-android-app, action se.spacify.app.roaming.event.MOTION) and forwards each
 * one to the WebView as a "motion" event with Roaming's flat extras (motion_type, direction,
 * intensity, source, timestamp).
 *
 * Since Android 8 implicit broadcasts don't reach manifest-declared receivers, so the receiver is
 * registered at runtime, only while the web app asked for it (start()/stop(), i.e. ROAMING is
 * switched on) and the app is visible (registered in onStart, unregistered in onStop), as
 * Roaming's README recommends.
 */
@CapacitorPlugin(name = "RoamingMotion")
public class RoamingMotionPlugin extends Plugin {

    static final String ACTION_MOTION = "se.spacify.app.roaming.event.MOTION";

    private boolean wanted = false;
    private boolean visible = true;
    private BroadcastReceiver receiver = null;

    @PluginMethod
    public void start(PluginCall call) {
        wanted = true;
        sync();
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        wanted = false;
        sync();
        call.resolve();
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        visible = true;
        sync();
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        visible = false;
        sync();
    }

    @Override
    protected void handleOnDestroy() {
        wanted = false;
        sync();
        super.handleOnDestroy();
    }

    private void sync() {
        Context context = getContext();
        if (context == null) return;
        boolean shouldListen = wanted && visible;
        if (shouldListen && receiver == null) {
            receiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context c, Intent intent) {
                    if (intent == null || !ACTION_MOTION.equals(intent.getAction())) return;
                    JSObject data = new JSObject();
                    data.put("motion_type", orDefault(intent.getStringExtra("motion_type"), "idle"));
                    data.put("direction", orDefault(intent.getStringExtra("direction"), "none"));
                    data.put("intensity", intent.getFloatExtra("intensity", 0f));
                    data.put("source", intent.getStringExtra("source"));
                    data.put("timestamp", intent.getLongExtra("timestamp", 0L));
                    notifyListeners("motion", data);
                }
            };
            ContextCompat.registerReceiver(
                context,
                receiver,
                new IntentFilter(ACTION_MOTION),
                ContextCompat.RECEIVER_EXPORTED
            );
        } else if (!shouldListen && receiver != null) {
            try {
                context.unregisterReceiver(receiver);
            } catch (IllegalArgumentException ignored) {
                // Already unregistered.
            }
            receiver = null;
        }
    }

    private static String orDefault(String value, String fallback) {
        return value != null ? value : fallback;
    }
}
