import React, { useMemo, useState } from "react";
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";

import AppIcon from "../components/common/AppIcon";

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

const initialNotifications = [
  {
    id: "N1",
    title: "New job assigned",
    details: "Connaught Place → Gurgaon",
    time: "2 min ago",
    type: "job",
    unread: true,
  },
  {
    id: "N2",
    title: "Payment received",
    details: "Payment credited to your wallet",
    time: "1 hr ago",
    type: "payment",
    unread: true,
  },
  {
    id: "N3",
    title: "Reminder",
    details: "Upload proof for completed job #DP1258",
    time: "Yesterday",
    type: "reminder",
    unread: false,
  },
];

const getNotificationIcon = (type) => {
  switch (type) {
    case "job":
      return {
        library: "MaterialCommunityIcons",
        name: "briefcase-plus-outline",
        color: "#0284C7",
        backgroundColor: "#E0F2FE",
      };

    case "payment":
      return {
        library: "MaterialCommunityIcons",
        name: "wallet-check-outline",
        color: "#16A34A",
        backgroundColor: "#DCFCE7",
      };

    case "reminder":
    default:
      return {
        library: "MaterialCommunityIcons",
        name: "alarm-check",
        color: "#D97706",
        backgroundColor: "#FEF3C7",
      };
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
        activeOpacity={0.9}
        onPress={() => onPress(item.id)}
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
            {item.details}
          </Text>
        </View>

        <View style={styles.notificationMeta}>
          <Text
            style={styles.notificationTime}
            numberOfLines={1}
          >
            {item.time}
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

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isSmallPhone = width < 390;

  const [notifications, setNotifications] =
    useState(initialNotifications);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) => notification.unread
      ).length,
    [notifications]
  );

  const toggleRead = (id) => {
    setNotifications((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, unread: false }
          : item
      )
    );
  };

  const markAllRead = () => {
    setNotifications((previous) =>
      previous.map((item) => ({
        ...item,
        unread: false,
      }))
    );
  };

  const renderNotification = ({ item }) => (
    <NotificationCard
      item={item}
      onPress={toggleRead}
    />
  );

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.navy900}
        translucent={false}
      />

      <LinearGradient
        colors={[
          COLORS.navy900,
          COLORS.navy800,
          COLORS.blue600,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.header,
          isSmallPhone && styles.headerSmall,
        ]}
      >
        <View
          pointerEvents="none"
          style={styles.decorCircleLarge}
        />
        <View
          pointerEvents="none"
          style={styles.decorCircleSmall}
        />

        <View style={styles.headerTopRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              ALERTS & ACTIVITY
            </Text>

            <Text style={styles.headerTitle}>
              Notifications
            </Text>

            <Text
              style={styles.headerSubtitle}
              numberOfLines={2}
            >
              Stay updated with your job alerts and account activity.
            </Text>
          </View>

          <View style={styles.headerBadge}>
            <AppIcon
              library="Ionicons"
              name="notifications-outline"
              size={21}
              color={COLORS.white}
            />

            <Text style={styles.headerBadgeCount}>
              {unreadCount}
            </Text>
          </View>
        </View>

        <View style={styles.headerBottomRow}>
          <View style={styles.summaryPill}>
            <View
              style={[
                styles.summaryIndicator,
                unreadCount === 0 &&
                  styles.summaryIndicatorRead,
              ]}
            />

            <Text style={styles.summaryText}>
              {unreadCount > 0
                ? `${unreadCount} unread ${
                    unreadCount === 1
                      ? "notification"
                      : "notifications"
                  }`
                : "You are all caught up"}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.markAllButton,
              unreadCount === 0 &&
                styles.markAllButtonDisabled,
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
              size={18}
              color={
                unreadCount === 0
                  ? "rgba(255,255,255,0.45)"
                  : COLORS.white
              }
            />

            {!isSmallPhone ? (
              <Text
                style={[
                  styles.markAllText,
                  unreadCount === 0 &&
                    styles.markAllTextDisabled,
                ]}
              >
                Mark all read
              </Text>
            ) : null}
          </TouchableOpacity>
        </View>
      </LinearGradient>

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

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom:
                130 + insets.bottom,
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.navy900,
  },

  header: {
    minHeight: 238,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    overflow: "hidden",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerSmall: {
    minHeight: 224,
    paddingHorizontal: 16,
  },

  decorCircleLarge: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -88,
    top: -84,
    backgroundColor:
      "rgba(56, 189, 248, 0.14)",
  },

  decorCircleSmall: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -46,
    bottom: -58,
    backgroundColor:
      "rgba(255, 255, 255, 0.06)",
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    zIndex: 2,
  },

  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 14,
  },

  eyebrow: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.7,
  },

  headerTitle: {
    marginTop: 7,
    color: COLORS.white,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.72)",
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "500",
    maxWidth: 300,
  },

  headerBadge: {
    minWidth: 56,
    height: 50,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor:
      "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    flexShrink: 0,
  },

  headerBadgeCount: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
  },

  headerBottomRow: {
    marginTop: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 2,
  },

  summaryPill: {
    flex: 1,
    minHeight: 45,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor:
      "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.14)",
    flexDirection: "row",
    alignItems: "center",
  },

  summaryIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#38BDF8",
    marginRight: 9,
  },

  summaryIndicatorRead: {
    backgroundColor: "#4ADE80",
  },

  summaryText: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "700",
  },

  markAllButton: {
    minHeight: 45,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor:
      "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    flexShrink: 0,
  },

  markAllButtonDisabled: {
    backgroundColor:
      "rgba(255,255,255,0.07)",
    borderColor:
      "rgba(255,255,255,0.10)",
  },

  markAllText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
  },

  markAllTextDisabled: {
    color: "rgba(255,255,255,0.45)",
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
