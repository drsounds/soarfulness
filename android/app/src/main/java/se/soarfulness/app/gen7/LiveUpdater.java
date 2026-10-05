package se.soarfulness.app.gen7;

import android.content.Context;
import android.net.Uri;
import android.system.ErrnoException;
import android.system.Os;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Downloads the web bundle currently deployed at the configured site (capacitor.config.ts →
 * plugins.LiveUpdate.url) into a new bundle directory, for {@link LiveUpdateStore} to switch to.
 *
 * <p>The site serves {@code /capacitor-live-update.json} (written at build time by
 * scripts/vite-plugin-live-update-manifest.ts): every file of the build with its SHA-256. Only files
 * whose hash isn't already on the device are downloaded; the rest are hard-linked from the
 * downloaded bundle being served, or copied out of the APK's bundled assets. Every file is
 * verified before the bundle is handed over, and an interrupted download resumes where it left
 * off. Nothing the app is currently serving is ever touched, so a failure at any point just
 * leaves the current bundle in place.
 */
final class LiveUpdater {

    private static final String TAG = "LiveUpdater";
    private static final int FORMAT = 1;
    private static final int PARALLEL_DOWNLOADS = 4;
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 30_000;
    /** Free space to leave on the device on top of what the new bundle needs. */
    private static final long SPACE_MARGIN_BYTES = 64L * 1024 * 1024;
    private static final Pattern VERSION = Pattern.compile("[A-Za-z0-9._-]{1,64}");
    private static final Pattern HTML_ASSET_REF = Pattern.compile("[\"'(]/(assets/[^\"'()?#\\s]+)");
    private static final AtomicBoolean running = new AtomicBoolean(false);

    static final String STATUS_UP_TO_DATE = "up-to-date";
    static final String STATUS_READY = "ready";
    static final String STATUS_BUSY = "busy";
    static final String STATUS_SKIPPED = "skipped";

    static final class Result {

        final String status;
        final String version;

        Result(String status, String version) {
            this.status = status;
            this.version = version;
        }
    }

    private static final class Entry {

        final String path;
        final String sha256;
        final long size;

        Entry(String path, String sha256, long size) {
            this.path = path;
            this.sha256 = sha256;
            this.size = size;
        }
    }

    /** Where an already-present copy of a file can be taken from. */
    private static final class Source {

        final File file; // a file in a downloaded bundle, or
        final String assetPath; // a path inside the APK's assets

        Source(File file, String assetPath) {
            this.file = file;
            this.assetPath = assetPath;
        }
    }

    private final Context context;
    private final String baseUrl;

