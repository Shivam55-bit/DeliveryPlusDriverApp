import API from "../api";
import {
  fetchAuthenticatedDriverProfile,
  normaliseDriverProfile,
  updateAuthenticatedDriverProfile,
  validateDriverProfileUpdates,
} from "../driverProfile";

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

describe("normaliseDriverProfile", () => {
  test("normalizes the authenticated user response without treating its ID as a driver ID", () => {
    expect(
      normaliseDriverProfile({
        user: {
          _id: "user-123456",
          name: "Alex Driver",
          email: "alex@example.com",
          phone: "5551234567",
          isOnline: true,
          vehicle: { registrationNumber: "ABC123" },
        },
      })
    ).toEqual({
      name: "Alex Driver",
      email: "alex@example.com",
      phone: "5551234567",
      driverId: null,
      vehicle: { registrationNumber: "ABC123" },
      profileImage: null,
      isOnline: true,
      isVerified: false,
      isApproved: false,
      rating: 0,
    });
  });

  test("uses a linked driver profile ID and its details", () => {
    const normalized = normaliseDriverProfile({
      user: {
        _id: "user-1",
        name: "Alex Driver",
        email: "alex@example.com",
        driverProfile: {
          _id: "driver-42",
          phoneNumber: "5551234567",
          assignedVehicle: { type: "Van" },
        },
      },
    });

    expect(normalized.driverId).toBe("driver-42");
    expect(normalized.phone).toBe("5551234567");
    expect(normalized.vehicle).toEqual({ type: "Van" });
  });

  test("extracts driverId from driverCode, driver_id, or driverNumber fields", () => {
    expect(
      normaliseDriverProfile({
        user: { name: "Shivam" },
        driverCode: "DRV-00155",
      }).driverId
    ).toBe("DRV-00155");

    expect(
      normaliseDriverProfile({
        user: { name: "Shivam", driver_id: "DP-8821" },
      }).driverId
    ).toBe("DP-8821");

    expect(
      normaliseDriverProfile({
        user: { name: "Shivam" },
        driver: { driverNumber: "1004" },
      }).driverId
    ).toBe("1004");
  });

  test("uses explicit empty-state values for missing profile fields", () => {
    expect(normaliseDriverProfile({ user: {} })).toMatchObject({
      name: "Name not provided",
      email: "Not provided",
      phone: "Not provided",
      driverId: null,
      isOnline: null,
    });
  });

  test("rejects an empty profile response", () => {
    expect(normaliseDriverProfile({ data: null })).toBeNull();
  });

  test("validates editable name and phone fields", () => {
    expect(
      validateDriverProfileUpdates({
        name: "A",
        phone: "123",
      })
    ).toEqual({
      name: "Enter a name with at least 2 characters.",
      phone: "Enter a valid phone number.",
    });
    expect(
      validateDriverProfileUpdates({
        name: "Alex Driver",
        phone: "+1 (555) 123-4567",
      })
    ).toEqual({});
  });

  test("allows a missing phone so a driver can add one", () => {
    expect(
      validateDriverProfileUpdates({ name: "Alex Driver", phone: "" })
    ).toEqual({});
  });
});

describe("authenticated driver profile API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads the authenticated profile with a finite timeout", async () => {
    API.get.mockResolvedValue({ user: { name: "Alex Driver" } });
    const controller = new AbortController();

    await expect(
      fetchAuthenticatedDriverProfile({ signal: controller.signal })
    ).resolves.toMatchObject({ name: "Alex Driver" });
    expect(API.get).toHaveBeenCalledWith("/auth/me", {
      timeout: 15000,
      signal: controller.signal,
    });
  });

  test.each([
    ["network errors", Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" })],
    ["timeouts", Object.assign(new Error("timeout"), { code: "ECONNABORTED" })],
    ["expired sessions", Object.assign(new Error("Unauthorized"), { response: { status: 401 } })],
    ["server errors", Object.assign(new Error("Server error"), { response: { status: 500 } })],
  ])("surfaces %s instead of returning fallback profile data", async (_label, error) => {
    API.get.mockRejectedValue(error);

    await expect(fetchAuthenticatedDriverProfile()).rejects.toBe(error);
  });

  test("updates only driver-editable name and phone fields", async () => {
    API.put.mockResolvedValue({ success: true });

    await updateAuthenticatedDriverProfile({
      name: "Alex Driver",
      phone: "5551234567",
      email: "not-submitted@example.com",
      vehicle: { type: "Not editable" },
    });

    expect(API.put).toHaveBeenCalledWith(
      "/driver/profile",
      { name: "Alex Driver", phone: "5551234567" },
      { timeout: 15000 }
    );
  });

  test("surfaces failed profile updates", async () => {
    const error = Object.assign(new Error("Update failed"), {
      response: { status: 500, data: { message: "Update failed" } },
    });
    API.put.mockRejectedValue(error);

    await expect(
      updateAuthenticatedDriverProfile({
        name: "Alex Driver",
        phone: "5551234567",
      })
    ).rejects.toBe(error);
  });
});
