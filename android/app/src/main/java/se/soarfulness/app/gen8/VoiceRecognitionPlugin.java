package se.soarfulness.app.gen8;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/**
 * VOICE (src/apps/voice): continuous speech recognition for voice commands, with Android's own
 * SpeechRecognizer (the WebView has no Web Speech API).
 *
 * PRIVACY RULE: on the device only. It uses SpeechRecognizer.createOnDeviceSpeechRecognizer
 * (Android 12+), which never sends audio to a server. Where that does not exist (older Android, no
 * on-device service) it reports status "nolocal" and does not listen: it never falls back to the
 * default recognizer, which may be online. A missing language pack is reported as "download";
 * downloadModel() asks Android to fetch it (Android 13+).
 *
 * SpeechRecognizer hears one phrase per session, so the plugin starts a new session after every
 * result or timeout while the web app wants it (start()/stop()) and the activity is in the
 * foreground (paused in onPause, resumed in onResume). Events to the WebView:
 *   "partial" {text}            what is being heard right now
 *   "result"  {alternatives}    a finished phrase, most likely first
 *   "speech"  {phase}           "begin" / "end": the recognizer heard speech start / stop
 *   "status"  {status, error?}  starting / listening / denied / error / off
 *
 * LATENCY: the recognizer only finishes a phrase after a stretch of silence, so the web app acts on
 * "partial" as soon as the words settle (VOICE → ACT EARLY) and "result" only confirms. Here: the
 * silence lengths are shortened (start option silenceMs; recognizers may ignore them), the next
 * session starts at once after each phrase, and a session that ends in ERROR_NO_MATCH after
 * partials still reports its last partial as a result instead of dropping it.
 *
 * Every SpeechRecognizer call has to happen on the main thread.
 */
