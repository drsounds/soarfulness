package se.soarfulness.app.gen8;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import java.io.File;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

/**
 * Which web bundle the app serves, and the on-disk layout of downloaded ones — see
 * CAPACITOR_APP.md's "Live updates" section for the whole flow.
 *
 * <p>Bundles live in {@code files/live-update/bundles/<version>/}, each a complete copy of the
 * web app (index.html, assets, everything from public/) plus the {@code capacitor-live-update.json}
 * it was built from. Switching bundles uses Capacitor's own mechanism: the Bridge serves from the
 * directory stored under {@code CapWebViewSettings/serverBasePath} on launch (falling back to the
 * APK's bundled {@code public/} assets when it's empty), and clears that preference itself the first
 * time a new APK version starts.
 *
 * <p>A freshly applied bundle starts on trial: the web app calls {@code LiveUpdate.notifyReady()}
 * once it has booted (src/lib/liveUpdate.ts). A bundle that never does — within
 * {@link LiveUpdatePlugin}'s timeout, or across {@link #MAX_UNCONFIRMED_LAUNCHES} launches — is
 * rolled back to the last good one (ultimately the APK's own bundle) and never retried.
 */
final class LiveUpdateStore {

    static final String MANIFEST_NAME = "capacitor-live-update.json";
    /** Where Capacitor copies webDir inside the APK (Bridge's DEFAULT_WEB_ASSET_DIR). */
    static final String BUNDLED_ASSET_DIR = "public";

    private static final String PREFS = "AquafulnessLiveUpdate";
    // Mirror com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME / CAP_SERVER_PATH, which the
    // Bridge reads on launch to decide where to serve the web app from.
    private static final String CAP_PREFS = com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME;
    private static final String CAP_SERVER_PATH = com.getcapacitor.plugin.WebView.CAP_SERVER_PATH;

    private static final String KEY_BINARY = "binary";
    /** Version being served; "" means the APK's bundled copy. */
    private static final String KEY_CURRENT = "current";
    /** Last confirmed version to roll back to; "" means the APK's bundled copy. */
    private static final String KEY_PREVIOUS = "previous";
    /** Fully downloaded and verified, waiting for the next launch (or LiveUpdate.apply()). */
    private static final String KEY_PENDING = "pending";
    private static final String KEY_TRIAL = "trial";
    private static final String KEY_TRIAL_LAUNCHES = "trialLaunches";
    private static final String KEY_FAILED = "failed";

    static final int MAX_UNCONFIRMED_LAUNCHES = 2;

    private LiveUpdateStore() {}

    static File bundlesDir(Context context) {
        return new File(context.getFilesDir(), "live-update/bundles");
    }

