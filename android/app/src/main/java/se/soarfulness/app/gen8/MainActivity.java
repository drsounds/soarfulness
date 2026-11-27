package se.soarfulness.app.gen8;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Not an npm-published plugin, so `cap sync` never registers it for us —
        // it has to be registered by hand, and (per Capacitor's own convention)
        // before super.onCreate() so it's available as soon as the bridge is.
        registerPlugin(AmbientAudioPlugin.class);
        registerPlugin(LiveUpdatePlugin.class);
        registerPlugin(AppLinksPlugin.class);
        registerPlugin(DeviceFilesPlugin.class);
        registerPlugin(RoamingMotionPlugin.class);
        registerPlugin(VoiceRecognitionPlugin.class);
        registerPlugin(OnDeviceLlmPlugin.class);
        registerPlugin(PictureInPicturePlugin.class);
        // Picks which web bundle the Bridge is about to serve (a downloaded live update, or the
        // one inside the APK) — must run before super.onCreate() starts the Bridge. See
        // CAPACITOR_APP.md's "Live updates".
        LiveUpdateStore.prepareForLaunch(this);
        super.onCreate(savedInstanceState);
    }

    // PIP (src/apps/pip, PictureInPicturePlugin): Home on Android 8 to 11 enters Picture-in-Picture
    // (Android 12+ auto-enters from the PiP params instead).
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        PictureInPicturePlugin.onUserLeaveHint(this);
    }

    // Every startActivity / activity-result launch ends up here: the app opening a share sheet or
    // file picker itself shouldn't count as pressing Home.
    @Override
    public void startActivityForResult(Intent intent, int requestCode, Bundle options) {
        PictureInPicturePlugin.onOwnActivityLaunch();
        super.startActivityForResult(intent, requestCode, options);
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        PictureInPicturePlugin.onModeChanged(isInPictureInPictureMode);
    }
}
