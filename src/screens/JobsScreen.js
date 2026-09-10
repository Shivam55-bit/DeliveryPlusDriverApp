import React, { useMemo, useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import AppIcon from "../components/common/AppIcon";
import JobTimerBanner from "../components/JobTimerBanner";
import API from "../services/api";
import { getDriverVisiblePriceInfo } from "../utils/jobHelpers";

// ── Design tokens (matches HomeScreen & ProfileScreen) ──────
const C = {
  bg: "#F4F6FA",
  navy: "#0B2545",
  amber: "#F5A623",
  white: "#FFFFFF",
  cardBorder: "rgba(15, 23, 42, 0.06)",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  success: "#16A34A",
  error: "#EF4444",
  blue: "#0284C7",
  routeLine: "#CBD5E1",
  divider: "#E2E8F0",
  // badge colors
  badgeUpcoming: { bg: "#FFF8ED", text: "#D4850A" },
  badgeInProgress: { bg: "#E0F2FE", text: "#0284C7" },
  badgeCompleted: { bg: "#DCFCE7", text: "#16A34A" },
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
    case "pending":
      return { bg: "rgba(245,166,35,0.14)", text: "#D4850A", label: "Pending" };
    case "inTransit":
      return { bg: "rgba(2,132,199,0.14)", text: "#0284C7", label: "In Transit" };
    case "started":
      return { bg: "rgba(14,165,233,0.14)", text: "#0E8BA8", label: "In Progress" };
    case "arrived":
      return { bg: "rgba(14,165,233,0.14)", text: "#0E8BA8", label: "Arrived" };
    case "completed":
      return { ...C.badgeCompleted, label: "Completed" };
    default:
      return { bg: C.bg, text: C.textMuted, label: status };
  }
};

const normalizeJob = (job) => {
  const status = normalizeStatus(job?.status);
  const statusStyle = getStatusStyle(status);
  const priceInfo = getDriverVisiblePriceInfo(job);

  const rawPickup =
    job?.pickupAddress ??
    job?.pickupLocation ??
    job?.pickup?.address ??
    (typeof job?.pickup === "string" ? job.pickup : job?.pickup?.formattedAddress) ??
    "";

  const rawDrop =
    job?.dropAddress ??
    job?.dropoffAddress ??
    job?.dropLocation ??
    job?.dropoff?.address ??
    (typeof job?.drop === "string" ? job.drop : (typeof job?.dropoff === "string" ? job.dropoff : job?.dropoff?.formattedAddress)) ??
    "";

  return {
    raw: job,
    id: job?.jobNumber || job?.jobReference || job?.referenceNumber || job?._id || "N/A",
    backendId: job?._id,
    time:
      job?.scheduledTime ||
      (job?.scheduledDate
        ? new Date(job.scheduledDate).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : ""),
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
    pickup: typeof rawPickup === "string" ? rawPickup : "",
    drop: typeof rawDrop === "string" ? rawDrop : "",
    jobType: job?.jobType,
    type: job?.jobType
      ? job.jobType.charAt(0).toUpperCase() + job.jobType.slice(1)
      : "Delivery",
    status,
    statusLabel: statusStyle.label,
    rawStatus: job?.status,
    startedAt:
      job?.startedAt ??
      job?.jobStartedAt ??
      job?.actualStartTime ??
      job?.timerStarted ??
      null,
    distance: job?.distance || (job?.estimatedHours ? `${job.estimatedHours || ""}h` : ""),
    showPriceToDriver: priceInfo.showPriceToDriver,
    driverPrice: priceInfo.driverPrice,
    formattedPrice: priceInfo.formattedPrice,
    canShowPrice: priceInfo.canShowPrice,
  };
};

