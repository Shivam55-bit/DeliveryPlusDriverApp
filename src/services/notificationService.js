import { Platform, PermissionsAndroid, Alert } from "react-native";
import * as RNFBMessaging from "@react-native-firebase/messaging";
import notifee, { AndroidImportance, EventType } from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API, { getStoredAuthToken } from "./api";
import { navigate, setPendingNotificationTarget } from "../navigation/navigationRef";

const FCM_TOKEN_STORAGE_KEY = "@delivery_plus_fcm_token";

/**
 * Safe helper to retrieve the messaging instance across RN Firebase v26+ and legacy versions.
 */
export const getSafeMessaging = () => {
  try {
    if (typeof RNFBMessaging.getMessaging === "function") {
      return RNFBMessaging.getMessaging();
    }
    if (typeof RNFBMessaging.default === "function") {
      return RNFBMessaging.default();
    }
    return null;
  } catch (err) {
    console.warn("[Push] Could not initialize Firebase messaging instance:", err?.message);
    return null;
  }
};

export const NOTIFICATION_CHANNELS = {
  JOBS_URGENT: {
    id: "jobs_urgent",
    name: "Job Assignments & Urgent Alerts",
    importance: AndroidImportance.HIGH,
    vibration: true,
  },
  JOB_UPDATES: {
    id: "job_updates",
    name: "Job Status Updates",
    importance: AndroidImportance.DEFAULT,
    vibration: true,
  },
  GENERAL: {
    id: "general_info",
    name: "General Notifications",
    importance: AndroidImportance.LOW,
  },
};

/**
 * Creates required Android notification channels once.
 */
export const createNotificationChannels = async () => {
  if (Platform.OS !== "android") return;

  try {
    if (notifee?.createChannel) {
      await notifee.createChannel({
        id: NOTIFICATION_CHANNELS.JOBS_URGENT.id,
        name: NOTIFICATION_CHANNELS.JOBS_URGENT.name,
        importance: NOTIFICATION_CHANNELS.JOBS_URGENT.importance,
        vibration: true,
        sound: "default",
      });

      await notifee.createChannel({
        id: NOTIFICATION_CHANNELS.JOB_UPDATES.id,
        name: NOTIFICATION_CHANNELS.JOB_UPDATES.name,
        importance: NOTIFICATION_CHANNELS.JOB_UPDATES.importance,
        vibration: true,
        sound: "default",
      });

      await notifee.createChannel({
        id: NOTIFICATION_CHANNELS.GENERAL.id,
        name: NOTIFICATION_CHANNELS.GENERAL.name,
        importance: NOTIFICATION_CHANNELS.GENERAL.importance,
      });

      console.log("[Push] Notification channels configured successfully.");
    }
  } catch (err) {
    console.warn("[Push] Failed to create notification channels:", err?.message);
  }
};

/**
 * Requests push notification permissions on iOS & Android 13+
 */
export const requestNotificationPermission = async () => {
  try {
    if (Platform.OS === "android") {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    }

    if (Platform.OS === "ios") {
      const messagingInstance = getSafeMessaging();
      if (!messagingInstance) return true;

      let authStatus;
      if (typeof RNFBMessaging.requestPermission === "function") {
        authStatus = await RNFBMessaging.requestPermission(messagingInstance, {
          alert: true,
          badge: true,
          sound: true,
        });
      } else if (typeof messagingInstance.requestPermission === "function") {
        authStatus = await messagingInstance.requestPermission({
          alert: true,
          badge: true,
          sound: true,
        });
      }

      const enabled =
        authStatus === 1 || // AUTHORIZED
        authStatus === 2;   // PROVISIONAL

      console.log("[Push] iOS Authorization Status:", authStatus, "Enabled:", enabled);
      return enabled;
    }
  } catch (err) {
    console.warn("[Push] Error requesting notification permissions:", err?.message);
    return false;
  }
  return true;
};

/**
 * Registers device FCM token with the backend.
 */
