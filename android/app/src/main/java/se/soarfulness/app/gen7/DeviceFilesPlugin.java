package se.soarfulness.app.gen7;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONException;

/**
 * Saving files to / opening files from the device through Android's own document pickers
 * (Storage Access Framework, so no storage permission is needed). The WebView can't do either
 * itself: it has no download handler for the web app's blob downloads, and its file chooser
 * filters on MIME types that .json files usually aren't labelled with. JS side:
 * src/lib/deviceFiles.ts.
 */
@CapacitorPlugin(name = "DeviceFiles")
public class DeviceFilesPlugin extends Plugin {

    /** { filename, mimeType, data, encoding: "utf8" | "base64" } → { saved } */
    @PluginMethod
    public void saveFile(PluginCall call) {
        if (call.getString("data") == null) {
            call.reject("data is required");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "aquafulness"));
        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = pickedUri(result);
        if (uri == null) {
            JSObject r = new JSObject();
            r.put("saved", false);
            call.resolve(r);
            return;
        }
        new Thread(() -> {
            try {
                String data = call.getString("data", "");
                byte[] bytes = "base64".equals(call.getString("encoding"))
                    ? Base64.decode(data, Base64.DEFAULT)
                    : data.getBytes(StandardCharsets.UTF_8);
                // "wt": truncate, in case the user picked an existing, longer file to overwrite.
                try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new IllegalStateException("No output stream for " + uri);
                    out.write(bytes);
                }
                JSObject r = new JSObject();
                r.put("saved", true);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Couldn't write the file", e);
            }
        }).start();
    }

    /** { mimeTypes?: string[], encoding: "utf8" | "base64" } → { name, mimeType, data } or {} if cancelled */
    @PluginMethod
    public void openFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        JSArray mimeTypes = call.getArray("mimeTypes");
        if (mimeTypes != null && mimeTypes.length() > 0) {
            try {
                intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.<String>toList().toArray(new String[0]));
            } catch (JSONException e) {
                call.reject("mimeTypes must be strings", e);
                return;
            }
        }
        startActivityForResult(call, intent, "openFileResult");
    }

    @ActivityCallback
    private void openFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = pickedUri(result);
        if (uri == null) {
            call.resolve(new JSObject());
            return;
        }
        new Thread(() -> {
            try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                if (in == null) throw new IllegalStateException("No input stream for " + uri);
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[64 * 1024];
                int n;
                while ((n = in.read(chunk)) != -1) buffer.write(chunk, 0, n);
                byte[] bytes = buffer.toByteArray();
                JSObject r = new JSObject();
                r.put("name", displayName(uri));
                r.put("mimeType", getContext().getContentResolver().getType(uri));
                r.put(
                    "data",
                    "base64".equals(call.getString("encoding"))
                        ? Base64.encodeToString(bytes, Base64.NO_WRAP)
                        : new String(bytes, StandardCharsets.UTF_8)
                );
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Couldn't read the file", e);
            }
        }).start();
    }

    private static Uri pickedUri(ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) return null;
        Intent data = result.getData();
        return data != null ? data.getData() : null;
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {
            // Some providers don't support the query; the name is only cosmetic.
        }
        return uri.getLastPathSegment();
    }
}
