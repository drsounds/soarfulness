package se.soarfulness.app.gen8;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "BatheNotification",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class BatheNotificationPlugin extends Plugin {

    private boolean wanted;

    @PluginMethod
    public void start(PluginCall call) {
        wanted = true;
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("notifications", call, "notificationsPermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void notificationsPermission(PluginCall call) {
        if (wanted && getPermissionState("notifications") == PermissionState.GRANTED) {
            startService(call);
        } else {
            JSObject result = new JSObject();
            result.put("shown", false);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        wanted = false;
        getContext().stopService(new Intent(getContext(), BatheNotificationService.class));
        call.resolve();
    }

    private void startService(PluginCall call) {
        if (!wanted) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(getContext(), BatheNotificationService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            JSObject result = new JSObject();
            result.put("shown", true);
            call.resolve(result);
        } catch (RuntimeException e) {
            call.reject("Couldn't start the bathing notification", e);
        }
    }
}
