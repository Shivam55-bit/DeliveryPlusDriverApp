const mockAndroidLocationManager = {
  getLocationPermissionStatus: jest.fn(),
  requestForegroundPermission: jest.fn(),
  requestBackgroundPermission: jest.fn(),
  openAppLocationSettings: jest.fn(),
  openDeviceLocationSettings: jest.fn(),
  startTracking: jest.fn(),
  stopTracking: jest.fn(),
  getCurrentPosition: jest.fn(),
};
const mockIosLocationManager = {
  startTracking: jest.fn(),
  stopTracking: jest.fn(),
};

jest.mock("react-native", () => {
  return {
    Linking: { openURL: jest.fn() },
    NativeModules: {
      NativeLocationManager: mockIosLocationManager,
      NativeLocationModule: mockAndroidLocationManager,
    },
    NativeEventEmitter: jest.fn().mockImplementation(() => ({
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    })),
    Platform: { OS: "android", Version: 35 },
  };
});

const { NativeEventEmitter, Platform } = require("react-native");
const {
  getAndroidLocationPermissionStatus,
  openLocationSettings,
  requestNativeLocationPermission,
  startNativeLocationTracking,
  stopNativeLocationTracking,
} = require("../nativeLocationService");

const makeStatus = (overrides = {}) => ({
  foregroundGranted: false,
  coarseGranted: false,
  preciseGranted: false,
  precision: "denied",
  backgroundGranted: false,
  locationServicesEnabled: true,
  foregroundPermanentlyDenied: false,
  backgroundPermanentlyDenied: false,
  trackingServiceRunning: false,
  androidVersion: Platform.Version,
  ...overrides,
});

describe("native Android location permissions and tracking", () => {
  let status;
  let requestOrder;

  beforeEach(() => {
    Platform.OS = "android";
    Platform.Version = 35;
    status = makeStatus();
    requestOrder = [];
    jest.clearAllMocks();
    mockAndroidLocationManager.getLocationPermissionStatus.mockImplementation(
      async () => ({ ...status })
    );
    mockAndroidLocationManager.requestForegroundPermission.mockImplementation(
      async () => {
        requestOrder.push("foreground");
        status = makeStatus({
          foregroundGranted: true,
          coarseGranted: true,
          precision: "approximate",
        });
        return { granted: true, canAskAgain: true };
      }
    );
    mockAndroidLocationManager.requestBackgroundPermission.mockImplementation(
      async () => {
        requestOrder.push("background");
        status = makeStatus({
          foregroundGranted: true,
          coarseGranted: true,
          precision: "approximate",
          backgroundGranted: true,
        });
        return { granted: true };
      }
    );
  });

  it("requests foreground first and leaves Android 11+ background access to Settings", async () => {
    const result = await requestNativeLocationPermission({
      requireBackground: true,
    });

    expect(requestOrder).toEqual(["foreground"]);
    expect(mockAndroidLocationManager.requestBackgroundPermission).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      foregroundGranted: true,
      precision: "approximate",
      backgroundGranted: false,
      granted: false,
      requiresSettings: true,
      status: "background_settings_required",
    });
  });

  it("requests Android 10 background permission only after foreground is granted", async () => {
    Platform.Version = 29;

    const result = await requestNativeLocationPermission({
      requireBackground: true,
    });

    expect(requestOrder).toEqual(["foreground", "background"]);
    expect(result.granted).toBe(true);
    expect(result.backgroundGranted).toBe(true);
  });

  it("requires device location services in addition to permission grants", async () => {
    status = makeStatus({
      foregroundGranted: true,
      coarseGranted: true,
      backgroundGranted: true,
      locationServicesEnabled: false,
    });

    const result = await requestNativeLocationPermission({
      requireBackground: true,
    });

    expect(result.granted).toBe(false);
    expect(result.status).toBe("location_services_disabled");
    expect(mockAndroidLocationManager.requestForegroundPermission).not.toHaveBeenCalled();
  });

  it("reads fresh native state and opens Android app settings", async () => {
    status = makeStatus({ foregroundGranted: true, coarseGranted: true });
    await expect(getAndroidLocationPermissionStatus()).resolves.toMatchObject({
      foregroundGranted: true,
      backgroundGranted: false,
    });

    await openLocationSettings();
    expect(mockAndroidLocationManager.openAppLocationSettings).toHaveBeenCalledTimes(1);
  });

  it("starts and stops the Android native location foreground service", async () => {
    const onLocation = jest.fn();
    mockAndroidLocationManager.startTracking.mockResolvedValue(true);
    mockAndroidLocationManager.stopTracking.mockResolvedValue(true);

    await expect(
      startNativeLocationTracking({ activeJob: true, onLocation })
    ).resolves.toBe("android-native");
    expect(mockAndroidLocationManager.startTracking).toHaveBeenCalledWith(
      expect.objectContaining({ activeJob: true })
    );

    await stopNativeLocationTracking("android-native");
    expect(mockAndroidLocationManager.stopTracking).toHaveBeenCalledTimes(1);
  });

  it("rejects iOS startup and removes native event listeners when the bridge refuses tracking", async () => {
    const startupError = new Error(
      "Always location authorization is required for background tracking."
    );
    mockIosLocationManager.startTracking.mockRejectedValue(startupError);
    Platform.OS = "ios";

    await expect(
      startNativeLocationTracking({
        activeJob: false,
        onLocation: jest.fn(),
      })
    ).rejects.toBe(startupError);

    expect(mockIosLocationManager.startTracking).toHaveBeenCalledWith(false);
    const emitter = NativeEventEmitter.mock.results[0].value;
    expect(emitter.addListener).toHaveBeenCalledTimes(2);
    for (const subscription of emitter.addListener.mock.results) {
      expect(subscription.value.remove).toHaveBeenCalledTimes(1);
    }
  });
});
