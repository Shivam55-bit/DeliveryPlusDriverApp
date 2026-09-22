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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import API, { clearAuthToken, getStoredUser } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import AppIcon from "../components/common/AppIcon";
import {
  normalizeJob,
  getJobState,
  formatJobDate,
  formatJobTime,
  formatScheduledTimeDisplay,
  calculateDriverDuration,
  calculateDriverHourlyEarnings,
  formatLiveTimer,
  useElapsedTime,
  openMap,
} from "../utils/jobHelpers";

export default function JobDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef(null);

  const routeParams = route?.params;
  const rawParam = useMemo(() => routeParams?.job || null, [routeParams]);
  const jobId = rawParam?._id || rawParam?.backendId || rawParam?.id || routeParams?.id;

  const jobState = getJobState(job) || {};
  const myAssignment = useMemo(() => {
    return (
      job?.myAssignment || {
        isAssigned: true,
        isPending: Boolean(jobState?.isPending),
        isInProgress: Boolean(jobState?.isInProgress),
        isCompleted: Boolean(jobState?.isCompleted),
        startedAt: job?.startedAt,
        completedAt: job?.completedAt,
        canStartWork: Boolean(jobState?.isPending),
        canEndWork: Boolean(jobState?.isInProgress),
      }
    );
  }, [job, jobState?.isPending, jobState?.isInProgress, jobState?.isCompleted]);

  const driverEarnings = useMemo(() => {
    return calculateDriverHourlyEarnings(myAssignment, job);
  }, [myAssignment, job]);

  const isMyWorkInProgress = Boolean(
    myAssignment?.isInProgress && myAssignment?.startedAt && !myAssignment?.completedAt
  );
  const elapsedTimeSeconds = useElapsedTime(myAssignment?.startedAt, isMyWorkInProgress);

  const fetchJobDetails = useCallback(async () => {
    let user = currentUser;
    if (!user) {
      user = await getStoredUser();
      if (user) setCurrentUser(user);
    }

    if (!jobId) {
      if (rawParam && (rawParam.id || rawParam._id)) {
        setJob(normalizeJob(rawParam, user));
      }
      setLoading(false);
      return;
    }

    try {
      const response = await API.get(`/jobs/${jobId}`);
      const rawData = response.job || response.data?.job || response;
      setJob(normalizeJob(rawData, user));
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
        setJob(normalizeJob(rawParam, user));
      } else {
        Alert.alert(
          "Error",
          "Unable to load job details: " + (error.response?.data?.message || error.message)
        );
      }
    } finally {
      setLoading(false);
    }
  }, [jobId, rawParam, currentUser, navigation]);

  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  useFocusEffect(
    useCallback(() => {
      fetchJobDetails();
    }, [fetchJobDetails])
  );

  const handleStartJob = () => {
    if (!jobId) {
      Alert.alert("Error", "Missing job reference.");
      return;
    }
    // Navigate to mandatory Start Job Agreement & Signature flow
    navigation.navigate("StartJobAgreement", {
      jobId,
      job,
      onJobStarted: async (updatedJob) => {
        if (updatedJob) setJob(normalizeJob(updatedJob, currentUser));
        await fetchJobDetails();
      },
    });
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

          <View style={styles.headerBadgesCluster}>
            {/* Job Status Badge */}
            <View
              style={[
                styles.headerStatusBadge,
                jobState?.isCompleted && styles.headerStatusCompleted,
                jobState?.isInProgress && styles.headerStatusInProgress,
                jobState?.isPending && styles.headerStatusPending,
                jobState?.isCancelled && styles.headerStatusCancelled,
              ]}
            >
              <View
                style={[
                  styles.headerStatusDot,
                  jobState?.isCompleted && styles.headerStatusDotCompleted,
                  jobState?.isInProgress && styles.headerStatusDotInProgress,
                  jobState?.isPending && styles.headerStatusDotPending,
                  jobState?.isCancelled && styles.headerStatusDotCancelled,
                ]}
              />
              <Text
                style={[
                  styles.headerStatusText,
                  jobState?.isCompleted && styles.headerStatusTextCompleted,
                  jobState?.isInProgress && styles.headerStatusTextInProgress,
                  jobState?.isPending && styles.headerStatusTextPending,
                  jobState?.isCancelled && styles.headerStatusTextCancelled,
                ]}
              >
                {jobState?.isCompleted
                  ? "Completed"
                  : jobState?.isInProgress
                    ? "In Progress"
                    : jobState?.isPending
                      ? "Pending"
                      : "Cancelled"}
              </Text>
            </View>

            {/* My Driver Status Pill if different / multi-driver */}
            {myAssignment.isAssigned && myAssignment.status && (
              <View
                style={[
                  styles.myStatusPill,
                  myAssignment.isCompleted && styles.myStatusPillCompleted,
                  myAssignment.isInProgress && styles.myStatusPillInProgress,
                  myAssignment.isPending && styles.myStatusPillPending,
                ]}
              >
                <Text
                  style={[
                    styles.myStatusPillText,
                    myAssignment.isCompleted && styles.myStatusPillTextCompleted,
                    myAssignment.isInProgress && styles.myStatusPillTextInProgress,
                    myAssignment.isPending && styles.myStatusPillTextPending,
                  ]}
                >
                  My Work: {myAssignment.isCompleted ? "Done" : myAssignment.isInProgress ? "Working" : "Assigned"}
                </Text>
              </View>
            )}
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
        {/* ── Completed Driver WORK SUMMARY Card ── */}
        {myAssignment.isCompleted ? (
          <View style={[styles.card, styles.workSummaryCard]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <AppIcon
                  library="Ionicons"
                  name="receipt-outline"
                  size={18}
                  color="#0284C7"
                />
                <Text style={styles.cardSectionTitleClean}>
                  WORK SUMMARY
                </Text>
              </View>
              <View style={styles.completedBadgeSmall}>
                <AppIcon library="Ionicons" name="checkmark-circle" size={13} color="#16A34A" />
                <Text style={styles.completedBadgeSmallText}>SESSION ENDED</Text>
              </View>
            </View>

            {/* Scheduled Date */}
            <View style={styles.scheduledDateBlock}>
              <Text style={styles.dateLabel}>SCHEDULED DATE</Text>
              <Text style={styles.dateValue}>
                {formatJobDate(job.scheduledDate || job.scheduledAt)}
              </Text>
            </View>

            {/* 3-Column Work Times Grid */}
            <View style={styles.timingGrid3Col}>
              <View style={styles.timingCol}>
                <Text style={styles.timingLabel}>Start Time</Text>
                <Text style={[styles.timingValue, styles.timingValueActive]} numberOfLines={1}>
                  {myAssignment.startedAt ? formatJobTime(myAssignment.startedAt) : "--"}
                </Text>
              </View>

              <View style={styles.timingColDivider} />

              <View style={styles.timingCol}>
                <Text style={styles.timingLabel}>End Time</Text>
                <Text style={[styles.timingValue, styles.timingValueCompleted]} numberOfLines={1}>
                  {myAssignment.completedAt ? formatJobTime(myAssignment.completedAt) : "--"}
                </Text>
              </View>

              <View style={styles.timingColDivider} />

              <View style={styles.timingCol}>
                <Text style={styles.timingLabel}>Total Worked Time</Text>
                <Text style={[styles.timingValue, styles.timingValueSuccess]} numberOfLines={1}>
                  {calculateDriverDuration(myAssignment)}
                </Text>
              </View>
            </View>

            {/* Completed Session Duration Banner */}
            <View style={styles.completedDurationBanner}>
              <View style={styles.durationLeft}>
                <AppIcon
                  library="Ionicons"
                  name="checkmark-circle"
                  size={18}
                  color="#16A34A"
                />
                <Text style={styles.durationTitle}>Driver Session Completed</Text>
              </View>
              <Text style={styles.durationValue}>
                {calculateDriverDuration(myAssignment)}
              </Text>
            </View>

            {/* Earnings Breakdown - Rendered ONLY if showDriverPrice is true */}
            {driverEarnings.showDriverPrice && driverEarnings.canShowPrice ? (
              <View style={styles.earningsBreakdownBox}>
                <View style={styles.breakdownHeaderRow}>
                  <AppIcon library="Ionicons" name="cash-outline" size={15} color="#0284C7" />
                  <Text style={styles.breakdownHeaderTitle}>
                    {driverEarnings.isHourly ? "HOURLY EARNINGS BREAKDOWN" : "PAYOUT DETAILS"}
                  </Text>
                </View>

                {driverEarnings.isHourly ? (
                  <>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Base Duration</Text>
                      <Text style={styles.breakdownValue}>{driverEarnings.formattedBaseDuration}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Hourly Rate</Text>
                      <Text style={styles.breakdownValue}>{driverEarnings.formattedHourlyRate}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Base Cost</Text>
                      <Text style={styles.breakdownValue}>{driverEarnings.formattedBaseAmount}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Callout Charge</Text>
                      <Text style={styles.breakdownValue}>{driverEarnings.formattedCalloutFee}</Text>
                    </View>
                    {driverEarnings.stairsFee > 0 ? (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Stairs Fee</Text>
                        <Text style={styles.breakdownValue}>{driverEarnings.formattedStairsFee}</Text>
                      </View>
                    ) : null}
                    {driverEarnings.travelBackFee > 0 ? (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Travel Back</Text>
                        <Text style={styles.breakdownValue}>{driverEarnings.formattedTravelBackFee}</Text>
                      </View>
                    ) : null}
                    {driverEarnings.overtimeMinutes > 0 ? (
                      <>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Overtime</Text>
                          <Text style={styles.breakdownValue}>{driverEarnings.formattedOvertimeMinutes}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Overtime Charge</Text>
                          <Text style={[styles.breakdownValue, { color: "#D97706", fontWeight: "700" }]}>
                            {driverEarnings.formattedOvertimeAmount}
                          </Text>
                        </View>
                      </>
                    ) : null}

                    <View style={styles.breakdownDivider} />

                    <View style={styles.finalAmountRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.finalAmountLabel}>Final Driver Amount</Text>
                        {driverEarnings.overtimeBlocks > 0 ? (
                          <Text style={styles.overtimeSlabNote}>
                            Includes {driverEarnings.overtimeBlocks} × 30-min overtime slab{driverEarnings.overtimeBlocks > 1 ? "s" : ""}
                          </Text>
                        ) : (
                          <Text style={styles.overtimeSlabNote}>Within base duration</Text>
                        )}
                      </View>
                      <Text style={styles.finalAmountValue}>
                        {driverEarnings.formattedFinalAmount}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Pricing Type</Text>
                      <Text style={styles.breakdownValue}>
                        {job.driverPriceType ? job.driverPriceType.toUpperCase() : "FIXED"}
                      </Text>
                    </View>
                    <View style={styles.breakdownDivider} />
                    <View style={styles.finalAmountRow}>
                      <Text style={styles.finalAmountLabel}>Final Driver Amount</Text>
                      <Text style={styles.finalAmountValue}>
                        {driverEarnings.formattedFinalAmount}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            ) : null}
          </View>
        ) : (
          /* ── Schedule & Work Time Card (In Progress / Pending) ── */
          <View style={[styles.card, styles.timingCard]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <AppIcon
                  library="Ionicons"
                  name="calendar-outline"
                  size={18}
                  color="#0284C7"
                />
                <Text style={styles.cardSectionTitleClean}>
                  Schedule & Work Time
                </Text>
              </View>
              <View style={styles.typeTagSmall}>
                <AppIcon
                  library="Ionicons"
                  name={job.isMovingJob ? "cube-outline" : "car-outline"}
                  size={13}
                  color="#0284C7"
                />
                <Text style={styles.typeTagSmallText}>
                  {job.jobTypeLabel.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Scheduled Date */}
            <View style={styles.scheduledDateBlock}>
              <Text style={styles.dateLabel}>SCHEDULED DATE</Text>
              <Text style={styles.dateValue}>
                {formatJobDate(job.scheduledDate || job.scheduledAt)}
              </Text>
            </View>

            {/* 3-Column Timing Grid: Scheduled Time | My Start Time | My End Time */}
            <View style={styles.timingGrid3Col}>
              <View style={styles.timingCol}>
                <Text style={styles.timingLabel}>Scheduled Time</Text>
                <Text style={styles.timingValue} numberOfLines={1}>
                  {formatScheduledTimeDisplay(job)}
                </Text>
              </View>

              <View style={styles.timingColDivider} />

              <View style={styles.timingCol}>
                <Text style={styles.timingLabel}>My Start Time</Text>
                <Text
                  style={[
                    styles.timingValue,
                    myAssignment.startedAt && styles.timingValueActive,
                  ]}
                  numberOfLines={1}
                >
                  {myAssignment.startedAt ? formatJobTime(myAssignment.startedAt) : "--"}
                </Text>
              </View>

              <View style={styles.timingColDivider} />

              <View style={styles.timingCol}>
                <Text style={styles.timingLabel}>My End Time</Text>
                <Text
                  style={[
                    styles.timingValue,
                    myAssignment.isCompleted &&
                    myAssignment.completedAt &&
                    styles.timingValueCompleted,
                  ]}
                  numberOfLines={1}
                >
                  {myAssignment.isCompleted && myAssignment.completedAt
                    ? formatJobTime(myAssignment.completedAt)
                    : "--"}
                </Text>
              </View>
            </View>

            {/* Dynamic Bottom Status Banner */}
            {!myAssignment.isAssigned ? (
              <View style={styles.notAssignedBanner}>
                <AppIcon
                  library="Ionicons"
                  name="alert-circle-outline"
                  size={16}
                  color="#DC2626"
                />
                <Text style={styles.notAssignedText}>
                  You are not currently assigned to this job.
                </Text>
              </View>
            ) : isMyWorkInProgress ? (
              <View style={styles.liveTimerBanner}>
                <View style={styles.liveTimerLeft}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.liveTimerTitle}>My Live Job Time</Text>
                </View>
                <Text style={styles.liveTimerClock}>
                  {formatLiveTimer(elapsedTimeSeconds)}
                </Text>
              </View>
            ) : (
              <View style={styles.notStartedBanner}>
                <AppIcon
                  library="Ionicons"
                  name="hourglass-outline"
                  size={16}
                  color="#64748B"
                />
                <Text style={styles.notStartedText}>Work not started</Text>
              </View>
            )}
          </View>
        )}

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

        {/* ── Driver Pricing Details (Before Completion only, when showDriverPrice is true) ── */}
        {!myAssignment.isCompleted && driverEarnings.showDriverPrice && driverEarnings.canShowPrice ? (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Estimated Driver Price</Text>

            <View style={styles.pricingGrid}>
              {driverEarnings.isHourly ? (
                <>
                  <View style={styles.pricingItem}>
                    <Text style={styles.pricingLabel}>Hourly Rate</Text>
                    <Text style={[styles.pricingValue, styles.finalCostValue]}>
                      {driverEarnings.formattedHourlyRate}
                    </Text>
                  </View>

                  <View style={styles.pricingItem}>
                    <Text style={styles.pricingLabel}>Minimum Duration</Text>
                    <Text style={styles.pricingValue}>
                      {driverEarnings.formattedBaseDuration}
                    </Text>
                  </View>

                  <View style={styles.pricingItem}>
                    <Text style={styles.pricingLabel}>Base Cost</Text>
                    <Text style={styles.pricingValue}>
                      {driverEarnings.formattedBaseAmount}
                    </Text>
                  </View>

                  <View style={styles.pricingItem}>
                    <Text style={styles.pricingLabel}>Callout Charge</Text>
                    <Text style={styles.pricingValue}>
                      {driverEarnings.formattedCalloutFee}
                    </Text>
                  </View>

                  {driverEarnings.stairsFee > 0 ? (
                    <View style={styles.pricingItem}>
                      <Text style={styles.pricingLabel}>Stairs Fee</Text>
                      <Text style={styles.pricingValue}>
                        {driverEarnings.formattedStairsFee}
                      </Text>
                    </View>
                  ) : null}

                  {driverEarnings.travelBackFee > 0 ? (
                    <View style={styles.pricingItem}>
                      <Text style={styles.pricingLabel}>Travel Back</Text>
                      <Text style={styles.pricingValue}>
                        {driverEarnings.formattedTravelBackFee}
                      </Text>
                    </View>
                  ) : null}

                  <View style={[styles.pricingItem, { width: "100%" }]}>
                    <Text style={styles.pricingLabel}>Estimated Total</Text>
                    <Text style={[styles.pricingValue, styles.finalCostValue, { fontSize: 18 }]}>
                      {driverEarnings.formattedEstimatedTotal || driverEarnings.formattedInitialTotal}
                    </Text>
                    <Text style={styles.pricingNotice}>
                      * Final amount with 30-min overtime slabs will be calculated upon ending work session.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.pricingItem}>
                    <Text style={styles.pricingLabel}>Estimated Driver Price</Text>
                    <Text style={[styles.pricingValue, styles.finalCostValue]}>
                      {driverEarnings.formattedFinalAmount}
                    </Text>
                  </View>

                  {job?.driverPriceType || driverEarnings.priceType ? (
                    <View style={styles.pricingItem}>
                      <Text style={styles.pricingLabel}>Price Type</Text>
                      <Text style={styles.pricingValue}>
                        {String(job?.driverPriceType || driverEarnings.priceType).toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </View>
        ) : null /* Pricing hidden when showPriceToDriver is false */}

        {/* ── Items & Instructions ── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Instructions & Items</Text>
          <Text style={styles.notesText}>{job.notes || "No special instructions provided."}</Text>
        </View>

        {/* ── Start Agreement Evidence (Read-Only) ── */}
        {(
          (myAssignment?.startAgreement && (myAssignment?.isInProgress || myAssignment?.isCompleted || myAssignment?.startedAt)) ||
          (job?.startAgreement && (myAssignment?.isInProgress || myAssignment?.isCompleted || job?.status === "in_progress" || job?.status === "completed"))
        ) ? (
          <View style={styles.card}>
            <View style={styles.evidenceHeaderRow}>
              <View style={styles.evidenceHeaderLeft}>
                <AppIcon
                  library="Ionicons"
                  name="shield-checkmark-outline"
                  size={18}
                  color="#16A34A"
                />
                <Text style={styles.cardSectionTitleClean}>
                  Start Agreement Evidence
                </Text>
              </View>
              <View style={styles.verifiedBadge}>
                <AppIcon library="Ionicons" name="checkmark" size={11} color="#16A34A" />
                <Text style={styles.verifiedBadgeText}>RECORDED</Text>
              </View>
            </View>

            {(() => {
              const agreement = myAssignment.startAgreement || job.startAgreement;
              return (
                <>
                  <View style={styles.evidenceGrid}>
                    <View style={styles.evidenceRow}>
                      <Text style={styles.evidenceLabel}>Terms Read:</Text>
                      <Text style={styles.evidenceValue}>Yes</Text>
                    </View>
                    <View style={styles.evidenceRow}>
                      <Text style={styles.evidenceLabel}>Terms Accepted:</Text>
                      <Text style={styles.evidenceValue}>Yes</Text>
                    </View>
                    <View style={styles.evidenceRow}>
                      <Text style={styles.evidenceLabel}>Stairs at Property:</Text>
                      <Text
                        style={[
                          styles.evidenceValue,
                          (agreement.stairsOption === "yes" ||
                            agreement.stairsAtProperty)
                            ? styles.evidenceWarning
                            : styles.evidenceSuccess,
                        ]}
                      >
                        {agreement.stairsOption
                          ? agreement.stairsOption.toUpperCase()
                          : agreement.stairsAtProperty
                            ? "YES"
                            : "NO"}
                      </Text>
                    </View>
                    <View style={styles.evidenceRow}>
                      <Text style={styles.evidenceLabel}>Signatory Name:</Text>
                      <Text style={styles.evidenceValue}>
                        {agreement.customerSignatureName ||
                          job.customerName ||
                          "Customer"}
                      </Text>
                    </View>
                    {agreement.acceptedAt || myAssignment.startedAt || job.startedAt ? (
                      <View style={styles.evidenceRow}>
                        <Text style={styles.evidenceLabel}>Accepted Time:</Text>
                        <Text style={styles.evidenceValue}>
                          {formatJobTime(
                            agreement.acceptedAt || myAssignment.startedAt || job.startedAt
                          )}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {agreement.customerSignature ? (
                    <View style={styles.sigPreviewSection}>
                      <Text style={styles.sigPreviewLabel}>
                        Customer Start Signature
                      </Text>
                      <View style={styles.sigPreviewBox}>
                        <Image
                          source={{ uri: agreement.customerSignature }}
                          style={styles.sigImage}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  ) : null}
                </>
              );
            })()}
          </View>
        ) : null}

        {/* ── Action Buttons (Dependent on Driver Assignment & Status) ── */}
        {!jobState?.isCancelled ? (
          !myAssignment.isAssigned ? (
            <View style={styles.unassignedActionBanner}>
              <AppIcon library="Ionicons" name="information-circle-outline" size={20} color="#D97706" />
              <Text style={styles.unassignedActionText}>
                You are not assigned to this job. (View only)
              </Text>
            </View>
          ) : myAssignment.canStartWork ? (
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleStartJob}
                activeOpacity={0.8}
              >
                <AppIcon library="Ionicons" name="play-sharp" size={20} color="#FFF" />
                <Text style={styles.primaryActionText}>Start Job</Text>
              </TouchableOpacity>
            </View>
          ) : myAssignment.canEndWork ? (
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, styles.endJobBtn]}
                onPress={handleEndJob}
                activeOpacity={0.8}
              >
                <AppIcon library="Ionicons" name="checkmark-done-sharp" size={20} color="#FFF" />
                <Text style={styles.primaryActionText}>End Job & Complete</Text>
              </TouchableOpacity>
            </View>
          ) : myAssignment.isCompleted ? (
            <View style={styles.readOnlyBanner}>
              <AppIcon library="Ionicons" name="checkmark-circle" size={18} color="#16A34A" />
              <Text style={styles.readOnlyText}>
                Your work session for this job is completed.
              </Text>
            </View>
          ) : (
            <View style={styles.readOnlyBanner}>
              <AppIcon library="Ionicons" name="lock-closed-outline" size={18} color="#64748B" />
              <Text style={styles.readOnlyText}>
                This job is {jobState?.isCompleted ? "completed" : "closed"} and is read-only.
              </Text>
            </View>
          )
        ) : (
          <View style={styles.readOnlyBanner}>
            <AppIcon library="Ionicons" name="close-circle-outline" size={18} color="#EF4444" />
            <Text style={styles.readOnlyText}>This job is cancelled.</Text>
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
  timingCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderTopWidth: 3.5,
    borderTopColor: "#0284C7",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  workSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    borderTopWidth: 3.5,
    borderTopColor: "#16A34A",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  completedBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  completedBadgeSmallText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#16A34A",
    letterSpacing: 0.4,
  },
  timingValueSuccess: {
    color: "#15803D",
    fontWeight: "900",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  cardSectionTitleClean: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  typeTagSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  typeTagSmallText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 0.4,
  },
  scheduledDateBlock: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  dateValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  timingGrid3Col: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  timingCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 2,
  },
  timingColDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E2E8F0",
  },
  timingLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  timingValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
  },
  timingValueActive: {
    color: "#0284C7",
    fontWeight: "900",
  },
  timingValueCompleted: {
    color: "#16A34A",
    fontWeight: "900",
  },
  liveTimerBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0B2545",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  liveTimerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#38BDF8",
  },
  liveTimerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  liveTimerClock: {
    fontSize: 14,
    fontWeight: "900",
    color: "#38BDF8",
    letterSpacing: 0.5,
    fontVariant: ["tabular-nums"],
  },
  completedDurationBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 12,
  },
  durationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  durationTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  durationValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#15803D",
  },
  notStartedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  notStartedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
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
  earningsBreakdownBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginTop: 14,
  },
  breakdownHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 8,
  },
  breakdownHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  breakdownValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 10,
  },
  finalAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  finalAmountLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#166534",
  },
  finalAmountValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#15803D",
  },
  overtimeSlabNote: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16A34A",
    marginTop: 2,
  },
  pricingNotice: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 6,
    fontStyle: "italic",
    lineHeight: 15,
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
  evidenceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  evidenceHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#16A34A",
    letterSpacing: 0.4,
  },
  evidenceGrid: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  evidenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  evidenceLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  evidenceValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  evidenceSuccess: {
    color: "#16A34A",
  },
  evidenceWarning: {
    color: "#D97706",
  },
  sigPreviewSection: {
    marginTop: 12,
  },
  sigPreviewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  sigPreviewBox: {
    height: 90,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  sigImage: {
    width: "100%",
    height: "100%",
  },
  headerBadgesCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  myStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  myStatusPillPending: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  myStatusPillInProgress: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  myStatusPillCompleted: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  myStatusPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
  },
  myStatusPillTextPending: {
    color: "#D97706",
  },
  myStatusPillTextInProgress: {
    color: "#2563EB",
  },
  myStatusPillTextCompleted: {
    color: "#16A34A",
  },
  notAssignedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  notAssignedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  unassignedActionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  unassignedActionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    lineHeight: 18,
  },
});