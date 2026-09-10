import { Platform } from "react-native";

let GoogleSigninModule = null;
let statusCodesModule = null;

const getGoogleSignin = () => {
  if (!GoogleSigninModule) {
    try {
      const g = require("@react-native-google-signin/google-signin");
      GoogleSigninModule = g.GoogleSignin;
      statusCodesModule = g.statusCodes;
    } catch (e) {
      console.warn("[GoogleAuth] Module loading warning:", e?.message);
    }
  }
  return { GoogleSignin: GoogleSigninModule, statusCodes: statusCodesModule };
};

let isConfigured = false;

/**
 * Safe configuration of Google Sign-In
 */
export const configureGoogleSignIn = async (webClientId = null, iosClientId = null) => {
  try {
    const { GoogleSignin } = getGoogleSignin();
    if (!GoogleSignin) {
      console.warn("[GoogleAuth] GoogleSignin native module not available yet.");
      return false;
    }

    const config = {
      scopes: ["email", "profile"],
      offlineAccess: false,
    };

    if (webClientId && typeof webClientId === "string" && webClientId.trim().length > 0) {
      config.webClientId = webClientId.trim();
    }

    if (iosClientId && typeof iosClientId === "string" && iosClientId.trim().length > 0) {
      config.iosClientId = iosClientId.trim();
    }

    try {
      const configureResult = GoogleSignin.configure(config);
      if (configureResult && typeof configureResult.then === "function") {
        await configureResult;
      }
      isConfigured = true;
      return true;
    } catch (confErr) {
      console.warn("[GoogleAuth] GoogleSignin.configure warning:", confErr?.message || confErr);
      isConfigured = false;
      return false;
    }
  } catch (err) {
    console.warn("[GoogleAuth] configureGoogleSignIn error:", err?.message || err);
    isConfigured = false;
    return false;
  }
};

/**
 * Perform Google Sign-In
 */
export const signInWithGoogle = async () => {
  try {
    const { GoogleSignin, statusCodes } = getGoogleSignin();

    if (!GoogleSignin) {
      return {
        success: false,
        error: "Google Sign In native module is not ready. Please try again.",
      };
    }

    if (!isConfigured) {
      const ok = await configureGoogleSignIn();
      if (!ok && !isConfigured) {
        return {
          success: false,
          error: "Google Sign-In is not configured for iOS yet. Please use Email/Password sign in.",
        };
      }
    }

    // Check Play Services support on Android
    if (Platform.OS === "android") {
      try {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      } catch (playError) {
        console.warn("[GoogleAuth] hasPlayServices warning:", playError);
      }
    }

    // Initiate sign in flow
    const response = await GoogleSignin.signIn();

    // Support both modern v14+ (response.data) and legacy (response) payloads
    const data = response?.data || response;
    const user = data?.user || response?.user || {};
    const idToken = data?.idToken || response?.idToken || "";

    const userProfile = {
      id: user.id || user.sub || "",
      name:
        user.name ||
        `${user.givenName || ""} ${user.familyName || ""}`.trim() ||
        "Google User",
      email: user.email || "",
      photo: user.photo || "",
      givenName: user.givenName || "",
      familyName: user.familyName || "",
      idToken,
    };

    return {
      success: true,
      user: userProfile,
      idToken,
      raw: response,
    };
  } catch (error) {
    const { statusCodes } = getGoogleSignin();

    const isCancelled =
      (statusCodes && error?.code === statusCodes.SIGN_IN_CANCELLED) ||
      error?.code === "12501" ||
      error?.code === "SIGN_IN_CANCELLED" ||
      error?.message?.toLowerCase()?.includes("cancel");

    if (isCancelled) {
      console.log("[GoogleAuth] Sign-in cancelled by user");
      return { success: false, cancelled: true };
    }

    const isInProgress =
      (statusCodes && error?.code === statusCodes.IN_PROGRESS) ||
      error?.code === "IN_PROGRESS" ||
      error?.message?.toLowerCase()?.includes("in progress");

    if (isInProgress) {
      console.log("[GoogleAuth] Sign-in already in progress");
      return { success: false, inProgress: true };
    }

    const isPlayServicesUnavailable =
      (statusCodes && error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) ||
      error?.code === "PLAY_SERVICES_NOT_AVAILABLE";

    if (isPlayServicesUnavailable) {
      return {
        success: false,
        error: "Google Play Services is not available on this device.",
      };
    }

    console.error("[GoogleAuth] Sign-in error:", error);
    return {
      success: false,
      error: error?.message || "Failed to sign in with Google. Please try again.",
    };
  }
};

/**
 * Sign out from Google
 */
export const signOutFromGoogle = async () => {
  try {
    const { GoogleSignin } = getGoogleSignin();
    if (GoogleSignin && isConfigured) {
      await GoogleSignin.signOut();
    }
  } catch (err) {
    console.warn("[GoogleAuth] Sign out warning:", err?.message);
  }
};
