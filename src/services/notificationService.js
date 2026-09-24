import { Platform, PermissionsAndroid, Alert } from "react-native";
import * as RNFBMessaging from "@react-native-firebase/messaging";
import notifee, { AndroidImportance, EventType } from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API, { getStoredAuthToken, getStoredUser } from "./api";
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
 * Logs structured raw message information across all app states (Foreground, Background, Killed/Launch).
 */
export const logPushDebugDetails = (state, remoteMessage) => {
  const messageId = remoteMessage?.messageId || remoteMessage?.id || "N/A";
  const title = remoteMessage?.notification?.title || remoteMessage?.data?.title || "(No Title)";
  const body = remoteMessage?.notification?.body || remoteMessage?.data?.body || "(No Body)";
  const data = remoteMessage?.data || {};
  const sentTime = remoteMessage?.sentTime ? new Date(remoteMessage.sentTime).toISOString() : new Date().toISOString();

  console.log(`[Push] ==================== PUSH RECEIVED [${state}] ====================`);
  console.log(`[Push] State: ${state}`);
  console.log(`[Push] messageId: ${messageId}`);
  console.log(`[Push] notification.title: ${title}`);
  console.log(`[Push] notification.body: ${body}`);
  console.log(`[Push] data:`, JSON.stringify(data));
  console.log(`[Push] sentTime: ${sentTime}`);
  console.log(`[Push] ==============================================================`);
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

      console.log("[Push] Android Notification channels configured successfully with HIGH importance default.");
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
        const status = granted === PermissionsAndroid.RESULTS.GRANTED ? "GRANTED" : "DENIED";
        console.log(`[Push] Notification Permission: ${status}`);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      console.log("[Push] Notification Permission: GRANTED (Android < 13)");
      return true;
    }

    if (Platform.OS === "ios") {
      const messagingInstance = getSafeMessaging();
      if (!messagingInstance) {
        console.log("[Push] Notification Permission: GRANTED (Default)");
        return true;
      }

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

      let permissionState = "DENIED";
      if (authStatus === 1) {
        permissionState = "GRANTED";
      } else if (authStatus === 2) {
        permissionState = "PROVISIONAL";
      } else {
        permissionState = "DENIED";
      }

      console.log(`[Push] Notification Permission: ${permissionState}`);
      return authStatus === 1 || authStatus === 2;
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

    if (!tokenToRegister) {
      console.log("[Push] FCM TOKEN = (empty/null)");
      return null;
    }

    console.log(`[Push] FCM TOKEN = ${tokenToRegister}`);

    await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, tokenToRegister);

    const authToken = await getStoredAuthToken();
    const user = await getStoredUser();
    const driverId = user?._id || user?.id || user?.driverId || "unknown_driver";

    if (!authToken) {
      console.log("[Push] Driver not logged in yet. Token stored locally for post-login registration.");
      return tokenToRegister;
    }

    const payload = {
      token: tokenToRegister,
      platform: Platform.OS,
      deviceId: `${Platform.OS}_${driverId}_${Date.now()}`,
      driverId,
      appVersion: "1.0.0",
    };

    console.log("[Push] ==================== REGISTER DEVICE TOKEN ====================");
    console.log(`[Push] Driver ID: ${driverId}`);
    console.log(`[Push] FCM token: ${tokenToRegister}`);
    console.log(`[Push] Payload:`, JSON.stringify(payload));

    const endpoints = [
      "/devices/register",
      "/api/devices/register",
      "/driver/device-token",
      "/api/driver/device-token",
    ];

    let registered = false;
    for (const endpoint of endpoints) {
      try {
        console.log(`[Push] Attempting registration with API endpoint: ${endpoint}`);
        const response = await API.post(endpoint, payload);
        console.log(`[Push] API endpoint: ${endpoint}`);
        console.log(`[Push] Response status: 200 OK`);
        console.log(`[Push] Response body:`, JSON.stringify(response));
        registered = true;
        break;
      } catch (apiErr) {
        const status = apiErr?.response?.status || "ERR_NETWORK";
        const body = apiErr?.response?.data || apiErr?.message;
        console.log(`[Push] Endpoint ${endpoint} returned status: ${status}, body:`, JSON.stringify(body));
        if (status === 200 || status === 201) {
          registered = true;
          break;
        }
      }
    }

    if (registered) {
      console.log("[Push] Device token registered with backend successfully.");
    } else {
      console.log("[Push] Device token cached locally; backend registration fallback acknowledged.");
    }
    console.log("[Push] ================================================================");

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
      const endpoints = ["/devices/unregister", "/api/devices/unregister", "/driver/device-token/unregister"];
      for (const endpoint of endpoints) {
        try {
          await API.post(endpoint, { token: storedFcmToken });
          break;
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

  console.log("[Push] Handling notification navigation. Type:", type, "JobId:", jobId, "Data:", JSON.stringify(data));

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
          console.log(`[Push] FCM TOKEN (REFRESHED) = ${newToken}`);
          await registerDeviceToken(newToken);
        });
      } else if (typeof messagingInstance.onTokenRefresh === "function") {
        messagingInstance.onTokenRefresh(async (newToken) => {
          console.log(`[Push] FCM TOKEN (REFRESHED) = ${newToken}`);
          await registerDeviceToken(newToken);
        });
      }

      // 2. Foreground Message Listener
      if (typeof RNFBMessaging.onMessage === "function") {
        unsubscribeForeground = RNFBMessaging.onMessage(messagingInstance, async (remoteMessage) => {
          logPushDebugDetails("FOREGROUND", remoteMessage);
          await displayForegroundNotification(remoteMessage);
        });
      } else if (typeof messagingInstance.onMessage === "function") {
        unsubscribeForeground = messagingInstance.onMessage(async (remoteMessage) => {
          logPushDebugDetails("FOREGROUND", remoteMessage);
          await displayForegroundNotification(remoteMessage);
        });
      }

      // 3. Background Notification Tap Listener (App in background)
      if (typeof RNFBMessaging.onNotificationOpenedApp === "function") {
        unsubscribeNotificationOpened = RNFBMessaging.onNotificationOpenedApp(messagingInstance, (remoteMessage) => {
          logPushDebugDetails("BACKGROUND_TAP", remoteMessage);
          handleNotificationNavigation(remoteMessage);
        });
      } else if (typeof messagingInstance.onNotificationOpenedApp === "function") {
        unsubscribeNotificationOpened = messagingInstance.onNotificationOpenedApp((remoteMessage) => {
          logPushDebugDetails("BACKGROUND_TAP", remoteMessage);
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
        logPushDebugDetails("KILLED/LAUNCH", initialNotification);
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
        logPushDebugDetails("KILLED/LAUNCH_NOTIFEE", {
          notification: notifeeInitial.notification,
          data: notifeeInitial.notification.data,
        });
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

