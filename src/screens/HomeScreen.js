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
  Platform,
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
import IosDashboardHeader from "../components/IosDashboardHeader";
import JobTimerBanner from "../components/JobTimerBanner";
import API, { getStoredUser, clearAuthToken, getAuthToken, setAuthToken } from "../services/api";
import { getDriverVisiblePriceInfo } from "../utils/jobHelpers";

const logoImage = require("../assets/images/Logo.png");

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
  const priceInfo = getDriverVisiblePriceInfo(job);

  const rawPickup =
    job?.pickupAddress ??
    job?.pickupLocation ??
    job?.pickup?.address ??
    (typeof job?.pickup === "string" ? job.pickup : job?.pickup?.formattedAddress) ??
    "Pickup address not available";

  const rawDropoff =
    job?.dropoffAddress ??
    job?.dropAddress ??
    job?.dropLocation ??
    job?.dropoff?.address ??
    (typeof job?.drop === "string" ? job.drop : (typeof job?.dropoff === "string" ? job.dropoff : job?.dropoff?.formattedAddress)) ??
    "Drop-off address not available";

  return {
    raw: job,
    id: job?.jobNumber ?? job?.jobReference ?? job?.referenceNumber ?? job?._id ?? "N/A",
    backendId: job?._id,
    status,
    customerName:
      job?.customerName ??
      job?.customer?.name ??
      job?.customerId?.name ??
      job?.user?.name ??
      "Customer",
    customerPhone:
      job?.customerPhone ??
      job?.customer?.phone ??
      job?.customerId?.phone ??
      job?.user?.phone ??
      "",
    pickup: typeof rawPickup === "string" ? rawPickup : "Pickup address not available",
    dropoff: typeof rawDropoff === "string" ? rawDropoff : "Drop-off address not available",
    time: formatScheduledTime(job),
    startedAt:
      job?.startedAt ??
      job?.jobStartedAt ??
      job?.actualStartTime ??
      job?.timerStarted ??
      null,
    type,
    showPriceToDriver: priceInfo.showPriceToDriver,
    driverPrice: priceInfo.driverPrice,
    driverPriceType: priceInfo.driverPriceType,
    displayCost: priceInfo.formattedPrice,
    canShowPrice: priceInfo.canShowPrice,
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

      {job.status === "inProgress" ? (
        <JobTimerBanner startedAt={job.startedAt} />
      ) : null}

      <View style={styles.jobFooter}>
        {job.displayCost ? (
          <View style={styles.costBlock}>
            <Text style={styles.costLabel}>Driver Price</Text>
            <Text style={styles.costValue}>{job.displayCost}</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.detailsAction,
            !job.displayCost && { marginLeft: "auto" },
          ]}
        >
          <Text style={styles.detailsActionText}>View details</Text>
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
    const insets = useSafeAreaInsets();
    const displayName =
      profile?.name ??
      profile?.fullName ??
      profile?.firstName ??
      "Driver";

    const firstName = String(displayName).trim().split(" ")[0] || "Driver";
    const initial = firstName.charAt(0).toUpperCase();

    const topInset = Platform.OS === "ios"
      ? Math.max(insets.top, 44) + 6
      : (StatusBar.currentHeight || 12) + 8;

    return (
      <View style={styles.dashboardHeaderContainer}>
        <LinearGradient
          colors={[COLORS.navy900, "#0B3564", "#135491"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: topInset }]}
        >
          <View style={styles.heroGlowOne} pointerEvents="none" />
          <View style={styles.heroGlowTwo} pointerEvents="none" />

          <View style={styles.heroTopRow}>
            <View style={styles.brandWrap}>
              <Image
                source={logoImage}
                style={styles.heroBrandLogo}
                resizeMode="contain"
              />
            </View>

            <TouchableOpacity
              style={styles.notificationButton}
              onPress={onOpenNotifications}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <AppIcon
                library="Feather"
                name="bell"
                size={19}
                color={COLORS.white}
              />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>

          <View style={styles.heroMainRow}>
            <View style={styles.greetingBlock}>
              <Text style={styles.greetingText}>{getGreeting()}</Text>
              <Text style={styles.profileName} numberOfLines={1}>
                {firstName}
              </Text>
              <View style={styles.datePill}>
                <AppIcon
                  library="Feather"
                  name="calendar"
                  size={11}
                  color={COLORS.cyan400}
                />
                <Text style={styles.datePillText}>{getDateLabel()}</Text>
              </View>
            </View>

            <View style={styles.profileOrbWrap}>
              <View style={styles.profileOrbOuter}>
                <View style={styles.profileOrbInner}>
                  <Text style={styles.profileOrbText}>{initial}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.heroStatusPill,
                  !isOnline && styles.heroStatusPillOffline,
                ]}
              >
                <View
                  style={[
                    styles.heroStatusDot,
                    !isOnline && styles.heroStatusDotOffline,
                  ]}
                />
                <Text style={styles.heroStatusText}>
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsContainer}>
          <View style={styles.statStrip}>
            <StatCard
              icon="clipboard-text-clock-outline"
              value={stats.assigned}
              label="Assigned"
              accent={COLORS.orange500}
              backgroundColor="#FFF5E5"
            />
            <View style={styles.statSeparator} />
            <StatCard
              icon="truck-fast-outline"
              value={stats.inProgress}
              label="In Progress"
              accent={COLORS.blue500}
              backgroundColor="#EAF4FF"
            />
            <View style={styles.statSeparator} />
            <StatCard
              icon="check-decagram-outline"
              value={stats.completed}
              label="Completed"
              accent={COLORS.green500}
              backgroundColor="#EAF9F2"
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
                  name={isOnline ? "radio-tower" : "power-standby"}
                  size={20}
                  color={isOnline ? COLORS.green500 : COLORS.subtle}
                />
              </View>

              <View style={styles.onlineTextBlock}>
                <View style={styles.onlineTitleRow}>
                  <Text style={styles.onlineTitle}>
                    {isOnline ? "Available for jobs" : "Currently offline"}
                  </Text>
                  {isOnline ? <View style={styles.liveDot} /> : null}
                </View>
                <Text style={styles.onlineSubtitle}>
                  {isOnline
                    ? "Receiving nearby job assignments"
                    : "Turn availability on when ready"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.toggleTrack,
                isOnline && styles.toggleTrackActive,
                togglingStatus && styles.toggleTrackLoading,
              ]}
              onPress={onToggleOnline}
              activeOpacity={0.85}
              disabled={togglingStatus}
              accessibilityRole="switch"
              accessibilityState={{ checked: isOnline }}
            >
              {togglingStatus ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <View
                  style={[
                    styles.toggleThumb,
                    isOnline && styles.toggleThumbActive,
                  ]}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>TODAY'S SCHEDULE</Text>
            <Text style={styles.sectionTitle}>Your Jobs</Text>
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
              size={14}
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

      // 1. Immediately use cached user profile if available
      try {
        const cachedUser = await getStoredUser();
        if (cachedUser && isMountedRef.current) {
          setProfile((prev) => prev || cachedUser);
        }
      } catch (e) {}

      try {
        const [
          profileResponse,
          jobsResponse,
          notificationsResponse,
        ] = await Promise.all([
          API.get("/auth/me").catch((err) => {
            console.log("[Home] /auth/me error:", err?.response?.status, err?.message);
            if (err?.response?.status === 401) {
              clearAuthToken();
              navigation.replace("Login");
            }
            return null;
          }),
          API.get("/jobs/driver/my-jobs").catch(async (err) => {
            console.log("[Home] /jobs/driver/my-jobs error:", err?.response?.status, err?.message);
            return API.get("/jobs/my-jobs").catch(async () => {
              return API.get("/jobs").catch(() => null);
            });
          }),
          API.get("/notifications?limit=1").catch(
            () => null
          ),
        ]);

        const profileData =
          profileResponse?.user ??
          profileResponse?.driver ??
          profileResponse?.data?.user ??
          profileResponse?.data?.driver ??
          profileResponse?.data ??
          profileResponse ??
          (await getStoredUser()) ??
          null;

        if (profileData && profileResponse) {
          const curToken = getAuthToken();
          if (curToken) {
            setAuthToken(curToken, profileData);
          }
        }

        const rawJobs =
          jobsResponse?.jobs ??
          jobsResponse?.data?.jobs ??
          jobsResponse?.bookings ??
          jobsResponse?.data?.bookings ??
          jobsResponse?.data ??
          jobsResponse?.results ??
          (Array.isArray(jobsResponse) ? jobsResponse : []);

        const normalisedJobs = (Array.isArray(rawJobs) ? rawJobs : [])
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

        if (profileData) {
          setProfile(profileData);
          setIsOnline(
            profileData?.isOnline ??
            profileData?.online ??
            profileData?.availability !== "offline"
          );
        }
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

        console.log("[Home] loadHomeData top error:", error);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [navigation, showToast]
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
    () => {
      if (Platform.OS === "ios") {
        return (
          <IosDashboardHeader
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
        );
      }
      return (
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
      );
    },
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
    <View style={styles.safeArea}>
      <StatusBar
        barStyle={Platform.OS === "ios" ? "dark-content" : "light-content"}
        backgroundColor={Platform.OS === "ios" ? COLORS.background : COLORS.navy900}
        translucent={Platform.OS === "android"}
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
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Platform.OS === "ios" ? COLORS.background : COLORS.navy900,
  },
  listContent: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
  },

  dashboardHeaderContainer: {
    width: "100%",
    backgroundColor: COLORS.background,
  },
  hero: {
    width: "100%",
    paddingHorizontal: scale(18),
    paddingBottom: verticalScale(22),
    borderBottomLeftRadius: moderateScale(24),
    borderBottomRightRadius: moderateScale(24),
    overflow: "hidden",
  },
  heroGlowOne: {
    position: "absolute",
    width: scale(180),
    height: scale(180),
    borderRadius: scale(90),
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    top: verticalScale(-60),
    right: scale(-50),
  },
  heroGlowTwo: {
    position: "absolute",
    width: scale(140),
    height: scale(140),
    borderRadius: scale(70),
    backgroundColor: "rgba(62, 201, 245, 0.12)",
    bottom: verticalScale(-50),
    left: scale(-30),
  },
  heroTopRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  brandWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: scale(10),
  },
  heroBrandLogo: {
    width: scale(140),
    height: verticalScale(36),
  },
  brandMark: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(12),
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(10),
    flexShrink: 0,
  },
  brandCopy: {
    flex: 1,
  },
  brandText: {
    color: COLORS.white,
    fontSize: moderateScale(13),
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  brandCaption: {
    color: COLORS.cyan400,
    fontSize: moderateScale(8.5),
    fontWeight: "800",
    letterSpacing: 1.3,
    marginTop: verticalScale(1),
  },
  notificationButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(13),
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -verticalScale(4),
    right: -scale(4),
    minWidth: moderateScale(18),
    height: moderateScale(18),
    paddingHorizontal: scale(4),
    borderRadius: moderateScale(9),
    backgroundColor: COLORS.red500,
    borderWidth: 2,
    borderColor: COLORS.navy900,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
  },
  notificationBadgeText: {
    color: COLORS.white,
    fontSize: moderateScale(8),
    fontWeight: "900",
  },
  heroMainRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: verticalScale(16),
    zIndex: 2,
  },
  greetingBlock: {
    flex: 1,
    paddingRight: scale(12),
  },
  greetingText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: moderateScale(12.5),
    fontWeight: "600",
  },
  profileName: {
    color: COLORS.white,
    fontSize: moderateScale(23),
    lineHeight: moderateScale(28),
    fontWeight: "900",
    marginTop: verticalScale(2),
    letterSpacing: -0.3,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: verticalScale(6),
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
  },
  datePillText: {
    color: COLORS.cyan400,
    fontSize: moderateScale(10),
    fontWeight: "700",
    marginLeft: scale(5),
  },
  profileOrbWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  profileOrbOuter: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(18),
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileOrbInner: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(14),
    backgroundColor: "rgba(255, 255, 255, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileOrbText: {
    color: COLORS.white,
    fontSize: moderateScale(19),
    fontWeight: "900",
  },
  heroStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: verticalScale(6),
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    backgroundColor: "rgba(48, 200, 138, 0.18)",
  },
  heroStatusPillOffline: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  heroStatusDot: {
    width: moderateScale(5),
    height: moderateScale(5),
    borderRadius: moderateScale(2.5),
    backgroundColor: COLORS.green500,
    marginRight: scale(4),
  },
  heroStatusDotOffline: {
    backgroundColor: COLORS.subtle,
  },
  heroStatusText: {
    color: COLORS.white,
    fontSize: moderateScale(8.5),
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  statsContainer: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  statStrip: {
    minHeight: verticalScale(92),
    borderRadius: moderateScale(22),
    backgroundColor: COLORS.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(10),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#12345A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statIcon: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(12),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statValue: {
    color: COLORS.text,
    fontSize: moderateScale(18),
    fontWeight: "900",
    marginTop: verticalScale(4),
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: moderateScale(8),
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.55,
    marginTop: verticalScale(1),
  },
  statSeparator: {
    width: 1,
    height: verticalScale(47),
    backgroundColor: COLORS.border,
  },

  onlineCardWrap: {
    marginHorizontal: 16,
    marginTop: 14,
  },
  onlineCard: {
    minHeight: verticalScale(72),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "#DDE9F5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(13),
    paddingVertical: verticalScale(11),
  },
  onlineCardOffline: {
    backgroundColor: "#FAFBFD",
  },
  onlineInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  onlineIconCircle: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(14),
    backgroundColor: "#EAF9F2",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  onlineIconCircleOffline: {
    backgroundColor: "#F0F3F7",
  },
  onlineTextBlock: {
    flex: 1,
    marginLeft: scale(10),
    marginRight: scale(8),
  },
  onlineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  onlineTitle: {
    color: COLORS.text,
    fontSize: moderateScale(13),
    fontWeight: "900",
  },
  liveDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: moderateScale(3),
    backgroundColor: COLORS.green500,
    marginLeft: scale(6),
  },
  onlineSubtitle: {
    color: COLORS.muted,
    fontSize: moderateScale(9.5),
    lineHeight: moderateScale(13.5),
    marginTop: verticalScale(2),
  },
  toggleTrack: {
    width: moderateScale(50),
    height: moderateScale(29),
    borderRadius: moderateScale(15),
    backgroundColor: "#C8D0DC",
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
    width: moderateScale(23),
    height: moderateScale(23),
    borderRadius: moderateScale(12),
    backgroundColor: COLORS.white,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },

  sectionHeader: {
    paddingHorizontal: scale(16),
    marginTop: verticalScale(20),
    marginBottom: verticalScale(10),
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionEyebrow: {
    color: COLORS.blue500,
    fontSize: moderateScale(8),
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: moderateScale(20),
    fontWeight: "900",
    marginTop: verticalScale(2),
  },
  viewAllButton: {
    minHeight: verticalScale(34),
    paddingHorizontal: scale(11),
    borderRadius: moderateScale(12),
    backgroundColor: "#EAF4FF",
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    color: COLORS.blue500,
    fontSize: moderateScale(10.5),
    fontWeight: "900",
    marginRight: scale(5),
  },

  cardSeparator: {
    height: verticalScale(11),
  },
  jobCard: {
    marginHorizontal: scale(14),
    borderRadius: moderateScale(21),
    backgroundColor: COLORS.surface,
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(14),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#17385D",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  jobCardAccent: {
    position: "absolute",
    left: 0,
    top: verticalScale(16),
    bottom: verticalScale(16),
    width: moderateScale(3),
    borderTopRightRadius: moderateScale(4),
    borderBottomRightRadius: moderateScale(4),
    backgroundColor: COLORS.blue500,
  },
  jobCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  jobReferenceBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: scale(8),
  },
  jobReference: {
    color: COLORS.orange500,
    fontSize: moderateScale(14),
    fontWeight: "900",
    letterSpacing: 0.1,
  },
  timeRow: {
    marginTop: verticalScale(4),
    flexDirection: "row",
    alignItems: "center",
  },
  jobTime: {
    color: COLORS.text,
    fontSize: moderateScale(12.5),
    fontWeight: "800",
    marginLeft: scale(5),
  },
  statusBadge: {
    minHeight: verticalScale(28),
    paddingHorizontal: scale(8),
    borderRadius: moderateScale(11),
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  statusText: {
    fontSize: moderateScale(8.5),
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.45,
    marginLeft: scale(4),
  },
  jobDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: verticalScale(11),
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  customerAvatar: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(13),
    backgroundColor: "#EAF3FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  customerAvatarText: {
    color: COLORS.blue500,
    fontSize: moderateScale(16),
    fontWeight: "900",
  },
  customerContent: {
    flex: 1,
    marginLeft: scale(9),
  },
  customerName: {
    color: COLORS.text,
    fontSize: moderateScale(15),
    fontWeight: "900",
  },
  typePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginTop: verticalScale(4),
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    backgroundColor: "#EEF6FF",
  },
  typePillText: {
    color: COLORS.blue500,
    fontSize: moderateScale(8),
    fontWeight: "900",
    letterSpacing: 0.55,
    marginLeft: scale(4),
  },

  routeWrap: {
    flexDirection: "row",
    marginTop: verticalScale(14),
    padding: moderateScale(11),
    borderRadius: moderateScale(15),
    backgroundColor: "#F8FAFD",
  },
  routeRail: {
    width: moderateScale(18),
    alignItems: "center",
    paddingVertical: verticalScale(3),
  },
  pickupDot: {
    width: moderateScale(9),
    height: moderateScale(9),
    borderRadius: moderateScale(5),
    backgroundColor: COLORS.green500,
  },
  routeLine: {
    width: moderateScale(1.5),
    height: verticalScale(28),
    backgroundColor: "#D6DFEB",
    marginVertical: verticalScale(4),
  },
  dropoffDot: {
    width: moderateScale(9),
    height: moderateScale(9),
    borderRadius: moderateScale(5),
    backgroundColor: COLORS.red500,
  },
  routeContent: {
    flex: 1,
    marginLeft: scale(6),
  },
  routeLabel: {
    color: COLORS.subtle,
    fontSize: moderateScale(7.5),
    fontWeight: "900",
    letterSpacing: 1,
  },
  routeAddress: {
    color: COLORS.text,
    fontSize: moderateScale(11.5),
    fontWeight: "700",
    lineHeight: moderateScale(16),
    marginTop: verticalScale(1),
  },
  routeGap: {
    height: verticalScale(10),
  },

  jobFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: verticalScale(12),
    paddingTop: verticalScale(11),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  costBlock: {
    flex: 1,
    paddingRight: scale(8),
  },
  costLabel: {
    color: COLORS.muted,
    fontSize: moderateScale(8.5),
    fontWeight: "700",
  },
  costValue: {
    color: "#168B54",
    fontSize: moderateScale(15),
    fontWeight: "900",
    marginTop: verticalScale(1),
  },
  deliveryMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  deliveryMetaText: {
    color: COLORS.muted,
    fontSize: moderateScale(9.5),
    fontWeight: "700",
    marginLeft: scale(5),
  },
  detailsAction: {
    minHeight: verticalScale(32),
    paddingHorizontal: scale(9),
    borderRadius: moderateScale(10),
    backgroundColor: "#F0F7FF",
    flexDirection: "row",
    alignItems: "center",
  },
  detailsActionText: {
    color: COLORS.blue500,
    fontSize: moderateScale(9.5),
    fontWeight: "900",
    marginRight: scale(4),
  },

  emptyCard: {
    marginHorizontal: scale(14),
    minHeight: verticalScale(190),
    borderRadius: moderateScale(21),
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(30),
  },
  emptyIcon: {
    width: moderateScale(70),
    height: moderateScale(70),
    borderRadius: moderateScale(23),
    backgroundColor: "#EAF3FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: moderateScale(17),
    fontWeight: "900",
    marginTop: verticalScale(13),
  },
  emptySubtitle: {
    color: COLORS.muted,
    fontSize: moderateScale(10.5),
    lineHeight: moderateScale(15),
    textAlign: "center",
    marginTop: verticalScale(5),
  },

  toast: {
    position: "absolute",
    zIndex: 100,
    left: scale(14),
    right: scale(14),
    minHeight: verticalScale(48),
    borderRadius: moderateScale(15),
    paddingHorizontal: scale(13),
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 9,
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
    fontSize: moderateScale(10.5),
    fontWeight: "700",
    marginLeft: scale(7),
  },
});
