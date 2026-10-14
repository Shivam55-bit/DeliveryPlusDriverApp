import { buildLocationPayload } from "../locationTrackingService";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock("react-native", () => {
  return {
    Alert: { alert: jest.fn() },
    Geolocation: {
      requestAuthorization: jest.fn(),
      getAuthorization: jest.fn(() => "authorizedalways"),
      watchPosition: jest.fn(() => 1),
      clearWatch: jest.fn(),
      getCurrentPosition: jest.fn((success) => success({ coords: { latitude: -33.8688, longitude: 151.2093 } })),
    },
    PermissionsAndroid: {
      PERMISSIONS: { ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION", ACCESS_BACKGROUND_LOCATION: "android.permission.ACCESS_BACKGROUND_LOCATION" },
      RESULTS: { GRANTED: "granted", DENIED: "denied" },
      check: jest.fn(() => true),
      requestMultiple: jest.fn(() => ({
        "android.permission.ACCESS_FINE_LOCATION": "granted",
        "android.permission.ACCESS_BACKGROUND_LOCATION": "granted",
      })),
    },
    NativeModules: {},
    Platform: { OS: "ios", Version: 17 },
  };
});

jest.mock("../api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
  getAuthToken: jest.fn(),
  getStoredAuthToken: jest.fn(),
  getStoredUser: jest.fn(),
}));

describe("buildLocationPayload", () => {
  it("returns only valid coordinates from a fresh real location fix", () => {
    expect(
      buildLocationPayload({
        coords: {
          latitude: -33.8688,
          longitude: 151.2093,
          accuracy: 8,
          heading: 90,
          speed: 4,
        },
        age: 1000,
        timestamp: "2026-10-09T12:00:00.000Z",
      })
    ).toEqual({ latitude: -33.8688, longitude: 151.2093 });
  });

  it.each([
    ["missing coordinates", { coords: {} }],
    ["invalid latitude", { coords: { latitude: 91, longitude: 10 } }],
    ["invalid longitude", { coords: { latitude: 10, longitude: -181 } }],
    ["non-finite values", { coords: { latitude: NaN, longitude: 10 } }],
    ["simulated locations", { coords: { latitude: 10, longitude: 10 }, mock: true }],
    ["SDK samples", { coords: { latitude: 10, longitude: 10 }, sample: true }],
    ["stale locations", { coords: { latitude: 10, longitude: 10 }, age: 120001 }],
  ])("rejects %s", (_description, location) => {
    expect(buildLocationPayload(location)).toBeNull();
  });
});
