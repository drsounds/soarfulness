import { Capacitor, registerPlugin } from "@capacitor/core";

interface BatheNotificationPlugin {
  start(): Promise<{ shown: boolean }>;
  stop(): Promise<void>;
}

const BatheNotification = registerPlugin<BatheNotificationPlugin>("BatheNotification");

export function startBatheNotification() {
  if (Capacitor.getPlatform() !== "android" || !Capacitor.isPluginAvailable("BatheNotification")) {
    return Promise.resolve();
  }
  return BatheNotification.start().then(() => undefined);
}

export function stopBatheNotification() {
  if (Capacitor.getPlatform() !== "android" || !Capacitor.isPluginAvailable("BatheNotification")) {
    return Promise.resolve();
  }
  return BatheNotification.stop();
}
