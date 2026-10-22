import {
  NOTIFICATION_CHANNELS,
  handleNotificationNavigation,
  displayForegroundNotification,
  requestNotificationPermission,
  registerDeviceToken,
  isNotificationForCurrentDriver,
} from "../src/services/notificationService";
import { navigate, setPendingNotificationTarget } from "../src/navigation/navigationRef";

jest.mock("../src/navigation/navigationRef", () => ({
  navigate: jest.fn(),
  setPendingNotificationTarget: jest.fn(),
}));

jest.mock("@react-native-firebase/messaging", () => {
  return {
    getMessaging: jest.fn(() => ({
      getToken: jest.fn().mockResolvedValue("mock-fcm-token-12345"),
      requestPermission: jest.fn().mockResolvedValue(1),
    })),
    getToken: jest.fn().mockResolvedValue("mock-fcm-token-12345"),
    requestPermission: jest.fn().mockResolvedValue(1),
    onTokenRefresh: jest.fn(),
    onMessage: jest.fn(),
    onNotificationOpenedApp: jest.fn(),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    setBackgroundMessageHandler: jest.fn(),
  };
});

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue("jobs_urgent"),
    displayNotification: jest.fn().mockResolvedValue("notif_id_1"),
    onForegroundEvent: jest.fn(),
    onBackgroundEvent: jest.fn(),
    getInitialNotification: jest.fn().mockResolvedValue(null),
  },
  AndroidImportance: {
    HIGH: 4,
    DEFAULT: 3,
    LOW: 2,
  },
  EventType: {
    PRESS: 1,
  },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn().mockResolvedValue(null),
  getItem: jest.fn().mockResolvedValue("mock-auth-token"),
  removeItem: jest.fn().mockResolvedValue(null),
  multiRemove: jest.fn().mockResolvedValue(null),
}));

jest.mock("../src/services/api", () => {
  return {
    __esModule: true,
    default: {
      post: jest.fn().mockResolvedValue({ success: true, message: "Token registered" }),
    },
    getStoredAuthToken: jest.fn().mockResolvedValue("mock-auth-token"),
    getStoredUser: jest.fn().mockResolvedValue({ _id: "driver-test-123", name: "Test Driver" }),
  };
});

describe("Notification Service Audit & Verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("defines high importance notification channels", () => {
    expect(NOTIFICATION_CHANNELS.JOBS_URGENT.importance).toBe(4);
    expect(NOTIFICATION_CHANNELS.JOBS_URGENT.id).toBe("jobs_urgent");
  });

  test("handleNotificationNavigation correctly routes to JobDetail when jobId is present", async () => {
    const remoteMessage = {
      data: {
        jobId: "job-00120",
        type: "JOB_ASSIGNED",
      },
    };

    await handleNotificationNavigation(remoteMessage);
    expect(navigate).toHaveBeenCalledWith("JobDetail", { jobId: "job-00120", id: "job-00120" });
  });

  test("handleNotificationNavigation routes to PaymentMethods for payment notifications", async () => {
    const remoteMessage = {
      data: {
        type: "PAYMENT_RECEIVED",
      },
    };

    await handleNotificationNavigation(remoteMessage);
    expect(navigate).toHaveBeenCalledWith("PaymentMethods");
  });

  test("handleNotificationNavigation defaults to Notifications when no jobId is present", async () => {
    const remoteMessage = {
      data: {
        type: "ANNOUNCEMENT",
      },
    };

    await handleNotificationNavigation(remoteMessage);
    expect(navigate).toHaveBeenCalledWith("Notifications");
  });

  test("handleNotificationNavigation routes to JobDetail with jobNumber when present", async () => {
    const remoteMessage = {
      data: {
        jobNumber: "JOB-9922",
        type: "NEW_JOB_ASSIGNED",
      },
    };

    await handleNotificationNavigation(remoteMessage);
    expect(navigate).toHaveBeenCalledWith("JobDetail", {
      jobId: null,
      id: null,
      jobNumber: "JOB-9922",
    });
  });

  test("redactToken masks sensitive tokens safely", () => {
    const { redactToken } = require("../src/services/notificationService");
    expect(redactToken("fcm_token_1234567890abcdef")).toBe("fcm_toke...abcdef");
    expect(redactToken("short")).toBe("[REDACTED]");
    expect(redactToken(null)).toBe("none");
  });

  test("getOrCreateDeviceId generates and returns a persistent deviceId", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    const { getOrCreateDeviceId } = require("../src/services/notificationService");
    const deviceId = await getOrCreateDeviceId("driver_123");
    expect(typeof deviceId).toBe("string");
    expect(deviceId).toContain("driver_123");
  });

  test("displayForegroundNotification suppresses duplicate Notifee popup on iOS when notification block exists", async () => {
    const notifee = require("@notifee/react-native").default;
    const remoteMessage = {
      notification: {
        title: "New Job Assigned",
        body: "Job #JOB-101 has been assigned to you",
      },
      data: {
        jobId: "job-101",
      },
    };

    // On iOS, native UNUserNotificationCenter willPresentNotification already displays the alert
    await displayForegroundNotification(remoteMessage);
    // Notifee should NOT be invoked to prevent duplicate stacked banners
    expect(notifee.displayNotification).not.toHaveBeenCalled();
  });

  test("displayForegroundNotification displays Notifee popup on iOS for data-only push", async () => {
    const notifee = require("@notifee/react-native").default;
    const remoteMessage = {
      data: {
        title: "Operational Alert",
        body: "Schedule updated for today",
        jobId: "job-202",
      },
    };

    await displayForegroundNotification(remoteMessage);
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Operational Alert",
        body: "Schedule updated for today",
      })
    );
  });

  test("isNotificationForCurrentDriver accepts notifications assigned to current driver", async () => {
    const { getStoredUser } = require("../src/services/api");
    getStoredUser.mockResolvedValueOnce({
      _id: "user-shivam-101",
      driverId: "driver-shivam-99",
      email: "shivam@deliveryplus.tech",
    });

    const targetPayload = {
      data: {
        jobId: "job-8899",
        assignedDriverId: "driver-shivam-99",
      },
    };

    const isForMe = await isNotificationForCurrentDriver(targetPayload);
    expect(isForMe).toBe(true);
  });

  test("isNotificationForCurrentDriver strictly drops notifications assigned to a different driver", async () => {
    const { getStoredUser } = require("../src/services/api");
    getStoredUser.mockResolvedValueOnce({
      _id: "user-shivam-101",
      driverId: "driver-shivam-99",
      email: "shivam@deliveryplus.tech",
    });

    const differentDriverPayload = {
      data: {
        jobId: "job-9999",
        assignedDriverId: "driver-another-person-555",
      },
    };

    const isForMe = await isNotificationForCurrentDriver(differentDriverPayload);
    expect(isForMe).toBe(false);
  });

  test("isNotificationForCurrentDriver permits untagged broadcast/operational announcements", async () => {
    const broadcastPayload = {
      data: {
        title: "All Drivers Update",
        message: "Depot opens 30 minutes earlier tomorrow",
      },
    };

    const isForMe = await isNotificationForCurrentDriver(broadcastPayload);
    expect(isForMe).toBe(true);
  });
});

