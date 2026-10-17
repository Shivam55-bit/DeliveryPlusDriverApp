import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  AppState,
  RefreshControl,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import AppIcon from "../components/common/AppIcon";
import JobTimerBanner from "../components/JobTimerBanner";
import { getStoredUser } from "../services/api";
import {
  fetchDriverJobs,
  getCachedDriverJobs,
  loadPersistedDriverJobs,
} from "../services/driverJobs";
import {
  getDriverVisiblePrice,
  normalizeMyDriverAssignment,
  getJobPricingSummary,
  formatCurrency,
  formatJobDate,
  formatScheduledTime,
  isJobScheduledOnDate,
} from "../utils/jobHelpers";
import { isJobRecentCompleted } from "../utils/completedJobsFilter";

// ── Design Tokens ─────────────────────────────────────────────
const C = {
  bg: "#F4F7FB",
  navy: "#071E3B",
  navy800: "#0A2545",
  amber: "#D97706",
  amberBg: "#FFF7ED",
  white: "#FFFFFF",
  cardBorder: "rgba(15, 23, 42, 0.08)",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  subtle: "#94A3B8",
  success: "#16A34A",
  successBg: "#DCFCE7",
  error: "#EF4444",
  errorBg: "#FEE2E2",
  blue: "#0284C7",
  blueBg: "#E0F2FE",
  indigo: "#4F46E5",
  indigoBg: "#EEF2FF",
  routeLine: "#CBD5E1",
  divider: "#E2E8F0",
};

const FILTERS = ["All", "Pending", "In Transit", "Arrived", "Started", "Completed"];

const normalizeStatus = (status) => {
  switch (String(status || "").trim().toLowerCase()) {
    case "assigned":
    case "pending":
      return "pending";
    case "in_transit":
    case "intransit":
    case "in transit":
    case "transit":
    case "in-transit":
      return "inTransit";
    case "arrived":
    case "arrival":
    case "reached":
      return "arrived";
    case "started":
    case "start":
    case "in progress":
    case "ongoing":
    case "paused":
      return "started";
    case "completed":
    case "cancelled":
      return "completed";
    default:
      return "pending";
  }
};

const getStatusStyle = (status) => {
  switch (status) {
    case "assigned":
    case "pending":
      return {
        bg: C.amberBg,
        text: C.amber,
        label: status === "assigned" ? "Assigned" : "Pending",
        icon: "calendar-clock-outline",
      };
    case "inTransit":
      return {
        bg: C.indigoBg,
        text: C.indigo,
        label: "In Transit",
        icon: "truck-fast-outline",
      };
    case "started":
      return {
        bg: C.blueBg,
        text: C.blue,
        label: "In Progress",
        icon: "progress-clock",
      };
    case "arrived":
      return {
        bg: C.blueBg,
        text: C.blue,
        label: "Arrived",
        icon: "map-marker-check-outline",
      };
    case "completed":
      return {
        bg: C.successBg,
        text: C.success,
        label: "Completed",
        icon: "check-circle-outline",
      };
    default:
      return {
        bg: "#F1F5F9",
        text: C.textMuted,
        label: status,
        icon: "calendar-outline",
      };
  }
};

