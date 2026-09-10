import React, { memo } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";

import AppIcon from "./common/AppIcon";

const truckImage = require("../assets/images/dashboardtruck_image-Photoroom.png");
const logoImage = require("../assets/images/Logo.png");

const COLORS = {
  navy900: "#061A33",
  navy800: "#0A1E3C",
  blue600: "#0D488F",
  blue500: "#155FB5",
  blue400: "#1B6ECF",
  cyan400: "#3EC9F5",
  orange500: "#FFA617",
  green500: "#20C997",
  red500: "#F04E57",
  white: "#FFFFFF",
  background: "#F4F7FC",
  surface: "#FFFFFF",
  text: "#0C1930",
  muted: "#71809B",
  subtle: "#A5B0C2",
  border: "#EAEFF6",
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const getDateLabel = () => {
  const now = new Date();
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
};

const StatCard = memo(({ icon, value, label, accent, backgroundColor }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconContainer, { backgroundColor }]}>
      <AppIcon
        library="MaterialCommunityIcons"
        name={icon}
        size={20}
        color={accent}
      />
    </View>
    <Text style={styles.statValue}>{value ?? 0}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

const IosDashboardHeader = memo(
  ({
    profile,
    stats,
    isOnline,
    togglingStatus,
    unreadCount,
    onToggleOnline,
    onOpenNotifications,
    onViewAll,
  }) => {
    const insets = useSafeAreaInsets();

    const rawName =
      profile?.name ??
      profile?.fullName ??
      profile?.firstName ??
      profile?.driverName ??
      profile?.driver?.name ??
      profile?.driver?.fullName ??
      profile?.user?.name ??
      profile?.user?.fullName ??
      profile?.email?.split("@")[0] ??
      "Driver";

    const displayName = String(rawName).trim() || "Driver";
    const firstName = displayName.split(" ")[0] || "Driver";
    const initial = firstName.charAt(0).toUpperCase();

    const topInset = Platform.OS === "ios" ? Math.max(insets.top, 44) + 16 : 16;

    return (
      <View style={styles.container}>
        {/* Floating Rounded Blue Card Banner matching reference design */}
        <View style={[styles.cardWrapper, { marginTop: topInset }]}>
          <LinearGradient
            colors={[COLORS.blue600, COLORS.blue500, COLORS.blue400]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            {/* Ambient Background Circles */}
            <View style={styles.ambientGlowOne} pointerEvents="none" />
            <View style={styles.ambientGlowTwo} pointerEvents="none" />

            {/* Top Bar inside Card: Avatar Orb + Branding + Notification Bell */}
            <View style={styles.cardTopRow}>
              <View style={styles.avatarOrb}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>

              <View style={styles.brandRow}>
                <Image
                  source={logoImage}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              </View>

              <TouchableOpacity
                style={styles.bellButton}
                onPress={onOpenNotifications}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <AppIcon
                  library="Feather"
                  name="bell"
                  size={19}
                  color={COLORS.white}
                />
                {unreadCount > 0 ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            {/* Main Content Row inside Card: Greeting Info & Truck Image */}
            <View style={styles.cardMainRow}>
              <View style={styles.greetingContainer}>
                <Text style={styles.greetingText}>{getGreeting()}</Text>
                <Text style={styles.driverName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.dateText}>{getDateLabel()}</Text>
                <Text style={styles.locationText}>Sydney, NSW</Text>
              </View>

              <View style={styles.truckImageContainer}>
                <Image
                  source={truckImage}
                  style={styles.truckImage}
                  resizeMode="contain"
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Floating White Stat Strip */}
        <View style={styles.statsContainer}>
          <View style={styles.statStrip}>
            <StatCard
              icon="clipboard-text-clock-outline"
              value={stats.assigned}
              label="ASSIGNED"
              accent={COLORS.orange500}
              backgroundColor="#FFF5E5"
            />
            <View style={styles.statDivider} />
            <StatCard
              icon="truck-fast-outline"
              value={stats.inProgress}
              label="IN PROGRESS"
              accent="#2688E8"
              backgroundColor="#EAF4FF"
            />
            <View style={styles.statDivider} />
            <StatCard
              icon="check-decagram-outline"
              value={stats.completed}
              label="COMPLETED"
              accent={COLORS.green500}
              backgroundColor="#EAF9F2"
            />
          </View>
        </View>

        {/* Dark Navy Online / Offline Availability Card */}
        <View style={styles.onlineCardContainer}>
          <View style={styles.onlineCard}>
            <View style={styles.onlineLeftContent}>
              <View
                style={[
                  styles.onlineIconCircle,
                  !isOnline && styles.onlineIconCircleOffline,
                ]}
              >
                <AppIcon
                  library="MaterialCommunityIcons"
                  name={isOnline ? "account-check-outline" : "power-standby"}
                  size={21}
                  color={isOnline ? COLORS.green500 : COLORS.subtle}
                />
              </View>

              <View style={styles.onlineTextBlock}>
                <Text style={styles.onlineTitle}>
                  {isOnline ? "You're online" : "You're offline"}
                </Text>
                <Text style={styles.onlineSubtitle}>
                  {isOnline
                    ? "Ready to receive new jobs"
                    : "Turn availability on when ready"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.toggleTrack,
                isOnline && styles.toggleTrackActive,
                togglingStatus && styles.toggleTrackLoading,
              ]}
              onPress={onToggleOnline}
              activeOpacity={0.85}
              disabled={togglingStatus}
              accessibilityRole="switch"
              accessibilityState={{ checked: isOnline }}
            >
              {togglingStatus ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <View
                  style={[
                    styles.toggleThumb,
                    isOnline && styles.toggleThumbActive,
                  ]}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Schedule & Jobs Section Header */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>YOUR SCHEDULE</Text>
            <Text style={styles.sectionTitle}>Today's Jobs</Text>
          </View>

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={onViewAll}
            activeOpacity={0.85}
          >
            <Text style={styles.viewAllText}>View all</Text>
            <AppIcon
              library="Feather"
              name="arrow-right"
              size={15}
              color="#2B70C9"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

export default IosDashboardHeader;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: COLORS.background,
  },

  cardWrapper: {
    marginLeft: 4,
    marginRight: 4,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#0A2540",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  cardGradient: {
    width: "100%",
    minHeight: 225,
    paddingTop: 16,
    paddingBottom: 22,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  ambientGlowOne: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  ambientGlowTwo: {
    position: "absolute",
    bottom: -60,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(62, 201, 245, 0.12)",
  },

  cardTopRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.20)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogo: {
    width: 145,
    height: 38,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.20)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginRight: 24,
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.red500,
    borderWidth: 2,
    borderColor: COLORS.blue500,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: "900",
  },

  cardMainRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 12,
  },
  greetingContainer: {
    flex: 1,
    paddingRight: 6,
    marginBottom: 28,
  },
  greetingText: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 15,
    fontWeight: "500",
  },
  driverName: {
    color: COLORS.white,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    marginTop: 2,
    letterSpacing: -0.5,
    textTransform: "lowercase",
  },
  dateText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
  },
  locationText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  truckImageContainer: {
    width: 190,
    height: 130,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  truckImage: {
    width: 190,
    height: 130,
  },

  statsContainer: {
    marginHorizontal: 16,
    marginTop: 14,
  },
  statStrip: {
    minHeight: 88,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#102844",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 8.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS.border,
  },

  onlineCardContainer: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  onlineCard: {
    minHeight: 70,
    borderRadius: 22,
    backgroundColor: COLORS.navy800,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#051020",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  onlineLeftContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  onlineIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(32, 201, 151, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineIconCircleOffline: {
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  onlineTextBlock: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },
  onlineTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
  },
  onlineSubtitle: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11,
    marginTop: 2,
  },
  toggleTrack: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#3A4B64",
    padding: 3,
    justifyContent: "center",
  },
  toggleTrackActive: {
    backgroundColor: COLORS.green500,
  },
  toggleTrackLoading: {
    alignItems: "center",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },

  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionEyebrow: {
    color: "#2B70C9",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2,
  },
  viewAllButton: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    color: "#2B70C9",
    fontSize: 12,
    fontWeight: "800",
    marginRight: 4,
  },
});
