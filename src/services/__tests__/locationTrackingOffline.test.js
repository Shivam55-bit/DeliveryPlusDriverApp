const mockAsyncStorage = {
  removeItem: jest.fn(),
  setItem: jest.fn(),
};
const mockApi = {
  post: jest.fn(),
  put: jest.fn(),
};
const mockAuthToken = "unit-test-driver-token";
let mockLocationCallback;

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: "active",
  },
  Platform: { OS: "android" },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

jest.mock("../api", () => ({
  __esModule: true,
  default: mockApi,
  getAuthToken: jest.fn(() => mockAuthToken),
  getStoredAuthToken: jest.fn(async () => mockAuthToken),
  getStoredUser: jest.fn(async () => ({
    id: "unit-test-driver",
    email: "driver@example.test",
  })),
  tryRequest: jest.fn((request, endpoints) => request(endpoints[0])),
}));

jest.mock("../nativeLocationService", () => ({
  getAndroidLocationPermissionStatus: jest.fn(),
  getCurrentNativeLocation: jest.fn(),
  getNativeLocationPermissionState: jest.fn(),
  requestNativeLocationPermission: jest.fn(),
  startNativeLocationTracking: jest.fn(async ({ onLocation }) => {
    mockLocationCallback = onLocation;
    return "android-native";
  }),
  stopNativeLocationTracking: jest.fn(async () => undefined),
}));

const { startDriverLocationTracking, stopDriverTrackingAndMarkOffline } =
  require("../locationTrackingService");

const flushCallbacks = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

const startTrackingAndQueueLocation = async () => {
  await startDriverLocationTracking({
    user: { id: "unit-test-driver", email: "driver@example.test" },
    permissionGranted: true,
    serverConfirmedOnline: true,
  });
  mockLocationCallback({
    coords: { latitude: 1, longitude: 2 },
    timestamp: Date.now(),
  });
  await flushCallbacks();
};

describe("driver location Offline ordering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationCallback = null;
  });

  it("waits for an in-flight location upload before calling the Offline endpoint and blocks new fixes", async () => {
    const events = [];
    let resolveLocationUpload;
    const locationUpload = new Promise((resolve) => {
      resolveLocationUpload = resolve;
    });
    mockApi.post.mockImplementation((path) => {
      if (path === "/drivers/me/location") {
        events.push("location");
        return locationUpload;
      }
      events.push("offline");
      return Promise.resolve({ success: true });
    });

    await startTrackingAndQueueLocation();
    expect(mockApi.post).toHaveBeenCalledWith(
      "/drivers/me/location",
      { latitude: 1, longitude: 2 },
      expect.any(Object)
    );

    const offlinePromise = stopDriverTrackingAndMarkOffline();
    await flushCallbacks();
    mockLocationCallback({
      coords: { latitude: 3, longitude: 4 },
      timestamp: Date.now(),
    });
    await flushCallbacks();

    expect(events).toEqual(["location"]);
    expect(mockApi.post).toHaveBeenCalledTimes(1);

    resolveLocationUpload({ success: true });
    await offlinePromise;

    expect(events).toEqual(["location", "offline"]);
    expect(mockApi.post).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failed location upload after Offline begins", async () => {
    const events = [];
    let rejectLocationUpload;
    const locationUpload = new Promise((_resolve, reject) => {
      rejectLocationUpload = reject;
    });
    locationUpload.catch(() => undefined);
    mockApi.post.mockImplementation((path) => {
      if (path === "/drivers/me/location") {
        events.push("location");
        return locationUpload;
      }
      events.push("offline");
      return Promise.resolve({ success: true });
    });

    await startTrackingAndQueueLocation();
    expect(mockApi.post).toHaveBeenCalledWith(
      "/drivers/me/location",
      { latitude: 1, longitude: 2 },
      expect.any(Object)
    );
    const offlinePromise = stopDriverTrackingAndMarkOffline();
    await flushCallbacks();
    rejectLocationUpload(new Error("network unavailable"));
    await offlinePromise;

    expect(events).toEqual(["location", "offline"]);
    expect(mockApi.post).toHaveBeenCalledTimes(2);
  });
});
