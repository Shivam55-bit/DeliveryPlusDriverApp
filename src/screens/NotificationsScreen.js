import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import AppIcon from "../components/common/AppIcon";
import {
  fetchDriverNotifications,
  getDriverNotificationsCache,
  loadPersistedDriverNotifications,
  markDriverNotificationAsRead,
  markAllDriverNotificationsAsRead,
  subscribeNotifications,
  subscribeUnreadCount,
  getDriverUnreadCount,
} from "../services/notificationService";
import { OPERATIONAL_TIMEZONE } from "../utils/jobHelpers";

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
  if (
    normalizedType.includes("job") ||
    normalizedType.includes("assign") ||
    normalizedType.includes("dispatch")
  ) {
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

  if (normalizedType.includes("cancel") || normalizedType.includes("remove")) {
    return {
      library: "MaterialCommunityIcons",
      name: "alert-octagon-outline",
      color: "#EF4444",
      backgroundColor: "#FEE2E2",
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
    if (diffDays < 7) return `${diffDays} days ago`;

    // Operational Sydney timezone date formatting
    return d.toLocaleDateString("en-AU", {
      timeZone: OPERATIONAL_TIMEZONE,
      day: "numeric",
      month: "short",
    });
  } catch {
    return "Recently";
  }
};

const NotificationCard = React.memo(({ item, onPress }) => {
  const icon = getNotificationIcon(item.type);
  const isUnread = Boolean(item.unread || !item.isRead);

  return (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        isUnread && styles.notificationCardUnread,
      ]}
      activeOpacity={0.88}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.details || item.body || item.message}`}
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
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {item.title}
          </Text>

          {isUnread ? <View style={styles.unreadDot} /> : null}
        </View>

        <Text style={styles.notificationDetails} numberOfLines={2}>
          {item.details || item.body || item.message}
        </Text>

        {(item.jobNumber || item.jobId) ? (
          <View style={styles.jobTagRow}>
            <View style={styles.jobTagPill}>
              <AppIcon
                library="MaterialCommunityIcons"
                name="clipboard-text-outline"
                size={11}
                color={COLORS.blue600}
              />
              <Text style={styles.jobTagText}>
                {item.jobNumber || `Job #${String(item.jobId).slice(-6)}`}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.notificationMeta}>
        <Text style={styles.notificationTime} numberOfLines={1}>
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
});

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const isMountedRef = useRef(true);

  const loadNotifications = useCallback(async ({ silent = false, force = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setFetchError(null);

    // Instant cache hydration
    try {
      const cached = getDriverNotificationsCache() || (await loadPersistedDriverNotifications());
      if (cached && Array.isArray(cached) && isMountedRef.current) {
        setNotifications(cached);
        setUnreadCount(getDriverUnreadCount());
        setLoading(false);
      }
    } catch {}

    try {
      const result = await fetchDriverNotifications({ force });
      if (isMountedRef.current && result) {
        setNotifications(result.notifications || []);
        setUnreadCount(result.unreadCount || 0);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setFetchError(err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadNotifications({ silent: false, force: false });

    const unsubscribeNotifications = subscribeNotifications((list) => {
      if (isMountedRef.current) {
        setNotifications(list);
      }
    });

    const unsubscribeUnread = subscribeUnreadCount((count) => {
      if (isMountedRef.current) {
        setUnreadCount(count);
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribeNotifications();
      unsubscribeUnread();
    };
  }, [loadNotifications]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications({ silent: true, force: true });
    }, [loadNotifications])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications({ silent: true, force: true });
  }, [loadNotifications]);

  const handleNotificationPress = useCallback(
    async (item) => {
      if (!item.isRead) {
        markDriverNotificationAsRead(item.id || item._id);
      }

      const jobId = item.jobId || item.job?._id || item.job?.id || item.data?.jobId;
      if (jobId) {
        navigation?.navigate("JobDetail", { jobId, id: jobId });
        return;
      }

      if (String(item.type).toLowerCase().includes("payment")) {
        navigation?.navigate("PaymentMethods");
        return;
      }
    },
    [navigation]
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllDriverNotificationsAsRead();
  }, []);

  const renderNotification = useCallback(
    ({ item }) => (
      <NotificationCard
        item={item}
        onPress={handleNotificationPress}
      />
    ),
    [handleNotificationPress]
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
                ? `You have ${unreadCount} unread update${unreadCount > 1 ? "s" : ""}`
                : "All notifications are caught up"}
            </Text>
          </View>

          {unreadCount > 0 ? (
            <TouchableOpacity
              style={styles.markAllReadButton}
              onPress={handleMarkAllRead}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
            >
              <Text style={styles.markAllReadText}>Mark all read</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>RECENT ACTIVITY</Text>
            <Text style={styles.sectionTitle}>Latest updates</Text>
          </View>

          <View style={styles.totalPill}>
            <Text style={styles.totalPillText}>
              {notifications.length}
            </Text>
          </View>
        </View>

        {loading && notifications.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.blue600} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.id || item._id)}
            renderItem={renderNotification}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: 130 + insets.bottom,
              },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[COLORS.blue600]}
                tintColor={COLORS.blue600}
              />
            }
            ItemSeparatorComponent={() => (
              <View style={styles.cardGap} />
            )}
            ListEmptyComponent={
              fetchError && notifications.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={[styles.emptyIcon, { backgroundColor: "#FEE2E2" }]}>
                    <AppIcon
                      library="Ionicons"
                      name="alert-circle-outline"
                      size={44}
                      color={COLORS.danger}
                    />
                  </View>

                  <Text style={styles.emptyTitle}>
                    Unable to load notifications
                  </Text>

                  <Text style={styles.emptySubtitle}>
                    Could not connect to the notification service. Please check your connection and retry.
                  </Text>

                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => loadNotifications({ force: true })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <AppIcon
                      library="Ionicons"
                      name="notifications-outline"
                      size={44}
                      color={COLORS.blue500}
                    />
                  </View>

                  <Text style={styles.emptyTitle}>
                    No notifications yet
                  </Text>

                  <Text style={styles.emptySubtitle}>
                    When dispatch assigns jobs, updates your schedule, or sends alerts, they will appear here.
                  </Text>
                </View>
              )
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

  markAllReadButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
  },

  markAllReadText: {
    color: COLORS.blue600,
    fontSize: 12,
    fontWeight: "700",
  },

  content: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 12,
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
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  totalPill: {
    minWidth: 38,
    height: 32,
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

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: "600",
  },

  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },

  cardGap: {
    height: 12,
  },

  notificationCard: {
    minHeight: 100,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#193D63",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  notificationCardUnread: {
    backgroundColor: COLORS.unreadBackground,
    borderColor: COLORS.unreadBorder,
  },

  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
    fontSize: 15,
    fontWeight: "800",
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
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "500",
  },

  jobTagRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },

  jobTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#EAF4FF",
  },

  jobTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.blue600,
  },

  notificationMeta: {
    marginLeft: 10,
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 48,
    flexShrink: 0,
  },

  notificationTime: {
    maxWidth: 72,
    color: COLORS.subtle,
    fontSize: 10.5,
    fontWeight: "700",
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
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: "#E7F3FF",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 18,
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },

  emptySubtitle: {
    marginTop: 7,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.navy900,
  },

  retryButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
});