    static File bundleDir(Context context, String version) {
        return new File(bundlesDir(context), version);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized String current(Context context) {
        return prefs(context).getString(KEY_CURRENT, "");
    }

    static synchronized String pending(Context context) {
        return prefs(context).getString(KEY_PENDING, "");
    }

    static synchronized boolean isTrial(Context context) {
        return prefs(context).getBoolean(KEY_TRIAL, false);
    }

    static synchronized boolean isFailed(Context context, String version) {
        return prefs(context).getStringSet(KEY_FAILED, new HashSet<>()).contains(version);
    }

    /** The downloaded bundle currently served, or null when it's the APK's bundled copy. */
    static File currentDir(Context context) {
        String version = current(context);
        if (version.isEmpty()) return null;
        File dir = bundleDir(context, version);
        return dir.isDirectory() ? dir : null;
    }

    /**
     * A file from the currently served downloaded bundle (path relative to the web root, no
     * leading slash), or null when it's not there and callers should read the APK's
     * {@code public/} assets instead.
     */
    static File resolveCurrentFile(Context context, String relativePath) {
        File dir = currentDir(context);
        if (dir == null || relativePath == null) return null;
        File file = new File(dir, relativePath);
        return isInside(dir, file) && file.isFile() ? file : null;
    }

    static boolean isInside(File dir, File file) {
        try {
            String root = dir.getCanonicalPath() + File.separator;
            return file.getCanonicalPath().startsWith(root);
        } catch (IOException e) {
            return false;
        }
    }

    /**
     * Runs in MainActivity before the Bridge starts: promotes a pending download, rolls back a
     * bundle that never confirmed it booted, and writes the result where the Bridge looks.
     */
    static synchronized void prepareForLaunch(Context context) {
        SharedPreferences p = prefs(context);
        String binary = binaryVersion(context);
        if (!binary.equals(p.getString(KEY_BINARY, null))) {
            // A new APK ships its own (newer) web bundle — start over from it. Capacitor's
            // Bridge.isNewBinary() clears serverBasePath for the same reason.
            p.edit().clear().putString(KEY_BINARY, binary).commit();
            writeServerBasePath(context, null);
            deleteRecursively(bundlesDir(context));
            return;
        }

        if (p.getBoolean(KEY_TRIAL, false)) {
            int launches = p.getInt(KEY_TRIAL_LAUNCHES, 0);
            if (launches >= MAX_UNCONFIRMED_LAUNCHES) {
                rollbackLocked(context);
            } else {
                p.edit().putInt(KEY_TRIAL_LAUNCHES, launches + 1).commit();
            }
        }

        if (!p.getString(KEY_PENDING, "").isEmpty()) {
            promotePendingLocked(context);
        }

        File dir = currentDir(context);
        if (dir == null && !current(context).isEmpty()) {
            // Its directory went missing (storage cleared?) — fall back to the bundled copy.
            p.edit().putString(KEY_CURRENT, "").putBoolean(KEY_TRIAL, false).commit();
        }
        writeServerBasePath(context, dir);
        deleteUnusedBundles(context);
    }

    /** Switches to the pending download right away; returns its directory, or null if none. */
    static synchronized File applyPending(Context context) {
        if (pending(context).isEmpty()) return null;
        File dir = promotePendingLocked(context);
        if (dir != null) writeServerBasePath(context, dir);
        return dir;
    }

    /** Marks the served bundle as having booted successfully. */
    static synchronized void confirm(Context context) {
        prefs(context).edit().putBoolean(KEY_TRIAL, false).putInt(KEY_TRIAL_LAUNCHES, 0).commit();
    }

    /**
     * Abandons the served (unconfirmed) bundle for the last good one. Returns that bundle's
     * directory, or null when it's the APK's bundled copy.
     */
    static synchronized File rollback(Context context) {
        rollbackLocked(context);
        File dir = currentDir(context);
        writeServerBasePath(context, dir);
        return dir;
    }

    /** Drops every downloaded bundle and goes back to the APK's own. */
    static synchronized void resetToBundled(Context context) {
        prefs(context)
            .edit()
            .putString(KEY_CURRENT, "")
            .putString(KEY_PREVIOUS, "")
            .putString(KEY_PENDING, "")
            .putBoolean(KEY_TRIAL, false)
            .putInt(KEY_TRIAL_LAUNCHES, 0)
            .commit();
        writeServerBasePath(context, null);
    }

    static synchronized void setPending(Context context, String version) {
        prefs(context).edit().putString(KEY_PENDING, version).commit();
    }

    /** Bundle directories a download in progress must not delete or overwrite. */
    static synchronized Set<String> versionsInUse(Context context) {
        SharedPreferences p = prefs(context);
        Set<String> keep = new HashSet<>();
        keep.add(p.getString(KEY_CURRENT, ""));
        keep.add(p.getString(KEY_PREVIOUS, ""));
        keep.add(p.getString(KEY_PENDING, ""));
        keep.remove("");
        return keep;
    }

    private static File promotePendingLocked(Context context) {
        SharedPreferences p = prefs(context);
        String pending = p.getString(KEY_PENDING, "");
        File dir = bundleDir(context, pending);
        if (pending.isEmpty() || !dir.isDirectory() || isFailed(context, pending)) {
            p.edit().putString(KEY_PENDING, "").commit();
            return null;
        }
        String current = p.getString(KEY_CURRENT, "");
        // Only a confirmed bundle is worth rolling back to.
        String previous = p.getBoolean(KEY_TRIAL, false) ? p.getString(KEY_PREVIOUS, "") : current;
        p
            .edit()
            .putString(KEY_PREVIOUS, previous)
            .putString(KEY_CURRENT, pending)
            .putString(KEY_PENDING, "")
            .putBoolean(KEY_TRIAL, true)
            .putInt(KEY_TRIAL_LAUNCHES, 1)
            .commit();
        return dir;
    }

    private static void rollbackLocked(Context context) {
        SharedPreferences p = prefs(context);
        String current = p.getString(KEY_CURRENT, "");
        String previous = p.getString(KEY_PREVIOUS, "");
        Set<String> failed = new HashSet<>(p.getStringSet(KEY_FAILED, new HashSet<>()));
        if (!current.isEmpty()) failed.add(current);
        if (!previous.isEmpty() && !bundleDir(context, previous).isDirectory()) previous = "";
        p
            .edit()
            .putStringSet(KEY_FAILED, failed)
            .putString(KEY_CURRENT, previous)
            .putString(KEY_PREVIOUS, "")
            .putBoolean(KEY_TRIAL, false)
            .putInt(KEY_TRIAL_LAUNCHES, 0)
            .commit();
    }

    private static void writeServerBasePath(Context context, File dir) {
        context
            .getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(CAP_SERVER_PATH, dir == null ? "" : dir.getAbsolutePath())
            .commit();
    }

    private static void deleteUnusedBundles(Context context) {
        File[] dirs = bundlesDir(context).listFiles();
        if (dirs == null) return;
        Set<String> keep = versionsInUse(context);
        for (File dir : dirs) {
            // *.partial is an interrupted download, kept so the next attempt can resume it.
            if (!keep.contains(dir.getName()) && !dir.getName().endsWith(".partial")) {
                deleteRecursively(dir);
            }
        }
    }

    static void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.isDirectory() ? file.listFiles() : null;
        if (children != null) {
            for (File child : children) deleteRecursively(child);
        }
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }

    @SuppressWarnings("deprecation")
    private static String binaryVersion(Context context) {
        try {
            PackageManager pm = context.getPackageManager();
            PackageInfo info = pm.getPackageInfo(context.getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
            return code + ":" + info.versionName + ":" + info.lastUpdateTime;
        } catch (PackageManager.NameNotFoundException e) {
            return "";
        }
    }
}
