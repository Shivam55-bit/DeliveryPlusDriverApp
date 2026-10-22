import { Platform, PermissionsAndroid } from "react-native";
import * as RNFBMessaging from "@react-native-firebase/messaging";
import notifee, { AndroidImportance, EventType } from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API, { getStoredAuthToken, getStoredUser } from "./api";
import { navigate, setPendingNotificationTarget } from "../navigation/navigationRef";

const FCM_TOKEN_STORAGE_KEY = "@delivery_plus_fcm_token";
const NOTIFICATIONS_CACHE_KEY_PREFIX = "@delivery_plus_driver_notifications_";

// In-memory cache & listeners
let inMemoryNotifications = null;
let inMemoryUnreadCount = 0;
let inFlightNotificationsPromise = null;
const notificationListeners = new Set();
const unreadListeners = new Set();

/**
 * Returns dynamic storage key isolated by driver ID to prevent cross-driver data leaks on account switch.
 */
export const getNotificationStorageKey = async () => {
  try {
    const user = await getStoredUser();
    const driverId = user?._id || user?.id || user?.driverId || "anonymous";
    return `${NOTIFICATIONS_CACHE_KEY_PREFIX}${driverId}`;
  } catch {
    return `${NOTIFICATIONS_CACHE_KEY_PREFIX}default`;
  }
};

/**
 * Normalizes any notification record from backend, socket, or FCM payload into a consistent shape.
 */
export const normalizeNotification = (n) => {
  if (!n || typeof n !== "object") return null;
  const id = String(n._id || n.id || n.notificationId || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const title = String(n.title || "Notification").trim();
  const body = String(n.body || n.message || n.details || "").trim();
  const type = String(n.type || "GENERAL").toUpperCase();
  const isRead = Boolean(n.isRead === true || n.read === true);

  const rawJob = n.job || n.data?.job || null;
  const jobId =
    n.jobId ||
    (typeof rawJob === "object" ? rawJob?._id || rawJob?.id : rawJob) ||
    n.data?.jobId ||
    null;

  const jobNumber =
    n.jobNumber ||
    (typeof rawJob === "object" ? rawJob?.jobNumber : null) ||
    n.data?.jobNumber ||
    null;

  return {
    id,
    _id: id,
    title,
    body,
    message: body,
    details: body,
    type,
    isRead,
    read: isRead,
    unread: !isRead,
    jobId: jobId ? String(jobId) : null,
    jobNumber: jobNumber ? String(jobNumber) : null,
    job: typeof rawJob === "object" ? rawJob : null,
    createdAt: n.createdAt || n.timestamp || new Date().toISOString(),
    readAt: n.readAt || null,
    data: n.data || {},
  };
};

/**
 * Subscribes to notification inbox list updates.
 */
export const subscribeNotifications = (callback) => {
  if (typeof callback !== "function") return () => {};
  notificationListeners.add(callback);
  return () => {
    notificationListeners.delete(callback);
  };
};

/**
 * Subscribes to unread notification count badge updates.
 */
export const subscribeUnreadCount = (callback) => {
  if (typeof callback !== "function") return () => {};
  unreadListeners.add(callback);
  return () => {
    unreadListeners.delete(callback);
  };
};

const notifyNotificationSubscribers = (notifications) => {
  notificationListeners.forEach((cb) => {
    try {
      cb(notifications);
    } catch (e) {
      console.warn("[Push] notification subscriber error:", e?.message);
    }
  });
};

const notifyUnreadSubscribers = (count) => {
  unreadListeners.forEach((cb) => {
    try {
      cb(count);
    } catch (e) {
      console.warn("[Push] unread subscriber error:", e?.message);
    }
  });
};

/**
 * Returns synchronous in-memory cached notifications.
 */
export const getDriverNotificationsCache = () => {
  return inMemoryNotifications;
};

/**
 * Returns synchronous current unread count.
 */
export const getDriverUnreadCount = () => {
  return inMemoryUnreadCount;
};

/**
 * Loads persisted notifications from AsyncStorage for instant startup (< 50ms).
 */
export const loadPersistedDriverNotifications = async () => {
  if (inMemoryNotifications && inMemoryNotifications.length > 0) {
    return inMemoryNotifications;
  }

  try {
    const key = await getNotificationStorageKey();
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map(normalizeNotification).filter(Boolean);
        inMemoryNotifications = normalized;
        inMemoryUnreadCount = normalized.filter((n) => !n.isRead).length;
        notifyNotificationSubscribers(normalized);
        notifyUnreadSubscribers(inMemoryUnreadCount);
        return normalized;
      }
    }
  } catch (err) {
    console.warn("[Push] Failed to load persisted notifications:", err?.message);
  }
  return null;
};

