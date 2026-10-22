import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

let authToken = null;
let currentUser = null;

// Keys for persistence
const AUTH_TOKEN_KEY = "@delivery_plus_driver_auth_token";
const AUTH_USER_KEY = "@delivery_plus_driver_auth_user";

// If you want to override the API host, set this manually or use REACT_NATIVE_API_URL.
const MANUAL_API_HOST = null;

const baseURL =
  process.env.REACT_NATIVE_API_URL ||
  MANUAL_API_HOST ||
  "https://api.deliveryplus.tech/api";

if (__DEV__) {
  console.log("API baseURL:", baseURL);
}

const API = axios.create({
  baseURL,
  timeout: 15000,
});

const sanitizeDiagnosticBody = (body) => {
  const sensitiveKey =
    /authorization|token|secret|password|credential|latitude|longitude|(^|_)lat($|_)|(^|_)lng($|_)|coordinate|currentlocation|phone|email|name|address|signature|photo|image|notes/i;

  const sanitize = (value, key = "") => {
    if (sensitiveKey.test(key)) {
      return "[REDACTED]";
    }

    if (typeof value === "string") {
      return value
        .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
        .slice(0, 1000);
    }

    if (Array.isArray(value)) {
      return value.slice(0, 20).map((item) => sanitize(item));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .slice(0, 50)
          .map(([childKey, childValue]) => [
            childKey,
            sanitize(childValue, childKey),
          ])
      );
    }

    return value;
  };

  return sanitize(body);
};

export const tryRequest = async (
  requestFactory,
  candidatePaths,
  { logLabel = "request", allowNon404Failure = false } = {}
) => {
  let lastError = null;

  for (const path of candidatePaths) {
    try {
      const result = await requestFactory(path);
      return result;
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      const message = error?.message || "request failed";

      if (!allowNon404Failure && status && status !== 404 && status !== 405) {
        throw error;
      }

      if (__DEV__) {
        console.warn(`[${logLabel}] ${path} failed (${status || "network"}): ${message}`);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`No successful ${logLabel} response found`);
};

API.interceptors.request.use(async (config) => {
  config.metadata = { ...config.metadata, startedAt: Date.now() };

  if (!authToken) {
    try {
      authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch (e) {
      // ignore
    }
  }

  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
    if (typeof config.headers.set === "function") {
      config.headers.set("Authorization", `Bearer ${authToken}`);
    }
  }
  return config;
});

API.interceptors.response.use(
  (response) => {
    if (__DEV__ && response.config?.diagnosticOrigin) {
      console.info("[API REQUEST SUCCESS]", {
        origin: response.config.diagnosticOrigin,
        method: response.config.method?.toUpperCase(),
        url: API.getUri(response.config),
        status: response.status,
        elapsedMs: Date.now() - response.config.metadata?.startedAt,
        responseBody: sanitizeDiagnosticBody(response.data),
      });
    }
    return response.data?.data ?? response.data;
  },
  (error) => {
    if (__DEV__) {
      const config = error.config || {};
      const diagnostic = {
        origin: config.diagnosticOrigin || "unattributed API call",
        method: config.method?.toUpperCase() || "UNKNOWN",
        url: config.url ? API.getUri(config) : "unavailable",
        status: error.response?.status || "network",
        elapsedMs: config.metadata?.startedAt
          ? Date.now() - config.metadata.startedAt
          : null,
        responseBody: sanitizeDiagnosticBody(error.response?.data),
      };
      console.warn("[API REQUEST FAILURE]", JSON.stringify(diagnostic));
    }
    return Promise.reject(error);
  }
);

/**
 * Persist and set authentication token & user data
 */
export const setAuthToken = async (token, user = null) => {
  const tokenChanged = authToken !== token;
  const userChanged =
    Boolean(user) !== Boolean(currentUser) ||
    (user && currentUser && (user._id !== currentUser._id || user.id !== currentUser.id || user.email !== currentUser.email || user.role !== currentUser.role));

  if (!tokenChanged && !userChanged && authToken && currentUser) {
    return;
  }

  if (authToken && tokenChanged) {
    try {
      const { stopDriverTrackingAndMarkOffline } = await import(
        "./locationTrackingService"
      );
      await stopDriverTrackingAndMarkOffline();
    } catch (error) {
      console.warn("[LOCATION_UPLOAD_FAILED] offline before account change failed");
    }
  }

  authToken = token;
  try {
    if (token && tokenChanged) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    if (tokenChanged && !user) {
      currentUser = null;
      await AsyncStorage.removeItem(AUTH_USER_KEY);
    }
    if (user && (userChanged || tokenChanged)) {
      currentUser = user;
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }

    // Trigger FCM device registration in background on valid session
    if (token) {
      import("./notificationService").then(({ registerDeviceToken }) => {
        registerDeviceToken().catch(() => {});
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("[Auth] Failed to persist auth token:", err?.message);
  }
};

/**
 * Get current in-memory token
 */
export const getAuthToken = () => authToken;

/**
 * Retrieve stored token from AsyncStorage
 */
export const getStoredAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      authToken = token;
    }
    return token;
  } catch (err) {
    console.warn("[Auth] Failed to get stored auth token:", err?.message);
    return authToken;
  }
};

/**
 * Retrieve stored user profile from AsyncStorage
 */
export const getStoredUser = async () => {
  try {
    if (currentUser) return currentUser;
    const userStr = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (userStr) {
      currentUser = JSON.parse(userStr);
    }
    return currentUser;
  } catch (err) {
    console.warn("[Auth] Failed to get stored user:", err?.message);
    return null;
  }
};

/**
 * Get current in-memory user
 */
export const getCurrentUser = () => currentUser;

/**
 * Clear authentication token on logout
 */
export const clearAuthToken = async () => {
  try {
    const { stopDriverTrackingAndMarkOffline } = await import(
      "./locationTrackingService"
    );
    await stopDriverTrackingAndMarkOffline();
  } catch (error) {
    console.warn("[LOCATION_UPLOAD_FAILED] offline before logout failed");
  }

  try {
    // Unregister FCM device token before wiping auth session
    const { unregisterDeviceToken, clearNotificationState } = await import("./notificationService");
    await unregisterDeviceToken();
    clearNotificationState();
  } catch (err) {
    console.warn("[Auth] Error during device unregistration on logout:", err?.message);
  }

  authToken = null;
  currentUser = null;
  try {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
  } catch (err) {
    console.warn("[Auth] Failed to clear stored token:", err?.message);
  }
};

export default API;