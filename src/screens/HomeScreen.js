import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import {
  moderateScale,
  scale,
  verticalScale,
} from "react-native-size-matters";

import AppIcon from "../components/common/AppIcon";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";

const COLORS = {
  navy900: "#061A33",
  navy800: "#092B53",
  navy700: "#0E3D72",
  blue500: "#2688E8",
  cyan400: "#3EC9F5",
  orange500: "#FFA617",
  green500: "#30C88A",
  red500: "#F04E57",
  white: "#FFFFFF",
  background: "#F2F6FC",
  surface: "#FFFFFF",
  text: "#0C1930",
  muted: "#71809B",
  subtle: "#A5B0C2",
  border: "#E6ECF4",
};

const STATUS_CONFIG = {
  upcoming: {
    label: "Upcoming",
    backgroundColor: "#FFF4E2",
    color: "#D98708",
    icon: "calendar-clock-outline",
  },
  inProgress: {
    label: "In Progress",
    backgroundColor: "#E3F7FC",
    color: "#078BA9",
    icon: "progress-clock",
  },
  completed: {
    label: "Completed",
    backgroundColor: "#E7F8EF",
    color: "#168B54",
    icon: "check-circle-outline",
  },
  cancelled: {
    label: "Cancelled",
    backgroundColor: "#FDECEE",
    color: "#D9424C",
    icon: "close-circle-outline",
  },
};

const normaliseValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const normaliseStatus = (status) => {
  const value = normaliseValue(status);

  if (["assigned", "pending", "upcoming"].includes(value)) {
    return "upcoming";
  }

  if (
    [
      "started",
      "inprogress",
      "intransit",
      "arrived",
      "paused",
    ].includes(value)
  ) {
    return "inProgress";
  }

  if (["completed", "finished"].includes(value)) {
    return "completed";
  }

  if (["cancelled", "canceled"].includes(value)) {
    return "cancelled";
  }

  return "upcoming";
};

const getJobType = (job) => {
  const type = normaliseValue(
    job?.jobType ?? job?.type ?? job?.serviceType
  );

  return {
    raw: type,
    isMoving: type === "moving",
    isDelivery: type === "delivery",
    label:
      type === "moving"
        ? "Moving"
        : type === "delivery"
          ? "Delivery"
          : "Job",
  };
};

const safeCurrency = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return `$${amount.toFixed(2)}`;
};