/**
 * Authoritative fetch from backend endpoint `/api/driver/notifications`.
 * Updates cache, unread count, and notifies all subscribers.
 */
export const fetchDriverNotifications = async ({
  page = 1,
  limit = 50,
  unreadOnly = false,
  force = false,
} = {}) => {
  const authToken = await getStoredAuthToken();
  if (!authToken) {
    return {
      notifications: inMemoryNotifications || [],
      unreadCount: inMemoryUnreadCount,
    };
  }

  if (inFlightNotificationsPromise && !force) {
    return inFlightNotificationsPromise;
  }

  inFlightNotificationsPromise = (async () => {
    try {
      const response = await API.get("/driver/notifications", {
        params: { page, limit, unreadOnly },
        diagnosticOrigin: "notificationService.fetchDriverNotifications",
      });

      let rawList = [];
      let count = 0;

      if (Array.isArray(response)) {
        rawList = response;
      } else if (response && typeof response === "object") {
        rawList = response.notifications || response.items || response.results || [];
        count = Number(response.unreadCount ?? response.unread ?? 0);
      }

      const normalized = rawList.map(normalizeNotification).filter(Boolean);

      if (response?.unreadCount === undefined) {
        count = normalized.filter((n) => !n.isRead).length;
      }

      inMemoryNotifications = normalized;
      inMemoryUnreadCount = count;

      getNotificationStorageKey().then((key) => {
        AsyncStorage.setItem(key, JSON.stringify(normalized)).catch(() => {});
      });

      notifyNotificationSubscribers(normalized);
      notifyUnreadSubscribers(count);

      return { notifications: normalized, unreadCount: count };
    } catch (err) {
      if (__DEV__) {
        console.warn("[Push] fetchDriverNotifications failed:", err?.response?.status, err?.message);
      }
      if (!inMemoryNotifications) {
        const persisted = await loadPersistedDriverNotifications();
        if (persisted) {
          return { notifications: persisted, unreadCount: inMemoryUnreadCount };
        }
      }
      throw err;
    } finally {
      inFlightNotificationsPromise = null;
    }
  })();

  return inFlightNotificationsPromise;
};

let inFlightUnreadCountPromise = null;
let lastUnreadCountFetchTimestamp = 0;
const UNREAD_COUNT_TTL_MS = 15000;

/**
 * Fetches authoritative unread count from `/api/driver/notifications/unread-count`.
 * Deduplicates in-flight calls and caches response for 15s.
 */
export const fetchDriverUnreadCount = async ({ force = false } = {}) => {
  const authToken = await getStoredAuthToken();
  if (!authToken) return 0;

  const now = Date.now();
  if (!force && now - lastUnreadCountFetchTimestamp < UNREAD_COUNT_TTL_MS && inMemoryUnreadCount !== null) {
    return inMemoryUnreadCount;
  }

  if (inFlightUnreadCountPromise && !force) {
    return inFlightUnreadCountPromise;
  }

  inFlightUnreadCountPromise = (async () => {
    try {
      const response = await API.get("/driver/notifications/unread-count", {
        diagnosticOrigin: "notificationService.fetchDriverUnreadCount",
      });
      const count = Number(response?.unreadCount ?? response?.data?.unreadCount ?? 0);
      inMemoryUnreadCount = count;
      lastUnreadCountFetchTimestamp = Date.now();
      notifyUnreadSubscribers(count);
      return count;
    } catch (err) {
      return inMemoryUnreadCount;
    } finally {
      inFlightUnreadCountPromise = null;
    }
  })();

  return inFlightUnreadCountPromise;
};

/**
 * Optimistically marks a single notification as read, persists state, and notifies backend.
 */
