import "react-native-gesture-handler";
import { AppRegistry, Platform, LogBox } from "react-native";
import * as RNFBMessaging from "@react-native-firebase/messaging";
import notifee, { EventType } from "@notifee/react-native";
import App from "./App";
import { name as appName } from "./app.json";

LogBox.ignoreAllLogs(true);

if (Platform.OS === "android") {
  // Native free GPS tracking is managed by the JS tracking coordinator and Android service.
}

// Firebase background message handler (supports both v26 modular and namespace APIs)
try {
  const messagingInstance =
    typeof RNFBMessaging.getMessaging === "function"
      ? RNFBMessaging.getMessaging()
      : typeof RNFBMessaging.default === "function"
        ? RNFBMessaging.default()
        : null;

  const handleBackgroundPush = async (remoteMessage) => {
    console.info("[Push] background notification received");

    // If notification block is missing (Data-only FCM message), display local notification via Notifee
    if (!remoteMessage?.notification && (remoteMessage?.data?.title || remoteMessage?.data?.body)) {
      try {
        if (typeof notifee?.displayNotification === "function") {
          await notifee.displayNotification({
            title: remoteMessage.data.title || "DeliveryPlus Driver",
            body: remoteMessage.data.body || "New update received",
            data: remoteMessage.data || {},
            android: {
              channelId: remoteMessage.data.channelId || "jobs_urgent",
              importance: 4, // AndroidImportance.HIGH
              pressAction: {
                id: "default",
              },
              smallIcon: "ic_launcher",
            },
            ios: {
              foregroundPresentationOptions: {
                banner: true,
                badge: true,
                sound: true,
                list: true,
              },
            },
          });
        }
      } catch (err) {
        console.warn("[Push] Error displaying background data-only notification:", err?.message);
      }
    }
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
        console.info("[Push] background notification opened");
      }
    });
  }
} catch (err) {
  console.warn("[Push] Failed to register Notifee background handler:", err?.message);
}

AppRegistry.registerComponent(appName, () => App);
