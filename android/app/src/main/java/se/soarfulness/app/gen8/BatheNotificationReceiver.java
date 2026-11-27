package se.soarfulness.app.gen8;

import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BatheNotificationReceiver extends BroadcastReceiver {

    public static final String ACTION_STOP = "se.soarfulness.app.gen8.BatheNotificationService.STOP";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_STOP.equals(intent.getAction())) return;
        context.stopService(new Intent(context, BatheNotificationService.class));
        ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (manager != null) {
            for (ActivityManager.AppTask task : manager.getAppTasks()) {
                task.finishAndRemoveTask();
            }
        }
    }
}