const formatScheduledTime = (job) => {
  const rawTime =
    job?.scheduledTime ??
    job?.scheduleTime ??
    job?.timeWindowStart ??
    null;

  if (typeof rawTime === "string" && rawTime.trim()) {
    return rawTime.trim();
  }

  const rawDate =
    job?.scheduledAt ??
    job?.scheduledDateTime ??
    job?.scheduledDate ??
    null;

  if (!rawDate) {
    return "Time TBD";
  }

  const date = new Date(rawDate);

  if (Number.isNaN(date.getTime())) {
    return "Time TBD";
  }

  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const getDateLabel = () => {
  const now = new Date();

  return now.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const normaliseJob = (job) => {
  const status = normaliseStatus(job?.status);
  const type = getJobType(job);

  const minimumEstimatedCost =
    job?.minimumEstimatedCost ??
    job?.pricing?.minimumEstimatedCost ??
    null;

  const finalCost =
    job?.finalCost ??
    job?.pricing?.finalCost ??
    null;

  return {
    raw: job,
    id: job?.jobNumber ?? job?.jobReference ?? job?._id,
    backendId: job?._id,
    status,
    customerName:
      job?.customerName ??
      job?.customerId?.name ??
      job?.customer?.name ??
      "Customer",
    customerPhone:
      job?.customerPhone ??
      job?.customerId?.phone ??
      job?.customer?.phone ??
      "",
    pickup:
      job?.pickupAddress ??
      job?.pickup?.address ??
      job?.pickup ??
      "Pickup address not available",
    dropoff:
      job?.dropoffAddress ??
      job?.dropAddress ??
      job?.dropoff?.address ??
      job?.drop ??
      "Drop-off address not available",
    time: formatScheduledTime(job),
    type,
    displayCost:
      type.isMoving
        ? status === "completed"
          ? safeCurrency(finalCost)
          : safeCurrency(minimumEstimatedCost)
        : null,
  };
};

const StatCard = memo(
  ({ icon, value, label, accent, backgroundColor }) => (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statIcon,
          {
            backgroundColor,
          },
        ]}
      >
        <AppIcon
          library="MaterialCommunityIcons"
          name={icon}
          size={moderateScale(22)}
          color={accent}
        />
      </View>

      <AnimatedCounter value={value} style={styles.statValue} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
);

const AnimatedCounter = memo(({ value, style }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = Number(value) || 0;

    Animated.timing(animatedValue, {
      toValue: target,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedValue, value]);

  return (
    <Animated.Text style={style}>
      {animatedValue.interpolate({
        inputRange: [0, Math.max(Number(value) || 1, 1)],
        outputRange: ["0", String(Number(value) || 0)],
        extrapolate: "clamp",
      })}
    </Animated.Text>
  );
});

const JobRoute = memo(({ pickup, dropoff }) => (
  <View style={styles.routeWrap}>
    <View style={styles.routeRail}>
      <View style={styles.pickupDot} />
      <View style={styles.routeLine} />
      <View style={styles.dropoffDot} />
    </View>

    <View style={styles.routeContent}>
      <View>
        <Text style={styles.routeLabel}>PICKUP</Text>
        <Text style={styles.routeAddress} numberOfLines={2}>
          {pickup}
        </Text>
      </View>

      <View style={styles.routeGap} />

      <View>
        <Text style={styles.routeLabel}>DROP-OFF</Text>
        <Text style={styles.routeAddress} numberOfLines={2}>
          {dropoff}
        </Text>
      </View>
    </View>
  </View>
));

const JobCard = memo(({ job, onPress }) => {
  const status =
    STATUS_CONFIG[job.status] ?? STATUS_CONFIG.upcoming;

  return (
    <TouchableOpacity
      style={styles.jobCard}
      activeOpacity={0.92}
      onPress={() => onPress(job)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${job.id} details`}
    >
      <View style={styles.jobCardAccent} />

      <View style={styles.jobCardHeader}>
        <View style={styles.jobReferenceBlock}>
          <Text style={styles.jobReference}>#{job.id}</Text>

          <View style={styles.timeRow}>
            <AppIcon
              library="Feather"
              name="clock"
              size={moderateScale(15)}
              color={COLORS.muted}
            />
            <Text style={styles.jobTime}>{job.time}</Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: status.backgroundColor,
            },
          ]}
        >
          <AppIcon
            library="MaterialCommunityIcons"
            name={status.icon}
            size={moderateScale(14)}
            color={status.color}
          />
          <Text
            style={[
              styles.statusText,
              {
                color: status.color,
              },
            ]}
          >
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.jobDivider} />

      <View style={styles.customerRow}>
        <View style={styles.customerAvatar}>
          <Text style={styles.customerAvatarText}>
            {job.customerName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.customerContent}>
          <Text style={styles.customerName} numberOfLines={1}>
            {job.customerName}
          </Text>

          <View style={styles.typePill}>
            <AppIcon
              library="MaterialCommunityIcons"
              name={
                job.type.isMoving
                  ? "truck-cargo-container"
                  : "truck-delivery-outline"
              }
              size={moderateScale(13)}
              color={COLORS.blue500}
            />
            <Text style={styles.typePillText}>
              {job.type.label.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <JobRoute
        pickup={job.pickup}
        dropoff={job.dropoff}
      />

      <View style={styles.jobFooter}>
        {job.displayCost ? (
          <View style={styles.costBlock}>
            <Text style={styles.costLabel}>
              {job.status === "completed"
                ? "Final Cost"
                : "Minimum Est. Cost"}
            </Text>
            <Text style={styles.costValue}>
              {job.displayCost}
            </Text>
          </View>
        ) : (
          <View style={styles.deliveryMeta}>
            <AppIcon
              library="MaterialCommunityIcons"
              name="package-variant-closed"
              size={moderateScale(17)}
              color={COLORS.muted}
            />
            <Text style={styles.deliveryMetaText}>
              Delivery job
            </Text>
          </View>
        )}

        <View style={styles.detailsAction}>
          <Text style={styles.detailsActionText}>
            View details
          </Text>
          <AppIcon
            library="Feather"
            name="arrow-up-right"
            size={moderateScale(17)}
            color={COLORS.blue500}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
});

const EmptyJobs = memo(() => (
  <View style={styles.emptyCard}>
    <View style={styles.emptyIcon}>
      <AppIcon
        library="MaterialCommunityIcons"
        name="clipboard-text-clock-outline"
        size={moderateScale(44)}
        color={COLORS.blue500}
      />
    </View>
    <Text style={styles.emptyTitle}>No active jobs</Text>
    <Text style={styles.emptySubtitle}>
      New assigned and in-progress jobs will appear here.
    </Text>
  </View>
));

const DashboardHeader = memo(
  ({
    profile,
    stats,
    isOnline,
    togglingStatus,
    unreadCount,
    onToggleOnline,
    onOpenNotifications,
    onViewAll,
  }) => {
    const heroOpacity = useRef(new Animated.Value(0)).current;
    const truckTranslateX = useRef(new Animated.Value(44)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(truckTranslateX, {
          toValue: 0,
          duration: 900,
          delay: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, [heroOpacity, truckTranslateX]);

    return (
      <View>
        <Animated.View style={[styles.heroShell, { opacity: heroOpacity }]}> 
          <LinearGradient
            colors={["#072D59", "#0F4C81", "#19A7FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />

            <View style={styles.heroTopRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile?.name?.charAt(0)?.toUpperCase() || "D"}
                </Text>
              </View>

              <View style={styles.brand}>
                <View style={styles.brandIcon}>
                  <AppIcon
                    library="MaterialCommunityIcons"
                    name="truck-fast-outline"
                    size={moderateScale(20)}
                    color={COLORS.cyan400}
                  />
                </View>
                <Text style={styles.brandMain}>DELIVERY</Text>
                <Text style={styles.brandPlus}>PLUS</Text>
              </View>

              <TouchableOpacity
                style={styles.notificationButton}
                onPress={onOpenNotifications}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Open notifications"
              >
                <AppIcon
                  library="Ionicons"
                  name="notifications-outline"
                  size={moderateScale(22)}
                  color={COLORS.white}
                />

                {unreadCount > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            <View style={styles.heroContent}>
              <View style={styles.greetingBlock}>
                <Text style={styles.greetingText}>
                  {getGreeting()}
                </Text>
                <Text style={styles.profileName} numberOfLines={1}>
                  {profile?.name || "Driver"}
                </Text>
                <Text style={styles.heroSubtitle} numberOfLines={2}>
                  {getDateLabel()}
                </Text>
                <Text style={styles.heroMeta} numberOfLines={1}>
                  Sydney, NSW
                </Text>
              </View>

              <Animated.Image
                source={require("../assets/images/dashboardtruck_image-Photoroom.png")}
                style={[
                  styles.heroTruck,
                  { transform: [{ translateX: truckTranslateX }] },
                ]}
                resizeMode="contain"
              />

            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.statsContainer}>
          <View style={styles.statStrip}>
            <StatCard
              icon="clipboard-text-clock-outline"
              value={stats.assigned}
              label="Assigned"
              accent={COLORS.orange500}
              backgroundColor="#FFF3DE"
            />

            <View style={styles.statSeparator} />

            <StatCard
              icon="truck-fast-outline"
              value={stats.inProgress}
              label="In Progress"
              accent={COLORS.blue500}
              backgroundColor="#E5F2FF"
            />

            <View style={styles.statSeparator} />

            <StatCard
              icon="check-decagram-outline"
              value={stats.completed}
              label="Completed"
              accent={COLORS.green500}
              backgroundColor="#E7F9F1"
            />
          </View>
        </View>

        <View style={styles.onlineCardWrap}>
          <View
            style={[
              styles.onlineCard,
              !isOnline && styles.onlineCardOffline,
            ]}
          >
            <View style={styles.onlineInfo}>
              <View
                style={[
                  styles.onlineIconCircle,
                  !isOnline && styles.onlineIconCircleOffline,
                ]}
              >
                <AppIcon
                  library="MaterialCommunityIcons"
                  name={
                    isOnline
                      ? "account-check-outline"
                      : "account-off-outline"
                  }
                  size={moderateScale(23)}
                  color={
                    isOnline
                      ? COLORS.green500
                      : COLORS.subtle
                  }
                />
              </View>

              <View style={styles.onlineTextBlock}>
                <Text style={styles.onlineTitle}>
                  {isOnline
                    ? "You’re online"
                    : "You’re offline"}
                </Text>
                <Text style={styles.onlineSubtitle}>
                  {isOnline
                    ? "Ready to receive new jobs"
                    : "Go online to receive assignments"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.toggleTrack,
                isOnline && styles.toggleTrackActive,
                togglingStatus &&
                  styles.toggleTrackLoading,
              ]}
              onPress={onToggleOnline}
              activeOpacity={0.85}
              disabled={togglingStatus}
              accessibilityRole="switch"
              accessibilityState={{ checked: isOnline }}
            >
              {togglingStatus ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.white}
                />
              ) : (
                <View
                  style={[
                    styles.toggleThumb,
                    isOnline &&
                      styles.toggleThumbActive,
                  ]}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>
              YOUR SCHEDULE
            </Text>
            <Text style={styles.sectionTitle}>
              Today’s Jobs
            </Text>
          </View>

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={onViewAll}
            activeOpacity={0.85}
          >
            <Text style={styles.viewAllText}>View all</Text>
            <AppIcon
              library="Feather"
              name="arrow-right"
              size={moderateScale(16)}
              color={COLORS.blue500}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({
    assigned: 0,
    inProgress: 0,
    completed: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [togglingStatus, setTogglingStatus] =
    useState(false);
  const [toast, setToast] = useState({
    visible: false,
    type: "success",
    message: "",
  });

  const toastTimer = useRef(null);
  const isMountedRef = useRef(true);

  const showToast = useCallback(
    (message, type = "success") => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }

      setToast({
        visible: true,
        type,
        message,
      });

      toastTimer.current = setTimeout(() => {
        if (isMountedRef.current) {
          setToast((previous) => ({
            ...previous,
            visible: false,
          }));
        }
      }, 2600);
    },
    []
  );

  const loadHomeData = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const [
          profileResponse,
          jobsResponse,
          notificationsResponse,
        ] = await Promise.all([
          API.get("/auth/me"),
          API.get("/jobs/driver/my-jobs"),
          API.get("/notifications?limit=1").catch(
            () => null
          ),
        ]);

        const profileData =
          profileResponse?.user ??
          profileResponse ??
          null;

        const rawJobs =
          jobsResponse?.jobs ??
          jobsResponse?.data?.jobs ??
          [];

        const normalisedJobs = rawJobs
          .map(normaliseJob)
          .filter((job) =>
            ["upcoming", "inProgress", "completed"].includes(
              job.status
            )
          );

        const inProgressJobs =
          normalisedJobs.filter(
            (job) => job.status === "inProgress"
          );
        const upcomingJobs =
          normalisedJobs.filter(
            (job) => job.status === "upcoming"
          );
        const completedJobs =
          normalisedJobs.filter(
            (job) => job.status === "completed"
          );

        const homeJobs = [
          ...inProgressJobs,
          ...upcomingJobs,
        ].slice(0, 3);

        if (!isMountedRef.current) return;

        setProfile(profileData);
        setIsOnline(
          profileData?.isOnline ??
            profileData?.online ??
            profileData?.availability !== "offline"
        );
        setJobs(homeJobs);
        setStats({
          assigned: upcomingJobs.length,
          inProgress: inProgressJobs.length,
          completed: completedJobs.length,
        });
        setUnreadCount(
          Number(
            notificationsResponse?.unreadCount ??
              notificationsResponse?.data
                ?.unreadCount ??
              0
          ) || 0
        );
      } catch (error) {
        if (!isMountedRef.current) return;

        showToast(
          error?.response?.data?.message ??
            "Unable to load your dashboard.",
          "error"
        );
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHomeData({ silent: true });
    }, [loadHomeData])
  );

  useEffect(() => {
    const subscription =
      AppState.addEventListener(
        "change",
        (nextState) => {
          if (nextState === "active") {
            loadHomeData({ silent: true });
          }
        }
      );

    return () => subscription.remove();
  }, [loadHomeData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadHomeData({ silent: true });
  }, [loadHomeData]);

  const handleToggleOnline = useCallback(
    async () => {
      if (togglingStatus) return;

      const nextOnlineState = !isOnline;

      try {
        setTogglingStatus(true);

        const response = await API.put(
          "/driver/me/availability",
          {
            availability: nextOnlineState
              ? "available"
              : "offline",
          }
        );

        if (
          response?.success === false ||
          response?.data?.success === false
        ) {
          throw new Error(
            response?.message ??
              response?.data?.message ??
              "Unable to update availability."
          );
        }

        setIsOnline(nextOnlineState);
        showToast(
          nextOnlineState
            ? "You are now online."
            : "You are now offline."
        );
      } catch (error) {
        showToast(
          error?.response?.data?.message ??
            error?.message ??
            "Unable to update availability.",
          "error"
        );
      } finally {
        setTogglingStatus(false);
      }
    },
    [
      isOnline,
      showToast,
      togglingStatus,
    ]
  );

  const handleOpenJob = useCallback(
    (job) => {
      navigation.navigate("JobDetail", {
        jobId: job.backendId,
        job: job.raw,
      });
    },
    [navigation]
  );

  const listHeader = useMemo(
    () => (
      <DashboardHeader
        profile={profile}
        stats={stats}
        isOnline={isOnline}
        togglingStatus={togglingStatus}
        unreadCount={unreadCount}
        onToggleOnline={handleToggleOnline}
        onOpenNotifications={() =>
          navigation.navigate("Notifications")
        }
        onViewAll={() =>
          navigation.navigate("JobsTab")
        }
      />
    ),
    [
      handleToggleOnline,
      isOnline,
      navigation,
      profile,
      stats,
      togglingStatus,
      unreadCount,
    ]
  );

  const renderJob = useCallback(
    ({ item }) => (
      <JobCard
        job={item}
        onPress={handleOpenJob}
      />
    ),
    [handleOpenJob]
  );

  if (loading) {
    return (
      <LoadingSpinner
        fullScreen
        text="Loading your dashboard..."
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.navy900}
      />

      {toast.visible ? (
        <View
          style={[
            styles.toast,
            {
              top: insets.top + verticalScale(8),
            },
            toast.type === "error"
              ? styles.toastError
              : styles.toastSuccess,
          ]}
        >
          <AppIcon
            library="MaterialCommunityIcons"
            name={
              toast.type === "error"
                ? "alert-circle-outline"
                : "check-circle-outline"
            }
            size={moderateScale(20)}
            color={COLORS.white}
          />
          <Text style={styles.toastText}>
            {toast.message}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={jobs}
        keyExtractor={(item) =>
          String(item.backendId ?? item.id)
        }
        renderItem={renderJob}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={EmptyJobs}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: 145 + insets.bottom,
          },
        ]}
        ItemSeparatorComponent={() => (
          <View style={styles.cardSeparator} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.blue500}
            colors={[COLORS.blue500]}
          />
        }
      />
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    flexGrow: 1,
  },

  heroShell: {
    marginHorizontal: 0,
  },
  hero: {
    width: "100%",
    minHeight: 300,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    borderRadius: 30,
  },
  heroGlowOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.09)",
    top: -80,
    right: -60,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(25,167,255,0.18)",
    bottom: -55,
    left: -35,
  },
  heroTopRow: {
    width: "100%",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 40,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: moderateScale(18),
  },
  brand: {
    flex: 1,
    marginHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  brandIcon: {
    marginRight: 6,
  },
  brandMain: {
    color: COLORS.white,
    fontSize: moderateScale(16),
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  brandPlus: {
    color: COLORS.cyan400,
    fontSize: moderateScale(16),
    fontWeight: "900",
    letterSpacing: 1.8,
    marginLeft: 6,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 9.5,
    backgroundColor: COLORS.red500,
    borderWidth: 2,
    borderColor: "#0F4C81",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: "900",
  },
  heroContent: {
    flex: 1,
    justifyContent: "space-between",
    marginTop: 18,
    paddingBottom: 4,
  },
  greetingBlock: {
    zIndex: 5,
    width: "58%",
  },
  greetingText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 18,
    fontWeight: "600",
  },
  profileName: {
    color: COLORS.white,
    fontSize: 42,
    fontWeight: "900",
    marginTop: 4,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
    maxWidth: "100%",
  },
  heroMeta: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    marginTop: 4,
  },
  heroTruck: {
    position: "absolute",
    width: "48%",
    minWidth: 200,
    maxWidth: 300,
    height: 210,
    right: -30,
    bottom: -10,
  },
  statsContainer: {
    marginHorizontal: 16,
    marginTop: 14,
  },
  statStrip: {
    minHeight: 104,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    shadowColor: "#102A4B",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 9.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.65,
    marginTop: 1,
  },
  statSeparator: {
    width: 1,
    height: 60,
    backgroundColor: COLORS.border,
  },

  onlineCardWrap: {
    marginHorizontal: 16,
    marginTop: 18,
  },
  onlineCard: {
    minHeight: 82,
    borderRadius: 22,
    backgroundColor: "#083563",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  onlineCardOffline: {
    backgroundColor: "#223349",
  },
  onlineInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  onlineIconCircle: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: "rgba(48,200,138,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineIconCircleOffline: {
    backgroundColor: "rgba(165,176,194,0.12)",
  },
  onlineTextBlock: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  onlineTitle: {
    color: COLORS.white,
    fontSize: moderateScale(15),
    fontWeight: "800",
  },
  onlineSubtitle: {
    color: "rgba(255,255,255,0.58)",
    fontSize: moderateScale(10.5),
    lineHeight: moderateScale(15),
    marginTop: verticalScale(2),
  },
  toggleTrack: {
    width: moderateScale(54),
    height: moderateScale(31),
    borderRadius: moderateScale(16),
    backgroundColor: "#56667B",
    padding: moderateScale(3),
    justifyContent: "center",
  },
  toggleTrackActive: {
    backgroundColor: COLORS.green500,
  },
  toggleTrackLoading: {
    alignItems: "center",
  },
  toggleThumb: {
    width: moderateScale(25),
    height: moderateScale(25),
    borderRadius: moderateScale(13),
    backgroundColor: COLORS.white,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 3,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },

  sectionHeader: {
    paddingHorizontal: 18,
    marginTop: 24,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionEyebrow: {
    color: COLORS.blue500,
    fontSize: moderateScale(9.5),
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: moderateScale(23),
    fontWeight: "900",
    marginTop: verticalScale(3),
  },
  viewAllButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#E7F2FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewAllText: {
    color: COLORS.blue500,
    fontSize: moderateScale(12.5),
    fontWeight: "800",
  },

  cardSeparator: {
    height: verticalScale(14),
  },
  jobCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    padding: 17,
    overflow: "hidden",
    shadowColor: "#163659",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  jobCardAccent: {
    position: "absolute",
    left: 0,
    top: verticalScale(23),
    bottom: verticalScale(23),
    width: moderateScale(4),
    borderTopRightRadius: moderateScale(4),
    borderBottomRightRadius: moderateScale(4),
    backgroundColor: COLORS.blue500,
  },
  jobCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  jobReferenceBlock: {
    flex: 1,
  },
  jobReference: {
    color: COLORS.orange500,
    fontSize: moderateScale(17),
    fontWeight: "900",
    letterSpacing: 0.15,
  },
  timeRow: {
    marginTop: verticalScale(5),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  jobTime: {
    color: COLORS.text,
    fontSize: moderateScale(15),
    fontWeight: "700",
  },
  statusBadge: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  statusText: {
    fontSize: moderateScale(10.5),
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },
  jobDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: verticalScale(14),
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  customerAvatar: {
    width: moderateScale(45),
    height: moderateScale(45),
    borderRadius: moderateScale(16),
    backgroundColor: "#EAF3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  customerAvatarText: {
    color: COLORS.blue500,
    fontSize: moderateScale(18),
    fontWeight: "900",
  },
  customerContent: {
    flex: 1,
    marginLeft: scale(11),
  },
  customerName: {
    color: COLORS.text,
    fontSize: moderateScale(19),
    fontWeight: "900",
  },
  typePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    marginTop: verticalScale(5),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(9),
    backgroundColor: "#EAF3FF",
  },
  typePillText: {
    color: COLORS.blue500,
    fontSize: moderateScale(9.5),
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  routeWrap: {
    flexDirection: "row",
    marginTop: verticalScale(18),
  },
  routeRail: {
    width: moderateScale(20),
    alignItems: "center",
    paddingVertical: verticalScale(5),
  },
  pickupDot: {
    width: moderateScale(11),
    height: moderateScale(11),
    borderRadius: moderateScale(6),
    backgroundColor: COLORS.orange500,
  },
  routeLine: {
    width: moderateScale(2),
    height: verticalScale(35),
    backgroundColor: "#DDE4EE",
    marginVertical: verticalScale(5),
  },
  dropoffDot: {
    width: moderateScale(11),
    height: moderateScale(11),
    borderRadius: moderateScale(6),
    backgroundColor: COLORS.red500,
  },
  routeContent: {
    flex: 1,
    marginLeft: scale(7),
  },
  routeLabel: {
    color: COLORS.subtle,
    fontSize: moderateScale(9.5),
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  routeAddress: {
    color: COLORS.text,
    fontSize: moderateScale(14),
    fontWeight: "700",
    lineHeight: moderateScale(19),
    marginTop: verticalScale(2),
  },
  routeGap: {
    height: verticalScale(15),
  },

  jobFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: verticalScale(17),
    paddingTop: verticalScale(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  costBlock: {
    flex: 1,
  },
  costLabel: {
    color: COLORS.muted,
    fontSize: moderateScale(10.5),
    fontWeight: "700",
  },
  costValue: {
    color: "#168B54",
    fontSize: moderateScale(18),
    fontWeight: "900",
    marginTop: verticalScale(2),
  },
  deliveryMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(7),
  },
  deliveryMetaText: {
    color: COLORS.muted,
    fontSize: moderateScale(11.5),
    fontWeight: "700",
  },
  detailsAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
  },
  detailsActionText: {
    color: COLORS.blue500,
    fontSize: moderateScale(12.5),
    fontWeight: "900",
  },

  emptyCard: {
    marginHorizontal: scale(18),
    minHeight: verticalScale(220),
    borderRadius: moderateScale(24),
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(35),
  },
  emptyIcon: {
    width: moderateScale(84),
    height: moderateScale(84),
    borderRadius: moderateScale(30),
    backgroundColor: "#EAF3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: moderateScale(20),
    fontWeight: "900",
    marginTop: verticalScale(17),
  },
  emptySubtitle: {
    color: COLORS.muted,
    fontSize: moderateScale(12.5),
    lineHeight: moderateScale(18),
    textAlign: "center",
    marginTop: verticalScale(6),
  },

  toast: {
    position: "absolute",
    zIndex: 100,
    left: scale(16),
    right: scale(16),
    minHeight: verticalScale(52),
    borderRadius: moderateScale(17),
    paddingHorizontal: scale(15),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(9),
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  toastSuccess: {
    backgroundColor: "#168B54",
  },
  toastError: {
    backgroundColor: "#D94049",
  },
  toastText: {
    flex: 1,
    color: COLORS.white,
    fontSize: moderateScale(12.5),
    fontWeight: "700",
  },
});