export const registerDeviceToken = async (fcmToken = null) => {
  try {
    let tokenToRegister = fcmToken;
    const messagingInstance = getSafeMessaging();

    if (!tokenToRegister && messagingInstance) {
      if (typeof RNFBMessaging.getToken === "function") {
        tokenToRegister = await RNFBMessaging.getToken(messagingInstance);
      } else if (typeof messagingInstance.getToken === "function") {
        tokenToRegister = await messagingInstance.getToken();
      }
    }

    if (!tokenToRegister) return null;

    await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, tokenToRegister);

    const authToken = await getStoredAuthToken();
    if (!authToken) {
      console.log("[Push] User not logged in yet. Token stored locally for post-login registration.");
      return tokenToRegister;
    }

    console.log("[Push] Registering device token on backend:", tokenToRegister.substring(0, 15) + "...");

    // Call backend device registration endpoint
    try {
      await API.post("/devices/register", {
        token: tokenToRegister,
        platform: Platform.OS,
        deviceId: `${Platform.OS}_${Date.now()}`,
        appVersion: "1.0.0",
      });
      console.log("[Push] Device token registered with backend successfully.");
    } catch (apiErr) {
      try {
        await API.post("/api/devices/register", {
          token: tokenToRegister,
          platform: Platform.OS,
        });
      } catch (fallbackErr) {
        console.log("[Push] Backend device registration API note:", apiErr?.message || fallbackErr?.message);
      }
    }

    return tokenToRegister;
  } catch (err) {
    console.warn("[Push] Failed to register FCM token:", err?.message);
    return null;
  }
};

/**
 * Unregisters device token on driver logout.
 */
export const unregisterDeviceToken = async () => {
  try {
    const storedFcmToken = await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (storedFcmToken) {
      try {
        await API.post("/devices/unregister", { token: storedFcmToken });
      } catch (e) {
        try {
          await API.post("/api/devices/unregister", { token: storedFcmToken });
        } catch (ignored) {}
      }
      await AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      console.log("[Push] FCM token unregistered from backend.");
    }
  } catch (err) {
    console.warn("[Push] Error unregistering device token:", err?.message);
  }
};

/**
 * Resolves notification payload into a navigation action.
 */
export const handleNotificationNavigation = (remoteMessage) => {
  if (!remoteMessage) return;

  const data = remoteMessage.data || {};
  const jobId = data.jobId || data.id || data._id;
  const type = (data.type || data.notificationType || "").toUpperCase();

  console.log("[Push] Handling notification navigation. Type:", type, "JobId:", jobId, "Data:", data);

  if (jobId) {
    navigate("JobDetail", { jobId, id: jobId });
    return;
  }

  if (type === "PAYMENT" || type === "PAYMENT_RECEIVED") {
    navigate("PaymentMethods");
    return;
  }

  navigate("Notifications");
};

/**
 * Shows a foreground heads-up banner using Notifee.
 */
export const displayForegroundNotification = async (remoteMessage) => {
  try {
    if (!notifee?.displayNotification) return;

    const { notification, data } = remoteMessage;
    const title = notification?.title || data?.title || "DeliveryPlus Driver";
    const body = notification?.body || data?.body || "You have a new update.";
    const channelId = data?.channelId || NOTIFICATION_CHANNELS.JOBS_URGENT.id;

    await notifee.displayNotification({
      title,
      body,
      data: data || {},
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
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
        },
      },
    });
  } catch (err) {
    console.warn("[Push] Failed to display foreground notification:", err?.message);
  }
};

/**
 * Initializes all push notification listeners and background hooks.
 */
