import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  RefreshControl,
  ScrollView,
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
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";
import colors from "../utils/colors";

const UI = {
  primaryDark: colors?.primaryDark || "#071E3B",
  primary: colors?.primary || "#0B3B69",
  accent: colors?.accent || "#159DE3",
  background: colors?.background || "#F3F6FB",
  surface: colors?.surface || "#FFFFFF",
  text: colors?.text || "#0F172A",
  textSecondary: colors?.textSecondary || "#64748B",
  textMuted: colors?.textMuted || "#94A3B8",
  textInverse: colors?.textInverse || "#FFFFFF",
  border: colors?.border || "#E2E8F0",
  success: colors?.success || "#16A34A",
  warning: colors?.warning || "#D97706",
};

const getVehicleValue = (vehicle, keys, fallback = "Not provided") => {
  for (const key of keys) {
    const value = vehicle?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return String(value);
    }
  }

  return fallback;
};

const DetailItem = ({
  icon,
  label,
  value,
  accent = UI.primary,
  fullWidth = false,
}) => (
  <View
    style={[
      styles.detailItem,
      fullWidth && styles.detailItemFull,
    ]}
  >
    <View
      style={[
        styles.detailIcon,
        {
          backgroundColor: `${accent}14`,
        },
      ]}
    >
      <AppIcon
        library="MaterialCommunityIcons"
        name={icon}
        size={22}
        color={accent}
      />
    </View>

    <View style={styles.detailCopy}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={styles.detailValue}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  </View>
);

