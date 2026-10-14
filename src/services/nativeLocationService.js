import {
  Linking,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from "react-native";

const iosLocationManager = NativeModules.NativeLocationManager;
const androidLocationManager = NativeModules.NativeLocationModule;
let iosLocationSubscription = null;
let iosErrorSubscription = null;
let androidLocationSubscription = null;
let androidErrorSubscription = null;

const normalizeAuthorizationStatus = (status) => {
  if (status && typeof status === "object") {
    return normalizeAuthorizationStatus(status.status);
  }

  if (typeof status !== "string") {
    return "not_determined";
  }

  const normalized = status.trim().toLowerCase();
  const mapped = {
    authorizedalways: "authorizedalways",
    authorized_always: "authorizedalways",
    authorizedwheninuse: "authorizedwheninuse",
    authorized_when_in_use: "authorizedwheninuse",
    authorized_wheninuse: "authorizedwheninuse",
    granted: "granted",
    denied: "denied",
    restricted: "restricted",
    not_determined: "not_determined",
    notdetermined: "not_determined",
  };

  return mapped[normalized] || normalized;
};

const requireNativeLocationManager = () => {
  if (!iosLocationManager) {
    throw new Error("The native iOS location module is not available.");
  }

  return iosLocationManager;
};

const requireAndroidLocationManager = () => {
  if (!androidLocationManager) {
    throw new Error("The native Android location module is not available.");
  }

  return androidLocationManager;
};

export const getAndroidLocationPermissionStatus = async () => {
  if (Platform.OS !== "android") {
    throw new Error("Android location permission status is only available on Android.");
  }

  return requireAndroidLocationManager().getLocationPermissionStatus();
};

export const getNativeLocationPermissionState = async () => {
  if (Platform.OS === "android") {
    const status = await getAndroidLocationPermissionStatus();
    return status.foregroundGranted &&
      status.backgroundGranted &&
      status.locationServicesEnabled
      ? "granted"
      : "denied";
  }

  if (Platform.OS === "ios") {
    const result = await requireNativeLocationManager().getAuthorizationStatus();
    const normalized = normalizeAuthorizationStatus(result);
    if (__DEV__) {
      console.info("[LOCATION_PERMISSION_DEBUG] native auth status:", result?.status);
    }
    return normalized;
  }

  return "granted";
};

export const subscribeNativeLocationAuthorization = (onAuthorizationChanged) => {
  if (Platform.OS !== "ios" || typeof onAuthorizationChanged !== "function") {
    return () => {};
  }

  const emitter = new NativeEventEmitter(requireNativeLocationManager());
  const subscription = emitter.addListener(
    "authorizationChanged",
    (result) => {
      const status = normalizeAuthorizationStatus(result);
      if (__DEV__) {
        console.info(
          "[LOCATION_PERMISSION_DEBUG] native authorization callback:",
          result?.status
        );
      }
      onAuthorizationChanged(status);
    }
  );

  return () => subscription.remove();
};

export const openLocationSettings = async () => {
  if (Platform.OS === "ios") {
    try {
      await Linking.openURL("app-settings:");
      return true;
    } catch (error) {
      console.warn("[LOCATION_PERMISSION] unable to open iOS settings", error);
      return false;
    }
  }

  if (Platform.OS === "android") {
    try {
      await requireAndroidLocationManager().openAppLocationSettings();
      return true;
    } catch (error) {
      console.warn("[LOCATION_PERMISSION] unable to open Android app settings", error);
      return false;
    }
  }

  return false;
};

export const openDeviceLocationSettings = async () => {
  if (Platform.OS !== "android") {
    return openLocationSettings();
  }

  try {
    await requireAndroidLocationManager().openDeviceLocationSettings();
    return true;
  } catch (error) {
    console.warn("[LOCATION_PERMISSION] unable to open Android location settings", error);
    return false;
  }
};

export const requestNativeLocationPermission = async ({
  requireBackground = true,
} = {}) => {
  if (Platform.OS === "android") {
    const manager = requireAndroidLocationManager();
    let status = await manager.getLocationPermissionStatus();

    if (!status.foregroundGranted) {
      await manager.requestForegroundPermission();
      status = await manager.getLocationPermissionStatus();
    }

    if (!status.foregroundGranted) {
      return {
        ...status,
        granted: false,
        status: status.foregroundPermanentlyDenied
          ? "foreground_denied_permanently"
          : "foreground_denied",
        requiresSettings: Boolean(status.foregroundPermanentlyDenied),
        backgroundRequired: requireBackground,
      };
    }

    if (requireBackground && !status.backgroundGranted) {
      if (Platform.Version >= 30) {
        return {
          ...status,
          granted: false,
          status: "background_settings_required",
          requiresSettings: true,
          backgroundRequired: true,
        };
      }

      await manager.requestBackgroundPermission();
      status = await manager.getLocationPermissionStatus();
    }

    const granted =
      status.foregroundGranted &&
      (!requireBackground || status.backgroundGranted) &&
      status.locationServicesEnabled;

    return {
      ...status,
      granted,
      status: granted
        ? "granted"
        : !status.locationServicesEnabled
          ? "location_services_disabled"
          : "background_denied",
      requiresSettings:
        !status.locationServicesEnabled ||
        (requireBackground && !status.backgroundGranted),
      backgroundRequired: requireBackground,
    };
  }

  if (Platform.OS === "ios") {
    const nativeManager = requireNativeLocationManager();
    let result = await nativeManager.getAuthorizationStatus();
    let normalized = normalizeAuthorizationStatus(result);

    if (__DEV__) {
      console.info(
        "[LOCATION_PERMISSION_DEBUG] requestNativeLocationPermission initial:",
        result?.status
      );
    }

    if (normalized === "authorizedalways" || normalized === "authorizedwheninuse") {
      return {
        granted: true,
        status: normalized,
        requiresSettings: false,
        backgroundRequired: false,
      };
    }

    if (normalized === "denied" || normalized === "restricted") {
      return {
        granted: false,
        status: normalized,
        requiresSettings: true,
        backgroundRequired: false,
      };
    }

    if (normalized === "not_determined") {
      result = await nativeManager.requestWhenInUseAuthorization();
      normalized = normalizeAuthorizationStatus(result);
    }

    if (normalized === "authorizedwheninuse") {
      // Under iOS two-stage authorization, requestAlwaysAuthorization can be proposed,
      // but authorizedwheninuse is fully valid for live online driver tracking.
      try {
        result = await nativeManager.requestAlwaysAuthorization();
        normalized = normalizeAuthorizationStatus(result);
      } catch (err) {
        // Keep authorizedwheninuse if always request is deferred by OS
      }
      return {
        granted: true,
        status: normalized === "authorizedalways" ? "authorizedalways" : "authorizedwheninuse",
        requiresSettings: false,
        backgroundRequired: false,
      };
    }

    if (normalized === "authorizedalways") {
      return {
        granted: true,
        status: "authorizedalways",
        requiresSettings: false,
        backgroundRequired: false,
      };
    }

    return {
      granted: false,
      status: normalized || "denied",
      requiresSettings: normalized === "denied" || normalized === "restricted",
      backgroundRequired: false,
    };
  }

  return {
    granted: true,
    status: "granted",
    requiresSettings: false,
    backgroundRequired: false,
  };
};

export const startNativeLocationTracking = async ({
  activeJob = false,
  onLocation,
  onError,
  minimumIntervalMs = 15000,
  minimumDistanceMeters = 20,
}) => {
  if (!onLocation || typeof onLocation !== "function") {
    return null;
  }

  if (Platform.OS === "ios") {
    const nativeManager = requireNativeLocationManager();
    const emitter = new NativeEventEmitter(nativeManager);

    iosLocationSubscription?.remove();
    iosErrorSubscription?.remove();
    iosLocationSubscription = emitter.addListener("location", onLocation);
    iosErrorSubscription = emitter.addListener("locationError", (error) => {
      if (typeof onError === "function") {
        onError(error);
      }
    });
    try {
      await nativeManager.startTracking(activeJob);
    } catch (error) {
      iosLocationSubscription?.remove();
      iosErrorSubscription?.remove();
      iosLocationSubscription = null;
      iosErrorSubscription = null;
      throw error;
    }
    return "ios-native";
  }

  const nativeManager = requireAndroidLocationManager();
  const emitter = new NativeEventEmitter(nativeManager);
  androidLocationSubscription?.remove();
  androidErrorSubscription?.remove();
  androidLocationSubscription = emitter.addListener(
    "NativeLocationUpdate",
    onLocation
  );
  androidErrorSubscription = emitter.addListener(
    "NativeLocationError",
    (error) => {
      if (typeof onError === "function") {
        onError(error);
      }
    }
  );

  try {
    await nativeManager.startTracking({
      activeJob,
      minimumIntervalMs,
      minimumDistanceMeters,
    });
  } catch (error) {
    androidLocationSubscription?.remove();
    androidErrorSubscription?.remove();
    androidLocationSubscription = null;
    androidErrorSubscription = null;
    throw error;
  }
  return "android-native";
};

export const stopNativeLocationTracking = async (watchId) => {
  if (Platform.OS === "ios" && watchId === "ios-native") {
    iosLocationSubscription?.remove();
    iosErrorSubscription?.remove();
    iosLocationSubscription = null;
    iosErrorSubscription = null;
    await iosLocationManager?.stopTracking();
    return;
  }

  if (Platform.OS === "android" && watchId === "android-native") {
    androidLocationSubscription?.remove();
    androidErrorSubscription?.remove();
    androidLocationSubscription = null;
    androidErrorSubscription = null;
    await requireAndroidLocationManager().stopTracking();
  }
};

export const getCurrentNativeLocation = async ({ timeoutMs = 20000 } = {}) => {
  if (Platform.OS === "ios") {
    return requireNativeLocationManager().getCurrentLocation();
  }

  const location = await requireAndroidLocationManager().getCurrentPosition(timeoutMs);
  return {
    coords: {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
    },
    timestamp: location.timestamp,
  };
};
