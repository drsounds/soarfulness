package se.soarfulness.app.gen8;

import android.Manifest;
import android.content.Intent;
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
 * SpeechRecognizer hears one phrase per session, so the plugin starts a new session after every
 * result or timeout while the web app wants it (start()/stop()) and the activity is in the
 * foreground (paused in onPause, resumed in onResume). Events to the WebView:
 *   "partial" {text}            what is being heard right now
 *   "result"  {alternatives}    a finished phrase, most likely first
 *   "status"  {status, error?}  starting / listening / denied / error / off
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
    private int errorsInARow = 0;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        lang = call.getString("lang", "en-US");
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
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            status("error", "no speech recognition service on this device");
            return;
        }
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(listener);
        } else if (sessionOpen) {
            recognizer.cancel();
        }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        sessionOpen = true;
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
        public void onBeginningOfSpeech() {}

        @Override
        public void onRmsChanged(float rmsdB) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {}

        @Override
        public void onError(int error) {
            sessionOpen = false;
            if (!wanted) return;
            switch (error) {
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    wanted = false;
                    status("denied", "insufficient permissions");
                    return;
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                    // Silence: just listen again.
                    restartLater(50);
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
            if (list != null && !list.isEmpty()) {
                JSObject data = new JSObject();
                data.put("alternatives", new JSArray(list));
                notifyListeners("result", data);
            }
            restartLater(50);
        }

        @Override
        public void onPartialResults(Bundle partial) {
            ArrayList<String> list = partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (list == null || list.isEmpty()) return;
            JSObject data = new JSObject();
            data.put("text", list.get(0));
            notifyListeners("partial", data);
        }

        @Override
        public void onEvent(int eventType, Bundle params) {}
    };
}
