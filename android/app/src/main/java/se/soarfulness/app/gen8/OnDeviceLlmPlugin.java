package se.soarfulness.app.gen8;

import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.genai.common.DownloadCallback;
import com.google.mlkit.genai.common.FeatureStatus;
import com.google.mlkit.genai.common.GenAiException;
import com.google.mlkit.genai.prompt.GenerateContentRequest;
import com.google.mlkit.genai.prompt.GenerateContentResponse;
import com.google.mlkit.genai.prompt.Generation;
import com.google.mlkit.genai.prompt.TextPart;
import com.google.mlkit.genai.prompt.java.GenerativeModelFutures;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * VOICE → LLM (src/apps/voice/llm/NativeLlm.ts): Android's own on-device model, Gemini Nano,
 * through the ML Kit GenAI Prompt API on AICore, so the voice interpreter can use it instead of a
 * model downloaded into the WebView.
 *
 * PRIVACY RULE: on the device only. Google documents that the GenAI APIs run entirely on-device
 * ("input, inference, and output data is processed locally"). This plugin makes no network calls
 * of its own; the model itself is installed and updated by Android (AICore), never by the app.
 *
 * Methods:
 *   status()   {status: "unavailable" | "downloadable" | "downloading" | "available"}
 *   download() resolves when AICore has the model; "download" events {phase, bytes?, error?}
 *   generate({prompt, temperature}) → {text}   one prompt, one answer (no history)
 *   cancel()   cancels the generation in progress (the web side's time limit ran out)
 *
 * AICore only answers while the app is the foreground app and enforces a per-app quota; those
 * errors (BACKGROUND_USE_BLOCKED, BUSY, PER_APP_BATTERY_USE_QUOTA_EXCEEDED) come back as rejections
 * and the web side falls back to the rules matcher. Requires Android 8.0 (API 26).
 */
@CapacitorPlugin(name = "OnDeviceLlm")
public class OnDeviceLlmPlugin extends Plugin {

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private GenerativeModelFutures model = null;
    private ListenableFuture<GenerateContentResponse> current = null;

    private GenerativeModelFutures model() {
        if (model == null) model = GenerativeModelFutures.from(Generation.INSTANCE.getClient());
        return model;
    }

    private static boolean supportedSdk() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
    }

    private static String statusName(int s) {
        if (s == FeatureStatus.AVAILABLE) return "available";
        if (s == FeatureStatus.DOWNLOADING) return "downloading";
        if (s == FeatureStatus.DOWNLOADABLE) return "downloadable";
        return "unavailable";
    }

    private static String message(Throwable t) {
        Throwable c = t;
        while (c.getCause() != null && c != c.getCause()) c = c.getCause();
        String m = c.getMessage();
        return c.getClass().getSimpleName() + (m != null ? ": " + m : "");
    }

    @PluginMethod
    public void status(PluginCall call) {
        if (!supportedSdk()) {
            JSObject ret = new JSObject();
            ret.put("status", "unavailable");
            ret.put("error", "needs Android 8.0 or newer");
            call.resolve(ret);
            return;
        }
        try {
            ListenableFuture<Integer> f = model().checkStatus();
            f.addListener(
                () -> {
                    JSObject ret = new JSObject();
                    try {
                        ret.put("status", statusName(f.get()));
                    } catch (Exception e) {
                        ret.put("status", "unavailable");
                        ret.put("error", message(e));
                    }
                    call.resolve(ret);
                },
                worker
            );
        } catch (Throwable e) {
            JSObject ret = new JSObject();
            ret.put("status", "unavailable");
            ret.put("error", message(e));
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        if (!supportedSdk()) {
            call.reject("needs Android 8.0 or newer");
            return;
        }
        try {
            model().download(
                new DownloadCallback() {
                    @Override
                    public void onDownloadStarted(long bytesToDownload) {
                        JSObject e = new JSObject();
                        e.put("phase", "started");
                        e.put("total", bytesToDownload);
                        notifyListeners("download", e);
                    }

                    @Override
                    public void onDownloadProgress(long totalBytesDownloaded) {
                        JSObject e = new JSObject();
                        e.put("phase", "progress");
                        e.put("bytes", totalBytesDownloaded);
                        notifyListeners("download", e);
                    }

                    @Override
                    public void onDownloadCompleted() {
                        JSObject e = new JSObject();
                        e.put("phase", "done");
                        notifyListeners("download", e);
                        call.resolve();
                    }

                    @Override
                    public void onDownloadFailed(GenAiException ex) {
                        JSObject e = new JSObject();
                        e.put("phase", "failed");
                        e.put("error", message(ex));
                        notifyListeners("download", e);
                        call.reject(message(ex));
                    }
                }
            );
        } catch (Throwable e) {
            call.reject(message(e));
        }
    }

    @PluginMethod
    public void generate(PluginCall call) {
        String prompt = call.getString("prompt", "");
        Double temperature = call.getDouble("temperature", 0.0);
        if (!supportedSdk()) {
            call.reject("needs Android 8.0 or newer");
            return;
        }
        if (prompt == null || prompt.isEmpty()) {
            call.reject("empty prompt");
            return;
        }
        try {
            GenerateContentRequest.Builder builder = new GenerateContentRequest.Builder(new TextPart(prompt));
            builder.setTemperature(temperature == null ? 0f : temperature.floatValue());
            // Greedy: the same phrase gives the same tool calls.
            builder.setTopK(1);
            ListenableFuture<GenerateContentResponse> f = model().generateContent(builder.build());
            current = f;
            f.addListener(
                () -> {
                    if (current == f) current = null;
                    if (f.isCancelled()) {
                        call.reject("cancelled");
                        return;
                    }
                    try {
                        GenerateContentResponse res = f.get();
                        String text = res.getCandidates().isEmpty() ? "" : res.getCandidates().get(0).getText();
                        JSObject ret = new JSObject();
                        ret.put("text", text == null ? "" : text);
                        call.resolve(ret);
                    } catch (Exception e) {
                        call.reject(message(e));
                    }
                },
                worker
            );
        } catch (Throwable e) {
            call.reject(message(e));
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        ListenableFuture<GenerateContentResponse> f = current;
        if (f != null) f.cancel(true);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        ListenableFuture<GenerateContentResponse> f = current;
        if (f != null) f.cancel(true);
        worker.shutdown();
        super.handleOnDestroy();
    }
}