const normalizeJob = (job, currentUser = null) => {
  const myAssignment = normalizeMyDriverAssignment(job, currentUser, {
    requireDriverMatch: true,
  });
  const pricing = getJobPricingSummary(job, myAssignment);

  // Driver's personal work status takes precedence for card status
  const personalStatus = myAssignment?.isCompleted
    ? "completed"
    : myAssignment?.isInProgress
    ? "started"
    : myAssignment?.isPending || myAssignment?.isAssigned
    ? "assigned"
    : normalizeStatus(job?.status);

  const status = personalStatus;
  const statusStyle = getStatusStyle(status);

  const rawPickup =
    job?.pickupAddress ??
    job?.pickupLocation ??
    job?.pickup?.address ??
    (typeof job?.pickup === "string" ? job.pickup : job?.pickup?.formattedAddress) ??
    "Pickup address not specified";

  const rawDrop =
    job?.dropAddress ??
    job?.dropoffAddress ??
    job?.dropLocation ??
    job?.dropoff?.address ??
    (typeof job?.drop === "string" ? job.drop : (typeof job?.dropoff === "string" ? job.dropoff : job?.dropoff?.formattedAddress)) ??
    "Drop-off address not specified";

  const startedAt = myAssignment?.isInProgress && myAssignment?.startedAt
    ? myAssignment.startedAt
    : null;

  const scheduledDate =
    job?.scheduledDate ??
    job?.scheduledAt ??
    job?.scheduledDateTime ??
    job?.date;

  const isToday = isJobScheduledOnDate(job);
  const dateLabel = formatJobDate(scheduledDate, true);
  const timeFormatted = formatScheduledTime(job);
  const hasValidTime =
    timeFormatted &&
    timeFormatted !== "--" &&
    timeFormatted !== "Not available" &&
    timeFormatted !== "Invalid date";

  const scheduleBadge = isToday
    ? (hasValidTime ? `Today · ${timeFormatted}` : "Today")
    : (dateLabel !== "--" && dateLabel !== "Invalid Date"
        ? (hasValidTime ? `${dateLabel} · ${timeFormatted}` : dateLabel)
        : (hasValidTime ? timeFormatted : "Scheduled"));

  const driverVisiblePrice = getDriverVisiblePrice(job, myAssignment);
  const formattedPrice =
    status === "completed"
      ? pricing.formattedFinalTotal
      : formatCurrency(driverVisiblePrice);

  return {
    raw: job,
    id: job?.jobNumber || job?.jobReference || job?.referenceNumber || job?._id || "N/A",
    backendId: job?._id,
    myAssignment,
    time: timeFormatted,
    scheduleBadge,
    scheduledDateLabel: dateLabel !== "--" ? dateLabel : "",
    isToday,
    name:
      job?.customerName ||
      job?.customer?.name ||
      job?.customerId?.name ||
      job?.user?.name ||
      "Customer",
    phone:
      job?.customerPhone ||
      job?.customer?.phone ||
      job?.customerId?.phone ||
      job?.user?.phone ||
      "",
    pickup: typeof rawPickup === "string" ? rawPickup : "Pickup address not specified",
    drop: typeof rawDrop === "string" ? rawDrop : "Drop-off address not specified",
    jobType: job?.jobType,
    type: String(job?.jobType || "delivery").toLowerCase().includes("moving")
      ? "Moving"
      : "Delivery",
    status,
    statusStyle,
    startedAt,
    showPriceToDriver: pricing.showDriverPrice,
    driverPrice: driverVisiblePrice,
    formattedPrice,
    canShowPrice: pricing.canShowPrice,
  };
};

