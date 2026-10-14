import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import API, { getAuthToken, getStoredAuthToken, getStoredUser, tryRequest } from "./api";
import {
  getAndroidLocationPermissionStatus,
  getCurrentNativeLocation,
  getNativeLocationPermissionState,
  requestNativeLocationPermission,
  startNativeLocationTracking,
  stopNativeLocationTracking as stopNativeLocationWatch,
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
let permissionPromptPromise = null;
let startPromise = null;
let lastSuccessfulUploadAt = 0;
let lastSuccessfulCoordinates = null;
let nativeWatchId = null;

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

const isUserOnline = (user) => {
  const onlineFlag = user?.isOnline ?? user?.online;
  if (typeof onlineFlag === "boolean") {
    return onlineFlag;
  }

  return ["available", "online"].includes(
    String(user?.availability || "").trim().toLowerCase()
  );
};

export const buildLocationPayload = (location) => {
  const latitude = Number(location?.coords?.latitude);
  const longitude = Number(location?.coords?.longitude);
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
      requireBackground: true,
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
      const result = await requestNativeLocationPermission({ requireBackground: true });
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

  console.info("[LOCATION_UPLOAD_STARTED]");
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
    console.info("[LOCATION_UPLOAD_SUCCESS]");
    return true;
  } catch (error) {
    console.warn(
      `[LOCATION_UPLOAD_FAILED] ${error?.response?.status || "network"}`
    );
    throw error;
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
      if (!isRetryableError(error) || attempt === MAX_UPLOAD_ATTEMPTS - 1) {
        return false;
      }
      await wait(1000 * 2 ** attempt);
    }
  }

  return false;
};

const drainLocationQueue = async () => {
  while (trackingEnabled && latestPendingLocation) {
    const payload = latestPendingLocation;
    latestPendingLocation = null;
    const token = activeSessionToken;

    if (
      trackingEnabled &&
      token &&
      token === activeSessionToken &&
      getAuthToken() === token
    ) {
      await uploadWithRetry(payload, token);
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

  console.info("[LOCATION_FIX_RECEIVED]");
  const now = Date.now();
  const minimumInterval = activeJob ? 12000 : 45000;
  const minimumMovement = activeJob ? 20 : 50;
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
      if (trackingEnabled && latestPendingLocation) {
        queueLocation({ coords: latestPendingLocation }).catch(() => {
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

const deactivateTracking = async () => {
  trackingEnabled = false;
  activeSessionToken = null;
  latestPendingLocation = null;
  lastSuccessfulUploadAt = 0;
  lastSuccessfulCoordinates = null;

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

  if (
    isGuestSession(token, storedUser) ||
    (!serverConfirmedOnline && !isUserOnline(storedUser))
  ) {
    await deactivateTracking();
    return false;
  }

  const nextActiveJob = Boolean(isActiveJob);
  if (trackingEnabled && activeSessionToken === token) {
    const androidStatus = Platform.OS === "android" ? await getAndroidLocationPermissionStatus().catch(() => null) : null;
    const serviceRunning =
      Platform.OS !== "android" ||
      Boolean(androidStatus?.trackingServiceRunning);
    if (activeJob === nextActiveJob && serviceRunning) {
      return true;
    }
    activeJob = nextActiveJob;
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
      minimumIntervalMs: nextActiveJob ? 12000 : 45000,
      minimumDistanceMeters: nextActiveJob ? 20 : 50,
      onLocation: (location) => {
        queueLocation(location).catch(() => {
          console.warn("[LOCATION_UPLOAD_FAILED] location queue failed");
        });
      },
      onError: (error) => {
        console.warn("[LOCATION_PERMISSION] no location source available", error);
      },
    });
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
    return;
  }

  await stopNativeWatch();
  nativeWatchId = await startNativeLocationTracking({
    activeJob,
    minimumIntervalMs: activeJob ? 12000 : 45000,
    minimumDistanceMeters: activeJob ? 20 : 50,
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
  const token = (await getStoredAuthToken()) || getAuthToken();
  const user = await getStoredUser();
  let cleanupError = null;
  try {
    await deactivateTracking();
  } catch (error) {
    cleanupError = error;
  }

  if (isGuestSession(token, user)) {
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
};

export const handleHeadlessLocation = async () => undefined;
