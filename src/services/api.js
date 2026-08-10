import axios from "axios";
import { Platform } from "react-native";

let authToken = null;

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

API.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => {
    // Unwrap backend response wrapper: { success, message, data }
    return response.data?.data ?? response.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const setAuthToken = (token) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

export const clearAuthToken = () => {
  authToken = null;
};

export default API;