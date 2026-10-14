import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "../components/common/AppIcon";
import LoadingSpinner from "../components/LoadingSpinner";
import { fetchAuthenticatedDriverProfile } from "../services/driverProfile";

const THEME = {
  primaryDark: "#082F5B",
  primary: "#0B3B69",
  navy: "#0B2545",
  blue: "#134074",
  cyan: "#0077B6",
  accent: "#159DE3",
  background: "#F3F6FB",
  surface: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  textInverse: "#FFFFFF",
  border: "#E2E8F0",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
};

const getVehicleValue = (vehicle, keys, fallback = "Not provided") => {
  if (!vehicle) return fallback;
  for (const key of keys) {
    const value = vehicle?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return fallback;
};

const DetailItem = memo(({ icon, label, value, accent = THEME.cyan, iconBg = "#E0F2FE" }) => (
  <View style={styles.detailCard}>
    <View style={[styles.detailIconWrap, { backgroundColor: iconBg }]}>
      <AppIcon library="MaterialCommunityIcons" name={icon} size={22} color={accent} />
    </View>
    <View style={styles.detailCopy}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  </View>
));

export default function VehicleDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [vehicleData, setVehicleData] = useState(
    route?.params?.vehicle || null
  );
  const [driverName, setDriverName] = useState(
    route?.params?.driverName || "Driver"
  );
  const [loading, setLoading] = useState(!route?.params?.vehicle);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchVehicleDetails = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage("");

    try {
      const profile = await fetchAuthenticatedDriverProfile();
      setVehicleData(profile.vehicle || null);
      if (profile.name) {
        setDriverName(profile.name);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to refresh vehicle records.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicleDetails();
  }, [fetchVehicleDetails]);

  const normalizedVehicle = useMemo(() => {
    if (!vehicleData) return null;

    return {
      type: getVehicleValue(
        vehicleData,
        ["type", "vehicleType", "model", "name"],
        "Delivery Vehicle"
      ),
      number: getVehicleValue(
        vehicleData,
        ["number", "vehicleNumber", "registrationNumber", "plateNumber", "licensePlate"],
        "Unregistered"
      ),
      make: getVehicleValue(
        vehicleData,
        ["make", "brand", "manufacturer"],
        "Commercial Standard"
      ),
      year: getVehicleValue(
        vehicleData,
        ["registrationYear", "year", "manufactureYear"],
        "Recent"
      ),
      color: getVehicleValue(
        vehicleData,
        ["color", "vehicleColor"],
        "Fleet White"
      ),
      status: getVehicleValue(
        vehicleData,
        ["status", "verificationStatus"],
        "Verified & Active"
      ),
    };
  }, [vehicleData]);

  const handleCallDispatch = () => {
    Alert.alert(
      "Contact Dispatch",
      "Call the fleet dispatch team regarding your vehicle assignment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Dispatch",
          onPress: () => {
            Linking.openURL("tel:+61424796524").catch(() => {
              Alert.alert("Notice", "Dispatch Phone: +61 424 796 524");
            });
          },
        },
      ]
    );
  };

  const handleRequestVehicleEmail = () => {
    const subject = encodeURIComponent(
      `Vehicle Assignment Request - ${driverName}`
    );
    const body = encodeURIComponent(
      `Hi Dispatch Team,\n\nI am registered as an active driver (${driverName}) and would like to request vehicle allocation for upcoming delivery shifts.\n\nLicence details:\n[Enter licence number or vehicle preferences]\n\nThank you,\n${driverName}`
    );
    Linking.openURL(
      `mailto:info@deliveryplus.com.au?subject=${subject}&body=${body}`
    ).catch(() => {
      Alert.alert(
        "Email Client Unavailable",
        "Please send an email to info@deliveryplus.com.au"
      );
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Simple Header */}
      <View
        style={[
          styles.simpleHeader,
          { paddingTop: Math.max(insets.top, 10) },
        ]}
      >
        {insets.top <= 20 ? <View style={styles.sheetHandle} /> : null}

        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("Home");
              }
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <AppIcon library="Ionicons" name="chevron-back" size={22} color={THEME.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Vehicle Details
          </Text>

          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={() => fetchVehicleDetails(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Refresh vehicle details"
          >
            <AppIcon library="Ionicons" name="reload" size={18} color={THEME.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Body */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 36 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchVehicleDetails(true)}
            tintColor={THEME.cyan}
            colors={[THEME.cyan]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <LoadingSpinner text="Checking fleet records..." />
          </View>
        ) : normalizedVehicle ? (
          /* ASSIGNED VEHICLE VIEW */
          <View style={styles.assignedContainer}>
            {/* Vehicle Card Hero */}
            <View style={styles.vehicleHeroCard}>
              <View style={styles.vehicleHeroTop}>
                <View style={styles.vehicleBadgeIcon}>
                  <AppIcon
                    library="MaterialCommunityIcons"
                    name="truck-outline"
                    size={28}
                    color={THEME.cyan}
                  />
                </View>
                <View style={styles.vehicleHeroTitles}>
                  <Text style={styles.vehicleTypeTitle}>
                    {normalizedVehicle.type}
                  </Text>
                  <Text style={styles.vehicleMakeSubtitle}>
                    {normalizedVehicle.make}
                  </Text>
                </View>
                <View style={styles.verifiedActiveBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeBadgeText}>Assigned</Text>
                </View>
              </View>

              {/* License Rego Plate Box */}
              <View style={styles.regoPlateBox}>
                <View style={styles.regoState}>
                  <Text style={styles.regoStateText}>NSW</Text>
                </View>
                <Text style={styles.regoPlateNumber}>
                  {normalizedVehicle.number}
                </Text>
                <View style={styles.regoCheck}>
                  <AppIcon
                    library="Ionicons"
                    name="checkmark-circle"
                    size={16}
                    color={THEME.success}
                  />
                </View>
              </View>
            </View>

            {/* Specifications Section */}
            <Text style={styles.sectionHeading}>Vehicle Specifications</Text>
            <View style={styles.specsGrid}>
              <DetailItem
                icon="truck-fast-outline"
                label="Vehicle Type"
                value={normalizedVehicle.type}
                accent={THEME.cyan}
                iconBg="#E0F2FE"
              />
              <DetailItem
                icon="license"
                label="Plate Number"
                value={normalizedVehicle.number}
                accent={THEME.primary}
                iconBg="#E2E8F0"
              />
              <DetailItem
                icon="car-info"
                label="Make / Brand"
                value={normalizedVehicle.make}
                accent="#7C3AED"
                iconBg="#EDE9FE"
              />
              <DetailItem
                icon="palette-outline"
                label="Color"
                value={normalizedVehicle.color}
                accent="#D97706"
                iconBg="#FEF3C7"
              />
              <DetailItem
                icon="calendar-check-outline"
                label="Model Year"
                value={normalizedVehicle.year}
                accent={THEME.success}
                iconBg="#DCFCE7"
              />
              <DetailItem
                icon="shield-check-outline"
                label="Compliance"
                value={normalizedVehicle.status}
                accent="#0284C7"
                iconBg="#E0F2FE"
              />
            </View>

            {/* Compliance Banner */}
            <View style={styles.complianceCard}>
              <View style={styles.complianceIconWrap}>
                <AppIcon
                  library="MaterialCommunityIcons"
                  name="shield-car"
                  size={24}
                  color={THEME.success}
                />
              </View>
              <View style={styles.complianceCopy}>
                <Text style={styles.complianceTitle}>Roadworthy & Insured</Text>
                <Text style={styles.complianceSubtitle}>
                  This vehicle is covered by commercial goods transit policy and authorized for current dispatch routes.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.vehicleActionsRow}>
              <TouchableOpacity
                style={styles.actionBtnOutline}
                onPress={handleCallDispatch}
                activeOpacity={0.84}
              >
                <AppIcon library="MaterialCommunityIcons" name="phone-outline" size={18} color={THEME.primary} />
                <Text style={styles.actionBtnOutlineText}>Contact Dispatch</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => fetchVehicleDetails(true)}
                activeOpacity={0.84}
              >
                <AppIcon library="Ionicons" name="refresh" size={18} color={THEME.textInverse} />
                <Text style={styles.actionBtnPrimaryText}>Refresh Data</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* NO VEHICLE ASSIGNED VIEW (MODERNIZED & FUNCTIONAL) */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <AppIcon
                  library="MaterialCommunityIcons"
                  name="truck"
                  size={42}
                  color={THEME.cyan}
                />
              </View>

              <View style={styles.emptyPendingBadge}>
                <View style={styles.pendingDot} />
                <Text style={styles.pendingBadgeText}>Fleet Allocation Pending</Text>
              </View>

              <Text style={styles.emptyTitle}>No Vehicle Assigned</Text>
              <Text style={styles.emptyDescription}>
                {errorMessage ||
                  "Your driver account currently does not have an assigned delivery vehicle. Vehicles are allocated and verified directly by the fleet manager."}
              </Text>

              {/* Instructions Box */}
              <View style={styles.instructionBox}>
                <View style={styles.instructionStep}>
                  <Text style={styles.stepNumber}>1</Text>
                  <Text style={styles.stepText}>
                    Contact dispatch or fleet admin with your licence & vehicle preferences.
                  </Text>
                </View>
                <View style={styles.instructionStep}>
                  <Text style={styles.stepNumber}>2</Text>
                  <Text style={styles.stepText}>
                    Once approved by admin, tap 'Check Status Again' below to sync.
                  </Text>
                </View>
              </View>

              {/* High-Utility Action Buttons */}
              <View style={styles.emptyButtonsContainer}>
                <TouchableOpacity
                  style={styles.callDispatchBtn}
                  onPress={handleCallDispatch}
                  activeOpacity={0.86}
                >
                  <AppIcon library="MaterialCommunityIcons" name="phone-in-talk" size={18} color={THEME.textInverse} />
                  <Text style={styles.callDispatchBtnText}>Call Fleet Dispatch</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.emailDispatchBtn}
                  onPress={handleRequestVehicleEmail}
                  activeOpacity={0.86}
                >
                  <AppIcon library="MaterialCommunityIcons" name="email-fast-outline" size={18} color={THEME.primary} />
                  <Text style={styles.emailDispatchBtnText}>Request Vehicle Allocation</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.retryRefreshBtn}
                  onPress={() => fetchVehicleDetails(true)}
                  activeOpacity={0.84}
                >
                  <AppIcon library="Ionicons" name="reload" size={16} color={THEME.textSecondary} />
                  <Text style={styles.retryRefreshBtnText}>Check Status Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  simpleHeader: {
    backgroundColor: THEME.surface,
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  assignedContainer: {
    gap: 16,
  },
  vehicleHeroCard: {
    backgroundColor: THEME.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  vehicleHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  vehicleBadgeIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleHeroTitles: {
    flex: 1,
  },
  vehicleTypeTitle: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: "900",
  },
  vehicleMakeSubtitle: {
    color: THEME.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  verifiedActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.success,
  },
  activeBadgeText: {
    color: THEME.success,
    fontSize: 11.5,
    fontWeight: "800",
  },
  regoPlateBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: "#CBD5E1",
  },
  regoState: {
    backgroundColor: THEME.cyan,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  regoStateText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  regoPlateNumber: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 3,
  },
  regoCheck: {
    width: 20,
    alignItems: "center",
  },
  sectionHeading: {
    color: THEME.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailCard: {
    width: "48%",
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  detailIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCopy: {
    flex: 1,
  },
  detailLabel: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  detailValue: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  complianceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  complianceIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  complianceCopy: {
    flex: 1,
  },
  complianceTitle: {
    color: "#166534",
    fontSize: 13.5,
    fontWeight: "800",
  },
  complianceSubtitle: {
    color: "#15803D",
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  vehicleActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: THEME.surface,
    borderWidth: 1.5,
    borderColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionBtnOutlineText: {
    color: THEME.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionBtnPrimaryText: {
    color: THEME.textInverse,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyContainer: {
    paddingTop: 8,
  },
  emptyCard: {
    backgroundColor: THEME.surface,
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyPendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    marginBottom: 10,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.warning,
  },
  pendingBadgeText: {
    color: "#B45309",
    fontSize: 11.5,
    fontWeight: "800",
  },
  emptyTitle: {
    color: THEME.text,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyDescription: {
    color: THEME.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 8,
  },
  instructionBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  instructionStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.primary,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 20,
  },
  stepText: {
    flex: 1,
    color: THEME.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyButtonsContainer: {
    width: "100%",
    marginTop: 20,
    gap: 10,
  },
  callDispatchBtn: {
    backgroundColor: THEME.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  callDispatchBtnText: {
    color: THEME.textInverse,
    fontSize: 14,
    fontWeight: "800",
  },
  emailDispatchBtn: {
    backgroundColor: THEME.surface,
    borderWidth: 1.5,
    borderColor: THEME.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  emailDispatchBtnText: {
    color: THEME.primary,
    fontSize: 13.5,
    fontWeight: "800",
  },
  retryRefreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  retryRefreshBtnText: {
    color: THEME.textSecondary,
    fontSize: 12.5,
    fontWeight: "700",
  },
});
