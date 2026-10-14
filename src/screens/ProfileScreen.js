import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";

import AppIcon from "../components/common/AppIcon";
import LoadingSpinner from "../components/LoadingSpinner";
import API, {
  clearAuthToken,
  getAuthToken,
} from "../services/api";
import {
  fetchAuthenticatedDriverProfile,
} from "../services/driverProfile";

const PALETTE = {
  background: "#F3F6FB",
  surface: "#FFFFFF",
  navy: "#082F5B",
  navyDeep: "#061D38",
  blue: "#1D8FE9",
  cyan: "#35C7F4",
  text: "#0C1930",
  muted: "#71809A",
  subtle: "#9BA8BA",
  border: "#E5EBF3",
  green: "#20C88A",
  orange: "#FFA617",
  red: "#EF535A",
  purple: "#7D6CF2",
  white: "#FFFFFF",
};

const extractJobs = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.jobs)) return value.jobs;
  if (Array.isArray(value?.data?.jobs)) return value.data.jobs;
  if (Array.isArray(value?.data)) return value.data;
  return null;
};

const getInitial = (name) =>
  String(name === "Name not provided" ? "D" : name || "D")
    .trim()
    .charAt(0)
    .toUpperCase() || "D";

const formatDriverId = (value) => {
  if (!value) return "Driver ID: Not available";

  const clean = String(value).trim();
  if (
    !clean ||
    clean.toLowerCase() === "null" ||
    clean.toLowerCase() === "undefined" ||
    clean.toLowerCase() === "not available"
  ) {
    return "Driver ID: Not available";
  }

  if (/^driver\s*id/i.test(clean)) {
    return clean;
  }
  if (/^id[:\s]/i.test(clean)) {
    return `Driver ${clean}`;
  }

  if (/^[0-9a-fA-F]{24}$/.test(clean)) {
    return `Driver ID: #${clean.slice(-6).toUpperCase()}`;
  }

  return `Driver ID: ${clean}`;
};

const normaliseAvatarUrl = (avatar) => {
  if (typeof avatar !== "string" || !avatar) return null;
  if (/^https?:\/\//i.test(avatar)) return avatar;

  const baseURL = String(API?.defaults?.baseURL || "").replace(
    /\/$/,
    ""
  );
  const path = String(avatar).startsWith("/")
    ? avatar
    : `/${avatar}`;

  return baseURL ? `${baseURL}${path}` : avatar;
};

const ProfileStat = memo(
  ({ icon, label, value, color, backgroundColor }) => (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statIcon,
          { backgroundColor },
        ]}
      >
        <AppIcon
          library="MaterialCommunityIcons"
          name={icon}
          size={23}
          color={color}
        />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
);