export const initNotifications = async () => {
  try {
    await createNotificationChannels();
    const hasPermission = await requestNotificationPermission();

    if (hasPermission) {
      await registerDeviceToken();
    }

    const messagingInstance = getSafeMessaging();

    let unsubscribeForeground = () => {};
    let unsubscribeNotificationOpened = () => {};
    let unsubscribeNotifee = () => {};

    if (messagingInstance) {
      // 1. Listen for token refreshes
      if (typeof RNFBMessaging.onTokenRefresh === "function") {
        RNFBMessaging.onTokenRefresh(messagingInstance, async (newToken) => {
          console.log("[Push] FCM token refreshed:", newToken.substring(0, 15) + "...");
          await registerDeviceToken(newToken);
        });
      } else if (typeof messagingInstance.onTokenRefresh === "function") {
        messagingInstance.onTokenRefresh(async (newToken) => {
          console.log("[Push] FCM token refreshed:", newToken.substring(0, 15) + "...");
          await registerDeviceToken(newToken);
        });
      }

      // 2. Foreground Message Listener
      if (typeof RNFBMessaging.onMessage === "function") {
        unsubscribeForeground = RNFBMessaging.onMessage(messagingInstance, async (remoteMessage) => {
          console.log("[Push] Foreground message received:", remoteMessage);
          await displayForegroundNotification(remoteMessage);
        });
      } else if (typeof messagingInstance.onMessage === "function") {
        unsubscribeForeground = messagingInstance.onMessage(async (remoteMessage) => {
          console.log("[Push] Foreground message received:", remoteMessage);
          await displayForegroundNotification(remoteMessage);
        });
      }

      // 3. Background Notification Tap Listener (App in background)
      if (typeof RNFBMessaging.onNotificationOpenedApp === "function") {
        unsubscribeNotificationOpened = RNFBMessaging.onNotificationOpenedApp(messagingInstance, (remoteMessage) => {
          console.log("[Push] Notification opened from background state:", remoteMessage);
          handleNotificationNavigation(remoteMessage);
        });
      } else if (typeof messagingInstance.onNotificationOpenedApp === "function") {
        unsubscribeNotificationOpened = messagingInstance.onNotificationOpenedApp((remoteMessage) => {
          console.log("[Push] Notification opened from background state:", remoteMessage);
          handleNotificationNavigation(remoteMessage);
        });
      }

      // 4. Killed State / Cold Start Initial Notification
      let initialNotification = null;
      if (typeof RNFBMessaging.getInitialNotification === "function") {
        initialNotification = await RNFBMessaging.getInitialNotification(messagingInstance);
      } else if (typeof messagingInstance.getInitialNotification === "function") {
        initialNotification = await messagingInstance.getInitialNotification();
      }

      if (initialNotification) {
        console.log("[Push] App opened from killed state via notification:", initialNotification);
        const data = initialNotification.data || {};
        const jobId = data.jobId || data.id || data._id;
        if (jobId) {
          setPendingNotificationTarget("JobDetail", { jobId, id: jobId });
        } else {
          setPendingNotificationTarget("Notifications", {});
        }
      }
    }

    // 5. Notifee Foreground / Local Notification Tap Listener
    if (notifee?.onForegroundEvent) {
      unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.PRESS && detail?.notification) {
          console.log("[Push] Notifee local notification tapped:", detail.notification);
          handleNotificationNavigation({
            data: detail.notification.data,
            notification: {
              title: detail.notification.title,
              body: detail.notification.body,
            },
          });
        }
      });
    }

    // Also check Notifee initial notification
    if (notifee?.getInitialNotification) {
      const notifeeInitial = await notifee.getInitialNotification();
      if (notifeeInitial?.notification) {
        const data = notifeeInitial.notification.data || {};
        const jobId = data.jobId || data.id || data._id;
        if (jobId) {
          setPendingNotificationTarget("JobDetail", { jobId, id: jobId });
        }
      }
    }

    return () => {
      if (typeof unsubscribeForeground === "function") unsubscribeForeground();
      if (typeof unsubscribeNotificationOpened === "function") unsubscribeNotificationOpened();
      if (typeof unsubscribeNotifee === "function") unsubscribeNotifee();
    };
  } catch (err) {
    console.warn("[Push] Error during push notification initialization:", err?.message);
    return () => {};
  }
};
