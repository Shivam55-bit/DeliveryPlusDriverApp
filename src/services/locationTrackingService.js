import { Alert, AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import API, { getAuthToken, getStoredAuthToken, getStoredUser, tryRequest } from "./api";
import {
  beginNativeBackgroundTask,
  endNativeBackgroundTask,
  getAndroidLocationPermissionStatus,
  getCurrentNativeLocation,
  getNativeLocationPermissionState,
  requestNativeLocationPermission,
  startNativeLocationTracking,
  stopNativeLocationTracking as stopNativeLocationWatch,
  updateNativeTrackingOptions,
} from "./nativeLocationService";

const TRACKING_ENABLED_KEY = "@delivery_plus_driver_location_tracking_enabled";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_UPLOAD_ATTEMPTS = 3;
const DRIVER_LOCATION_ENDPOINTS = [
  "/drivers/me/location",
  "/driver/me/location",
];
const DRIVER_OFFLINE_ENDPOINTS = [
  "/drivers/me/offline",
  "/driver/me/offline",
];

let trackingEnabled = false;
let activeSessionToken = null;
let activeJob = false;
let uploadInFlight = null;
let latestPendingLocation = null;
let pendingRetryLocation = null;
let pendingRetryTimestamp = 0;
let networkRecoveryTimer = null;
let permissionPromptPromise = null;
let startPromise = null;
let lastSuccessfulUploadAt = 0;
let lastSuccessfulCoordinates = null;
let nativeWatchId = null;
let offlineInFlight = null;
let lastOfflineTime = 0;
let appStateSubscription = null;

const wait = (duration) =>
  new Promise((resolve) => setTimeout(resolve, duration));

const isGuestSession = (token, user) => {
  const userId = String(user?._id || user?.id || "").toLowerCase();
  const email = String(user?.email || "").toLowerCase();

  return (
    !token ||
    token === "mock-test-driver-token" ||
    token.startsWith("google-session-") ||
    userId.startsWith("test-driver-") ||
    email === "testdriver@deliveryplus.com"
  );
};

const isUserOnline = (user, hasActiveJob = false) => {
  if (hasActiveJob) {
    return true;
  }
  const onlineFlag = user?.isOnline ?? user?.online;
  if (typeof onlineFlag === "boolean") {
    return onlineFlag;
  }

  const rawAvailability = String(user?.availability || user?.status || "").trim().toLowerCase();
  const explicitOffline = ["offline", "inactive", "off_duty", "off-duty", "deactivated", "suspended"];
  if (explicitOffline.includes(rawAvailability)) {
    return false;
  }

  return true;
};

export const buildLocationPayload = (location) => {
  const latitude = Number(location?.coords?.latitude);
  const longitude = Number(location?.coords?.longitude);
  const accuracy = Number(location?.coords?.accuracy);
  const age = Number(location?.age);

  if (
    location?.mock === true ||
    location?.sample === true ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    (Number.isFinite(accuracy) && accuracy < 0) ||
    (Number.isFinite(age) && age > 120000)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
};

const stopNativeWatch = async () => {
  if (nativeWatchId !== null && nativeWatchId !== undefined) {
    const watchId = nativeWatchId;
    nativeWatchId = null;
    await stopNativeLocationWatch(watchId);
  }
};

export const initializeLocationTracking = async () => {
  await stopNativeWatch();
};

const explainLocationUse = () =>
  new Promise((resolve) => {
    Alert.alert(
      "Location while you are online",
      "DeliveryPlus shares your current location with dispatch while you are online. Background access helps keep your location current during an active delivery, even when your screen is locked.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: false, onDismiss: () => resolve(false) }
    );
  });

export const requestDriverLocationPermission = async () => {
  if (permissionPromptPromise) {
    return permissionPromptPromise;
  }

  if (Platform.OS === "android") {
    permissionPromptPromise = requestNativeLocationPermission({
      requireBackground: false,
    }).then((result) => Boolean(result?.granted)).finally(() => {
      permissionPromptPromise = null;
    });
    return permissionPromptPromise;
  }

  const currentState = await getNativeLocationPermissionState();

  if (__DEV__) {
    console.info("[LOCATION_PERMISSION_DEBUG] currentState:", currentState);
  }

  if (
    currentState === "authorizedalways" ||
    currentState === "authorizedwheninuse" ||
    currentState === "granted"
  ) {
    return true;
  }

  permissionPromptPromise = (async () => {
    const accepted = await explainLocationUse();
    if (!accepted) {
      console.info("[LOCATION_PERMISSION] explanation declined");
      return false;
    }

    try {
      const result = await requestNativeLocationPermission({ requireBackground: false });
      const granted = Boolean(result?.granted);

      if (__DEV__) {
        console.info(
          "[LOCATION_PERMISSION_DEBUG] request result:",
          result?.status,
          result?.requiresSettings,
          result?.granted
        );
      }

      console.info(
        `[LOCATION_PERMISSION] ${granted ? "granted" : result?.status || "denied"}`
      );
      return granted;
    } catch (error) {
      console.warn(
        `[LOCATION_PERMISSION] request failed ${error?.code || "unknown"}`
      );
      return false;
    }
  })().finally(() => {
    permissionPromptPromise = null;
  });

  return permissionPromptPromise;
};

const isRetryableError = (error) => {
  const status = error?.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
};

const uploadLocation = async (payload, token) => {
  if (!trackingEnabled || !token || token !== activeSessionToken) {
    return false;
  }

  const startTime = Date.now();
  console.info("GPS_UPLOAD_REQUESTED", { lat: payload.latitude, lng: payload.longitude });

  let bgTaskId = null;
  if (Platform.OS === "ios") {
    try {
      bgTaskId = await beginNativeBackgroundTask();
    } catch (e) {
      // ignore
    }
  }

  try {
    await tryRequest(
      async (path) => API.post(
        path,
        payload,
        {
          timeout: REQUEST_TIMEOUT_MS,
          diagnosticOrigin: "locationTrackingService.uploadLocation",
        }
      ),
      DRIVER_LOCATION_ENDPOINTS,
      { logLabel: "driver-location" }
    );

    if (!trackingEnabled || token !== activeSessionToken) {
      return false;
    }

    lastSuccessfulUploadAt = Date.now();
    lastSuccessfulCoordinates = payload;
    pendingRetryLocation = null;
    pendingRetryTimestamp = 0;

    console.info("GPS_UPLOAD_ACCEPTED", {
      lat: payload.latitude,
      lng: payload.longitude,
      durationMs: Date.now() - startTime,
    });
    console.info("[LOCATION_UPLOAD_SUCCESS]");
    return true;
  } catch (error) {
    console.warn(
      `[LOCATION_UPLOAD_FAILED] ${error?.response?.status || "network"}`
    );
    throw error;
  } finally {
    if (Platform.OS === "ios" && bgTaskId !== null && bgTaskId !== undefined) {
      try {
        await endNativeBackgroundTask(bgTaskId);
      } catch (e) {
        // ignore
      }
    }
  }
};

const uploadWithRetry = async (payload, token) => {
  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    if (!trackingEnabled || !token || token !== activeSessionToken) {
      return false;
    }

    try {
      return await uploadLocation(payload, token);
    } catch (error) {
      if (!trackingEnabled || !isRetryableError(error) || attempt === MAX_UPLOAD_ATTEMPTS - 1) {
        return false;
      }
      await wait(1000 * 2 ** attempt);
    }
  }

  return false;
};

const scheduleNetworkRecovery = () => {
  if (networkRecoveryTimer || !trackingEnabled) return;
  networkRecoveryTimer = setTimeout(() => {
    networkRecoveryTimer = null;
    if (
      trackingEnabled &&
      pendingRetryLocation &&
      Date.now() - pendingRetryTimestamp < 120000 &&
      !uploadInFlight
    ) {
      console.info("[GPS_DIAGNOSTIC] executing network recovery upload attempt");
      uploadInFlight = drainLocationQueue().finally(() => {
        uploadInFlight = null;
      });
    }
  }, 8000);
  if (networkRecoveryTimer && typeof networkRecoveryTimer.unref === "function") {
    networkRecoveryTimer.unref();
  }
};

const drainLocationQueue = async () => {
  while (trackingEnabled && (latestPendingLocation || pendingRetryLocation)) {
    const payload = latestPendingLocation || pendingRetryLocation;
    latestPendingLocation = null;
    pendingRetryLocation = null;
    const token = activeSessionToken;

    if (
      trackingEnabled &&
      token &&
      token === activeSessionToken &&
      getAuthToken() === token
    ) {
      const success = await uploadWithRetry(payload, token);
      if (!success && trackingEnabled) {
        // Preserve recent fix for network recovery if still fresh (< 120s)
        const now = Date.now();
        if (now - (pendingRetryTimestamp || now) < 120000) {
          pendingRetryLocation = payload;
          pendingRetryTimestamp = pendingRetryTimestamp || now;
          scheduleNetworkRecovery();
        }
        break;
      }
    }
  }
};

const queueLocation = async (location) => {
  if (
    !trackingEnabled ||
    !activeSessionToken ||
    getAuthToken() !== activeSessionToken
  ) {
    return;
  }

  const payload = buildLocationPayload(location);
  if (!payload) {
    return;
  }

  console.info("GPS_CAPTURED", {
    lat: payload.latitude,
    lng: payload.longitude,
    timestamp: new Date().toISOString(),
  });
  console.info("[LOCATION_FIX_RECEIVED]");

  const now = Date.now();
  const minimumInterval = activeJob ? 10000 : 35000;
  const minimumMovement = activeJob ? 20 : 40;
  const movedEnough =
    !lastSuccessfulCoordinates ||
    distanceBetweenMeters(lastSuccessfulCoordinates, payload) >=
      minimumMovement;

  if (now - lastSuccessfulUploadAt < minimumInterval && !movedEnough) {
    return;
  }

  latestPendingLocation = payload;
  if (!uploadInFlight) {
    uploadInFlight = drainLocationQueue().finally(() => {
      uploadInFlight = null;
      if (trackingEnabled && (latestPendingLocation || pendingRetryLocation)) {
        drainLocationQueue().catch(() => {
          console.warn("[LOCATION_UPLOAD_FAILED] location queue failed");
        });
      }
    });
  }
};

const distanceBetweenMeters = (first, second) => {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const setupAppStateHandling = () => {
  if (appStateSubscription || typeof AppState?.addEventListener !== "function") return;
  appStateSubscription = AppState.addEventListener("change", async (nextState) => {
    if (nextState === "active" && trackingEnabled) {
      console.info("[GPS_DIAGNOSTIC] AppState active, poking fresh location");
      if (networkRecoveryTimer) {
        clearTimeout(networkRecoveryTimer);
        networkRecoveryTimer = null;
      }
      try {
        const fresh = await getCurrentNativeLocation({ timeoutMs: 3000 });
        if (fresh && trackingEnabled) {
          await queueLocation(fresh);
        }
      } catch (e) {
        if (pendingRetryLocation && !uploadInFlight) {
          uploadInFlight = drainLocationQueue().finally(() => {
            uploadInFlight = null;
          });
        }
      }
    }
  });
};

const deactivateTracking = async () => {
  trackingEnabled = false;
  activeSessionToken = null;
  latestPendingLocation = null;
  pendingRetryLocation = null;
  pendingRetryTimestamp = 0;
  lastSuccessfulUploadAt = 0;
  lastSuccessfulCoordinates = null;

  if (networkRecoveryTimer) {
    clearTimeout(networkRecoveryTimer);
    networkRecoveryTimer = null;
  }

  let cleanupError = null;
  try {
    await stopNativeWatch();
  } catch (error) {
    cleanupError = error;
  }

  try {
    await AsyncStorage.removeItem(TRACKING_ENABLED_KEY);
  } catch (error) {
    console.warn("[LOCATION_UPLOAD_FAILED] could not clear tracking state");
    cleanupError = cleanupError || error;
  }

  if (uploadInFlight) {
    try {
      await uploadInFlight;
    } catch (error) {
      cleanupError = cleanupError || error;
    }
  }

  if (cleanupError) {
    throw cleanupError;
  }
};

const startTracking = async ({
  user,
  isActiveJob = false,
  permissionGranted = false,
  serverConfirmedOnline = false,
} = {}) => {
  const token = (await getStoredAuthToken()) || getAuthToken();
  const storedUser = user || (await getStoredUser());

  const nextActiveJob = Boolean(isActiveJob);
  if (
    isGuestSession(token, storedUser) ||
    (!serverConfirmedOnline && !isUserOnline(storedUser, nextActiveJob))
  ) {
    await deactivateTracking();
    return false;
  }

  setupAppStateHandling();

  if (trackingEnabled && activeSessionToken === token) {
    const androidStatus = Platform.OS === "android" ? await getAndroidLocationPermissionStatus().catch(() => null) : null;
    const serviceRunning =
      Platform.OS !== "android" ||
      Boolean(androidStatus?.trackingServiceRunning);
    if (activeJob === nextActiveJob && serviceRunning) {
      return true;
    }
    activeJob = nextActiveJob;
    if (Platform.OS === "ios") {
      await updateNativeTrackingOptions({ activeJob: nextActiveJob });
      return true;
    }
    await stopNativeWatch();
  }

  if (!permissionGranted) {
    const granted = await requestDriverLocationPermission();
    if (!granted) {
      return false;
    }
  }

  trackingEnabled = true;
  activeSessionToken = token;
  activeJob = nextActiveJob;

  try {
    await AsyncStorage.setItem(TRACKING_ENABLED_KEY, "true");
    nativeWatchId = await startNativeLocationTracking({
      activeJob: nextActiveJob,
      minimumIntervalMs: nextActiveJob ? 10000 : 35000,
      minimumDistanceMeters: nextActiveJob ? 20 : 40,
      onLocation: (location) => {
        queueLocation(location).catch(() => {
          console.warn("[LOCATION_UPLOAD_FAILED] location queue failed");
        });
      },
      onError: (error) => {
        console.warn("[LOCATION_PERMISSION] no location source available", error);
      },
    });

    // Acquire and upload initial fresh location immediately
    Promise.resolve()
      .then(() => getCurrentNativeLocation({ timeoutMs: 3500 }))
      .then((initialLoc) => {
        if (initialLoc && trackingEnabled) {
          queueLocation(initialLoc).catch(() => {});
        }
      })
      .catch(() => {});
  } catch (error) {
    try {
      await deactivateTracking();
    } catch (cleanupError) {
      console.warn("[LOCATION_UPLOAD_FAILED] cleanup after tracking start failed");
    }
    throw error;
  }

  console.info("[LOCATION_WATCH_STARTED]");
  return true;
};

export const startDriverLocationTracking = (options = {}) => {
  if (startPromise) {
    return startPromise;
  }

  startPromise = startTracking(options).finally(() => {
    startPromise = null;
  });
  return startPromise;
};

export const setDriverActiveJobTracking = async (isActiveJob) => {
  activeJob = Boolean(isActiveJob);
  if (!trackingEnabled) {
    if (isActiveJob) {
      await startTracking({ isActiveJob: true, serverConfirmedOnline: true, permissionGranted: true });
    }
    return;
  }

  if (Platform.OS === "ios") {
    await updateNativeTrackingOptions({ activeJob });
    return;
  }

  await stopNativeWatch();
  nativeWatchId = await startNativeLocationTracking({
    activeJob,
    minimumIntervalMs: activeJob ? 10000 : 35000,
    minimumDistanceMeters: activeJob ? 20 : 40,
    onLocation: (location) => {
      queueLocation(location).catch(() => {
        console.warn("[LOCATION_UPLOAD_FAILED] location queue failed");
      });
    },
    onError: (error) => {
      console.warn("[LOCATION_PERMISSION] no location source available", error);
    },
  });
};

export const stopDriverLocationTracking = async () => {
  await deactivateTracking();
};

export const sendFinalDriverLocation = async () => {
  if (!trackingEnabled || !activeSessionToken) {
    return false;
  }

  const token = activeSessionToken;
  const finalUpload = (async () => {
    try {
      const location = await getCurrentNativeLocation({ timeoutMs: 2000 });
      const payload = buildLocationPayload(location);
      if (!payload || !trackingEnabled || token !== activeSessionToken) {
        return false;
      }

      if (uploadInFlight) {
        const settled = await Promise.race([
          uploadInFlight.then(() => true),
          wait(800).then(() => false),
        ]);
        if (!settled) {
          return false;
        }
      }

      return uploadWithRetry(payload, token);
    } catch (error) {
      return false;
    }
  })();

  return Promise.race([finalUpload, wait(2500).then(() => false)]);
};

export const stopDriverTrackingAndMarkOffline = async () => {
  if (offlineInFlight) {
    return offlineInFlight;
  }

  offlineInFlight = (async () => {
    const token = (await getStoredAuthToken()) || getAuthToken();
    const user = await getStoredUser();
    let cleanupError = null;
    try {
      await deactivateTracking();
    } catch (error) {
      cleanupError = error;
    }

    if (isGuestSession(token, user)) {
      lastOfflineTime = Date.now();
      if (cleanupError) throw cleanupError;
      return;
    }

    let offlineError = null;
    try {
      await tryRequest(
        async (path) => API.post(
          path,
          {},
          {
            timeout: REQUEST_TIMEOUT_MS,
            diagnosticOrigin: "locationTrackingService.stopDriverTrackingAndMarkOffline",
          }
        ),
        DRIVER_OFFLINE_ENDPOINTS,
        { logLabel: "driver-offline" }
      );
      lastOfflineTime = Date.now();
      console.info("[GPS_DIAGNOSTIC] Offline confirmed by server");
    } catch (error) {
      console.warn(
        `[LOCATION_UPLOAD_FAILED] offline ${error?.response?.status || "network"}`
      );
      offlineError = error;
    }

    if (cleanupError || offlineError) {
      if (cleanupError && offlineError) {
        console.warn("[LOCATION_UPLOAD_FAILED] tracking cleanup and offline endpoint both failed");
      }
      throw offlineError || cleanupError;
    }
  })().finally(() => {
    offlineInFlight = null;
  });

  return offlineInFlight;
};

export const handleHeadlessLocation = async () => undefined;
