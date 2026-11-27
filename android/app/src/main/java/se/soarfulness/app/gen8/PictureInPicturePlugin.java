package se.soarfulness.app.gen8;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.pm.PackageManager;
import android.graphics.Rect;
import android.os.Build;
import android.os.SystemClock;
import android.util.Rational;
import android.view.View;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * PIP (src/apps/pip): lets the whole activity (the WebView with the bath) shrink into Android's
 * Picture-in-Picture window when the user leaves the app, like a video player.
 *
 * <ul>
 *   <li>Android 12+ (API 31): {@code setAutoEnterEnabled} in the activity's PiP params, so the
 *       system animates into PiP by itself on the Home gesture.
 *   <li>Android 8 to 11: {@link MainActivity#onUserLeaveHint()} calls {@link #onUserLeaveHint},
 *       which enters PiP, unless the app itself just started another activity (share sheet, file
 *       picker, speech input), which also counts as "leaving".
 * </ul>
 *
 * The web side tells it whether PiP is on, whether to auto-enter, and the window's aspect ratio
 * ({@code configure}); {@code enter} shows it right away; a "change" event reports entering and
 * leaving (MainActivity.onPictureInPictureModeChanged), so the page can hide its HUD.
 */
@CapacitorPlugin(name = "PictureInPicture")
public class PictureInPicturePlugin extends Plugin {

    /** Android's own limits for a PiP aspect ratio. */
    private static final float MIN_RATIO = 1f / 2.39f;
    private static final float MAX_RATIO = 2.39f;
    /** onUserLeaveHint this soon after the app started an activity itself isn't "pressing Home". */
    private static final long OWN_LAUNCH_GRACE_MS = 1500;

    private static PictureInPicturePlugin instance;
    private static boolean enabled = false;
    private static boolean autoEnter = false;
    private static int aspectWidth = 9;
    private static int aspectHeight = 16;
    private static long lastOwnLaunchMs = 0;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        Activity activity = getActivity();
        JSObject ret = new JSObject();
        ret.put("supported", supported(activity));
        ret.put("active", activity != null && activity.isInPictureInPictureMode());
        call.resolve(ret);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        autoEnter = Boolean.TRUE.equals(call.getBoolean("autoEnter", false));
        Integer w = call.getInt("aspectWidth");
        Integer h = call.getInt("aspectHeight");
        if (w != null && h != null && w > 0 && h > 0) {
            aspectWidth = w;
            aspectHeight = h;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(
            () -> {
                applyParams(activity);
                call.resolve();
            }
        );
    }

    @PluginMethod
    public void enter(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null || !supported(activity)) {
            JSObject ret = new JSObject();
            ret.put("entered", false);
            call.resolve(ret);
            return;
        }
        activity.runOnUiThread(
            () -> {
                boolean entered = false;
                try {
                    entered = activity.enterPictureInPictureMode(buildParams(activity));
                } catch (IllegalStateException | IllegalArgumentException e) {
                    // PiP switched off for the app in Android's settings.
                }
                JSObject ret = new JSObject();
                ret.put("entered", entered);
                call.resolve(ret);
            }
        );
    }

    static boolean supported(Activity activity) {
        return activity != null && activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
    }

    static PictureInPictureParams buildParams(Activity activity) {
        PictureInPictureParams.Builder b = new PictureInPictureParams.Builder();
        float ratio = aspectHeight > 0 ? (float) aspectWidth / (float) aspectHeight : 9f / 16f;
        if (ratio < MIN_RATIO) b.setAspectRatio(new Rational(1000, 2390));
        else if (ratio > MAX_RATIO) b.setAspectRatio(new Rational(2390, 1000));
        else b.setAspectRatio(new Rational(aspectWidth, aspectHeight));
        // Animate from the whole screen (the WebView fills it).
        View decor = activity.getWindow().getDecorView();
        Rect hint = new Rect();
        if (decor.getGlobalVisibleRect(hint) && !hint.isEmpty()) b.setSourceRectHint(hint);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            b.setAutoEnterEnabled(enabled && autoEnter);
            // The scene isn't a video: crossfade instead of a seamless resize.
            b.setSeamlessResizeEnabled(false);
        }
        return b.build();
    }

    static void applyParams(Activity activity) {
        if (!supported(activity)) return;
        try {
            activity.setPictureInPictureParams(buildParams(activity));
        } catch (IllegalStateException | IllegalArgumentException e) {
            // PiP switched off for the app in Android's settings.
        }
    }

    /** MainActivity.startActivityForResult: the app is opening something itself. */
    static void onOwnActivityLaunch() {
        lastOwnLaunchMs = SystemClock.uptimeMillis();
    }

    /** MainActivity.onUserLeaveHint: Home / Recents on Android 8 to 11. */
    static void onUserLeaveHint(Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return; // auto-enter handles it
        if (!enabled || !autoEnter || !supported(activity)) return;
        if (SystemClock.uptimeMillis() - lastOwnLaunchMs < OWN_LAUNCH_GRACE_MS) return;
        if (activity.isInPictureInPictureMode()) return;
        try {
            activity.enterPictureInPictureMode(buildParams(activity));
        } catch (IllegalStateException | IllegalArgumentException e) {
            // PiP switched off for the app in Android's settings.
        }
    }

    /** MainActivity.onPictureInPictureModeChanged. */
    static void onModeChanged(boolean active) {
        if (instance == null) return;
        JSObject ev = new JSObject();
        ev.put("active", active);
        instance.notifyListeners("change", ev, true);
    }
}