export const markDriverNotificationAsRead = async (notificationId) => {
  if (!notificationId) return;
  const targetId = String(notificationId);

  if (Array.isArray(inMemoryNotifications)) {
    inMemoryNotifications = inMemoryNotifications.map((n) =>
      n.id === targetId || n._id === targetId
        ? { ...n, isRead: true, read: true, unread: false, readAt: new Date().toISOString() }
        : n
    );
    inMemoryUnreadCount = Math.max(
      0,
      inMemoryNotifications.filter((n) => !n.isRead).length
    );
    notifyNotificationSubscribers(inMemoryNotifications);
    notifyUnreadSubscribers(inMemoryUnreadCount);

    getNotificationStorageKey().then((key) => {
      AsyncStorage.setItem(key, JSON.stringify(inMemoryNotifications)).catch(() => {});
    });
  }

  try {
    await API.patch(`/driver/notifications/${targetId}/read`);
  } catch (err) {
    if (__DEV__) {
      console.warn("[Push] markDriverNotificationAsRead API call failed:", err?.message);
    }
  }
};

/**
 * Optimistically marks all notifications as read, persists state, and notifies backend.
 */
export const markAllDriverNotificationsAsRead = async () => {
  if (Array.isArray(inMemoryNotifications)) {
    inMemoryNotifications = inMemoryNotifications.map((n) => ({
      ...n,
      isRead: true,
      read: true,
      unread: false,
      readAt: new Date().toISOString(),
    }));
    inMemoryUnreadCount = 0;
    notifyNotificationSubscribers(inMemoryNotifications);
    notifyUnreadSubscribers(0);

    getNotificationStorageKey().then((key) => {
      AsyncStorage.setItem(key, JSON.stringify(inMemoryNotifications)).catch(() => {});
    });
  }

  try {
    await API.patch("/driver/notifications/read-all");
  } catch (err) {
    if (__DEV__) {
      console.warn("[Push] markAllDriverNotificationsAsRead API call failed:", err?.message);
    }
  }
};

/**
 * Verifies that an incoming notification payload was explicitly addressed to
 * the currently logged-in driver user ID, rejecting cross-account leakages.
 */
