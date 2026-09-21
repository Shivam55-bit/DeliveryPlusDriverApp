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

const safeArray = (value) =>
  Array.isArray(value) ? value : [];

const getInitial = (name) =>
  String(name || "D")
    .trim()
    .charAt(0)
    .toUpperCase() || "D";

const maskDriverId = (value) => {
  if (!value) return "Driver ID: Not available";

  const id = String(value);
  return `Driver ID: •••${id.slice(-6).toUpperCase()}`;
};

const normaliseAvatarUrl = (avatar) => {
  if (!avatar) return null;
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

const QuickAction = memo(
  ({ icon, label, color, backgroundColor, onPress }) => (
    <TouchableOpacity
      style={styles.quickAction}
      activeOpacity={0.82}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.quickActionIcon,
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
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
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

  const [profileData, setProfileData] = useState({
    name: "Driver",
    email: "Not available",
    phone: "Not available",
    vehicle: null,
    profileImage: null,
    userId: "Driver ID: Not available",
    isVerified: false,
    isApproved: false,
    rating: 0,
  });

  const [stats, setStats] = useState({
    assigned: 0,
    completed: 0,
    rating: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingAccount, setDeletingAccount] =
    useState(false);

  const fetchProfileData = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);

      try {
        const [profileRes, completedRes, assignedRes] =
          await Promise.all([
            API.get("/auth/me"),
            API.get(
              "/jobs/driver/my-jobs?status=completed"
            ),
            API.get(
              "/jobs/driver/my-jobs?status=upcoming"
            ),
          ]);

        const user =
          profileRes?.user ??
          profileRes?.data?.user ??
          profileRes?.data ??
          null;

        if (!user) {
          throw new Error("Profile data not found");
        }

        const completedJobs = safeArray(
          completedRes?.jobs ??
            completedRes?.data?.jobs ??
            completedRes?.data
        );

        const assignedJobs = safeArray(
          assignedRes?.jobs ??
            assignedRes?.data?.jobs ??
            assignedRes?.data
        );

        const rating = Number(user?.rating) || 0;

        setProfileData({
          name: user?.name || "Driver",
          email: user?.email || "Not available",
          phone: user?.phone || "Not available",
          vehicle: user?.vehicle || null,
          profileImage: normaliseAvatarUrl(
            user?.avatar ?? user?.profileImage
          ),
          userId: maskDriverId(user?._id ?? user?.id),
          isVerified: Boolean(
            user?.isVerified ??
              user?.documentsVerified ??
              user?.verificationStatus === "verified"
          ),
          isApproved: Boolean(
            user?.isApproved ?? user?.status === "approved"
          ),
          rating,
        });

        setStats({
          assigned: assignedJobs.length,
          completed: completedJobs.length,
          rating,
        });
      } catch (error) {
        console.log(
          "Profile fetch error:",
          error?.response?.data ?? error?.message
        );

        if (!silent) {
          Alert.alert(
            "Profile unavailable",
            error?.response?.data?.message ||
              "Failed to load profile. Please try again."
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
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

    fetchProfileData();
  }, [fetchProfileData, heroOpacity, heroTranslateY]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfileData({ silent: true });
  }, [fetchProfileData]);

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
            await Promise.resolve(clearAuthToken());
            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
          },
        },
      ]
    );
  }, [navigation]);

  const performDeleteAccount = useCallback(async () => {
    if (deletingAccount) return;

    setDeletingAccount(true);

    try {
      const token = await Promise.resolve(getAuthToken());

      if (!token) {
        await Promise.resolve(clearAuthToken());
        navigation.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
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

      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      Alert.alert(
        "Unable to delete account",
        error?.response?.data?.message ||
          "Account deletion failed. Please try again."
      );
    } finally {
      setDeletingAccount(false);
    }
  }, [deletingAccount, navigation]);

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

  const performanceRating = useMemo(
    () =>
      stats.rating > 0
        ? stats.rating.toFixed(1)
        : "—",
    [stats.rating]
  );

  const vehicleTitle = useMemo(() => {
    if (!profileData.vehicle) return "No vehicle assigned";

    return (
      profileData.vehicle.number ??
      profileData.vehicle.registrationNumber ??
      profileData.vehicle.plateNumber ??
      "Vehicle assigned"
    );
  }, [profileData.vehicle]);

  const vehicleSubtitle = useMemo(() => {
    if (!profileData.vehicle) {
      return "Contact admin to assign a vehicle";
    }

    const vehicleType =
      profileData.vehicle.type ??
      profileData.vehicle.vehicleType ??
      "Vehicle";

    const status =
      profileData.vehicle.status ?? "Active";

    return `${vehicleType} • ${status}`;
  }, [profileData.vehicle]);

  if (loading) {
    return (
      <LoadingSpinner
        fullScreen
        text="Loading profile..."
      />
    );
  }

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

                  <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() =>
                      navigation.navigate("EditProfile")
                    }
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Open profile settings"
                  >
                    <AppIcon
                      library="Ionicons"
                      name="settings-outline"
                      size={20}
                      color={PALETTE.white}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.profileRow}>
                  <View style={styles.avatarWrap}>
                    {profileData.profileImage ? (
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
                      {profileData.userId}
                    </Text>

                    <Text
                      style={styles.profileEmail}
                      numberOfLines={1}
                    >
                      {profileData.email}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() =>
                      navigation.navigate("EditProfile")
                    }
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Edit profile"
                  >
                    <AppIcon
                      library="MaterialCommunityIcons"
                      name="account-edit-outline"
                      size={16}
                      color={PALETTE.white}
                    />
                    <Text style={styles.editButtonText}>
                      Edit
                    </Text>
                  </TouchableOpacity>
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
                value={stats.completed}
                label="Completed"
                color={PALETTE.green}
                backgroundColor="#E5F8F0"
              />
              <ProfileStat
                icon="clock-outline"
                value={stats.assigned}
                label="Assigned"
                color={PALETTE.blue}
                backgroundColor="#E6F2FF"
              />
              <ProfileStat
                icon="star-outline"
                value={performanceRating}
                label="Rating"
                color={PALETTE.orange}
                backgroundColor="#FFF3DF"
              />
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Vehicle</Text>

              <TouchableOpacity
                style={styles.vehicleCard}
                activeOpacity={0.84}
                onPress={() =>
                  navigation.navigate("VehicleDetails")
                }
              >
                <View
                  style={[
                    styles.vehicleIcon,
                    {
                      backgroundColor: profileData.vehicle
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
                      profileData.vehicle
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
              <Text style={styles.sectionTitle}>
                Quick Actions
              </Text>

              <View style={styles.quickActionsGrid}>
                <QuickAction
                  icon="account-edit-outline"
                  label="Edit Profile"
                  color={PALETTE.blue}
                  backgroundColor="#E6F2FF"
                  onPress={() =>
                    navigation.navigate("EditProfile")
                  }
                />
                <QuickAction
                  icon="truck-outline"
                  label="Vehicle"
                  color={PALETTE.orange}
                  backgroundColor="#FFF3DF"
                  onPress={() =>
                    navigation.navigate("VehicleDetails")
                  }
                />
                <QuickAction
                  icon="lock-reset"
                  label="Password"
                  color={PALETTE.green}
                  backgroundColor="#E5F8F0"
                  onPress={() =>
                    navigation.navigate("EditProfile")
                  }
                />
                <QuickAction
                  icon="bell-outline"
                  label="Alerts"
                  color={PALETTE.red}
                  backgroundColor="#FDEBED"
                  onPress={() =>
                    navigation.navigate("Notifications")
                  }
                />
                <QuickAction
                  icon="file-document-outline"
                  label="Documents"
                  color={PALETTE.purple}
                  backgroundColor="#EFEDFF"
                  onPress={() =>
                    navigation.navigate("EditProfile")
                  }
                />
                <QuickAction
                  icon="help-circle-outline"
                  label="Support"
                  color={PALETTE.navy}
                  backgroundColor="#E8EEF5"
                  onPress={() =>
                    navigation.navigate("HelpSupport")
                  }
                />
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Account</Text>

              <View style={styles.groupCard}>
                <MenuRow
                  icon="account-edit-outline"
                  title="Edit Profile"
                  subtitle="Update personal information"
                  onPress={() =>
                    navigation.navigate("EditProfile")
                  }
                />
                <MenuRow
                  icon="truck-outline"
                  title="Vehicle Details"
                  subtitle="View assigned vehicle"
                  onPress={() =>
                    navigation.navigate("VehicleDetails")
                  }
                />
                <MenuRow
                  icon="lock-reset"
                  title="Change Password"
                  subtitle="Secure your account"
                  onPress={() =>
                    navigation.navigate("EditProfile")
                  }
                />
                <MenuRow
                  icon="file-document-outline"
                  title="Documents"
                  subtitle="View driver documents"
                  onPress={() =>
                    navigation.navigate("EditProfile")
                  }
                  last
                />
              </View>
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
  editButton: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    flexShrink: 0,
  },
  editButtonText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: "700",
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

  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
  },
  quickAction: {
    width: "31%",
    alignItems: "center",
  },
  quickActionIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    color: PALETTE.text,
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
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