@CapacitorPlugin(
    name = "VoiceRecognition",
    permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class VoiceRecognitionPlugin extends Plugin {

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer = null;
    private boolean wanted = false;
    private boolean foreground = true;
    private boolean sessionOpen = false;
    private String lang = "en-US";
    private int silenceMs = 600;
    private int errorsInARow = 0;
    /** The last partial of the current session, reported if the session ends without results. */
    private String lastPartial = "";

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        boolean onDevice = onDeviceAvailable();
        ret.put("available", onDevice);
        ret.put("onDevice", onDevice);
        call.resolve(ret);
    }

    /** Asks Android to download the on-device model for a language (Android 13+). */
    @PluginMethod
    public void downloadModel(PluginCall call) {
        String l = call.getString("lang", lang);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || !onDeviceAvailable()) {
            call.reject("on-device model download needs Android 13 or newer");
            return;
        }
        main.post(() -> {
            try {
                SpeechRecognizer r = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
                r.triggerModelDownload(recognizerIntent(l));
                r.destroy();
                call.resolve();
            } catch (RuntimeException e) {
                call.reject(e.getMessage());
            }
        });
    }

    private boolean onDeviceAvailable() {
        return (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())
        );
    }

    private Intent recognizerIntent(String language) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        // Finish a phrase after a short silence (Android's default is much longer). Hints only.
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, (long) silenceMs);
        intent.putExtra(
            RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,
            (long) Math.max(200, silenceMs * 2 / 3)
        );
        return intent;
    }

    @PluginMethod
    public void start(PluginCall call) {
        lang = call.getString("lang", "en-US");
        Integer silence = call.getInt("silenceMs");
        if (silence != null) silenceMs = Math.max(200, Math.min(5000, silence));
        wanted = true;
        errorsInARow = 0;
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermission");
            return;
        }
        main.post(this::restartNow);
        call.resolve();
    }

    @PermissionCallback
    private void microphonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            main.post(this::restartNow);
        } else {
            wanted = false;
            status("denied", "microphone permission denied");
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        wanted = false;
        main.post(() -> {
            destroyRecognizer();
            status("off", null);
        });
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        foreground = false;
        main.post(this::destroyRecognizer);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        foreground = true;
        if (wanted) main.post(this::restartNow);
    }

    @Override
    protected void handleOnDestroy() {
        wanted = false;
        main.post(this::destroyRecognizer);
        super.handleOnDestroy();
    }

    // ------------------------------------------------------------ sessions --

    private void restartNow() {
        if (!wanted || !foreground) return;
        if (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            !SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())
        ) {
            // Never fall back to the default (possibly online) recognizer.
            wanted = false;
            status("nolocal", lang);
            return;
        }
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(listener);
        } else if (sessionOpen) {
            recognizer.cancel();
        }
        Intent intent = recognizerIntent(lang);
        sessionOpen = true;
        lastPartial = "";
        try {
            recognizer.startListening(intent);
        } catch (RuntimeException e) {
            sessionOpen = false;
            status("error", e.getMessage());
            restartLater(1000);
        }
    }

    private void restartLater(long delayMs) {
        main.postDelayed(this::restartNow, delayMs);
    }

    /** Next session as soon as this callback returns (not from inside it). */
    private void restartNowOnMain() {
        main.post(this::restartNow);
    }

    private void result(ArrayList<String> alternatives) {
        JSObject data = new JSObject();
        data.put("alternatives", new JSArray(alternatives));
        notifyListeners("result", data);
    }

    private void speech(String phase) {
        JSObject data = new JSObject();
        data.put("phase", phase);
        notifyListeners("speech", data);
    }

    private void destroyRecognizer() {
        main.removeCallbacksAndMessages(null);
        sessionOpen = false;
        if (recognizer != null) {
            try {
                recognizer.cancel();
                recognizer.destroy();
            } catch (RuntimeException ignored) {
                // Already gone.
            }
            recognizer = null;
        }
    }

    private void status(String s, String error) {
        JSObject data = new JSObject();
        data.put("status", s);
        if (error != null) data.put("error", error);
        notifyListeners("status", data);
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override
        public void onReadyForSpeech(Bundle params) {
            errorsInARow = 0;
            status("listening", null);
        }

        @Override
        public void onBeginningOfSpeech() {
            speech("begin");
        }

        @Override
        public void onRmsChanged(float rmsdB) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {
            speech("end");
        }

        @Override
        public void onError(int error) {
            sessionOpen = false;
            if (!wanted) return;
            switch (error) {
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    wanted = false;
                    status("denied", "insufficient permissions");
                    return;
                case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:
                    // The language pack is not on the device yet.
                    wanted = false;
                    status("download", lang);
                    return;
                case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:
                    wanted = false;
                    status("nolocal", lang);
                    return;
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                    // Silence, or words it gave up on: report what was heard, listen again.
                    if (!lastPartial.isEmpty()) {
                        ArrayList<String> heard = new ArrayList<>();
                        heard.add(lastPartial);
                        lastPartial = "";
                        result(heard);
                    }
                    restartNowOnMain();
                    return;
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                case SpeechRecognizer.ERROR_CLIENT:
                    destroyRecognizer();
                    restartLater(500);
                    return;
                default:
                    errorsInARow++;
                    status("error", "speech recognizer error " + error);
                    restartLater(Math.min(5000, 250L << Math.min(errorsInARow, 5)));
            }
        }

        @Override
        public void onResults(Bundle results) {
            sessionOpen = false;
            ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if ((list == null || list.isEmpty()) && !lastPartial.isEmpty()) {
                list = new ArrayList<>();
                list.add(lastPartial);
            }
            lastPartial = "";
            if (list != null && !list.isEmpty()) result(list);
            // Listen again at once: words said before the next session starts are lost.
            restartNowOnMain();
        }

        @Override
        public void onPartialResults(Bundle partial) {
            ArrayList<String> list = partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (list == null || list.isEmpty()) return;
            String text = list.get(0);
            if (text == null || text.trim().isEmpty()) return;
            lastPartial = text;
            JSObject data = new JSObject();
            data.put("text", text);
            notifyListeners("partial", data);
        }

        @Override
        public void onEvent(int eventType, Bundle params) {}
    };
}
