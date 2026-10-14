import {
  normalizeNotification,
  fetchDriverNotifications,
  fetchDriverUnreadCount,
  markDriverNotificationAsRead,
  markAllDriverNotificationsAsRead,
  addForegroundNotification,
  clearNotificationState,
  subscribeNotifications,
  subscribeUnreadCount,
  getDriverNotificationsCache,
  getDriverUnreadCount,
} from "../notificationService";
import API from "../api";

jest.mock("@react-native-firebase/messaging", () => ({
  getMessaging: jest.fn(() => ({
    getToken: jest.fn().mockResolvedValue("mock-fcm-token"),
    requestPermission: jest.fn().mockResolvedValue(1),
  })),
  getToken: jest.fn().mockResolvedValue("mock-fcm-token"),
  requestPermission: jest.fn().mockResolvedValue(1),
  onTokenRefresh: jest.fn(),
  onMessage: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
  getInitialNotification: jest.fn().mockResolvedValue(null),
}));

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue("jobs_urgent"),
    displayNotification: jest.fn().mockResolvedValue("notif_id_1"),
    onForegroundEvent: jest.fn(),
    getInitialNotification: jest.fn().mockResolvedValue(null),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
  EventType: { PRESS: 1 },
}));

const mockStorage = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn((key, val) => {
    mockStorage[key] = val;
    return Promise.resolve();
  }),
  getItem: jest.fn((key) => Promise.resolve(mockStorage[key] || null)),
  removeItem: jest.fn((key) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue({ success: true }),
    patch: jest.fn().mockResolvedValue({ success: true }),
  },
  getStoredAuthToken: jest.fn().mockResolvedValue("valid-auth-token-123"),
  getStoredUser: jest.fn().mockResolvedValue({ _id: "driver_shivam_123", name: "Shivam" }),
}));

describe("Driver Notification Inbox & Lifecycle Audit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearNotificationState();
  });

  test("normalizeNotification creates consistent shape with read/unread flags and job linkage", () => {
    const raw = {
      _id: "notif_001",
      title: "New Job Assigned",
      message: "You have been assigned to Job #JOB-00146",
      type: "NEW_JOB_ASSIGNED",
      isRead: false,
      job: {
        _id: "job_mongo_id_146",
        jobNumber: "JOB-00146",
      },
      createdAt: "2026-10-13T08:00:00.000Z",
    };

    const normalized = normalizeNotification(raw);
    expect(normalized.id).toBe("notif_001");
    expect(normalized.title).toBe("New Job Assigned");
    expect(normalized.unread).toBe(true);
    expect(normalized.isRead).toBe(false);
    expect(normalized.jobId).toBe("job_mongo_id_146");
    expect(normalized.jobNumber).toBe("JOB-00146");
  });

  test("fetchDriverNotifications fetches from /driver/notifications, caches data, and syncs unread count", async () => {
    API.get.mockResolvedValueOnce({
      notifications: [
        {
          _id: "notif_001",
          title: "New Job Assigned",
          body: "Job #JOB-00146 assigned",
          type: "NEW_JOB_ASSIGNED",
          isRead: false,
        },
        {
          _id: "notif_002",
          title: "Job Rescheduled",
          body: "Job #JOB-00147 time updated",
          type: "JOB_UPDATED",
          isRead: true,
        },
      ],
      unreadCount: 1,
    });

    const result = await fetchDriverNotifications();
    expect(API.get).toHaveBeenCalledWith("/driver/notifications", expect.anything());
    expect(result.notifications).toHaveLength(2);
    expect(result.unreadCount).toBe(1);

    // Synchronous memory cache check
    expect(getDriverNotificationsCache()).toHaveLength(2);
    expect(getDriverUnreadCount()).toBe(1);
  });

  test("addForegroundNotification prepends incoming FCM push and notifies subscribers immediately", async () => {
    const subscriberMock = jest.fn();
    const unreadSubscriberMock = jest.fn();

    const unsubNotif = subscribeNotifications(subscriberMock);
    const unsubUnread = subscribeUnreadCount(unreadSubscriberMock);

    // Initial state: 0 notifications
    expect(getDriverNotificationsCache()).toBeNull();

    // Foreground push arrives
    const remoteMessage = {
      messageId: "fcm_msg_999",
      notification: {
        title: "Urgent Dispatch Alert",
        body: "Customer requested gate access pin.",
      },
      data: {
        type: "JOB_UPDATED",
        jobId: "job_999",
        jobNumber: "JOB-00999",
      },
    };

    API.get.mockResolvedValueOnce({ notifications: [], unreadCount: 0 });

    await addForegroundNotification(remoteMessage);

    const cache = getDriverNotificationsCache();
    expect(cache).toHaveLength(1);
    expect(cache[0].id).toBe("fcm_msg_999");
    expect(cache[0].title).toBe("Urgent Dispatch Alert");
    expect(cache[0].unread).toBe(true);
    expect(getDriverUnreadCount()).toBe(1);

    expect(subscriberMock).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: "fcm_msg_999" })]));
    expect(unreadSubscriberMock).toHaveBeenCalledWith(1);

    unsubNotif();
    unsubUnread();
  });

  test("markDriverNotificationAsRead updates optimistic state and calls API", async () => {
    API.get.mockResolvedValueOnce({
      notifications: [
        {
          _id: "notif_100",
          title: "Test Alert",
          body: "Details",
          isRead: false,
        },
      ],
      unreadCount: 1,
    });

    await fetchDriverNotifications();
    expect(getDriverUnreadCount()).toBe(1);

    await markDriverNotificationAsRead("notif_100");

    const cache = getDriverNotificationsCache();
    expect(cache[0].isRead).toBe(true);
    expect(cache[0].unread).toBe(false);
    expect(getDriverUnreadCount()).toBe(0);

    expect(API.patch).toHaveBeenCalledWith("/driver/notifications/notif_100/read");
  });

  test("markAllDriverNotificationsAsRead marks all read and zeroes unread count", async () => {
    API.get.mockResolvedValueOnce({
      notifications: [
        { _id: "notif_a", isRead: false },
        { _id: "notif_b", isRead: false },
      ],
      unreadCount: 2,
    });

    await fetchDriverNotifications();
    expect(getDriverUnreadCount()).toBe(2);

    await markAllDriverNotificationsAsRead();
    expect(getDriverUnreadCount()).toBe(0);
    const cache = getDriverNotificationsCache();
    expect(cache.every((n) => n.isRead)).toBe(true);

    expect(API.patch).toHaveBeenCalledWith("/driver/notifications/read-all");
  });

  test("clearNotificationState resets in-memory notifications on logout", async () => {
    API.get.mockResolvedValueOnce({
      notifications: [{ _id: "notif_x", isRead: false }],
      unreadCount: 1,
    });
    await fetchDriverNotifications();
    expect(getDriverNotificationsCache()).toHaveLength(1);

    clearNotificationState();
    expect(getDriverNotificationsCache()).toBeNull();
    expect(getDriverUnreadCount()).toBe(0);
  });
});
