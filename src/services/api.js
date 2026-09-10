import axios from "axios";
import { Platform } from "react-native";
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

console.log("API baseURL:", baseURL);

const API = axios.create({
  baseURL,
});

API.interceptors.request.use(async (config) => {
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
    console.log("[API RESPONSE URL]:", response.config?.url);
    console.log("[API RAW RESPONSE]:", JSON.stringify(response.data));
    return response.data?.data ?? response.data;
  },
  (error) => {
    console.log("[API ERROR]:", error.config?.url, error.response?.data);
    return Promise.reject(error);
  }
);

/**
 * Persist and set authentication token & user data
 */
export const setAuthToken = async (token, user = null) => {
  authToken = token;
  try {
    if (token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    if (user) {
      currentUser = user;
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
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
 * Clear authentication token on logout
 */
export const clearAuthToken = async () => {
  authToken = null;
  currentUser = null;
  try {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
  } catch (err) {
    console.warn("[Auth] Failed to clear stored token:", err?.message);
  }
};

export default API;