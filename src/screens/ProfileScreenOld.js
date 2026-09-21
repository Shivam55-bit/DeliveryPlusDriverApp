import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Card from "../components/Card";
import AppIcon from "../components/common/AppIcon";
import CustomButton from "../components/CustomButton";
import LoadingSpinner from "../components/LoadingSpinner";
import colors from "../utils/colors";
import API, { clearAuthToken, getAuthToken } from "../services/api";

const MenuItem = ({ icon, title, subtitle, onPress, showArrow = true }) => (
  <Card onPress={onPress} style={styles.menuItem}>
    <View style={styles.menuContent}>
      <View style={[styles.menuIcon, { backgroundColor: colors.accent + "15" }]}> 
        <AppIcon library="Ionicons" name={icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {showArrow && <AppIcon library="Ionicons" name="chevron-forward" size={20} color={colors.textMuted} />}
    </View>
  </Card>
);

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    vehicle: "",
    profileImage: null,
  });
  const [stats, setStats] = useState([
    { icon: "check-circle", value: 0, label: "Completed" },
    { icon: "clock-outline", value: 0, label: "Pending" },
  ]);
  const [loading, setLoading] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [profileRes, completedRes, pendingRes] = await Promise.all([
          API.get("/auth/me"),
          API.get("/jobs/driver/my-jobs?status=completed"),
          API.get("/jobs/driver/my-jobs?status=pending"),
        ]);

        // Set profile data
        const user = profileRes?.user ?? profileRes?.data?.user;
        if (!user) {
          throw new Error("Profile response did not include user data.");
        }

        const avatarUrl = user.avatar
          ? user.avatar.startsWith('http')
            ? user.avatar
            : `${API.defaults.baseURL}${user.avatar}`
          : null;

        setProfileData({
          name: user.name || "Driver",
          phone: user.phone || "",
          vehicle: user.vehicle ? `${user.vehicle.type} | ${user.vehicle.number}` : "Not assigned",
          profileImage: avatarUrl,
        });

        // Calculate stats from jobs
        const completedJobs = completedRes?.jobs ?? completedRes?.data?.jobs ?? [];
        const pendingJobs = pendingRes?.jobs ?? pendingRes?.data?.jobs ?? [];
        setStats([
          { icon: "check-circle", value: completedJobs.length, label: "Completed" },
          { icon: "clock-outline", value: pendingJobs.length, label: "Pending" },
        ]);
      } catch (error) {
        Alert.alert("Error", "Failed to load profile data: " + (error.response?.data?.message || error.message));
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const getErrorMessage = (error) => {
    return (
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "Something went wrong. Please try again."
    );
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          clearAuthToken();
          navigation.replace("Login");
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;

    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const token = getAuthToken();
            if (!token) {
              clearAuthToken();
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
              return;
            }

            setDeletingAccount(true);
            try {
              await API.delete("/account", {
                headers: { Authorization: `Bearer ${token}` },
              });

              if (typeof global !== "undefined" && global?.fcmToken) {
                try {
                  await API.post("/device-token/unregister", { token: global.fcmToken });
                } catch (deviceError) {
                  console.log("FCM unregister skipped:", deviceError?.message || deviceError);
                }
              }

              clearAuthToken();
              Alert.alert("Account Deleted", "Your account has been deleted successfully.");
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            } catch (error) {
              Alert.alert("Delete Failed", getErrorMessage(error));
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {loading ? (
        <LoadingSpinner text="Loading profile..." />
      ) : (
        <>
          <LinearGradient colors={colors.gradient.primary} style={styles.header}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.headerTitle}>My Profile</Text>
                <Text style={styles.headerSubtitle}>Manage your driver account</Text>
              </View>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => navigation.navigate("EditProfile")}
                activeOpacity={0.8}
              >
                <AppIcon library="MaterialCommunityIcons" name="pencil" size={18} color={colors.textInverse} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
              {profileData.profileImage ? (
                <Image
                  source={{ uri: profileData.profileImage }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarPlaceholderText}>
                    {profileData.name?.charAt(0)?.toUpperCase() || ""}
                  </Text>
                </View>
              )}
            </View>

              <View style={styles.profileInfo}>
                <Text style={styles.name}>{profileData.name}</Text>
                <Text style={styles.phone}>{profileData.phone}</Text>
                <View style={styles.vehicleRow}>
                  <AppIcon library="MaterialCommunityIcons" name="truck" size={14} color={colors.textInverse} />
                  <Text style={styles.vehicleText}>{profileData.vehicle}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          <ScrollView
            contentContainerStyle={[
              styles.scrollViewContent,
              { paddingBottom: insets.bottom + 30 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.statsContainer}>
                {stats.map((item) => (
                  <Card key={item.label} style={styles.statCard}>
                    <View style={styles.statBox}>
                      <AppIcon library="MaterialCommunityIcons" name={item.icon} size={22} color={colors.primary} />
                      <Text style={styles.statValue}>{item.value}</Text>
                      <Text style={styles.statLabel}>{item.label}</Text>
                    </View>
                  </Card>
                ))}
              </View>

              <View style={styles.menuSection}>
                <Text style={styles.sectionTitle}>Account</Text>
                <MenuItem
                  icon="account-edit"
                  title="Edit Profile"
                  subtitle="Update personal information"
                  onPress={() => navigation.navigate("EditProfile")}
                />
                <MenuItem
                  icon="truck-delivery"
                  title="Vehicle Details"
                  subtitle="Manage vehicle information"
                  onPress={() => navigation.navigate("VehicleDetails")}
                />
                <MenuItem
                  icon="map-marker-path"
                  title="Delivery History"
                  subtitle="View past deliveries"
                  onPress={() => navigation.navigate("DeliveryHistory")}
                />
              </View>

              <View style={styles.menuSection}>
                <Text style={styles.sectionTitle}>Support</Text>
                <MenuItem
                  icon="help-circle"
                  title="Help & Support"
                  subtitle="Get help and contact support"
                  onPress={() => navigation.navigate("HelpSupport")}
                />
                <MenuItem
                  icon="file-document"
                  title="Terms & Conditions"
                  subtitle="Read our terms of service"
                  onPress={() => navigation.navigate("Terms")}
                />
                <MenuItem
                  icon="shield-check"
                  title="Privacy Policy"
                  subtitle="Learn about data protection"
                  onPress={() => navigation.navigate("Privacy")}
                />
              </View>

              <View style={styles.logoutSection}>
                <CustomButton
                  title="Logout"
                  onPress={handleLogout}
                  variant="danger"
                  fullWidth
                  size="large"
                />
                <CustomButton
                  title={deletingAccount ? "Deleting..." : "Delete Account"}
                  onPress={handleDeleteAccount}
                  variant="danger"
                  fullWidth
                  size="large"
                  style={styles.deleteButton}
                  disabled={deletingAccount}
                  loading={deletingAccount}
                />
              </View>
            </View>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textInverse,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  quickAction: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 18,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: colors.textInverse,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  avatarPlaceholderText: {
    color: colors.textInverse,
    fontSize: 28,
    fontWeight: "700",
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.textInverse,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textInverse,
  },
  phone: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  scrollViewContent: {
    paddingBottom: 30,
  },
  content: {
    padding: 20,
  },
  vehicleRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleText: {
    marginLeft: 8,
    color: colors.textInverse,
    fontSize: 13,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  statBox: {
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: 10,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    marginBottom: 10,
  },
  menuContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  logoutSection: {
    marginTop: 10,
    marginBottom: 18,
  },
  deleteButton: {
    backgroundColor: "#DC2626",
  },
});
