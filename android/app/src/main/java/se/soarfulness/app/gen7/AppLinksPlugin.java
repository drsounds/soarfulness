package se.soarfulness.app.gen7;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android App Links for the public site (AndroidManifest.xml's autoVerify intent filter, verified
 * against public/.well-known/assetlinks.json): hands the tapped https URL to the web app, which
 * routes to the same page in-app (src/lib/appLinks.ts). Capacitor's bridge doesn't do that on its
 * own without the @capacitor/app plugin; this is the small part of it this app needs, plus
 * Android's share sheet, since the WebView has no navigator.share.
 */
@CapacitorPlugin(name = "AppLinks")
public class AppLinksPlugin extends Plugin {

    private boolean launchUrlConsumed = false;

    /** The link the app was cold-started from. Read once, so a WebView reload doesn't re-follow it. */
    @PluginMethod
    public void getLaunchUrl(PluginCall call) {
        JSObject result = new JSObject();
        Uri uri = launchUrlConsumed ? null : getBridge().getIntentUri();
        launchUrlConsumed = true;
        result.put("url", uri != null && isWebLink(uri) ? uri.toString() : null);
        call.resolve(result);
    }

    /** A link tapped while the app is already running (launchMode singleTask). */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null || !isWebLink(uri)) return;
        JSObject data = new JSObject();
        data.put("url", uri.toString());
        notifyListeners("appUrlOpen", data, true);
    }

    @PluginMethod
    public void share(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        String title = call.getString("title");
        String text = call.getString("text");
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text != null && !text.isEmpty() ? text + "\n" + url : url);
        if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
        Intent chooser = Intent.createChooser(send, title);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't open the share sheet", e);
        }
    }

    private static boolean isWebLink(Uri uri) {
        String scheme = uri.getScheme();
        return "https".equals(scheme) || "http".equals(scheme);
    }
}
