import {
  NOTIFICATION_CHANNELS,
  handleNotificationNavigation,
  displayForegroundNotification,
  requestNotificationPermission,
  registerDeviceToken,
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

  test("handleNotificationNavigation correctly routes to JobDetail when jobId is present", () => {
    const remoteMessage = {
      data: {
        jobId: "job-00120",
        type: "JOB_ASSIGNED",
      },
    };

    handleNotificationNavigation(remoteMessage);
    expect(navigate).toHaveBeenCalledWith("JobDetail", { jobId: "job-00120", id: "job-00120" });
  });

  test("handleNotificationNavigation routes to PaymentMethods for payment notifications", () => {
    const remoteMessage = {
      data: {
        type: "PAYMENT_RECEIVED",
      },
    };

    handleNotificationNavigation(remoteMessage);
    expect(navigate).toHaveBeenCalledWith("PaymentMethods");
  });

  test("handleNotificationNavigation defaults to Notifications when no jobId is present", () => {
    const remoteMessage = {
      data: {
        type: "ANNOUNCEMENT",
      },
    };

    handleNotificationNavigation(remoteMessage);
    expect(navigate).toHaveBeenCalledWith("Notifications");
  });

  test("requestNotificationPermission returns boolean", async () => {
    const result = await requestNotificationPermission();
    expect(typeof result).toBe("boolean");
  });

  test("registerDeviceToken retrieves token and posts to backend", async () => {
    const token = await registerDeviceToken("explicit-token-abc");
    expect(token).toBe("explicit-token-abc");
  });
});