    LiveUpdater(Context context, String baseUrl) {
        this.context = context.getApplicationContext();
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    Result run() throws IOException, JSONException {
        if (!running.compareAndSet(false, true)) return new Result(STATUS_BUSY, null);
        try {
            return runLocked();
        } finally {
            running.set(false);
        }
    }

    private Result runLocked() throws IOException, JSONException {
        String manifestJson = new String(
            fetch(baseUrl + "/" + LiveUpdateStore.MANIFEST_NAME + "?t=" + System.currentTimeMillis()),
            StandardCharsets.UTF_8
        );
        JSONObject manifest = new JSONObject(manifestJson);
        if (manifest.optInt("format") != FORMAT) {
            return new Result(STATUS_SKIPPED, null);
        }
        String version = manifest.getString("version");
        if (!VERSION.matcher(version).matches()) throw new IOException("Bad bundle version: " + version);

        String current = LiveUpdateStore.current(context);
        String servedVersion = current.isEmpty() ? bundledVersion(context) : current;
        if (version.equals(servedVersion) || version.equals(LiveUpdateStore.pending(context))) {
            return new Result(STATUS_UP_TO_DATE, version);
        }
        if (LiveUpdateStore.isFailed(context, version)) {
            return new Result(STATUS_SKIPPED, version);
        }

        List<Entry> files = parseEntries(manifest.getJSONArray("files"), true);
        List<Entry> remote = manifest.has("remote") ? parseEntries(manifest.getJSONArray("remote"), false) : new ArrayList<>();
        Set<String> paths = new HashSet<>();
        for (Entry e : files) paths.add(e.path);

        // The deployed site renders "/" per request rather than serving an index.html, so take a
        // snapshot of it — the same thing scripts/capacitor-snapshot-shell.mjs does for the APK.
        String html = new String(fetch(baseUrl + "/?t=" + System.currentTimeMillis()), StandardCharsets.UTF_8);
        if (!html.contains("<html")) throw new IOException("\"/\" did not return an HTML document");
        Matcher refs = HTML_ASSET_REF.matcher(html);
        while (refs.find()) {
            if (!paths.contains(refs.group(1))) {
                // Usually a deploy caught halfway; the next check will see a consistent pair.
                throw new IOException("\"/\" references " + refs.group(1) + ", which the manifest doesn't list");
            }
        }

        Map<String, Source> sources = indexExistingFiles();

        long needed = 0;
        for (Entry e : files) {
            Source s = sources.get(e.sha256);
            if (s == null || s.file == null) needed += e.size;
        }
        File bundles = LiveUpdateStore.bundlesDir(context);
        if (!bundles.isDirectory() && !bundles.mkdirs()) throw new IOException("Cannot create " + bundles);
        if (bundles.getUsableSpace() < needed + SPACE_MARGIN_BYTES) {
            throw new IOException("Not enough free space for the update (" + needed / (1024 * 1024) + " MB needed)");
        }

        File staging = new File(bundles, version + ".partial");
        File[] existing = bundles.listFiles();
        if (existing != null) {
            for (File dir : existing) {
                if (dir.getName().endsWith(".partial") && !dir.equals(staging)) LiveUpdateStore.deleteRecursively(dir);
            }
        }
        if (!staging.isDirectory() && !staging.mkdirs()) throw new IOException("Cannot create " + staging);

        ExecutorService pool = Executors.newFixedThreadPool(PARALLEL_DOWNLOADS);
        try {
            List<Future<?>> tasks = new ArrayList<>();
            for (Entry e : files) {
                tasks.add(pool.submit(() -> {
                    ensureFile(staging, e, sources.get(e.sha256));
                    return null;
                }));
            }
            for (Future<?> task : tasks) {
                try {
                    task.get();
                } catch (java.util.concurrent.ExecutionException ex) {
                    Throwable cause = ex.getCause();
                    throw cause instanceof IOException ? (IOException) cause : new IOException(cause);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Interrupted", ex);
                }
            }
        } finally {
            pool.shutdownNow();
        }

        // Assets only Lovable's hosting serves (see the manifest plugin) — best-effort, exactly
        // like on the website itself: the app already copes with them missing.
        for (Entry e : remote) {
            try {
                ensureRemoteFile(staging, e);
            } catch (IOException ex) {
                Log.w(TAG, "Skipping " + e.path + ": " + ex.getMessage());
            }
        }

        writeFile(new File(staging, "index.html"), html.getBytes(StandardCharsets.UTF_8));
        writeFile(new File(staging, LiveUpdateStore.MANIFEST_NAME), manifestJson.getBytes(StandardCharsets.UTF_8));

        File target = LiveUpdateStore.bundleDir(context, version);
        if (LiveUpdateStore.versionsInUse(context).contains(version)) {
            throw new IOException("Bundle " + version + " is already in use");
        }
        LiveUpdateStore.deleteRecursively(target);
        if (!staging.renameTo(target)) throw new IOException("Cannot move " + staging + " to " + target);
        LiveUpdateStore.setPending(context, version);
        Log.i(TAG, "Web bundle " + version + " downloaded; it will be used from the next launch");
        return new Result(STATUS_READY, version);
    }

    /** The version of the web bundle inside the APK, or "" if it predates live updates. */
    static String bundledVersion(Context context) {
        try (InputStream in = context.getAssets().open(LiveUpdateStore.BUNDLED_ASSET_DIR + "/" + LiveUpdateStore.MANIFEST_NAME)) {
            return new JSONObject(new String(readAll(in), StandardCharsets.UTF_8)).optString("version", "");
        } catch (IOException | JSONException e) {
            return "";
        }
    }

    private static List<Entry> parseEntries(JSONArray array, boolean requireHash) throws JSONException, IOException {
        List<Entry> entries = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            JSONObject o = array.getJSONObject(i);
            String path = o.getString("path");
            if (!isSafePath(path)) throw new IOException("Unsafe path in manifest: " + path);
            String sha = o.optString("sha256", "");
            if (requireHash && !sha.matches("[0-9a-f]{64}")) throw new IOException("Bad hash for " + path);
            entries.add(new Entry(path, sha, o.optLong("size", -1)));
        }
        return entries;
    }

    private static boolean isSafePath(String path) {
        if (path.isEmpty() || path.startsWith("/") || path.contains("\\") || path.contains("\0")) return false;
        for (String segment : path.split("/", -1)) {
            if (segment.isEmpty() || segment.equals(".") || segment.equals("..")) return false;
        }
        return !path.equals("index.html") && !path.equals(LiveUpdateStore.MANIFEST_NAME);
    }