const MenuRow = memo(
  ({
    icon,
    title,
    subtitle,
    onPress,
    iconColor = PALETTE.blue,
    iconBackground = "#E8F3FF",
    danger = false,
    last = false,
  }) => (
    <TouchableOpacity
      style={[
        styles.menuRow,
        !last && styles.menuRowDivider,
      ]}
      onPress={onPress}
      activeOpacity={0.76}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View
        style={[
          styles.menuIcon,
          { backgroundColor: iconBackground },
        ]}
      >
        <AppIcon
          library="MaterialCommunityIcons"
          name={icon}
          size={21}
          color={danger ? PALETTE.red : iconColor}
        />
      </View>

      <View style={styles.menuTextWrap}>
        <Text
          style={[
            styles.menuTitle,
            danger && styles.menuDangerText,
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.menuSubtitle}>{subtitle}</Text>
        ) : null}
      </View>

      <AppIcon
        library="Feather"
        name="chevron-right"
        size={20}
        color={PALETTE.subtle}
      />
    </TouchableOpacity>
  )
);

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isSmallScreen = width < 390;
  const isTablet = width >= 768;
  const pageMaxWidth = isTablet ? 720 : undefined;

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(
    new Animated.Value(14)
  ).current;
  const profileRequestId = useRef(0);
  const profileAbortController = useRef(null);

  const [profileData, setProfileData] = useState(null);

  const [stats, setStats] = useState({
    assigned: null,
    completed: null,
    rating: null,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [deletingAccount, setDeletingAccount] =
    useState(false);

  const fetchProfileData = useCallback(
    async ({ silent = false } = {}) => {
      profileAbortController.current?.abort();
      const controller = new AbortController();
      profileAbortController.current = controller;
      const requestId = ++profileRequestId.current;
      if (!silent) setLoading(true);
      setLoadError("");

      try {
        const completedJobsRequest = API.get(
          "/jobs/driver/my-jobs?status=completed",
          { timeout: 15000, signal: controller.signal }
        );
        const assignedJobsRequest = API.get(
          "/jobs/driver/my-jobs?status=upcoming",
          { timeout: 15000, signal: controller.signal }
        );
        const statsRequest = Promise.allSettled([
          completedJobsRequest,
          assignedJobsRequest,
        ]);

        const profile = await fetchAuthenticatedDriverProfile({
          signal: controller.signal,
        });
        if (requestId !== profileRequestId.current) return;

        profile.profileImage = normaliseAvatarUrl(profile.profileImage);
        setProfileData(profile);
        setProfileImageFailed(false);
        setStats((current) => ({
          ...current,
          rating: profile.rating,
        }));
        setLoading(false);

        const [completedResult, assignedResult] = await statsRequest;
        if (requestId !== profileRequestId.current) return;

        const completedJobs =
          completedResult.status === "fulfilled"
            ? extractJobs(completedResult.value)
            : null;
        const assignedJobs =
          assignedResult.status === "fulfilled"
            ? extractJobs(assignedResult.value)
            : null;

        if (!completedJobs) {
          console.warn(
            "[Profile] Completed jobs response was unavailable or invalid.",
            completedResult.status === "rejected"
              ? completedResult.reason?.message
              : "Unrecognized response shape"
          );
        }
        if (!assignedJobs) {
          console.warn(
            "[Profile] Assigned jobs response was unavailable or invalid.",
            assignedResult.status === "rejected"
              ? assignedResult.reason?.message
              : "Unrecognized response shape"
          );
        }

        setStats({
          assigned: assignedJobs?.length ?? null,
          completed: completedJobs?.length ?? null,
          rating: profile.rating,
        });
      } catch (error) {
        if (requestId !== profileRequestId.current) return;

        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Unable to load your profile. Please try again.";
        setLoadError(message);

        if (error?.response?.status === 401) {
          await clearAuthToken();
          const rootNavigation = navigation.getParent() || navigation;
          rootNavigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        }
      } finally {
        if (requestId === profileRequestId.current) {
          profileAbortController.current = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [navigation]
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroTranslateY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroOpacity, heroTranslateY]);

  useFocusEffect(
    useCallback(() => {
      fetchProfileData();

      return () => {
        profileAbortController.current?.abort();
        profileRequestId.current += 1;
      };
    }, [fetchProfileData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfileData({ silent: true });
  }, [fetchProfileData]);

  const resetToLogin = useCallback(() => {
    const rootNavigation = navigation.getParent() || navigation;
    rootNavigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  }, [navigation]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            await clearAuthToken();
            resetToLogin();
          },
        },
      ]
    );
  }, [resetToLogin]);

  const performDeleteAccount = useCallback(async () => {
    if (deletingAccount) return;

    setDeletingAccount(true);

    try {
      const token = await Promise.resolve(getAuthToken());

      if (!token) {
        await clearAuthToken();
        resetToLogin();
        return;
      }

      if (global?.fcmToken) {
        try {
          await API.post("/device-token/unregister", {
            token: global.fcmToken,
          });
        } catch (error) {
          console.log("FCM unregister skipped");
        }
      }

      await API.delete("/account", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      await Promise.resolve(clearAuthToken());

      Alert.alert(
        "Account deleted",
        "Your account has been permanently deleted."
      );

      resetToLogin();
    } catch (error) {
      Alert.alert(
        "Unable to delete account",
        error?.response?.data?.message ||
          "Account deletion failed. Please try again."
      );
    } finally {
      setDeletingAccount(false);
    }
  }, [deletingAccount, resetToLogin]);

  const handleDeleteAccount = useCallback(() => {
    if (deletingAccount) return;

    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: performDeleteAccount,
        },
      ]
    );
  }, [deletingAccount, performDeleteAccount]);


  const vehicleTitle = useMemo(() => {
    const vehicle = profileData?.vehicle;
    if (!vehicle) return "No vehicle assigned";

    return (
      vehicle.number ??
      vehicle.vehicleNumber ??
      vehicle.registrationNumber ??
      vehicle.plateNumber ??
      vehicle.licensePlate ??
      "Vehicle assigned"
    );
  }, [profileData?.vehicle]);

  const vehicleSubtitle = useMemo(() => {
    const vehicle = profileData?.vehicle;
    if (!vehicle) {
      return "Contact admin to assign a vehicle";
    }

    const vehicleType =
      vehicle.type ??
      vehicle.vehicleType ??
      vehicle.model ??
      "Vehicle details unavailable";

    const status =
      vehicle.status ??
      vehicle.verificationStatus ??
      "Status unavailable";

    return `${vehicleType} • ${status}`;
  }, [profileData?.vehicle]);

  if (loading) {
    return (
      <LoadingSpinner
        fullScreen
        text="Loading profile..."
      />
    );
  }

  if (!profileData) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={PALETTE.navyDeep}
        />
        <View style={styles.errorState}>
          <AppIcon
            library="MaterialCommunityIcons"
            name="account-alert-outline"
            size={42}
            color={PALETTE.red}
          />
          <Text style={styles.errorTitle}>Profile unavailable</Text>
          <Text style={styles.errorMessage}>
            {loadError || "Unable to load your profile. Please try again."}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchProfileData()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading profile"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }


  const availabilityLabel =
    profileData.isOnline === null
      ? "Unavailable"
      : profileData.isOnline
        ? "Online"
        : "Offline";

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top"]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={PALETTE.navyDeep}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PALETTE.blue}
            colors={[PALETTE.blue]}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: 132 + insets.bottom,
          },
        ]}
      >
        {loadError ? (
          <View style={styles.refreshError}>
            <Text style={styles.refreshErrorText}>
              Could not refresh profile: {loadError}
            </Text>
            <TouchableOpacity
              onPress={handleRefresh}
              accessibilityRole="button"
              accessibilityLabel="Retry profile refresh"
            >
              <Text style={styles.refreshRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View
          style={[
            styles.page,
            pageMaxWidth
              ? {
                  maxWidth: pageMaxWidth,
                  alignSelf: "center",
                  width: "100%",
                }
              : null,
          ]}
        >
          <Animated.View
            style={[
              styles.hero,
              {
                opacity: heroOpacity,
                transform: [
                  { translateY: heroTranslateY },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={["#0B2545", "#134074", "#0077B6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroCircleOne} />
              <View style={styles.heroCircleTwo} />

              <View style={styles.heroInnerContainer}>
                <View style={styles.heroTopRow}>
                  <View style={styles.heroTitleGroup}>
                    <Text style={styles.heroEyebrow}>
                      DRIVER ACCOUNT
                    </Text>
                    <Text style={styles.heroTitle}>
                      My Profile
                    </Text>
                  </View>
                </View>

                <View style={styles.profileRow}>
                  <View style={styles.avatarWrap}>
                    {profileData.profileImage && !profileImageFailed ? (
                      <Image
                        source={{
                          uri: profileData.profileImage,
                        }}
                        style={[
                          styles.avatar,
                          {
                            width: isSmallScreen ? 64 : 72,
                            height: isSmallScreen ? 64 : 72,
                            borderRadius: isSmallScreen
                              ? 32
                              : 36,
                          },
                        ]}
                        onError={() => setProfileImageFailed(true)}
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatar,
                          styles.avatarPlaceholder,
                          {
                            width: isSmallScreen ? 64 : 72,
                            height: isSmallScreen ? 64 : 72,
                            borderRadius: isSmallScreen
                              ? 32
                              : 36,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarText,
                            {
                              fontSize: isSmallScreen
                                ? 25
                                : 29,
                            },
                          ]}
                        >
                          {getInitial(profileData.name)}
                        </Text>
                      </View>
                    )}

                    {profileData.isVerified ? (
                      <View style={styles.verifiedBadge}>
                        <AppIcon
                          library="Ionicons"
                          name="checkmark-sharp"
                          size={13}
                          color={PALETTE.white}
                        />
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.profileInfo}>
                    <Text
                      style={[
                        styles.profileName,
                        {
                          fontSize: isSmallScreen ? 20 : 23,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {profileData.name}
                    </Text>

                    <Text
                      style={styles.profileId}
                      numberOfLines={1}
                    >
                      {formatDriverId(
                        profileData.driverId ||
                        profileData.driverCode ||
                        profileData.driver_id ||
                        profileData.driverNumber
                      )}
                    </Text>

                    <Text
                      style={styles.profileEmail}
                      numberOfLines={1}
                    >
                      {profileData.email}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          <View style={styles.content}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  YOUR ACTIVITY
                </Text>
                <Text style={styles.sectionTitle}>
                  Performance
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <ProfileStat
                icon="clipboard-check-outline"
                value={stats.completed ?? "—"}
                label="Completed"
                color={PALETTE.green}
                backgroundColor="#E5F8F0"
              />
              <ProfileStat
                icon="clock-outline"
                value={stats.assigned ?? "—"}
                label="Assigned"
                color={PALETTE.blue}
                backgroundColor="#E6F2FF"
              />
            </View>

            <View style={styles.profileDetailsCard}>
              <View style={styles.profileDetailRow}>
                <AppIcon
                  library="MaterialCommunityIcons"
                  name="phone-outline"
                  size={19}
                  color={PALETTE.blue}
                />
                <Text style={styles.profileDetailLabel}>Phone</Text>
                <Text style={styles.profileDetailValue} numberOfLines={1}>
                  {profileData.phone}
                </Text>
              </View>
              <View style={styles.profileDetailRow}>
                <AppIcon
                  library="MaterialCommunityIcons"
                  name={
                    profileData.isOnline === null
                      ? "help-circle-outline"
                      : profileData.isOnline
                        ? "check-circle-outline"
                        : "minus-circle-outline"
                  }
                  size={19}
                  color={
                    profileData.isOnline === null
                      ? PALETTE.subtle
                      : profileData.isOnline
                        ? PALETTE.green
                        : PALETTE.muted
                  }
                />
                <Text style={styles.profileDetailLabel}>Availability</Text>
                <Text style={styles.profileDetailValue}>
                  {availabilityLabel}
                </Text>
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Vehicle</Text>

              <TouchableOpacity
                style={styles.vehicleCard}
                activeOpacity={0.84}
                onPress={() =>
                  navigation.navigate("VehicleDetails", {
                    vehicle: profileData?.vehicle,
                    driverName: profileData?.name,
                  })
                }
              >
                <View
                  style={[
                    styles.vehicleIcon,
                    {
                      backgroundColor: profileData?.vehicle
                        ? "#E6F2FF"
                        : "#EEF1F5",
                    },
                  ]}
                >
                  <AppIcon
                    library="MaterialCommunityIcons"
                    name="truck-outline"
                    size={27}
                    color={
                      profileData?.vehicle
                        ? PALETTE.blue
                        : PALETTE.subtle
                    }
                  />
                </View>

                <View style={styles.vehicleTextWrap}>
                  <Text
                    style={styles.vehicleTitle}
                    numberOfLines={1}
                  >
                    {vehicleTitle}
                  </Text>
                  <Text
                    style={styles.vehicleSubtitle}
                    numberOfLines={2}
                  >
                    {vehicleSubtitle}
                  </Text>
                </View>

                <AppIcon
                  library="Feather"
                  name="chevron-right"
                  size={21}
                  color={PALETTE.subtle}
                />
              </TouchableOpacity>
            </View>



            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Support</Text>

              <View style={styles.groupCard}>
                <MenuRow
                  icon="help-circle-outline"
                  title="Help & Support"
                  subtitle="Get help from Delivery Plus"
                  onPress={() =>
                    navigation.navigate("HelpSupport")
                  }
                />
                <MenuRow
                  icon="file-document-outline"
                  title="Terms & Conditions"
                  subtitle="Read our terms of service"
                  onPress={() =>
                    navigation.navigate("Terms")
                  }
                />
                <MenuRow
                  icon="shield-check-outline"
                  title="Privacy Policy"
                  subtitle="Learn how your data is protected"
                  onPress={() =>
                    navigation.navigate("Privacy")
                  }
                  last
                />
              </View>
            </View>

            <View style={styles.dangerSection}>
              <Text style={styles.dangerSectionTitle}>
                Account Actions
              </Text>

              <TouchableOpacity
                style={styles.logoutButton}
                activeOpacity={0.86}
                onPress={handleLogout}
              >
                <AppIcon
                  library="MaterialCommunityIcons"
                  name="logout"
                  size={21}
                  color={PALETTE.white}
                />
                <Text style={styles.logoutButtonText}>
                  Log out
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                activeOpacity={0.86}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <AppIcon
                    library="MaterialCommunityIcons"
                    name="loading"
                    size={21}
                    color={PALETTE.red}
                  />
                ) : (
                  <AppIcon
                    library="MaterialCommunityIcons"
                    name="delete-outline"
                    size={21}
                    color={PALETTE.red}
                  />
                )}
                <Text style={styles.deleteButtonText}>
                  {deletingAccount
                    ? "Deleting account..."
                    : "Delete Account"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  errorTitle: {
    color: PALETTE.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 14,
  },
  errorMessage: {
    color: PALETTE.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 46,
    minWidth: 132,
    paddingHorizontal: 20,
    marginTop: 20,
    borderRadius: 15,
    backgroundColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: PALETTE.white,
    fontSize: 14,
    fontWeight: "800",
  },
  refreshError: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FDEBED",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  refreshErrorText: {
    flex: 1,
    color: "#9F2630",
    fontSize: 12,
    lineHeight: 17,
  },
  refreshRetryText: {
    color: PALETTE.navy,
    fontSize: 12,
    fontWeight: "900",
  },
  page: {
    width: "100%",
  },

  hero: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 24,
    shadowColor: "#0B2545",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  heroGradient: {
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  heroInnerContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    zIndex: 2,
  },
  heroCircleOne: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -50,
    top: -70,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  heroCircleTwo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    left: -40,
    bottom: -60,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  heroTitleGroup: {
    flex: 1,
    paddingRight: 12,
  },
  heroEyebrow: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: PALETTE.white,
    fontSize: 26,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    flexShrink: 0,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    position: "relative",
    flexShrink: 0,
  },
  avatar: {
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "#DFF4FF",
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#0F3854",
    fontWeight: "900",
  },
  verifiedBadge: {
    position: "absolute",
    right: -2,
    bottom: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    marginRight: 10,
  },
  profileName: {
    color: PALETTE.white,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  profileId: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  profileEmail: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 3,
  },


  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: PALETTE.blue,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  sectionTitle: {
    color: PALETTE.text,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 2,
    marginBottom: 13,
  },
  sectionBlock: {
    marginTop: 24,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  profileDetailsCard: {
    marginTop: 14,
    paddingHorizontal: 15,
    paddingVertical: 4,
    borderRadius: 18,
    backgroundColor: PALETTE.surface,
    shadowColor: "#173A5F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  profileDetailRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileDetailLabel: {
    flex: 1,
    color: PALETTE.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  profileDetailValue: {
    maxWidth: "56%",
    color: PALETTE.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  statCard: {
    flex: 1,
    minHeight: 118,
    borderRadius: 20,
    backgroundColor: PALETTE.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 13,
    shadowColor: "#173A5F",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    color: PALETTE.text,
    fontSize: 23,
    fontWeight: "900",
    marginTop: 8,
  },
  statLabel: {
    color: PALETTE.muted,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 3,
    textAlign: "center",
  },

  vehicleCard: {
    minHeight: 92,
    borderRadius: 21,
    backgroundColor: PALETTE.surface,
    paddingHorizontal: 15,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#173A5F",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  vehicleIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  vehicleTextWrap: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 13,
  },
  vehicleTitle: {
    color: PALETTE.text,
    fontSize: 16,
    fontWeight: "800",
  },
  vehicleSubtitle: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },


  groupCard: {
    borderRadius: 22,
    backgroundColor: PALETTE.surface,
    overflow: "hidden",
    shadowColor: "#173A5F",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  menuRow: {
    minHeight: 73,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  menuRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  menuIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  menuTextWrap: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 12,
  },
  menuTitle: {
    color: PALETTE.text,
    fontSize: 14.5,
    fontWeight: "800",
  },
  menuDangerText: {
    color: PALETTE.red,
  },
  menuSubtitle: {
    color: PALETTE.muted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },

  dangerSection: {
    marginTop: 26,
  },
  dangerSectionTitle: {
    color: PALETTE.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 13,
  },
  logoutButton: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: PALETTE.navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  logoutButtonText: {
    color: PALETTE.white,
    fontSize: 15,
    fontWeight: "900",
  },
  deleteButton: {
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: PALETTE.red,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 12,
  },
  deleteButtonText: {
    color: PALETTE.red,
    fontSize: 15,
    fontWeight: "900",
  },
});