export const isNotificationForCurrentDriver = async (remoteMessage) => {
  if (!remoteMessage?.data) return true;
  const data = remoteMessage.data;

  // Extract all possible recipient/target driver & user identifiers from payload
  const payloadTargets = [
    data.recipientDriverId,
    data.recipientUserId,
    data.targetDriverId,
    data.targetUserId,
    data.assignedDriverId,
    data.driverId,
    data.driver_id,
    data.recipientId,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  // Untagged broadcasts, system announcements, or general alerts pass to all drivers
  if (payloadTargets.length === 0) return true;

  try {
    const user = await getStoredUser();
    if (!user) return false;

    // Build comprehensive set of current driver's valid identities
    const activeDriverIdentities = new Set(
      [
        user._id,
        user.id,
        user.driverId,
        user.driver_id,
        user.driverProfileId,
        user.driverProfile?._id,
        user.driverProfile?.id,
        typeof user.driver === "string" ? user.driver : user.driver?._id || user.driver?.id,
        user.email,
        user.username,
      ]
        .filter(Boolean)
        .map((v) => String(v).trim().toLowerCase())
    );

    const matches = payloadTargets.some((target) => activeDriverIdentities.has(target));

    if (!matches) {
      console.warn("[Push] Security drop: notification targets another driver", {
        payloadTargets,
        activeDriver: user._id || user.id || user.email,
      });
      return false;
    }

    return true;
  } catch {
    return true;
  }
};

/**
 * Adds an incoming foreground push message directly into the inbox store,
 * updating unread badges and reconciling with the server.
 */
export const addForegroundNotification = async (remoteMessage) => {
  if (!remoteMessage) return;

  const isForMe = await isNotificationForCurrentDriver(remoteMessage);
  if (!isForMe) return;

  const data = remoteMessage.data || {};
  const notification = remoteMessage.notification || {};

  const rawId =
    remoteMessage.messageId ||
    data._id ||
    data.id ||
    data.notificationId ||
    `fcm_${Date.now()}`;

  const newItem = normalizeNotification({
    _id: rawId,
    id: rawId,
    title: notification.title || data.title || "DeliveryPlus Update",
    body: notification.body || data.body || data.message || "You have a new update.",
    type: data.type || data.notificationType || "GENERAL",
    isRead: false,
    jobId: data.jobId || data.id,
    jobNumber: data.jobNumber,
    createdAt: new Date().toISOString(),
    data,
  });

  if (!newItem) return;

  if (Array.isArray(inMemoryNotifications)) {
    const existingIndex = inMemoryNotifications.findIndex(
      (n) => n.id === newItem.id || (newItem.jobId && n.jobId === newItem.jobId && n.type === newItem.type && Math.abs(new Date(n.createdAt) - new Date(newItem.createdAt)) < 5000)
    );
    if (existingIndex >= 0) {
      inMemoryNotifications[existingIndex] = {
        ...inMemoryNotifications[existingIndex],
        ...newItem,
      };
    } else {
      inMemoryNotifications = [newItem, ...inMemoryNotifications];
      inMemoryUnreadCount += 1;
    }
  } else {
    inMemoryNotifications = [newItem];
    inMemoryUnreadCount = 1;
  }

  notifyNotificationSubscribers(inMemoryNotifications);
  notifyUnreadSubscribers(inMemoryUnreadCount);

  getNotificationStorageKey().then((key) => {
    AsyncStorage.setItem(key, JSON.stringify(inMemoryNotifications)).catch(() => {});
  });

  // Reconcile authoritative populated records in background
  fetchDriverNotifications({ force: true }).catch(() => {});

  // If notification is job-related, invalidate and refresh assigned jobs list
  if (newItem.jobId || data?.jobNumber || String(data?.type || "").toUpperCase().includes("JOB")) {
    import("./driverJobs")
      .then(({ invalidateDriverJobsCache, fetchDriverJobs }) => {
        invalidateDriverJobsCache();
        fetchDriverJobs("foreground_notification_push", { force: true }).catch(() => {});
      })
      .catch(() => {});
  }
};

/**
 * Clears in-memory notifications and resets badge on logout.
 */
export const clearNotificationState = () => {
  inMemoryNotifications = null;
  inMemoryUnreadCount = 0;
  notifyNotificationSubscribers([]);
  notifyUnreadSubscribers(0);
};

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
  DELIVERY_PLUS: {
    id: "delivery-plus",
    name: "DeliveryPlus Notifications",
    importance: AndroidImportance.HIGH,
    vibration: true,
  },
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
 * Logs only the notification lifecycle state, never notification content.
 */
export const logPushDebugDetails = (state) => {
  console.info("[Push] notification event", state);
};

/**
 * Creates required Android notification channels once.
 */
export const createNotificationChannels = async () => {
  if (Platform.OS !== "android") return;

  try {
    if (notifee?.createChannel) {
      await notifee.createChannel({
        id: NOTIFICATION_CHANNELS.DELIVERY_PLUS.id,
        name: NOTIFICATION_CHANNELS.DELIVERY_PLUS.name,
        importance: NOTIFICATION_CHANNELS.DELIVERY_PLUS.importance,
        vibration: true,
        sound: "default",
      });

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
      if (notifee?.requestPermission) {
        try {
          await notifee.requestPermission();
        } catch (notifeePermErr) {
          console.warn("[Push] Notifee permission error:", notifeePermErr?.message);
        }
      }

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

const DEVICE_ID_KEY = "@delivery_plus_device_id";

/**
 * Returns a stable unique device ID stored in AsyncStorage.
 */
export const getOrCreateDeviceId = async (driverId = "driver") => {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `${Platform.OS}_${driverId}_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return `${Platform.OS}_${driverId}`;
  }
};

/**
 * Redacts a token string for safe diagnostic logging (never prints full credentials).
 */
export const redactToken = (t) => {
  if (!t || typeof t !== "string") return "none";
  if (t.length <= 14) return "[REDACTED]";
  return `${t.slice(0, 8)}...${t.slice(-6)}`;
};

let lastRegisteredToken = null;
let lastRegisteredDriverId = null;
let lastRegisteredAt = 0;
const REGISTRATION_DEBOUNCE_MS = 60000; // 1 minute

/**
 * Registers device FCM token with the backend.
 */
export const registerDeviceToken = async (fcmToken = null, { force = false } = {}) => {
  try {
    let tokenToRegister = fcmToken;
    const messagingInstance = getSafeMessaging();

    if (!tokenToRegister && messagingInstance) {
      if (Platform.OS === "ios") {
        try {
          if (typeof RNFBMessaging.registerDeviceForRemoteMessages === "function") {
            await RNFBMessaging.registerDeviceForRemoteMessages(messagingInstance);
          } else if (typeof messagingInstance.registerDeviceForRemoteMessages === "function") {
            await messagingInstance.registerDeviceForRemoteMessages();
          }
        } catch (iosRegErr) {
          console.warn("[Push] registerDeviceForRemoteMessages notice:", iosRegErr?.message);
        }
      }

      if (typeof RNFBMessaging.getToken === "function") {
        tokenToRegister = await RNFBMessaging.getToken(messagingInstance);
      } else if (typeof messagingInstance.getToken === "function") {
        tokenToRegister = await messagingInstance.getToken();
      }
    }

    const fcmTokenExists = Boolean(tokenToRegister && tokenToRegister.trim().length > 0);
    console.log(`[Push] FCM_TOKEN_EXISTS = ${fcmTokenExists}`);

    if (!tokenToRegister) {
      return null;
    }

    await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, tokenToRegister);

    const authToken = await getStoredAuthToken();
    const user = await getStoredUser();
    const driverId = user?._id || user?.id || user?.driverId || "unknown_driver";

    if (!authToken) {
      console.log("[Push] driver not logged in; device token stored for later registration");
      return tokenToRegister;
    }

    // Skip redundant network registrations within debounce window
    const now = Date.now();
    if (
      !force &&
      tokenToRegister === lastRegisteredToken &&
      driverId === lastRegisteredDriverId &&
      now - lastRegisteredAt < REGISTRATION_DEBOUNCE_MS
    ) {
      return tokenToRegister;
    }

    const deviceId = await getOrCreateDeviceId(driverId);

    const payload = {
      token: tokenToRegister,
      fcmToken: tokenToRegister, // Provide both keys for backend controller compatibility
      platform: Platform.OS,
      deviceId,
      driverId,
      appVersion: "1.0.0",
    };

    const endpoints = [
      "/devices/register",
      "/driver/device-token",
      "/drivers/me/device-token",
      "/driver/me/device-token",
      "/drivers/me/push-token",
      "/driver/me/push-token",
    ];

    let registered = false;
    for (const endpoint of endpoints) {
      try {
        await API.post(endpoint, payload);
        registered = true;
        break;
      } catch (apiErr) {
        const status = apiErr?.response?.status || "ERR_NETWORK";
        if (__DEV__) {
          console.warn("[Push] device token registration endpoint attempted:", endpoint, status);
        }
        if (status === 200 || status === 201) {
          registered = true;
          break;
        }
      }
    }

    console.info("[Push] FCM_TOKEN_REGISTRATION", {
      platform: Platform.OS,
      driverId,
      tokenPrefix: redactToken(tokenToRegister),
      status: registered ? "SUCCESS" : "FALLBACK_CACHED",
    });

    if (registered) {
      lastRegisteredToken = tokenToRegister;
      lastRegisteredDriverId = driverId;
      lastRegisteredAt = Date.now();
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
      const endpoints = [
        "/devices/unregister",
        "/driver/device-token/unregister",
        "/drivers/me/device-token/unregister",
        "/driver/me/device-token/unregister",
      ];
      for (const endpoint of endpoints) {
        try {
          await API.post(endpoint, { token: storedFcmToken, fcmToken: storedFcmToken });
          break;
        } catch (ignored) {}
      }
      await AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      lastRegisteredToken = null;
      lastRegisteredDriverId = null;
      lastRegisteredAt = 0;
      console.log("[Push] FCM token unregistered from backend.");
    }
  } catch (err) {
    console.warn("[Push] Error unregistering device token:", err?.message);
  }
};

const executeNavigation = (data, remoteMessage) => {
  const jobId =
    data.jobId ||
    data.id ||
    data._id ||
    data.job_id ||
    (typeof data.job === "object" ? data.job?._id || data.job?.id : data.job);
  const jobNumber = data.jobNumber || (typeof data.job === "object" ? data.job?.jobNumber : null);
  const type = (data.type || data.notificationType || "").toUpperCase();

  console.info("NOTIFICATION_TAPPED", {
    messageId: remoteMessage?.messageId || data._id || null,
    jobId: jobId ? String(jobId) : null,
    jobNumber: jobNumber ? String(jobNumber) : null,
    type,
  });

  if (jobId || jobNumber) {
    const navParams = {
      jobId: jobId ? String(jobId) : null,
      id: jobId ? String(jobId) : null,
    };
    if (jobNumber) {
      navParams.jobNumber = String(jobNumber);
    }
    navigate("JobDetail", navParams);
    return;
  }

  if (type === "PAYMENT" || type === "PAYMENT_RECEIVED") {
    navigate("PaymentMethods");
    return;
  }

  navigate("Notifications");
};

/**
 * Resolves notification payload into a navigation action.
 * Stage: NOTIFICATION_TAPPED
 */
export const handleNotificationNavigation = async (remoteMessage) => {
  if (!remoteMessage) return;

  const data = remoteMessage.data || {};

  try {
    const isForMe = await isNotificationForCurrentDriver(remoteMessage);
    if (!isForMe) {
      console.warn("[Push] Security drop on tap: notification targets another driver.");
      return;
    }
    executeNavigation(data, remoteMessage);
  } catch {
    executeNavigation(data, remoteMessage);
  }
};

/**
 * Shows a foreground heads-up banner using Notifee.
 * Stage: LOCAL_NOTIFICATION_DISPLAYED
 */
export const displayForegroundNotification = async (remoteMessage) => {
  try {
    if (!notifee?.displayNotification) return;

    const isForMe = await isNotificationForCurrentDriver(remoteMessage);
    if (!isForMe) {
      console.warn("[Push] Security drop: notification belongs to another driver, banner suppressed.");
      return;
    }

    const { notification, data = {} } = remoteMessage || {};
    let title = notification?.title || data?.title || "DeliveryPlus Driver";
    let body = notification?.body || data?.body || "You have a new update.";

    // If job number or pickup info is provided, enrich notification content
    if (data?.jobNumber && !title.includes(data.jobNumber)) {
      title = `${data.jobNumber} • ${title}`;
    }
    const pickupInfo = data?.pickup || data?.pickupAddress;
    if (pickupInfo && !body.includes(pickupInfo)) {
      body = `${body} • Pickup: ${pickupInfo}`;
    }

    const channelId = data?.channelId || NOTIFICATION_CHANNELS.JOBS_URGENT.id;

    // On iOS, UNUserNotificationCenter willPresentNotification in AppDelegate already displays
    // the native banner for messages containing a notification payload (title & body).
    // Avoid double popups by not displaying an identical Notifee banner on iOS when remoteMessage.notification exists.
    if (Platform.OS === "ios" && remoteMessage?.notification) {
      console.info("LOCAL_NOTIFICATION_DISPLAYED", {
        messageId: remoteMessage.messageId || data._id || null,
        channelId,
        title,
        nativePresented: true,
      });
      return;
    }

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
        sound: "default",
        vibrationPattern: [300, 500],
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

    console.info("LOCAL_NOTIFICATION_DISPLAYED", {
      messageId: remoteMessage.messageId || data._id || null,
      channelId,
      title,
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
          await registerDeviceToken(newToken);
        });
      } else if (typeof messagingInstance.onTokenRefresh === "function") {
        messagingInstance.onTokenRefresh(async (newToken) => {
          await registerDeviceToken(newToken);
        });
      }

      // 2. Foreground Message Listener
      if (typeof RNFBMessaging.onMessage === "function") {
        unsubscribeForeground = RNFBMessaging.onMessage(messagingInstance, async (remoteMessage) => {
          console.info("APP_MESSAGE_RECEIVED", {
            messageId: remoteMessage.messageId || remoteMessage.data?._id || null,
            type: remoteMessage.data?.type || null,
            title: remoteMessage.notification?.title || remoteMessage.data?.title || null,
          });
          logPushDebugDetails("FOREGROUND", remoteMessage);
          await displayForegroundNotification(remoteMessage);
          await addForegroundNotification(remoteMessage);
        });
      } else if (typeof messagingInstance.onMessage === "function") {
        unsubscribeForeground = messagingInstance.onMessage(async (remoteMessage) => {
          console.info("APP_MESSAGE_RECEIVED", {
            messageId: remoteMessage.messageId || remoteMessage.data?._id || null,
            type: remoteMessage.data?.type || null,
            title: remoteMessage.notification?.title || remoteMessage.data?.title || null,
          });
          logPushDebugDetails("FOREGROUND", remoteMessage);
          await displayForegroundNotification(remoteMessage);
          await addForegroundNotification(remoteMessage);
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
        handleNotificationNavigation(initialNotification);
      }
    }

    // 5. Notifee Foreground / Local Notification Tap Listener
    if (notifee?.onForegroundEvent) {
      unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.PRESS && detail?.notification) {
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
        handleNotificationNavigation({
          data: notifeeInitial.notification.data,
          notification: {
            title: notifeeInitial.notification.title,
            body: notifeeInitial.notification.body,
          },
        });
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