    /**
     * sha256 → somewhere that content already exists on the device: the served and pending
     * bundles (hard-linkable), then the APK's bundled assets (must be copied).
     */
    private Map<String, Source> indexExistingFiles() {
        Map<String, Source> sources = new HashMap<>();
        for (String version : new String[] { LiveUpdateStore.pending(context), LiveUpdateStore.current(context) }) {
            if (version.isEmpty()) continue;
            File dir = LiveUpdateStore.bundleDir(context, version);
            try (InputStream in = new FileInputStream(new File(dir, LiveUpdateStore.MANIFEST_NAME))) {
                JSONArray files = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8)).getJSONArray("files");
                for (Entry e : parseEntries(files, true)) {
                    File f = new File(dir, e.path);
                    if (f.isFile() && !sources.containsKey(e.sha256)) sources.put(e.sha256, new Source(f, null));
                }
            } catch (IOException | JSONException e) {
                Log.w(TAG, "Ignoring unreadable bundle " + version + ": " + e.getMessage());
            }
        }
        String bundledRoot = LiveUpdateStore.BUNDLED_ASSET_DIR + "/";
        try (InputStream in = context.getAssets().open(bundledRoot + LiveUpdateStore.MANIFEST_NAME)) {
            JSONArray files = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8)).getJSONArray("files");
            for (Entry e : parseEntries(files, true)) {
                if (!sources.containsKey(e.sha256)) sources.put(e.sha256, new Source(null, bundledRoot + e.path));
            }
        } catch (IOException | JSONException e) {
            // An APK built before live updates existed — everything gets downloaded.
        }
        return sources;
    }

    private void ensureFile(File staging, Entry e, Source source) throws IOException {
        File target = new File(staging, e.path);
        if (!LiveUpdateStore.isInside(staging, target)) throw new IOException("Unsafe path " + e.path);
        if (target.isFile() && (e.size < 0 || target.length() == e.size) && e.sha256.equals(sha256(target))) {
            return; // left over from an interrupted attempt
        }
        makeParentDirs(target);
        //noinspection ResultOfMethodCallIgnored
        target.delete();

        if (source != null && source.file != null) {
            try {
                // Bundles are never modified in place, so sharing the inode is safe and free.
                Os.link(source.file.getAbsolutePath(), target.getAbsolutePath());
                return;
            } catch (ErrnoException ex) {
                if (copyVerified(new FileInputStream(source.file), target, e.sha256)) return;
            }
        } else if (source != null) {
            try {
                if (copyVerified(context.getAssets().open(source.assetPath), target, e.sha256)) return;
            } catch (FileNotFoundException ignored) {
                // Fall through to downloading it.
            }
        }

        if (!copyVerified(openUrl(urlFor(e.path)), target, e.sha256)) {
            throw new IOException("Hash mismatch downloading " + e.path);
        }
    }

    private void ensureRemoteFile(File staging, Entry e) throws IOException {
        File target = new File(staging, e.path);
        if (!LiveUpdateStore.isInside(staging, target)) throw new IOException("Unsafe path " + e.path);
        if (target.isFile() && (e.size < 0 || target.length() == e.size)) return;
        makeParentDirs(target);
        //noinspection ResultOfMethodCallIgnored
        target.delete();
        File existing = LiveUpdateStore.resolveCurrentFile(context, e.path);
        if (existing != null && (e.size < 0 || existing.length() == e.size)) {
            try {
                Os.link(existing.getAbsolutePath(), target.getAbsolutePath());
                return;
            } catch (ErrnoException ignored) {
                // Download it instead.
            }
        }
        copyVerified(openUrl(urlFor(e.path)), target, null);
        if (e.size >= 0 && target.length() != e.size) {
            //noinspection ResultOfMethodCallIgnored
            target.delete();
            throw new IOException("Size mismatch");
        }
    }

    private static void makeParentDirs(File file) throws IOException {
        File parent = file.getParentFile();
        // mkdirs() also returns false when a parallel download just created it — only a
        // directory that still doesn't exist afterwards is an error.
        if (parent != null && !parent.mkdirs() && !parent.isDirectory()) throw new IOException("Cannot create " + parent);
    }

    /** Streams into target (via a temp file), checking the hash when one is given. Closes in. */
    private static boolean copyVerified(InputStream in, File target, String expectedSha256) throws IOException {
        File tmp = new File(target.getPath() + ".tmp");
        MessageDigest digest = newDigest();
        try (InputStream src = in; OutputStream out = new FileOutputStream(tmp)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = src.read(buf)) != -1) {
                digest.update(buf, 0, n);
                out.write(buf, 0, n);
            }
        }
        if (expectedSha256 != null && !expectedSha256.equals(hex(digest.digest()))) {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
            return false;
        }
        if (!tmp.renameTo(target)) throw new IOException("Cannot write " + target);
        return true;
    }

    private String urlFor(String path) {
        StringBuilder url = new StringBuilder(baseUrl);
        for (String segment : path.split("/")) url.append('/').append(Uri.encode(segment));
        return url.toString();
    }

    private static InputStream openUrl(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
        conn.setReadTimeout(READ_TIMEOUT_MS);
        conn.setUseCaches(false);
        conn.setRequestProperty("Cache-Control", "no-cache");
        int code = conn.getResponseCode();
        if (code != HttpURLConnection.HTTP_OK) {
            conn.disconnect();
            throw new IOException("HTTP " + code + " for " + url);
        }
        return conn.getInputStream();
    }

    private static byte[] fetch(String url) throws IOException {
        try (InputStream in = openUrl(url)) {
            return readAll(in);
        }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        return out.toByteArray();
    }

    private static void writeFile(File file, byte[] data) throws IOException {
        try (OutputStream out = new FileOutputStream(file)) {
            out.write(data);
        }
    }

    private static String sha256(File file) throws IOException {
        MessageDigest digest = newDigest();
        try (InputStream in = new FileInputStream(file)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) != -1) digest.update(buf, 0, n);
        }
        return hex(digest.digest());
    }

    private static MessageDigest newDigest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
