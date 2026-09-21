import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import AppIcon from "../components/common/AppIcon";
import API from "../services/api";

const COLORS = {
  navy900: "#071E3B",
  navy800: "#0A315C",
  blue600: "#0F6FBA",
  blue500: "#1598E8",
  background: "#F4F7FB",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  subtle: "#94A3B8",
  border: "#E7EDF5",
  unreadBorder: "#BAE6FD",
  unreadBackground: "#F8FDFF",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#EF4444",
  white: "#FFFFFF",
};

const getNotificationIcon = (type) => {
  const normalizedType = String(type || "").toLowerCase();
  if (normalizedType.includes("job") || normalizedType.includes("assign")) {
    return {
      library: "MaterialCommunityIcons",
      name: "briefcase-plus-outline",
      color: "#0284C7",
      backgroundColor: "#E0F2FE",
    };
  }

  if (normalizedType.includes("payment") || normalizedType.includes("wallet")) {
    return {
      library: "MaterialCommunityIcons",
      name: "wallet-check-outline",
      color: "#16A34A",
      backgroundColor: "#DCFCE7",
    };
  }

  return {
    library: "MaterialCommunityIcons",
    name: "alarm-check",
    color: "#D97706",
    backgroundColor: "#FEF3C7",
  };
};

const formatTimeAgo = (dateInput) => {
  if (!dateInput) return "Just now";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  } catch {
    return "Recently";
  }
};

