import "react-native-gesture-handler";
import { AppRegistry } from "react-native";
import * as RNFBMessaging from "@react-native-firebase/messaging";
import notifee, { EventType } from "@notifee/react-native";
import App from "./App";
import { name as appName } from "./app.json";

// Firebase background message handler (supports both v26 modular and namespace APIs)
try {
  const messagingInstance =
    typeof RNFBMessaging.getMessaging === "function"
      ? RNFBMessaging.getMessaging()
      : typeof RNFBMessaging.default === "function"
        ? RNFBMessaging.default()
        : null;

  if (messagingInstance) {
    if (typeof RNFBMessaging.setBackgroundMessageHandler === "function") {
      RNFBMessaging.setBackgroundMessageHandler(messagingInstance, async (remoteMessage) => {
        console.log("[Push] Background message received in background handler:", remoteMessage?.messageId);
      });
    } else if (typeof messagingInstance.setBackgroundMessageHandler === "function") {
      messagingInstance.setBackgroundMessageHandler(async (remoteMessage) => {
        console.log("[Push] Background message received in background handler:", remoteMessage?.messageId);
      });
    }
  }
} catch (err) {
  console.warn("[Push] Failed to register background message handler:", err?.message);
}

// Notifee background event handler
try {
  if (typeof notifee?.onBackgroundEvent === "function") {
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log("[Push] Background Notifee notification pressed:", detail?.notification);
      }
    });
  }
} catch (err) {
  console.warn("[Push] Failed to register Notifee background handler:", err?.message);
}

AppRegistry.registerComponent(appName, () => App);