export default function VehicleDetailsScreen({
  navigation,
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isCompactPhone = width < 390;
  const isTablet = width >= 768;

  const [vehicleData, setVehicleData] =
    useState(null);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const fetchVehicleDetails = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const response = await API.get(
          "/auth/me"
        );

        const payload =
          response?.data ?? response;

        const user =
          payload?.user ??
          payload?.data?.user ??
          payload?.data ??
          null;

        const vehicle =
          user?.vehicle ??
          user?.assignedVehicle ??
          user?.vehicleDetails ??
          null;

        setVehicleData(vehicle || null);
      } catch (error) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Unable to load vehicle details.";

        setErrorMessage(message);
        setVehicleData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchVehicleDetails();
  }, [fetchVehicleDetails]);

  const normalizedVehicle = useMemo(() => {
    if (!vehicleData) return null;

    return {
      type: getVehicleValue(vehicleData, [
        "type",
        "vehicleType",
        "model",
        "name",
      ]),
      number: getVehicleValue(vehicleData, [
        "number",
        "vehicleNumber",
        "registrationNumber",
        "licensePlate",
      ]),
      year: getVehicleValue(vehicleData, [
        "registrationYear",
        "year",
        "manufactureYear",
      ]),
      color: getVehicleValue(vehicleData, [
        "color",
        "vehicleColor",
      ]),
      make: getVehicleValue(vehicleData, [
        "make",
        "brand",
        "manufacturer",
      ]),
      status: getVehicleValue(
        vehicleData,
        ["status", "verificationStatus"],
        "Assigned"
      ),
    };
  }, [vehicleData]);

  const initials = useMemo(() => {
    const type =
      normalizedVehicle?.type || "V";

    return String(type)
      .trim()
      .charAt(0)
      .toUpperCase();
  }, [normalizedVehicle]);

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={UI.primaryDark}
        translucent={false}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet &&
            styles.scrollContentTablet,
          {
            paddingBottom:
              40 + insets.bottom,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              fetchVehicleDetails(true)
            }
            tintColor={UI.primary}
            colors={[UI.primary]}
          />
        }
      >
        <View
          style={[
            styles.contentShell,
            isTablet &&
              styles.contentShellTablet,
          ]}
        >
          <LinearGradient
            colors={[
              UI.primaryDark,
              UI.primary,
              UI.accent,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.header,
              isCompactPhone &&
                styles.headerCompact,
            ]}
          >
            <View
              pointerEvents="none"
              style={styles.headerCircleLarge}
            />
            <View
              pointerEvents="none"
              style={styles.headerCircleSmall}
            />

            <View style={styles.headerTopRow}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() =>
                  navigation.goBack()
                }
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <AppIcon
                  library="Ionicons"
                  name="arrow-back"
                  size={22}
                  color={UI.textInverse}
                />
              </TouchableOpacity>

              <View style={styles.headerTitleBlock}>
                <Text style={styles.headerEyebrow}>
                  DRIVER VEHICLE
                </Text>
                <Text style={styles.headerTitle}>
                  Vehicle Details
                </Text>
                <Text
                  style={styles.headerSubtitle}
                  numberOfLines={2}
                >
                  View your assigned vehicle and registration information.
                </Text>
              </View>

              <View
                style={
                  styles.headerButtonPlaceholder
                }
              />
            </View>

            {normalizedVehicle ? (
              <View style={styles.vehicleSummary}>
                <View style={styles.vehicleAvatar}>
                  <Text style={styles.vehicleAvatarText}>
                    {initials}
                  </Text>
                </View>

                <View style={styles.vehicleSummaryText}>
                  <Text
                    style={styles.vehicleSummaryTitle}
                    numberOfLines={1}
                  >
                    {normalizedVehicle.type}
                  </Text>

                  <Text
                    style={styles.vehicleSummaryNumber}
                    numberOfLines={1}
                  >
                    {normalizedVehicle.number}
                  </Text>
                </View>

                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusBadgeText}>
                    {normalizedVehicle.status}
                  </Text>
                </View>
              </View>
            ) : null}
          </LinearGradient>

          {loading ? (
            <View style={styles.loaderCard}>
              <LoadingSpinner text="Loading vehicle details..." />
            </View>
          ) : normalizedVehicle ? (
            <View style={styles.content}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>
                    VEHICLE PROFILE
                  </Text>
                  <Text style={styles.sectionTitle}>
                    Assigned vehicle
                  </Text>
                </View>

                <View style={styles.verifiedPill}>
                  <AppIcon
                    library="Ionicons"
                    name="checkmark-circle"
                    size={17}
                    color={UI.success}
                  />
                  <Text style={styles.verifiedText}>
                    Active
                  </Text>
                </View>
              </View>

              <View style={styles.detailsCard}>
                <View style={styles.detailsGrid}>
                  <DetailItem
                    icon="truck-outline"
                    label="Vehicle Type"
                    value={normalizedVehicle.type}
                    accent={UI.accent}
                  />

                  <DetailItem
                    icon="license"
                    label="Vehicle Number"
                    value={normalizedVehicle.number}
                    accent={UI.primary}
                  />

                  {normalizedVehicle.make !==
                  "Not provided" ? (
                    <DetailItem
                      icon="car-info"
                      label="Make / Brand"
                      value={normalizedVehicle.make}
                      accent="#7C3AED"
                    />
                  ) : null}

                  {normalizedVehicle.year !==
                  "Not provided" ? (
                    <DetailItem
                      icon="calendar-check-outline"
                      label="Registration Year"
                      value={normalizedVehicle.year}
                      accent={UI.warning}
                    />
                  ) : null}

                  {normalizedVehicle.color !==
                  "Not provided" ? (
                    <DetailItem
                      icon="palette-outline"
                      label="Vehicle Color"
                      value={normalizedVehicle.color}
                      accent="#DB2777"
                    />
                  ) : null}

                  <DetailItem
                    icon="shield-check-outline"
                    label="Assignment Status"
                    value={normalizedVehicle.status}
                    accent={UI.success}
                  />
                </View>
              </View>

              <View style={styles.infoCard}>
                <View style={styles.infoIcon}>
                  <AppIcon
                    library="Ionicons"
                    name="information-circle-outline"
                    size={22}
                    color={UI.accent}
                  />
                </View>

                <View style={styles.infoCopy}>
                  <Text style={styles.infoTitle}>
                    Need to update vehicle details?
                  </Text>
                  <Text style={styles.infoText}>
                    Vehicle changes require admin verification. Contact support or your administrator.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() =>
                  fetchVehicleDetails(true)
                }
                activeOpacity={0.86}
              >
                <AppIcon
                  library="Ionicons"
                  name="refresh"
                  size={20}
                  color={UI.textInverse}
                />
                <Text style={styles.refreshButtonText}>
                  Refresh Details
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <AppIcon
                  library="MaterialCommunityIcons"
                  name="truck-off-outline"
                  size={48}
                  color={UI.accent}
                />
              </View>

              <Text style={styles.emptyTitle}>
                No vehicle assigned
              </Text>

              <Text style={styles.emptySubtitle}>
                {errorMessage ||
                  "Vehicle information will appear here after an administrator assigns and verifies your vehicle."}
              </Text>

              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() =>
                    fetchVehicleDetails()
                  }
                  activeOpacity={0.86}
                >
                  <AppIcon
                    library="Ionicons"
                    name="refresh"
                    size={20}
                    color={UI.textInverse}
                  />
                  <Text style={styles.retryButtonText}>
                    Retry
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backOutlineButton}
                  onPress={() =>
                    navigation.goBack()
                  }
                  activeOpacity={0.82}
                >
                  <Text
                    style={
                      styles.backOutlineButtonText
                    }
                  >
                    Back to Profile
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: UI.primaryDark,
  },

  scrollContent: {
    flexGrow: 1,
    backgroundColor: UI.background,
    paddingTop: 12,
  },

  scrollContentTablet: {
    paddingVertical: 30,
  },

  contentShell: {
    width: "100%",
  },

  contentShellTablet: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },

  header: {
    minHeight: 224,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderRadius: 30,
    overflow: "hidden",
  },

  headerCompact: {
    minHeight: 212,
    marginHorizontal: 12,
    paddingHorizontal: 16,
  },

  headerCircleLarge: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -70,
    top: -78,
    backgroundColor:
      "rgba(255,255,255,0.10)",
  },

  headerCircleSmall: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    left: -42,
    bottom: -52,
    backgroundColor:
      "rgba(255,255,255,0.06)",
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    zIndex: 2,
  },

  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor:
      "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  headerButtonPlaceholder: {
    width: 44,
    height: 44,
    flexShrink: 0,
  },

  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
  },

  headerEyebrow: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.45,
  },

  headerTitle: {
    marginTop: 4,
    color: UI.textInverse,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  headerSubtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.76)",
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "500",
  },

  vehicleSummary: {
    marginTop: 25,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 19,
    backgroundColor:
      "rgba(255,255,255,0.11)",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },

  vehicleAvatar: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor:
      "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  vehicleAvatarText: {
    color: UI.primary,
    fontSize: 20,
    fontWeight: "900",
  },

  vehicleSummaryText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },

  vehicleSummaryTitle: {
    color: UI.textInverse,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },

  vehicleSummaryNumber: {
    marginTop: 3,
    color: "rgba(255,255,255,0.72)",
    fontSize: 11.5,
    fontWeight: "700",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor:
      "rgba(255,255,255,0.14)",
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#5EE6B3",
    marginRight: 6,
  },

  statusBadgeText: {
    color: UI.textInverse,
    fontSize: 10.5,
    fontWeight: "900",
  },

  loaderCard: {
    minHeight: 300,
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 26,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 22,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  sectionEyebrow: {
    color: UI.accent,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  sectionTitle: {
    marginTop: 4,
    color: UI.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },

  verifiedPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor: "#ECFDF5",
    flexDirection: "row",
    alignItems: "center",
  },

  verifiedText: {
    marginLeft: 5,
    color: UI.success,
    fontSize: 10.5,
    fontWeight: "900",
  },

  detailsCard: {
    padding: 14,
    borderRadius: 26,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.border,
    shadowColor: "#173B61",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },

  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  detailItem: {
    width: "48.5%",
    minHeight: 116,
    marginBottom: 12,
    padding: 14,
    borderRadius: 19,
    backgroundColor: "#F8FAFD",
    borderWidth: 1,
    borderColor: "#E9EEF5",
  },

  detailItemFull: {
    width: "100%",
  },

  detailIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  detailCopy: {
    marginTop: 12,
  },

  detailLabel: {
    color: UI.textSecondary,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  detailValue: {
    marginTop: 5,
    color: UI.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },

  infoCard: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: "#F1F8FD",
    borderWidth: 1,
    borderColor: "#D9EDF9",
    flexDirection: "row",
    alignItems: "flex-start",
  },

  infoIcon: {
    width: 30,
    paddingTop: 1,
    alignItems: "center",
    flexShrink: 0,
  },

  infoCopy: {
    flex: 1,
    marginLeft: 8,
  },

  infoTitle: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "900",
  },

  infoText: {
    marginTop: 4,
    color: UI.textSecondary,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "500",
  },

  refreshButton: {
    height: 56,
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: UI.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: UI.primary,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },

  refreshButtonText: {
    marginLeft: 8,
    color: UI.textInverse,
    fontSize: 15,
    fontWeight: "900",
  },

  emptyCard: {
    minHeight: 430,
    marginHorizontal: 16,
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 34,
    borderRadius: 28,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#173B61",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },

  emptyIconWrap: {
    width: 94,
    height: 94,
    borderRadius: 31,
    backgroundColor: "#E8F5FD",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 20,
    color: UI.text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    textAlign: "center",
  },

  emptySubtitle: {
    marginTop: 9,
    maxWidth: 330,
    color: UI.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
  },

  emptyActions: {
    width: "100%",
    marginTop: 24,
  },

  retryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: UI.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  retryButtonText: {
    marginLeft: 8,
    color: UI.textInverse,
    fontSize: 15,
    fontWeight: "900",
  },

  backOutlineButton: {
    height: 54,
    marginTop: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  backOutlineButtonText: {
    color: UI.primary,
    fontSize: 14,
    fontWeight: "900",
  },
});
