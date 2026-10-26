package se.soarfulness.app.gen8;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Keeps the bundled web app up to date with the deployed site (capacitor.config.ts →
 * plugins.LiveUpdate.url) — see CAPACITOR_APP.md's "Live updates" section.
 *
 * <p>On launch, and on resume at most every {@link #CHECK_INTERVAL_MS}, it checks the site in the
 * background and downloads a newer bundle ({@link LiveUpdater}); the download is switched to on the
 * next launch (MainActivity → {@link LiveUpdateStore#prepareForLaunch}), so a session in progress
 * is never reloaded under the user. Offline, or on any failure, the app simply keeps serving what
 * it has — the APK's own bundle at worst.
 *
 * <p>JS side: src/lib/liveUpdate.ts. {@code notifyReady()} must be called once the web app has
 * booted, or the bundle is rolled back after {@link #READY_TIMEOUT_MS}.
 */
@CapacitorPlugin(name = "LiveUpdate")
public class LiveUpdatePlugin extends Plugin {

    private static final String TAG = "LiveUpdate";
    private static final long CHECK_INTERVAL_MS = 30 * 60 * 1000L;
    private static final long READY_TIMEOUT_MS = 30_000L;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable readyTimeout = this::onReadyTimeout;
    private String url;
    private boolean autoCheck;
    private long lastCheckAt = 0;

    @Override
    public void load() {
        url = getConfig().getString("url", null);
        autoCheck = getConfig().getBoolean("autoCheck", true);
        if (LiveUpdateStore.isTrial(getContext())) {
            mainHandler.postDelayed(readyTimeout, READY_TIMEOUT_MS);
        }
        if (autoCheck) checkInBackground(null);
    }

    @Override
    protected void handleOnResume() {
        if (autoCheck && System.currentTimeMillis() - lastCheckAt > CHECK_INTERVAL_MS) {
            checkInBackground(null);
        }
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.removeCallbacks(readyTimeout);
        executor.shutdownNow();
    }

    /** Called by the web app once it has booted — confirms a freshly applied bundle works. */
    @PluginMethod
    public void notifyReady(PluginCall call) {
        mainHandler.removeCallbacks(readyTimeout);
        LiveUpdateStore.confirm(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject state = new JSObject();
        state.put("url", url);
        state.put("current", LiveUpdateStore.current(getContext()));
        state.put("pending", LiveUpdateStore.pending(getContext()));
        state.put("bundled", LiveUpdater.bundledVersion(getContext()));
        state.put("trial", LiveUpdateStore.isTrial(getContext()));
        call.resolve(state);
    }

    /** Checks the site now; resolves with {status, version} once any download has finished. */
    @PluginMethod
    public void check(PluginCall call) {
        checkInBackground(call);
    }

    /** Switches to a downloaded bundle right away (reloading the web view) instead of on the next launch. */
    @PluginMethod
    public void apply(PluginCall call) {
        File dir = LiveUpdateStore.applyPending(getContext());
        JSObject result = new JSObject();
        result.put("applied", dir != null);
        call.resolve(result);
        if (dir != null) {
            mainHandler.removeCallbacks(readyTimeout);
            mainHandler.postDelayed(readyTimeout, READY_TIMEOUT_MS);
            getBridge().setServerBasePath(dir.getAbsolutePath());
        }
    }

    /** Goes back to the web app bundled in the APK (reloading the web view). */
    @PluginMethod
    public void reset(PluginCall call) {
        mainHandler.removeCallbacks(readyTimeout);
        LiveUpdateStore.resetToBundled(getContext());
        call.resolve();
        getBridge().setServerAssetPath(LiveUpdateStore.BUNDLED_ASSET_DIR);
    }

    private void checkInBackground(PluginCall call) {
        if (url == null || url.isEmpty()) {
            if (call != null) call.reject("plugins.LiveUpdate.url is not configured");
            return;
        }
        lastCheckAt = System.currentTimeMillis();
        executor.execute(() -> {
            try {
                LiveUpdater.Result result = new LiveUpdater(getContext(), url).run();
                if (LiveUpdater.STATUS_READY.equals(result.status)) {
                    JSObject event = new JSObject();
                    event.put("version", result.version);
                    notifyListeners("updateReady", event);
                }
                if (call != null) {
                    JSObject ret = new JSObject();
                    ret.put("status", result.status);
                    ret.put("version", result.version);
                    call.resolve(ret);
                }
            } catch (Exception e) {
                // Offline, a deploy caught halfway, out of space… — keep what we have, try again later.
                Log.w(TAG, "Live update check failed: " + e.getMessage());
                if (call != null) call.reject(e.getMessage(), e);
            }
        });
    }

    private void onReadyTimeout() {
        Log.w(TAG, "Web bundle " + LiveUpdateStore.current(getContext()) + " never called notifyReady(); rolling back");
        File dir = LiveUpdateStore.rollback(getContext());
        if (dir != null) {
            getBridge().setServerBasePath(dir.getAbsolutePath());
        } else {
            getBridge().setServerAssetPath(LiveUpdateStore.BUNDLED_ASSET_DIR);
        }
    }
}