export default function JobsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompactPhone = width < 390;
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await API.get("/jobs/driver/my-jobs").catch(async () => {
        return API.get("/jobs/my-jobs").catch(async () => {
          return API.get("/jobs").catch(() => null);
        });
      });
      const rawJobs =
        response?.jobs ??
        response?.data?.jobs ??
        response?.bookings ??
        response?.data?.bookings ??
        response?.data ??
        response?.results ??
        (Array.isArray(response) ? response : []);
      setJobs((Array.isArray(rawJobs) ? rawJobs : []).map(normalizeJob));
    } catch (error) {
      console.log("Failed to load jobs: ", error?.response?.data?.message || error?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs])
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchFilter =
        activeFilter === "All" ||
        (activeFilter === "Pending" && job.status === "pending") ||
        (activeFilter === "In Transit" && job.status === "inTransit") ||
        (activeFilter === "Arrived" && job.status === "arrived") ||
        (activeFilter === "Started" && job.status === "started") ||
        (activeFilter === "Completed" && job.status === "completed");

      const searchText = `${job.name} ${job.id} ${job.pickup} ${job.drop}`.toLowerCase();
      const matchSearch = searchText.includes(search.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [activeFilter, search, jobs]);

  const getAddressSubtitle = (address) => {
    if (!address) return "";
    const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length <= 1) return "";
    const sub = parts.slice(-2).join(", ");
    return sub === address ? "" : sub;
  };

  const renderJob = ({ item }) => {
    const statusStyle = getStatusStyle(item.status);
    const actionLabel =
      item.status === "pending"
        ? "Start Job"
        : item.status === "inTransit"
        ? "Navigate"
        : item.status === "started"
        ? "Continue"
        : "View Details";

    const handleNavigate = () => navigation.navigate("JobDetail", { job: item });
    const pickupSubtitle = getAddressSubtitle(item.pickup);
    const dropSubtitle = getAddressSubtitle(item.drop);
    const isCompleted = item.status === "completed";

    return (
      <TouchableOpacity
        style={styles.jobCard}
        onPress={handleNavigate}
        activeOpacity={0.9}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobHeaderLeft}>
            <Text style={styles.jobId}>#{item.id}</Text>
            <View style={styles.timeRow}>
              <AppIcon library="Feather" name="clock" size={13} color={C.textMuted} />
              <Text style={styles.jobTime}>{item.time}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {item.canShowPrice ? (
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>{item.formattedPrice}</Text>
              </View>
            ) : null}
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                {item.statusLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.customerName}>{item.name}</Text>
        <Text style={styles.jobTypeText}>{item.type}</Text>

        <View style={styles.contactRow}>
          <AppIcon library="Ionicons" name="call" size={14} color={C.textMuted} />
          <Text style={styles.contactText}>{item.phone}</Text>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routeRow}>
            <View style={styles.dotWrap}>
              <View style={styles.dotPickup} />
            </View>
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeTitle} numberOfLines={1}>
                {item.pickup}
              </Text>
              {pickupSubtitle ? (
                <Text style={styles.routeSubtitle} numberOfLines={1}>
                  {pickupSubtitle}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.dotWrap}>
              <View style={styles.dotDropoff} />
            </View>
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeTitle} numberOfLines={1}>
                {item.drop}
              </Text>
              {dropSubtitle ? (
                <Text style={styles.routeSubtitle} numberOfLines={1}>
                  {dropSubtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {["started", "inTransit", "arrived"].includes(item.status) ? (
          <JobTimerBanner startedAt={item.startedAt} />
        ) : null}

        <View style={styles.actionsRow}>
          {isCompleted ? (
            <TouchableOpacity
              style={styles.completedDetailsBtn}
              onPress={handleNavigate}
              activeOpacity={0.8}
            >
              <AppIcon
                library="Ionicons"
                name="checkmark-circle-outline"
                size={16}
                color="#16A34A"
              />
              <Text style={styles.completedDetailsText}>View Details</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleNavigate}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleNavigate}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{actionLabel}</Text>
              </TouchableOpacity>
            </>
          )}
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

      {/* ── Simple Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>My Jobs</Text>
          <View style={styles.jobCountBadge}>
            <Text style={styles.jobCountBadgeText}>{jobs.length} Jobs</Text>
          </View>
        </View>

        {/* ── Search Bar ── */}
        <View style={styles.searchBox}>
          <View style={styles.searchIconWrap}>
            <AppIcon
              library="Feather"
              name="search"
              size={18}
              color={C.blue}
            />
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search job, customer, location..."
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
              <AppIcon
                library="Ionicons"
                name="close"
                size={17}
                color={C.textSecondary}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.bodyWrap}>
        {loading ? (
          <LoadingSpinner text="Loading jobs..." />
        ) : (
          <FlatList
            data={filteredJobs}
            keyExtractor={(item) => item.id}
            renderItem={renderJob}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: 140 + insets.bottom },
            ]}
            ListEmptyComponent={
              <EmptyState
                icon="clipboard-list-outline"
                title="No jobs found"
                subtitle="Try adjusting your search or filter"
              />
            }
            ListHeaderComponent={
              <>
                {/* ── Search Bar ── */}
                {/* ── Filter Chips ── */}
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

                {/* ── Result Count ── */}
                <View style={styles.resultRow}>
                  <Text style={styles.resultText}>
                    {filteredJobs.length} result
                    {filteredJobs.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              </>
            }
            ListFooterComponent={null}
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
    paddingTop: 14,
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
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.5,
  },
  jobCountBadge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  jobCountBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },

  // ── Search ────────────────────────────────────────────────
  searchBox: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  searchIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EAF6FC",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 46,
    marginLeft: 10,
    marginRight: 6,
    fontSize: 14,
    color: C.textPrimary,
    paddingVertical: 0,
  },
  clearSearchButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
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
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  chipActive: {
    backgroundColor: "#0B2545",
    borderColor: "#0B2545",
    shadowColor: "#0B2545",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSecondary,
  },
  chipTextActive: {
    color: C.white,
    fontWeight: "700",
  },

  // ── Result Count ──────────────────────────────────────────
  resultRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  resultText: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: "600",
  },

  // ── List ──────────────────────────────────────────────────
  listContent: {
    paddingTop: 4,
  },

  // ── Job Card ──────────────────────────────────────────────
  jobCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "rgba(15, 23, 42, 0.08)",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  jobHeaderLeft: {
    flex: 1,
  },
  jobId: {
    fontSize: 13,
    fontWeight: "800",
    color: C.amber,
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  jobTime: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textPrimary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    backgroundColor: C.divider,
    marginVertical: 14,
  },
  customerName: {
    fontSize: 17,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 4,
  },
  jobTypeText: {
    fontSize: 11,
    color: C.navy,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
  },
  contactText: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
  },

  // ── Route ─────────────────────────────────────────────────
  routeContainer: {
    marginBottom: 16,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 14,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  dotWrap: {
    width: 12,
    alignItems: "center",
  },
  dotPickup: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.amber,
  },
  dotDropoff: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.error,
  },
  routeLine: {
    width: 1.5,
    height: 14,
    backgroundColor: C.routeLine,
    marginLeft: 5.25,
    marginVertical: 2,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeTitle: {
    fontSize: 13,
    color: C.textPrimary,
    fontWeight: "700",
  },
  routeSubtitle: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 1,
  },

  // ── Actions ───────────────────────────────────────────────
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.white,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textPrimary,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#0B2545",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0B2545",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.white,
  },
  completedDetailsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.25)",
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    paddingVertical: 11,
  },
  completedDetailsText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16A34A",
  },
  priceBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  priceBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#15803D",
  },
});