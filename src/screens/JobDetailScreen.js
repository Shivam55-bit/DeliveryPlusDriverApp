import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Linking,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import API, { clearAuthToken } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import AppIcon from "../components/common/AppIcon";
import {
  normalizeJob,
  getJobState,
  formatTime,
  formatScheduledTime,
  formatDurationDisplay,
  useElapsedTime,
  formatFormattedTimer,
  openMap,
} from "../utils/jobHelpers";

export default function JobDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompactPhone = width < 390;
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const scrollViewRef = useRef(null);

  const routeParams = route?.params;
  const rawParam = useMemo(() => routeParams?.job || null, [routeParams]);
  const jobId = rawParam?._id || rawParam?.backendId || rawParam?.id || routeParams?.id;

  const jobState = getJobState(job);
  const elapsedTimeSeconds = useElapsedTime(job?.startedAt, jobState.isInProgress);

  const fetchJobDetails = useCallback(async () => {
    if (!jobId) {
      if (rawParam && (rawParam.id || rawParam._id)) {
        setJob(normalizeJob(rawParam));
      }
      setLoading(false);
      return;
    }

    try {
      const response = await API.get(`/jobs/${jobId}`);
      const rawData = response.job || response.data?.job || response;
      setJob(normalizeJob(rawData));
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthToken();
        Alert.alert("Session Expired", "Please login again.", [
          { text: "OK", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Login" }] }) },
        ]);
        return;
      }

      console.warn("API load error, falling back to params:", error.message);
      if (rawParam) {
        setJob(normalizeJob(rawParam));
      } else {
        Alert.alert(
          "Error",
          "Unable to load job details: " + (error.response?.data?.message || error.message)
        );
      }
    } finally {
      setLoading(false);
    }
  }, [jobId, rawParam, navigation]);

  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  useFocusEffect(
    useCallback(() => {
      fetchJobDetails();
    }, [fetchJobDetails])
  );

  const handleStartJob = async () => {
    if (!jobId) {
      Alert.alert("Error", "Missing job ID.");
      return;
    }

    setStarting(true);
    try {
      const response = await API.post(`/jobs/${jobId}/start`);
      const updatedRaw = response?.job || response?.data?.job;

      if (updatedRaw) {
        setJob((prevJob) => {
          const mergedRaw = {
            ...prevJob,
            ...Object.fromEntries(
              Object.entries(updatedRaw).filter(([, value]) => value !== undefined && value !== null)
            ),
          };
          return normalizeJob(mergedRaw);
        });
      } else {
        // Refetch if backend response didn't return complete job object
        await fetchJobDetails();
      }

      Alert.alert("Job Started!", "Job is now in progress.");
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthToken();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        return;
      }

      const msg = error.response?.data?.message || error.message || "Failed to start job.";
      Alert.alert("Start Error", String(msg));
    } finally {
      setStarting(false);
    }
  };

  const handleEndJob = () => {
    navigation.navigate("JobCompletionTerms", {
      jobId,
      job,
    });
  };

  const handleCallCustomer = () => {
    if (!job?.customerPhone) {
      Alert.alert("No Phone Number", "Customer phone number is not available.");
      return;
    }
    Linking.openURL(`tel:${job.customerPhone}`).catch((err) => {
      Alert.alert("Error", "Could not dial phone: " + err.message);
    });
  };

  if (loading && !job) {
    return <LoadingSpinner text="Loading job details..." />;
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#0B2545" />
        <View style={styles.emptyContainer}>
          <AppIcon library="Ionicons" name="alert-circle-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyText}>Job details not found.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchJobDetails}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header ── */}
      <View style={styles.headerShell}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <AppIcon
              library="Ionicons"
              name="chevron-back"
              size={22}
              color="#0F172A"
            />
          </TouchableOpacity>

          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Job Details
            </Text>
            <Text style={styles.headerEyebrow} numberOfLines={1}>
              {job.isMovingJob ? "MOVING SERVICE" : "DELIVERY SERVICE"}
            </Text>
          </View>

          {job.customerPhone ? (
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleCallCustomer}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Call customer"
            >
              <AppIcon
                library="Ionicons"
                name="call-outline"
                size={19}
                color="#0284C7"
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSidePlaceholder} />
          )}
        </View>

        <View style={styles.headerBottomRow}>
          <View style={styles.referenceBlock}>
            <Text style={styles.referenceLabel}>JOB REFERENCE</Text>
            <Text style={styles.referenceValue} numberOfLines={1}>
              #{job.jobReference}
            </Text>
          </View>

          <View
            style={[
              styles.headerStatusBadge,
              jobState.isCompleted && styles.headerStatusCompleted,
              jobState.isInProgress && styles.headerStatusInProgress,
              jobState.isPending && styles.headerStatusPending,
              jobState.isCancelled && styles.headerStatusCancelled,
            ]}
          >
            <View
              style={[
                styles.headerStatusDot,
                jobState.isCompleted && styles.headerStatusDotCompleted,
                jobState.isInProgress && styles.headerStatusDotInProgress,
                jobState.isPending && styles.headerStatusDotPending,
                jobState.isCancelled && styles.headerStatusDotCancelled,
              ]}
            />
            <Text
              style={[
                styles.headerStatusText,
                jobState.isCompleted && styles.headerStatusTextCompleted,
                jobState.isInProgress && styles.headerStatusTextInProgress,
                jobState.isPending && styles.headerStatusTextPending,
                jobState.isCancelled && styles.headerStatusTextCancelled,
              ]}
            >
              {jobState.isCompleted
                ? "Completed"
                : jobState.isInProgress
                  ? "In Progress"
                  : jobState.isPending
                    ? "Pending"
                    : "Cancelled"}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 132 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status & Timing Bar ── */}
        <View style={[styles.card, styles.statusCard]}>
          <View style={styles.jobTypeHeaderRow}>
            <View style={styles.typeTag}>
              <AppIcon
                library="Ionicons"
                name={job.isMovingJob ? "cube-outline" : "car-outline"}
                size={16}
                color="#0284C7"
              />
              <Text style={styles.typeTagText}>JOB TYPE: {job.jobTypeLabel.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.timingGrid}>
            <View style={styles.timingItem}>
              <Text style={styles.timingLabel}>Scheduled</Text>
              <Text style={styles.timingValue}>
                {formatScheduledTime(job.scheduledAt || job.scheduledTime)}
              </Text>
            </View>

            {jobState.isInProgress || jobState.isCompleted ? (
              <View style={styles.timingItem}>
                <Text style={styles.timingLabel}>Started Time</Text>
                <Text style={styles.timingValue}>{formatTime(job.startedAt)}</Text>
              </View>
            ) : null}

            {jobState.isCompleted ? (
              <View style={styles.timingItem}>
                <Text style={styles.timingLabel}>Ended Time</Text>
                <Text style={styles.timingValue}>
                  {formatTime(job.endedAt || job.completedAt)}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Running Timer Bar */}
          {jobState.isInProgress ? (
            <View style={styles.timerBanner}>
              <View style={styles.timerLeft}>
                <View style={styles.pulseDot} />
                <Text style={styles.timerTitle}>Running Timer</Text>
              </View>
              <Text style={styles.timerClock}>
                {formatFormattedTimer(elapsedTimeSeconds)}
              </Text>
            </View>
          ) : null}

          {/* Total Duration for Completed */}
          {jobState.isCompleted && job.actualDurationMinutes ? (
            <View style={styles.durationBanner}>
              <AppIcon library="Ionicons" name="time-outline" size={18} color="#16A34A" />
              <Text style={styles.durationTitle}>Total Duration:</Text>
              <Text style={styles.durationValue}>
                {formatDurationDisplay(job.actualDurationMinutes)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Customer Details ── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Customer Information</Text>

          <View style={styles.customerRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {(job.customerName || "C").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{job.customerName}</Text>
              <Text style={styles.customerPhone}>{job.customerPhone || "No phone listed"}</Text>
            </View>

            {job.customerPhone ? (
              <TouchableOpacity style={styles.callBtn} onPress={handleCallCustomer}>
                <AppIcon library="Ionicons" name="call" size={18} color="#FFF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ── Route Addresses & Navigation ── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Route Details</Text>

          {/* Pickup Address */}
          <View style={styles.addressBlock}>
            <View style={styles.addressTitleRow}>
              <View style={styles.pickupDot} />
              <Text style={styles.addressLabel}>PICKUP LOCATION</Text>
            </View>
            <Text style={styles.addressText}>{job.pickupAddress || job.pickup || "Not specified"}</Text>

            {job.pickupAddress || job.pickup ? (
              <TouchableOpacity
                style={styles.navInlineBtn}
                onPress={() => openMap(job.pickupAddress || job.pickup)}
                activeOpacity={0.8}
              >
                <AppIcon library="Ionicons" name="navigate-outline" size={16} color="#0284C7" />
                <Text style={styles.navInlineText}>Navigate to Pickup</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.routeDivider} />

          {/* Dropoff Address */}
          <View style={styles.addressBlock}>
            <View style={styles.addressTitleRow}>
              <View style={styles.dropDot} />
              <Text style={styles.addressLabel}>DROP-OFF LOCATION</Text>
            </View>
            <Text style={styles.addressText}>{job.dropoffAddress || job.dropAddress || job.drop || "Not specified"}</Text>

            {job.dropoffAddress || job.dropAddress || job.drop ? (
              <TouchableOpacity
                style={styles.navInlineBtn}
                onPress={() => openMap(job.dropoffAddress || job.dropAddress || job.drop)}
                activeOpacity={0.8}
              >
                <AppIcon library="Ionicons" name="navigate-outline" size={16} color="#0284C7" />
                <Text style={styles.navInlineText}>Navigate to Drop-off</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ── Driver Pricing Details ── */}
        {job.canShowPrice ? (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Job Price</Text>

            <View style={styles.pricingGrid}>
              <View style={styles.pricingItem}>
                <Text style={styles.pricingLabel}>Driver Price</Text>
                <Text style={[styles.pricingValue, styles.finalCostValue]}>
                  {job.formattedPrice || `$${Number(job.driverPrice).toFixed(2)}`}
                </Text>
              </View>

              {job.driverPriceType ? (
                <View style={styles.pricingItem}>
                  <Text style={styles.pricingLabel}>Price Type</Text>
                  <Text style={styles.pricingValue}>{job.driverPriceType}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null /* Pricing hidden when showPriceToDriver is false */}

        {/* ── Items & Instructions ── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Instructions & Items</Text>
          <Text style={styles.notesText}>{job.notes || "No special instructions provided."}</Text>
        </View>

        {/* ── Action Buttons (Dependent on Job Status) ── */}
        {!jobState.isCompleted && !jobState.isCancelled ? (
          <View style={styles.actionSection}>
            {jobState.isPending ? (
              <TouchableOpacity
                style={[styles.primaryActionBtn, starting && styles.btnDisabled]}
                onPress={handleStartJob}
                disabled={starting}
                activeOpacity={0.8}
              >
                <AppIcon library="Ionicons" name="play-sharp" size={20} color="#FFF" />
                <Text style={styles.primaryActionText}>
                  {starting ? "Starting Job..." : "Start Job"}
                </Text>
              </TouchableOpacity>
            ) : null}

            {jobState.isInProgress ? (
              <TouchableOpacity
                style={[styles.primaryActionBtn, styles.endJobBtn]}
                onPress={handleEndJob}
                activeOpacity={0.8}
              >
                <AppIcon library="Ionicons" name="checkmark-done-sharp" size={20} color="#FFF" />
                <Text style={styles.primaryActionText}>End Job & Complete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.readOnlyBanner}>
            <AppIcon library="Ionicons" name="lock-closed-outline" size={18} color="#64748B" />
            <Text style={styles.readOnlyText}>
              This job is {jobState.isCompleted ? "completed" : "cancelled"} and is read-only.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerShell: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTopRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerSidePlaceholder: {
    width: 38,
    height: 38,
    flexShrink: 0,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 12,
    justifyContent: "center",
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 23,
  },
  headerEyebrow: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    lineHeight: 13,
    marginTop: 1,
  },
  headerBottomRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 14,
  },
  referenceBlock: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  referenceLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  referenceValue: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  headerStatusBadge: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 0,
  },
  headerStatusText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.45,
  },
  headerStatusTextPending: {
    color: "#B45309",
  },
  headerStatusTextInProgress: {
    color: "#0369A1",
  },
  headerStatusTextCompleted: {
    color: "#15803D",
  },
  headerStatusTextCancelled: {
    color: "#B91C1C",
  },
  headerStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerStatusPending: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  headerStatusInProgress: {
    backgroundColor: "#E0F2FE",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  headerStatusCompleted: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  headerStatusCancelled: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  headerStatusDotPending: {
    backgroundColor: "#D97706",
  },
  headerStatusDotInProgress: {
    backgroundColor: "#0284C7",
  },
  headerStatusDotCompleted: {
    backgroundColor: "#16A34A",
  },
  headerStatusDotCancelled: {
    backgroundColor: "#DC2626",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
  },
  statusInProgress: {
    backgroundColor: "#E0F2FE",
  },
  statusCompleted: {
    backgroundColor: "#DCFCE7",
  },
  statusCancelled: {
    backgroundColor: "#FEE2E2",
  },
  detailMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statusCard: {
    backgroundColor: "#EAF2FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderLeftWidth: 4.5,
    borderLeftColor: "#0284C7",
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  jobTypeHeaderRow: {
    marginBottom: 14,
  },
  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  typeTagText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0369A1",
    letterSpacing: 0.5,
  },
  timingGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0F2FE",
    shadowColor: "rgba(2, 132, 199, 0.06)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  timingItem: {
    flex: 1,
    alignItems: "center",
  },
  timingLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  timingValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  timerBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0B2545",
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  timerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#38BDF8",
  },
  timerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  timerClock: {
    fontSize: 18,
    fontWeight: "900",
    color: "#38BDF8",
    letterSpacing: 1,
  },
  durationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  durationTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16A34A",
  },
  durationValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#15803D",
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0B2545",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarInitial: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "800",
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  customerPhone: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  addressBlock: {
    marginBottom: 6,
  },
  addressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F5A623",
  },
  dropDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
  },
  addressText: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
    lineHeight: 20,
    marginLeft: 18,
  },
  navInlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 18,
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  navInlineText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },
  routeDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14,
  },
  pricingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pricingItem: {
    width: "47%",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
  },
  pricingLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  pricingValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  finalCostValue: {
    color: "#16A34A",
  },
  notesText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 20,
  },
  actionSection: {
    marginTop: 8,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0B2545",
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#0B2545",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  endJobBtn: {
    backgroundColor: "#16A34A",
    shadowColor: "#16A34A",
  },
  btnDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  readOnlyText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 12,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: "#0B2545",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: {
    color: "#FFF",
    fontWeight: "700",
  },
});