const NotificationCard = React.memo(
  ({ item, onPress }) => {
    const icon = getNotificationIcon(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          item.unread && styles.notificationCardUnread,
        ]}
        activeOpacity={0.88}
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.details}`}
      >
        <View
          style={[
            styles.notificationIcon,
            { backgroundColor: icon.backgroundColor },
          ]}
        >
          <AppIcon
            library={icon.library}
            name={icon.name}
            size={24}
            color={icon.color}
          />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationTitleRow}>
            <Text
              style={styles.notificationTitle}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            {item.unread ? (
              <View style={styles.unreadDot} />
            ) : null}
          </View>

          <Text
            style={styles.notificationDetails}
            numberOfLines={2}
          >
            {item.details || item.body || item.message}
          </Text>
        </View>

        <View style={styles.notificationMeta}>
          <Text
            style={styles.notificationTime}
            numberOfLines={1}
          >
            {item.timeFormatted || formatTimeAgo(item.createdAt || item.timestamp)}
          </Text>

          <AppIcon
            library="Feather"
            name="chevron-right"
            size={18}
            color={COLORS.subtle}
          />
        </View>
      </TouchableOpacity>
    );
  }
);

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await API.get("/notifications");
      const rawList = res?.notifications || res?.data?.notifications || (Array.isArray(res) ? res : []);
      const normalized = rawList.map((item, idx) => ({
        id: item._id || item.id || `notif_${idx}`,
        title: item.title || "Notification",
        details: item.message || item.body || item.details || "",
        type: item.type || (item.data?.type || "job"),
        unread: item.read === false || item.unread === true || item.isRead === false,
        jobId: item.jobId || item.data?.jobId || item.data?.id,
        createdAt: item.createdAt || item.timestamp,
        timeFormatted: formatTimeAgo(item.createdAt || item.timestamp),
      }));
      setNotifications(normalized);
    } catch (err) {
      console.log("[Notifications] API load error:", err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) => notification.unread
      ).length,
    [notifications]
  );

  const handleNotificationPress = async (item) => {
    // 1. Mark as read locally and on backend
    if (item.unread) {
      setNotifications((previous) =>
        previous.map((n) =>
          n.id === item.id ? { ...n, unread: false } : n
        )
      );

      try {
        await API.patch(`/notifications/${item.id}/read`).catch(() => {
          return API.put(`/notifications/${item.id}/read`);
        });
      } catch (e) {
        // quiet fallback
      }
    }

    // 2. Navigate based on notification content
    if (item.jobId) {
      navigation?.navigate("JobDetail", { jobId: item.jobId, id: item.jobId });
      return;
    }

    if (String(item.type).toLowerCase().includes("payment")) {
      navigation?.navigate("PaymentMethods");
      return;
    }
  };

  const markAllRead = async () => {
    setNotifications((previous) =>
      previous.map((item) => ({
        ...item,
        unread: false,
      }))
    );

    try {
      await API.patch("/notifications/read-all").catch(() => {
        return API.put("/notifications/read-all");
      });
    } catch (err) {
      console.log("[Notifications] Mark all read error:", err?.message);
    }
  };

  const renderNotification = ({ item }) => (
    <NotificationCard
      item={item}
      onPress={handleNotificationPress}
    />
  );

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.white}
        translucent={false}
      />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.summaryText}>
              {unreadCount > 0
                ? `${unreadCount} unread ${
                    unreadCount === 1 ? "notification" : "notifications"
                  }`
                : "You are all caught up"}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.markAllButton,
              unreadCount === 0 && styles.markAllButtonDisabled,
            ]}
            onPress={markAllRead}
            disabled={unreadCount === 0}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
          >
            <AppIcon
              library="MaterialCommunityIcons"
              name="check-all"
              size={17}
              color={unreadCount === 0 ? COLORS.subtle : COLORS.blue600}
            />
            <Text
              style={[
                styles.markAllText,
                unreadCount === 0 && styles.markAllTextDisabled,
              ]}
            >
              Mark all read
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>
              RECENT ACTIVITY
            </Text>
            <Text style={styles.sectionTitle}>
              Latest updates
            </Text>
          </View>

          <View style={styles.totalPill}>
            <Text style={styles.totalPillText}>
              {notifications.length}
            </Text>
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.blue600} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderNotification}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.blue600]}
                tintColor={COLORS.blue600}
              />
            }
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: 130 + insets.bottom,
              },
            ]}
            ItemSeparatorComponent={() => (
              <View style={styles.cardGap} />
            )}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <AppIcon
                    library="Ionicons"
                    name="notifications-off-outline"
                    size={44}
                    color={COLORS.blue500}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  No notifications yet
                </Text>

                <Text style={styles.emptySubtitle}>
                  Job alerts and account updates will appear here.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },

  headerTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  summaryText: {
    marginTop: 2,
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "500",
  },

  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "rgba(15, 111, 186, 0.15)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  markAllButtonDisabled: {
    backgroundColor: "#F8FAFC",
    borderColor: "rgba(148, 163, 184, 0.15)",
  },

  markAllText: {
    color: COLORS.blue600,
    fontSize: 12,
    fontWeight: "700",
  },

  markAllTextDisabled: {
    color: COLORS.subtle,
  },

  content: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  sectionEyebrow: {
    color: COLORS.blue500,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.45,
  },

  sectionTitle: {
    marginTop: 4,
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  totalPill: {
    minWidth: 38,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: "#E7F3FF",
    alignItems: "center",
    justifyContent: "center",
  },

  totalPillText: {
    color: COLORS.blue600,
    fontSize: 13,
    fontWeight: "900",
  },

  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },

  cardGap: {
    height: 12,
  },

  notificationCard: {
    minHeight: 104,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#193D63",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },

  notificationCardUnread: {
    backgroundColor:
      COLORS.unreadBackground,
    borderColor: COLORS.unreadBorder,
  },

  notificationIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
    flexShrink: 0,
  },

  notificationContent: {
    flex: 1,
    minWidth: 0,
  },

  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  notificationTitle: {
    flexShrink: 1,
    color: COLORS.text,
    fontSize: 15.5,
    fontWeight: "900",
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.blue500,
    marginLeft: 7,
    flexShrink: 0,
  },

  notificationDetails: {
    marginTop: 5,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },

  notificationMeta: {
    marginLeft: 10,
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 52,
    flexShrink: 0,
  },

  notificationTime: {
    maxWidth: 72,
    color: COLORS.subtle,
    fontSize: 10.5,
    fontWeight: "800",
    textAlign: "right",
  },

  emptyCard: {
    marginTop: 42,
    minHeight: 260,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },

  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 30,
    backgroundColor: "#E7F3FF",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 18,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },

  emptySubtitle: {
    marginTop: 7,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
