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

  const handleBackgroundPush = async (remoteMessage) => {
    console.log("[Push] ==================== BACKGROUND PUSH RECEIVED ====================");
    console.log("[Push] State: BACKGROUND");
    console.log("[Push] messageId:", remoteMessage?.messageId || "N/A");
    console.log("[Push] notification.title:", remoteMessage?.notification?.title || remoteMessage?.data?.title || "(No Title)");
    console.log("[Push] notification.body:", remoteMessage?.notification?.body || remoteMessage?.data?.body || "(No Body)");
    console.log("[Push] data:", JSON.stringify(remoteMessage?.data || {}));
    console.log("[Push] sentTime:", remoteMessage?.sentTime ? new Date(remoteMessage.sentTime).toISOString() : new Date().toISOString());
    console.log("[Push] ================================================================");
  };

  if (messagingInstance) {
    if (typeof RNFBMessaging.setBackgroundMessageHandler === "function") {
      RNFBMessaging.setBackgroundMessageHandler(messagingInstance, handleBackgroundPush);
    } else if (typeof messagingInstance.setBackgroundMessageHandler === "function") {
      messagingInstance.setBackgroundMessageHandler(handleBackgroundPush);
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
        console.log("[Push] Background Notifee notification pressed:", JSON.stringify(detail?.notification || {}));
      }
    });
  }
} catch (err) {
  console.warn("[Push] Failed to register Notifee background handler:", err?.message);
}

AppRegistry.registerComponent(appName, () => App);


