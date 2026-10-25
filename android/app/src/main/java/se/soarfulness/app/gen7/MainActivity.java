package se.soarfulness.app.gen7;

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
        // Picks which web bundle the Bridge is about to serve (a downloaded live update, or the
        // one inside the APK) — must run before super.onCreate() starts the Bridge. See
        // CAPACITOR_APP.md's "Live updates".
        LiveUpdateStore.prepareForLaunch(this);
        super.onCreate(savedInstanceState);
    }
}