export default function JobsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobLoadError, setJobLoadError] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const fetchingJobsRef = useRef(false);

  const fetchJobs = useCallback(async (isManualRefresh = false) => {
    if (fetchingJobsRef.current) return;
    fetchingJobsRef.current = true;
    if (isManualRefresh) setRefreshing(true);
    try {
      const user = await getStoredUser();
      setCurrentUser(user);
      const rawJobs = await fetchDriverJobs("JobsScreen.fetchJobs");
      setJobs(
        rawJobs
          .map((job) => normalizeJob(job, user))
          .filter((job) => job.myAssignment?.isAssigned)
      );
      setJobLoadError(false);
    } catch (error) {
      if (__DEV__) {
        console.warn("[JobsScreen] Failed to fetch or normalize driver jobs:", {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        });
      }
      setJobLoadError(true);
    } finally {
      fetchingJobsRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Instant cache hydration on mount (< 100ms)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const user = await getStoredUser();
        const cached = getCachedDriverJobs() || (await loadPersistedDriverJobs());
        if (cached && Array.isArray(cached) && cached.length > 0 && isMounted) {
          setJobs(
            cached
              .map((job) => normalizeJob(job, user))
              .filter((job) => job.myAssignment?.isAssigned)
          );
          setLoading(false);
        }
      } catch (err) {}
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs])
  );

  // AppState change handling: Refresh when app resumes from background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        fetchJobs();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [fetchJobs]);

  // Periodic polling when any job is active
  useEffect(() => {
    let interval = null;
    const hasActiveJob = jobs.some((j) => ["started", "inTransit", "arrived"].includes(j.status));
    if (hasActiveJob) {
      interval = setInterval(() => {
        fetchJobs();
      }, 25000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobs, fetchJobs]);

  // Periodic 30-second re-evaluation timer and AppState resume handler for 24h job expiry
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setCurrentTime(Date.now());
        fetchJobs();
      }
    });

    return () => {
      clearInterval(timer);
      subscription?.remove();
    };
  }, [fetchJobs]);

  const onPullRefresh = useCallback(() => {
    fetchJobs(true);
  }, [fetchJobs]);

  const filteredJobs = useMemo(() => {
    const driverId = currentUser?._id || currentUser?.id;
    return jobs.filter((job) => {
      const isCompleted = job.status === "completed";
      const isRecent = isJobRecentCompleted(job.raw || job, currentTime, driverId);

      // If active filter is "Completed", must be completed AND within 24 hours
      if (activeFilter === "Completed" && (!isCompleted || !isRecent)) {
        return false;
      }

      // If active filter is "All", completed jobs older than 24 hours automatically disappear
      if (activeFilter === "All" && isCompleted && !isRecent) {
        return false;
      }

      const matchFilter =
        activeFilter === "All" ||
        (activeFilter === "Pending" &&
          ["pending", "assigned"].includes(job.status)) ||
        (activeFilter === "In Transit" && job.status === "inTransit") ||
        (activeFilter === "Arrived" && job.status === "arrived") ||
        (activeFilter === "Started" && job.status === "started") ||
        (activeFilter === "Completed" && isCompleted && isRecent);

      const searchText = `${job.name} ${job.id} ${job.pickup} ${job.drop}`.toLowerCase();
      const matchSearch = searchText.includes(search.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [activeFilter, search, jobs, currentTime, currentUser]);

  const handleCallCustomer = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const renderJob = ({ item }) => {
    const statusStyle = item.statusStyle;
    const isCompleted = item.status === "completed";
    const isInProgress = item.status === "started" || item.status === "inTransit" || item.status === "arrived";

    const actionLabel =
      item.status === "pending" || item.status === "assigned"
        ? "Start Job"
        : item.status === "inTransit"
        ? "Navigate"
        : item.status === "arrived"
        ? "Start Work"
        : isInProgress
        ? "Continue Job"
        : "View Details";

    const handleNavigate = () =>
      navigation.navigate("JobDetail", {
        jobId: item.backendId || item.id,
        id: item.backendId || item.id,
        job: item.raw || item,
      });

    const initial = (item.name.charAt(0) || "C").toUpperCase();

    return (
      <TouchableOpacity
        style={styles.jobCard}
        onPress={handleNavigate}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={`Job ${item.id}, ${item.name}`}
      >
        {/* Top Header Row: Job ID Pill + Schedule Pill + Status Pill */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.jobIdPill}>
              <Text style={styles.jobIdText}>#{item.id}</Text>
            </View>

            <View style={styles.schedulePill}>
              <AppIcon library="Feather" name="calendar" size={12} color={C.textSecondary} />
              <Text style={styles.schedulePillText} numberOfLines={1}>
                {item.scheduleBadge}
              </Text>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <AppIcon
              library="MaterialCommunityIcons"
              name={statusStyle.icon}
              size={13}
              color={statusStyle.text}
            />
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {statusStyle.label}
            </Text>
          </View>
        </View>

        <View style={styles.hairlineDivider} />

        {/* Customer & Service Row */}
        <View style={styles.customerRow}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerAvatarText}>{initial}</Text>
          </View>

          <View style={styles.customerInfo}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.name}
            </Text>

            <View style={styles.typePill}>
              <AppIcon
                library="MaterialCommunityIcons"
                name={
                  item.type === "Moving"
                    ? "truck-cargo-container"
                    : "package-variant-closed"
                }
                size={12}
                color={C.blue}
              />
              <Text style={styles.typePillText}>{item.type.toUpperCase()}</Text>
            </View>
          </View>

          {item.phone ? (
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => handleCallCustomer(item.phone)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Call ${item.name}`}
            >
              <AppIcon library="Ionicons" name="call" size={13} color={C.blue} />
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Route Rail: Continuous timeline + addresses */}
        <View style={styles.routeContainer}>
          <View style={styles.routeTimeline}>
            <View style={styles.dotPickupRing}>
              <View style={styles.dotPickup} />
            </View>
            <View style={styles.routeConnector} />
            <View style={styles.dotDropoffRing}>
              <View style={styles.dotDropoff} />
            </View>
          </View>

          <View style={styles.routeDetails}>
            <View style={styles.routeStop}>
              <Text style={styles.routeTagPickup}>PICKUP</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>
                {item.pickup}
              </Text>
            </View>

            <View style={styles.routeStopGap} />

            <View style={styles.routeStop}>
              <Text style={styles.routeTagDropoff}>DROP-OFF</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>
                {item.drop}
              </Text>
            </View>
          </View>
        </View>

        {/* Running Live Timer if active */}
        {isInProgress && item.startedAt ? (
          <View style={styles.timerWrap}>
            <JobTimerBanner startedAt={item.startedAt} />
          </View>
        ) : null}

        {/* Footer: Price on Left, Action CTA on Right */}
        <View style={styles.cardFooter}>
          <View style={styles.priceContainer}>
            {item.canShowPrice && item.formattedPrice ? (
              <>
                <Text style={styles.priceLabel}>
                  {isCompleted ? "FINAL TOTAL" : "ESTIMATED RATE"}
                </Text>
                <Text style={styles.priceValue}>{item.formattedPrice}</Text>
              </>
            ) : (
              <View style={styles.rateDisclosePill}>
                <AppIcon library="Feather" name="shield" size={11} color={C.textMuted} />
                <Text style={styles.rateDiscloseText}>Standard Driver Rate</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.actionCta,
              isCompleted && styles.actionCtaCompleted,
              isInProgress && styles.actionCtaInProgress,
            ]}
            onPress={handleNavigate}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.actionCtaText,
                isCompleted && styles.actionCtaTextCompleted,
              ]}
            >
              {actionLabel}
            </Text>
            <AppIcon
              library="Feather"
              name={isCompleted ? "check" : "arrow-right"}
              size={14}
              color={isCompleted ? C.success : C.white}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={C.bg}
        translucent={false}
      />

      {/* ── Top Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>My Jobs</Text>
          <View style={styles.jobCountBadge}>
            <Text style={styles.jobCountBadgeText}>{jobs.length} Assigned</Text>
          </View>
        </View>

        {/* ── Search Input ── */}
        <View style={styles.searchBox}>
          <View style={styles.searchIconWrap}>
            <AppIcon library="Feather" name="search" size={17} color={C.blue} />
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search job ID, customer, address..."
            placeholderTextColor={C.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />

          {search ? (
            <TouchableOpacity
              style={styles.clearSearchButton}
              onPress={() => setSearch("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.75}
            >
              <AppIcon library="Ionicons" name="close" size={16} color={C.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.bodyWrap}>
        {loading && (!jobs || jobs.length === 0) ? (
          <LoadingSpinner text="Loading your jobs..." />
        ) : (
          <FlatList
            data={filteredJobs}
            keyExtractor={(item) => String(item.backendId || item.id)}
            renderItem={renderJob}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={Platform.OS === "android"}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onPullRefresh}
                colors={[C.blue]}
                tintColor={C.blue}
              />
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: 130 + insets.bottom },
            ]}
            ListEmptyComponent={
              jobLoadError ? (
                <EmptyState
                  icon="alert-circle-outline"
                  title="Unable to load jobs"
                  subtitle="Your job list could not be refreshed. Check your connection and retry."
                  action={
                    <TouchableOpacity
                      style={styles.errorRetryBtn}
                      onPress={() => fetchJobs(true)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.errorRetryText}>Retry</Text>
                    </TouchableOpacity>
                  }
                />
              ) : (
                <EmptyState
                  icon="clipboard-list-outline"
                  title="No matching jobs"
                  subtitle={
                    search
                      ? "No jobs match your search query."
                      : "No assigned jobs match this filter."
                  }
                />
              )
            }
            ListHeaderComponent={
              <>
                {jobLoadError ? (
                  <View style={styles.loadErrorBanner}>
                    <Text style={styles.loadErrorText}>
                      Unable to refresh jobs.
                    </Text>
                    <TouchableOpacity
                      onPress={() => fetchJobs(true)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Filter Chips Bar */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterScroll}
                >
                  {FILTERS.map((f) => {
                    const active = activeFilter === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        onPress={() => setActiveFilter(f)}
                        activeOpacity={0.8}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {f}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.resultRow}>
                  <Text style={styles.resultText}>
                    Showing {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              </>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  bodyWrap: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ────────────────────────────────────────────────
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: C.bg,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: C.navy,
    letterSpacing: -0.5,
  },
  jobCountBadge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
  },
  jobCountBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0284C7",
  },

  // ── Search ────────────────────────────────────────────────
  searchBox: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  searchIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F0F7FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    marginLeft: 10,
    marginRight: 6,
    fontSize: 13.5,
    color: C.textPrimary,
    paddingVertical: 0,
  },
  clearSearchButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // ── Filters ───────────────────────────────────────────────
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingTop: 8,
    paddingBottom: 6,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  chipActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: C.textSecondary,
  },
  chipTextActive: {
    color: C.white,
    fontWeight: "800",
  },

  // ── Result Row ────────────────────────────────────────────
  resultRow: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
  },
  resultText: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  listContent: {
    paddingTop: 4,
  },

  // ── Job Card ──────────────────────────────────────────────
  jobCard: {
    backgroundColor: C.white,
    borderRadius: 22,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.07)",
    shadowColor: "#0B2545",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    paddingRight: 6,
  },
  jobIdPill: {
    backgroundColor: "#EEF2F6",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  jobIdText: {
    fontSize: 13,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: 0.2,
  },
  schedulePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4.5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  schedulePillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: C.textSecondary,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  hairlineDivider: {
    height: 1,
    backgroundColor: C.divider,
    marginVertical: 12,
  },

  // Customer Row
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  customerAvatarText: {
    fontSize: 15,
    fontWeight: "900",
    color: C.blue,
  },
  customerInfo: {
    flex: 1,
    minWidth: 0,
  },
  customerName: {
    fontSize: 15.5,
    fontWeight: "800",
    color: C.textPrimary,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  typePillText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: C.blue,
    letterSpacing: 0.4,
  },

  callButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  callButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.blue,
  },

  // Route Section: Two-Column Continuous Timeline
  routeContainer: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EDF2F7",
  },
  routeTimeline: {
    width: 18,
    alignItems: "center",
    paddingVertical: 2,
  },
  dotPickupRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  dotPickup: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#16A34A",
  },
  routeConnector: {
    flex: 1,
    width: 2,
    backgroundColor: "#CBD5E1",
    marginVertical: 3,
  },
  dotDropoffRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  dotDropoff: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.error,
  },
  routeDetails: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "space-between",
  },
  routeStop: {
    justifyContent: "center",
  },
  routeStopGap: {
    height: 10,
  },
  routeTagPickup: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#16A34A",
    letterSpacing: 0.7,
    marginBottom: 1,
  },
  routeTagDropoff: {
    fontSize: 9.5,
    fontWeight: "900",
    color: C.error,
    letterSpacing: 0.7,
    marginBottom: 1,
  },
  routeAddress: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: C.textPrimary,
  },

  timerWrap: {
    marginBottom: 10,
  },

  // Card Footer
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  priceContainer: {
    flex: 1,
    paddingRight: 10,
  },
  priceLabel: {
    fontSize: 9.5,
    fontWeight: "900",
    color: C.subtle,
    letterSpacing: 0.6,
  },
  priceValue: {
    fontSize: 17,
    fontWeight: "900",
    color: C.navy,
    marginTop: 1,
  },
  rateDisclosePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rateDiscloseText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
  },

  actionCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: C.navy,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  actionCtaInProgress: {
    backgroundColor: C.blue,
    shadowColor: C.blue,
  },
  actionCtaCompleted: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    shadowOpacity: 0,
    elevation: 0,
  },
  actionCtaText: {
    fontSize: 13,
    fontWeight: "800",
    color: C.white,
  },
  actionCtaTextCompleted: {
    color: C.success,
  },

  loadErrorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  loadErrorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
  },
  retryText: {
    color: C.blue,
    fontSize: 13,
    fontWeight: "700",
  },
  errorRetryBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: C.navy,
  },
  errorRetryText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "700",
  },
});