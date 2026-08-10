import React, { useMemo, useState, useEffect } from "react";
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
import API from "../services/api";

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
  const status = normalizeStatus(job.status);
  const statusStyle = getStatusStyle(status);
  return {
    id: job.jobNumber || job._id,
    backendId: job._id,
    time:
      job.scheduledTime ||
      (job.scheduledDate
        ? new Date(job.scheduledDate).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : ""),
    name: job.customerName || job.customerId?.name || "",
    phone: job.customerPhone || job.customerId?.phone || "",
    pickup: job.pickupAddress || "",
    drop: job.dropAddress || "",
    jobType: job.jobType,
    type: job.jobType
      ? job.jobType.charAt(0).toUpperCase() + job.jobType.slice(1)
      : "Delivery",
    status,
    statusLabel: statusStyle.label,
    rawStatus: job.status,
    distance: job.distance || (job.estimatedHours ? `${job.estimatedHours || ""}h` : ""),
    earnings: "",
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

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await API.get("/jobs/driver/my-jobs");
        const rawJobs = response.jobs || response.data?.jobs || [];
        setJobs(rawJobs.map(normalizeJob));
      } catch (error) {
        alert("Failed to load jobs: " + (error.response?.data?.message || error.message));
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

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
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>
              {item.statusLabel}
            </Text>
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
        barStyle="light-content"
        backgroundColor={C.navy}
        translucent={false}
      />

      <View
        style={[
          styles.header,
          isCompactPhone && styles.headerCompact,
        ]}
      >
        <View
          pointerEvents="none"
          style={styles.headerDecorLarge}
        />
        <View
          pointerEvents="none"
          style={styles.headerDecorSmall}
        />

        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerEyebrow}>ASSIGNMENTS</Text>
            <Text
              style={[
                styles.headerTitle,
                isCompactPhone && styles.headerTitleCompact,
              ]}
              numberOfLines={1}
            >
              My Jobs
            </Text>
            <Text
              style={styles.headerSubtitle}
              numberOfLines={2}
            >
              Track your assigned and active jobs
            </Text>
          </View>

          <View style={styles.jobCountPill}>
            <Text style={styles.jobCountNumber}>
              {filteredJobs.length}
            </Text>
            <Text style={styles.jobCountText}>
              {filteredJobs.length === 1 ? "JOB" : "JOBS"}
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
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
    backgroundColor: C.navy,
  },
  bodyWrap: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ────────────────────────────────────────────────
  header: {
    minHeight: 236,
    backgroundColor: C.navy,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    overflow: "hidden",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerCompact: {
    minHeight: 226,
    paddingHorizontal: 16,
  },
  headerDecorLarge: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -82,
    top: -92,
    backgroundColor: "rgba(2,132,199,0.24)",
  },
  headerDecorSmall: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    left: -36,
    bottom: -42,
    backgroundColor: "rgba(56,189,248,0.10)",
  },
  headerTopRow: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  headerEyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: "rgba(255,255,255,0.68)",
    marginBottom: 7,
  },
  headerTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: C.white,
    letterSpacing: -0.7,
  },
  headerTitleCompact: {
    fontSize: 30,
    lineHeight: 36,
  },
  headerSubtitle: {
    marginTop: 6,
    maxWidth: 245,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: "rgba(255,255,255,0.72)",
  },
  jobCountPill: {
    minWidth: 68,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  jobCountNumber: {
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "900",
    color: C.white,
  },
  jobCountText: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.9,
    color: "rgba(255,255,255,0.72)",
  },

  // ── Search ────────────────────────────────────────────────
  searchWrap: {
    marginTop: 14,
    width: "100%",
    zIndex: 3,
  },
  searchBox: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 18,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.52)",
    shadowColor: "#020617",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  searchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EAF6FC",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 52,
    marginLeft: 10,
    marginRight: 6,
    fontSize: 14,
    color: C.textPrimary,
    paddingVertical: 0,
  },
  clearSearchButton: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // ── Filters ───────────────────────────────────────────────
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
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
});