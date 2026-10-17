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
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  Image,
  Modal,
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
import { isJobRecentCompleted } from "../utils/completedJobsFilter";
import API, {
  getStoredUser,
  clearAuthToken,
  getAuthToken,
  setAuthToken,
  tryRequest,
} from "../services/api";
import {
  fetchDriverJobs,
  getCachedDriverJobs,
  loadPersistedDriverJobs,
} from "../services/driverJobs";
import {
  requestDriverLocationPermission,
  startDriverLocationTracking,
  stopDriverLocationTracking,
  stopDriverTrackingAndMarkOffline,
} from "../services/locationTrackingService";
import {
  getAndroidLocationPermissionStatus,
  getNativeLocationPermissionState,
  openDeviceLocationSettings,
  openLocationSettings,
  subscribeNativeLocationAuthorization,
} from "../services/nativeLocationService";
import {
  getDriverVisiblePrice,
  normalizeMyDriverAssignment,
  getJobPricingSummary,
  formatCurrency,
  isJobScheduledOnDate,
  formatJobDate,
} from "../utils/jobHelpers";
import {
  getDriverUnreadCount,
  fetchDriverUnreadCount,
  subscribeUnreadCount,
  subscribeNotifications,
} from "../services/notificationService";

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

const DRIVER_AVAILABILITY_ENDPOINTS = [
  "/drivers/me/availability",
  "/drivers/me/heartbeat",
  "/driver/me/availability",
];

const getAndroidLocationPermissionDialog = (status) => {
  if (!status?.foregroundGranted) {
    const permanentlyDenied = Boolean(status?.foregroundPermanentlyDenied);
    return {
      step: "foreground",
      title: permanentlyDenied
        ? "Location access is blocked"
        : "Location permission required",
      message: permanentlyDenied
        ? "Enable location for DeliveryPlus in Android app settings. Approximate location is supported; precise location provides more reliable driver tracking."
        : "DeliveryPlus uses your location while you are online so dispatch can follow active deliveries. Choose Continue to allow location while using the app. Approximate location is supported; precise is more accurate.",
      canContinue: !permanentlyDenied,
      canOpenSettings: permanentlyDenied,
      settingsForDeviceLocation: false,
    };
  }

  if (!status?.locationServicesEnabled) {
    return {
      step: "services",
      title: "Turn on device location",
      message: "Android Location services are turned off. Enable device location, then return here and try again.",
      canContinue: false,
      canOpenSettings: true,
      settingsForDeviceLocation: true,
    };
  }

  return null;
};

const updateDriverAvailability = async (isOnline, diagnosticOrigin) => {
  const candidateEndpoints = isOnline
    ? [
        { path: "/drivers/me/heartbeat", method: "post", data: {} },
        { path: "/drivers/me/availability", method: "put", data: { availability: "available" } },
        { path: "/driver/me/availability", method: "put", data: { availability: "available" } },
        { path: "/drivers/me/online", method: "post", data: {} },
      ]
    : [
        { path: "/drivers/me/offline", method: "post", data: {} },
        { path: "/drivers/me/availability", method: "put", data: { availability: "offline" } },
        { path: "/driver/me/availability", method: "put", data: { availability: "offline" } },
      ];

  let lastError = null;
  for (const candidate of candidateEndpoints) {
    try {
      const response =
        candidate.method === "post"
          ? await API.post(candidate.path, candidate.data, { diagnosticOrigin })
          : await API.put(candidate.path, candidate.data, { diagnosticOrigin });

      if (response?.success === false || response?.data?.success === false) {
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      if (__DEV__) {
        console.warn(
          `[driver-availability] ${candidate.method.toUpperCase()} ${candidate.path} failed (${status || "network"})`
        );
      }
      if (status && status !== 404 && status !== 405) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
  return { success: true };
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

const normaliseJob = (job, currentUser = null) => {
  const type = getJobType(job);
  const myAssignment = normalizeMyDriverAssignment(job, currentUser, {
    requireDriverMatch: true,
  });
  const pricing = getJobPricingSummary(job, myAssignment);

  // Driver's personal work status takes priority for card status badge & timer
  const status = myAssignment?.isCompleted
    ? "completed"
    : myAssignment?.isInProgress
    ? "inProgress"
    : myAssignment?.isPending || myAssignment?.isAssigned
    ? "upcoming"
    : normaliseStatus(job?.status);

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

  const startedAt = myAssignment?.isInProgress && myAssignment?.startedAt
    ? myAssignment.startedAt
    : null;

  const driverVisiblePrice = getDriverVisiblePrice(job, myAssignment);
  const displayCost =
    status === "completed"
      ? pricing.formattedFinalTotal
      : formatCurrency(driverVisiblePrice);

  if (__DEV__ && (job?.jobNumber === "JOB-00130" || job?.id === "JOB-00130" || job?.jobReference === "JOB-00130")) {
    console.log("HOME_CARD_PRICE_DEBUG", {
      jobNumber: job?.jobNumber || job?.id || job?.jobReference,
      rawJob: job,
      totalEstimatedCost: job?.totalEstimatedCost,
      estimatedTotal: job?.estimatedTotal,
      minimumCost: job?.minimumCost,
      baseCost: job?.baseCost,
      driverPrice: job?.driverPrice,
      totalAmount: job?.totalAmount,
      billingTotal: job?.billing?.totalAmount,
      fixedQuote: job?.fixedQuote,
      displayedPrice: driverVisiblePrice,
    });
  }

  const scheduledDate =
    job?.scheduledDate ??
    job?.scheduledAt ??
    job?.scheduledDateTime ??
    job?.date;
  const isScheduledToday = isJobScheduledOnDate(job);
  const dateLabel = formatJobDate(scheduledDate, true);
  const timeFormatted = formatScheduledTime(job);
  const hasValidTime =
    timeFormatted &&
    timeFormatted !== "--" &&
    timeFormatted !== "Not available" &&
    timeFormatted !== "Invalid date";
  const displaySchedule = isScheduledToday
    ? (hasValidTime ? timeFormatted : "Today")
    : (dateLabel !== "--" && dateLabel !== "Invalid Date"
        ? (hasValidTime ? `${dateLabel} · ${timeFormatted}` : dateLabel)
        : (hasValidTime ? timeFormatted : "Scheduled"));

  return {
    raw: job,
    id: job?.jobNumber ?? job?.jobReference ?? job?.referenceNumber ?? job?._id ?? "N/A",
    backendId: job?._id,
    status,
    myAssignment,
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
    time: timeFormatted,
    displaySchedule,
    isScheduledToday,
    scheduledDate,
    startedAt,
    type,
    showPriceToDriver: pricing.showDriverPrice,
    driverPrice: pricing.totalEstimatedCost,
    driverPriceType: pricing.priceType,
    displayCost,
    canShowPrice: pricing.canShowPrice,
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
  const isUnavailable = value === null || value === undefined;

  useEffect(() => {
    if (isUnavailable) {
      animatedValue.stopAnimation();
      return;
    }

    const target = Number(value) || 0;

    Animated.timing(animatedValue, {
      toValue: target,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedValue, isUnavailable, value]);

  if (isUnavailable) {
    return <Text style={style}>—</Text>;
  }

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

  const rawJob = job?.raw || job;
  const myAssignment = job?.myAssignment || normalizeMyDriverAssignment(rawJob);
  const pricing = getJobPricingSummary(rawJob, myAssignment, "HomeScreen");

  const displayedPrice =
    job.status === "completed"
      ? pricing.finalTotal
      : getDriverVisiblePrice(rawJob, myAssignment);

  const displayedPriceFormatted =
    job.status === "completed"
      ? pricing.formattedFinalTotal
      : formatCurrency(displayedPrice);

  return (
    <TouchableOpacity
      style={styles.jobCard}
      activeOpacity={0.7}
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
            <Text style={styles.jobTime}>
              {job.displaySchedule || job.time}
            </Text>
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

      {job.status === "inProgress" && job.startedAt ? (
        <JobTimerBanner startedAt={job.startedAt} />
      ) : null}

      <View style={styles.jobFooter}>
        {pricing.canShowPrice && displayedPrice > 0 ? (
          <View style={styles.costBlock}>
            <Text style={styles.costLabel}>
              {job.status === "completed" ? "Final Driver Amount" : "Estimated Price"}
            </Text>
            <Text style={styles.costValue}>{displayedPriceFormatted}</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.detailsAction,
            (!pricing.canShowPrice || displayedPrice <= 0) && { marginLeft: "auto" },
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

const EmptyJobs = memo(({ error, onRetry, title, subtitle, icon, actionText, onAction }) => (
  <View style={styles.emptyCard}>
    <View style={styles.emptyIcon}>
      <AppIcon
        library="MaterialCommunityIcons"
        name={
          error
            ? "alert-circle-outline"
            : icon || "clipboard-text-clock-outline"
        }
        size={moderateScale(44)}
        color={error ? COLORS.red500 : COLORS.blue500}
      />
    </View>
    <Text style={styles.emptyTitle}>
      {error ? (typeof error === "string" ? error : "Unable to load jobs") : title || "No active jobs"}
    </Text>
    <Text style={styles.emptySubtitle}>
      {subtitle ||
        (error
          ? "Your job list could not be refreshed. Check your connection and retry."
          : "New assigned and in-progress jobs will appear here.")}
    </Text>
    {error && onRetry ? (
      <TouchableOpacity
        style={styles.emptyRetry}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading jobs"
      >
        <Text style={styles.emptyRetryText}>Retry</Text>
      </TouchableOpacity>
    ) : null}
    {!error && actionText && onAction ? (
      <TouchableOpacity
        style={[styles.emptyRetry, { backgroundColor: COLORS.navy900 }]}
        onPress={onAction}
        accessibilityRole="button"
      >
        <Text style={styles.emptyRetryText}>{actionText}</Text>
      </TouchableOpacity>
    ) : null}
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
    assigned: null,
    inProgress: null,
    completed: null,
  });
  const [jobLoadError, setJobLoadError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => getDriverUnreadCount());
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [togglingStatus, setTogglingStatus] =
    useState(false);
  const [locationPermissionDialog, setLocationPermissionDialog] = useState(null);
  const [locationActionInFlight, setLocationActionInFlight] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    type: "success",
    message: "",
  });

  const toastTimer = useRef(null);
  const isMountedRef = useRef(true);
  const hasLoadedJobsRef = useRef(false);
  const homeRequestInProgressRef = useRef(false);
  const locationSettingsOpenRef = useRef(false);
  const previousAppStateRef = useRef(AppState.currentState);
  const locationWarningShownRef = useRef(false);
  const suppressAutomaticTrackingRef = useRef(false);
  const offlineReconciliationNeededRef = useRef(false);

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
      if (homeRequestInProgressRef.current) return;
      homeRequestInProgressRef.current = true;

      if (!silent) {
        setLoading(true);
      }

      // 1. Immediately hydrate cached user profile & jobs for instant display (< 100ms)
      try {
        const cachedUser = await getStoredUser();
        if (cachedUser && isMountedRef.current) {
          setProfile((prev) => prev || cachedUser);
        }
        const cachedJobs = getCachedDriverJobs() || (await loadPersistedDriverJobs());
        if (cachedJobs && Array.isArray(cachedJobs) && cachedJobs.length > 0 && isMountedRef.current) {
          const cachedNormalised = cachedJobs
            .map((job) => normaliseJob(job, cachedUser))
            .filter((job) => job.myAssignment?.isAssigned && ["upcoming", "inProgress"].includes(job.status));
          setJobs((prev) => (prev && prev.length > 0 ? prev : cachedNormalised));
          setLoading(false);
          hasLoadedJobsRef.current = true;
        }
      } catch (e) { }

      try {
        const [
          profileResponse,
          jobResult,
        ] = await Promise.all([
          API.get("/auth/me", {
            diagnosticOrigin: "HomeScreen.loadHomeData profile",
          }).catch((err) => {
            console.log("[Home] /auth/me error:", err?.response?.status, err?.message);
            if (err?.response?.status === 401) {
              clearAuthToken();
              navigation.replace("Login");
            }
            return null;
          }),
          fetchDriverJobs("HomeScreen.loadHomeData driver jobs")
            .then((jobs) => ({ jobs }))
            .catch((error) => ({ error })),
        ]);

        const authUser = profileResponse?.user ?? profileResponse?.data?.user;
        const driverProfile =
          profileResponse?.driver ?? profileResponse?.data?.driver;
        const profileData =
          (authUser && driverProfile
            ? { ...authUser, driverProfile }
            : authUser ?? driverProfile) ??
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

        if (jobResult.error) {
          if (isMountedRef.current) {
            setJobLoadError(jobResult.error);
            if (!hasLoadedJobsRef.current) {
              setStats({ assigned: null, inProgress: null, completed: null });
            }
          }
        } else {
          const rawJobs = jobResult.jobs;
          console.info("[Home] loaded driver jobs:", {
            count: rawJobs.length,
            jobNumbers: rawJobs.map((job) =>
              job.jobNumber || job.jobReference || job.referenceNumber || job._id
            ),
          });

          const normalisedJobs = rawJobs
            .map((job) => normaliseJob(job, profileData))
            .filter((job) =>
              job.myAssignment?.isAssigned &&
              ["upcoming", "inProgress", "completed"].includes(job.status)
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
              (job) =>
                job.status === "completed" &&
                isJobRecentCompleted(job.raw || job, Date.now(), user?._id || user?.id)
            );

          // Show all in-progress jobs (running) and upcoming jobs (not started yet)
          const homeJobs = [
            ...inProgressJobs,
            ...upcomingJobs,
          ];

          if (!isMountedRef.current) return;

          hasLoadedJobsRef.current = true;
          setJobLoadError(null);
          setJobs(homeJobs);
          setStats({
            assigned: upcomingJobs.length,
            inProgress: inProgressJobs.length,
            completed: completedJobs.length,
          });
        }

        if (profileData) {
          setProfile(profileData);
          setIsOnline(
            profileData?.isOnline ??
            profileData?.online ??
            ["available", "online"].includes(
              String(profileData?.availability || "").trim().toLowerCase()
            )
          );
        }
      } catch (error) {
        if (!isMountedRef.current) return;

        console.warn("[Home] loadHomeData failed:", {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        });
        setJobLoadError(error);
        if (!hasLoadedJobsRef.current) {
          setStats({ assigned: null, inProgress: null, completed: null });
        }
      } finally {
        homeRequestInProgressRef.current = false;
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [navigation]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchDriverUnreadCount().catch(() => {});

    const unsubscribeUnread = subscribeUnreadCount((count) => {
      if (isMountedRef.current) {
        setUnreadCount(count);
      }
    });

    const unsubscribeNotifications = subscribeNotifications(() => {
      loadHomeData({ silent: true });
    });

    return () => {
      isMountedRef.current = false;
      unsubscribeUnread();
      unsubscribeNotifications();

      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, [loadHomeData]);

  useFocusEffect(
    useCallback(() => {
      loadHomeData({ silent: true });
      fetchDriverUnreadCount().catch(() => {});
    }, [loadHomeData])
  );

  useEffect(() => {
    const unsubscribeAuthorization = subscribeNativeLocationAuthorization(
      (status) => {
        if (__DEV__) {
          console.info("[LOCATION_PERMISSION_DEBUG] native callback state:", status);
        }
      }
    );
    const subscription =
      AppState.addEventListener(
        "change",
        async (nextState) => {
          if (nextState === "active") {
            const returnedFromSettings =
              locationSettingsOpenRef.current &&
              previousAppStateRef.current !== "active";
            previousAppStateRef.current = nextState;

            if (Platform.OS === "android") {
              try {
                const status = await getAndroidLocationPermissionStatus();
                if (__DEV__) {
                  console.info("[LOCATION_PERMISSION_DEBUG] appstate native status:", status);
                }
                if (isMountedRef.current) {
                  if (returnedFromSettings) {
                    locationSettingsOpenRef.current = false;
                    setLocationPermissionDialog(
                      getAndroidLocationPermissionDialog(status)
                    );
                  }
                }
              } catch (error) {
                if (isMountedRef.current) {
                  setLocationPermissionDialog(null);
                  showToast("Unable to recheck Android location permissions.", "error");
                }
              }
            } else if (__DEV__) {
              const nativeState = await getNativeLocationPermissionState();
              console.info("[LOCATION_PERMISSION_DEBUG] appstate native status:", nativeState);
            }
            if (offlineReconciliationNeededRef.current) {
              const reconciliationErrors = [];
              try {
                await updateDriverAvailability(
                  false,
                  "HomeScreen.reconcileOfflineAvailability"
                );
              } catch (error) {
                reconciliationErrors.push(error);
              }
              try {
                await stopDriverTrackingAndMarkOffline();
              } catch (error) {
                reconciliationErrors.push(error);
              }
              offlineReconciliationNeededRef.current =
                reconciliationErrors.length > 0;
              if (reconciliationErrors.length > 0 && isMountedRef.current) {
                showToast(
                  "Tracking is stopped, but the server has not confirmed Offline. It will be retried.",
                  "error"
                );
              }
            }
            loadHomeData({ silent: true });
          } else {
            previousAppStateRef.current = nextState;
          }
        }
      );

    return () => {
      subscription.remove();
      unsubscribeAuthorization();
    };
  }, [loadHomeData, showToast]);

  useEffect(() => {
    if (!profile) {
      return undefined;
    }

    if (!isOnline) {
      stopDriverLocationTracking().catch(() => {
        console.warn("[LOCATION_WATCH_STARTED] could not stop offline tracking");
      });
      return undefined;
    }
    if (suppressAutomaticTrackingRef.current) {
      return undefined;
    }

    let active = true;
    const hasActiveJob = jobs.some((job) => job.status === "inProgress");

    const resumeTracking = async () => {
      if (Platform.OS === "android") {
        const permissionStatus = await getAndroidLocationPermissionStatus();
        const permissionDialog =
          getAndroidLocationPermissionDialog(permissionStatus);
        if (permissionDialog) {
          if (!locationWarningShownRef.current) {
            locationWarningShownRef.current = true;
            showToast(
              "Location access is required to keep your online status tracked.",
              "error"
            );
          }
          return false;
        }
      }

      return startDriverLocationTracking({
        user: profile,
        isActiveJob: hasActiveJob,
        permissionGranted: Platform.OS === "android",
        serverConfirmedOnline: true,
      });
    };

    resumeTracking()
      .then((started) => {
        if (active && !started) {
          if (Platform.OS !== "android") {
            showToast(
              "Location permission is required to share your location while online.",
              "error"
            );
          }
        } else if (started) {
          locationWarningShownRef.current = false;
        }
      })
      .catch(() => {
        if (active) {
          if (!locationWarningShownRef.current) {
            locationWarningShownRef.current = true;
            showToast("Unable to start location tracking.", "error");
          }
        }
      });

    return () => {
      active = false;
    };
  }, [isOnline, profile, jobs, showToast]);

  // Periodic refresh when active jobs are in progress
  useEffect(() => {
    let interval = null;
    const hasActiveJob = jobs.some((j) => j.status === "inProgress");
    if (hasActiveJob) {
      interval = setInterval(() => {
        loadHomeData({ silent: true });
      }, 25000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobs, loadHomeData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadHomeData({ silent: true });
  }, [loadHomeData]);

  const todaysJobs = useMemo(
    () => jobs.filter((job) => isJobScheduledOnDate(job.raw || job)),
    [jobs]
  );

  const upcomingFutureJobs = useMemo(
    () =>
      jobs
        .filter((job) => !isJobScheduledOnDate(job.raw || job) && (job.status === "upcoming" || job.status === "inProgress"))
        .sort((a, b) => {
          const dateA = new Date(a.raw?.scheduledDate || a.raw?.scheduledAt || a.raw?.scheduledDateTime || 0).getTime();
          const dateB = new Date(b.raw?.scheduledDate || b.raw?.scheduledAt || b.raw?.scheduledDateTime || 0).getTime();
          return dateA - dateB;
        }),
    [jobs]
  );

  const displayedJobs = useMemo(() => {
    if (todaysJobs.length > 0) {
      return [...todaysJobs, ...upcomingFutureJobs.slice(0, 3)];
    }
    return upcomingFutureJobs.slice(0, 5);
  }, [todaysJobs, upcomingFutureJobs]);

  const handleToggleOnline = useCallback(
    async () => {
      if (togglingStatus) return;

      const nextOnlineState = !isOnline;

      try {
        setTogglingStatus(true);
        if (nextOnlineState) {
          if (Platform.OS === "android") {
            const status = await getAndroidLocationPermissionStatus();
            const dialog = getAndroidLocationPermissionDialog(status);
            if (dialog) {
              setLocationPermissionDialog(dialog);
              return;
            }
            setLocationPermissionDialog(null);
          } else {
            const permissionGranted = await requestDriverLocationPermission();
            if (!permissionGranted) {
              const nativeState = await getNativeLocationPermissionState();
              if (nativeState === "denied" || nativeState === "restricted") {
                Alert.alert(
                  "Location Permission Denied",
                  "Location access is currently turned off for DeliveryPlus. To share your location with dispatch while online, enable Location in Settings.",
                  [
                    { text: "Not Now", style: "cancel" },
                    {
                      text: "Open Settings",
                      onPress: () => openLocationSettings(),
                    },
                  ]
                );
              } else {
                showToast("Location permission was not granted.", "error");
              }
              return;
            }
          }

          suppressAutomaticTrackingRef.current = false;
          await updateDriverAvailability(
            true,
            "HomeScreen.handleToggleOnline"
          );

          try {
            const started = await startDriverLocationTracking({
              user: profile,
              isActiveJob: jobs.some((job) => job.status === "inProgress"),
              permissionGranted: true,
              serverConfirmedOnline: true,
            });
            if (!started) {
              throw new Error("Location tracking did not start.");
            }
          } catch (error) {
            const rollbackErrors = [];
            try {
              await stopDriverLocationTracking();
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError);
            }
            try {
              await updateDriverAvailability(
                false,
                "HomeScreen.rollbackOnlineAvailability"
              );
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError);
            }
            try {
              await stopDriverTrackingAndMarkOffline();
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError);
            }
            suppressAutomaticTrackingRef.current = true;
            offlineReconciliationNeededRef.current =
              rollbackErrors.length > 0;
            if (rollbackErrors.length > 0) {
              console.warn(
                "[LOCATION_UPLOAD_FAILED] online activation rollback was incomplete"
              );
            }
            throw new Error(
              rollbackErrors.length > 0
                ? "Location tracking could not start and Offline could not be confirmed with the server."
                : error?.message || "Unable to start location tracking."
            );
          }

          setIsOnline(true);
          showToast("You are now online.");
          return;
        }

        suppressAutomaticTrackingRef.current = true;
        const offlineErrors = [];
        try {
          await stopDriverLocationTracking();
        } catch (error) {
          offlineErrors.push(error);
        }
        try {
          await updateDriverAvailability(
            false,
            "HomeScreen.handleToggleOnline"
          );
        } catch (error) {
          offlineErrors.push(error);
        }
        try {
          await stopDriverTrackingAndMarkOffline();
        } catch (error) {
          offlineErrors.push(error);
        }

        offlineReconciliationNeededRef.current = offlineErrors.length > 0;
        setIsOnline(false);
        if (offlineErrors.length > 0) {
          showToast(
            "GPS tracking is stopped, but the server has not confirmed Offline. The app will retry.",
            "error"
          );
        } else {
          showToast("You are now offline.");
        }
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
      profile,
      jobs,
      showToast,
      togglingStatus,
    ]
  );

  const continueLocationPermissionSetup = useCallback(async () => {
    setLocationActionInFlight(true);
    try {
      await requestDriverLocationPermission();
      const status = await getAndroidLocationPermissionStatus();
      const dialog = getAndroidLocationPermissionDialog(status);
      if (dialog) {
        setLocationPermissionDialog(dialog);
      } else {
        setLocationPermissionDialog(null);
        await handleToggleOnline();
      }
    } catch (error) {
      showToast(
        error?.message || "Unable to request Android location permission.",
        "error"
      );
    } finally {
      setLocationActionInFlight(false);
    }
  }, [handleToggleOnline, showToast]);

  const openLocationPermissionSettings = useCallback(async () => {
    const dialog = locationPermissionDialog;
    setLocationPermissionDialog(null);
    locationSettingsOpenRef.current = true;
    const opened = dialog?.settingsForDeviceLocation
      ? await openDeviceLocationSettings()
      : await openLocationSettings();
    if (!opened) {
      locationSettingsOpenRef.current = false;
      showToast("Unable to open Android location settings.", "error");
    }
  }, [locationPermissionDialog, showToast]);

  const retryLocationPermissionCheck = useCallback(async () => {
    setLocationActionInFlight(true);
    try {
      const status = await getAndroidLocationPermissionStatus();
      const dialog = getAndroidLocationPermissionDialog(status);
      if (dialog) {
        setLocationPermissionDialog(dialog);
      } else {
        setLocationPermissionDialog(null);
        await handleToggleOnline();
      }
    } catch (error) {
      showToast(
        error?.message || "Unable to recheck Android location permission.",
        "error"
      );
    } finally {
      setLocationActionInFlight(false);
    }
  }, [handleToggleOnline, showToast]);

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
            sectionTitle={todaysJobs.length > 0 ? "Today's Jobs" : "Assigned Jobs"}
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
          sectionTitle={todaysJobs.length > 0 ? "Today's Jobs" : "Assigned Jobs"}
        />
      );
    },
    [
      handleToggleOnline,
      isOnline,
      navigation,
      profile,
      stats,
      todaysJobs.length,
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

  if (loading && (!jobs || jobs.length === 0)) {
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

      <Modal
        visible={Boolean(locationPermissionDialog)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLocationPermissionDialog(null)}
      >
        <View style={styles.locationModalBackdrop}>
          <View style={styles.locationModalCard}>
            <Text style={styles.locationModalTitle}>
              {locationPermissionDialog?.title}
            </Text>
            <Text style={styles.locationModalMessage}>
              {locationPermissionDialog?.message}
            </Text>
            {locationPermissionDialog?.canContinue ? (
              <TouchableOpacity
                style={styles.locationModalPrimaryButton}
                onPress={continueLocationPermissionSetup}
                disabled={locationActionInFlight || togglingStatus}
                accessibilityRole="button"
              >
                {locationActionInFlight ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.locationModalPrimaryText}>Continue</Text>
                )}
              </TouchableOpacity>
            ) : null}
            {locationPermissionDialog?.canOpenSettings ? (
              <TouchableOpacity
                style={styles.locationModalSecondaryButton}
                onPress={openLocationPermissionSettings}
                disabled={locationActionInFlight || togglingStatus}
                accessibilityRole="button"
              >
                <Text style={styles.locationModalSecondaryText}>
                  Open Settings
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.locationModalSecondaryButton}
              onPress={retryLocationPermissionCheck}
              disabled={locationActionInFlight || togglingStatus}
              accessibilityRole="button"
            >
              <Text style={styles.locationModalSecondaryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.locationModalCancelButton}
              onPress={() => setLocationPermissionDialog(null)}
              disabled={locationActionInFlight}
              accessibilityRole="button"
            >
              <Text style={styles.locationModalCancelText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        data={displayedJobs}
        keyExtractor={(item) =>
          String(item.backendId ?? item.id)
        }
        renderItem={renderJob}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        ListHeaderComponent={
          <>
            {jobLoadError ? (
              <View style={styles.loadErrorBanner}>
                <Text style={styles.loadErrorText}>
                  {jobLoadError?.response?.status === 401
                    ? "Session expired. Please log in again."
                    : jobLoadError?.response?.status === 403
                    ? "Access restricted. Contact dispatch."
                    : !jobLoadError?.response
                    ? "Network unavailable. Check your connection."
                    : "Unable to refresh driver jobs."}
                </Text>
                <TouchableOpacity
                  onPress={() => loadHomeData()}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading jobs"
                >
                  <Text style={styles.loadErrorRetry}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {listHeader}
          </>
        }
        ListFooterComponent={
          jobs.length > 0 ? (
            <View style={styles.viewAllFooterWrap}>
              <TouchableOpacity
                style={styles.viewAllFooterBtn}
                onPress={() => navigation.navigate("JobsTab")}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="View all assigned jobs"
              >
                <Text style={styles.viewAllFooterText}>
                  View all assigned jobs ({jobs.length})
                </Text>
                <AppIcon
                  library="Feather"
                  name="arrow-right"
                  size={15}
                  color={COLORS.navy900}
                />
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          jobLoadError ? (
            <EmptyJobs
              error={
                jobLoadError?.response?.status === 401
                  ? "Session Expired"
                  : jobLoadError?.response?.status === 403
                  ? "Access Restricted"
                  : !jobLoadError?.response
                  ? "Network Unavailable"
                  : "API Request Failed"
              }
              subtitle={
                jobLoadError?.response?.status === 401
                  ? "Your session has expired. Please log in again to continue."
                  : jobLoadError?.response?.status === 403
                  ? "Your account does not have permission to view assigned jobs. Contact dispatch."
                  : !jobLoadError?.response
                  ? "Unable to connect to the server. Check your internet connection and retry."
                  : "Could not fetch driver assignments. Tap retry to try again."
              }
              onRetry={() => loadHomeData()}
            />
          ) : (
            <EmptyJobs
              title="No assigned jobs"
              subtitle="You currently have no jobs assigned. New assignments from dispatch will appear here."
              onRetry={() => loadHomeData()}
            />
          )
        }
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
  },
  locationModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: scale(24),
    backgroundColor: "rgba(3, 14, 29, 0.68)",
  },
  locationModalCard: {
    borderRadius: moderateScale(18),
    padding: moderateScale(22),
    backgroundColor: COLORS.white,
    elevation: 12,
  },
  locationModalTitle: {
    color: COLORS.text,
    fontSize: moderateScale(19),
    fontWeight: "700",
    marginBottom: verticalScale(10),
  },
  locationModalMessage: {
    color: COLORS.muted,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(21),
    marginBottom: verticalScale(16),
  },
  locationModalPrimaryButton: {
    minHeight: verticalScale(46),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: moderateScale(11),
    marginTop: verticalScale(5),
    backgroundColor: COLORS.blue500,
  },
  locationModalPrimaryText: {
    color: COLORS.white,
    fontSize: moderateScale(14),
    fontWeight: "700",
  },
  locationModalSecondaryButton: {
    minHeight: verticalScale(44),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: moderateScale(11),
    marginTop: verticalScale(8),
  },
  locationModalSecondaryText: {
    color: COLORS.navy800,
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  locationModalCancelButton: {
    minHeight: verticalScale(40),
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(4),
  },
  locationModalCancelText: {
    color: COLORS.muted,
    fontSize: moderateScale(14),
    fontWeight: "600",
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
  emptyRetry: {
    marginTop: verticalScale(14),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(9),
    borderRadius: moderateScale(12),
    backgroundColor: COLORS.blue500,
  },
  emptyRetryText: {
    color: COLORS.white,
    fontSize: moderateScale(12),
    fontWeight: "700",
  },
  loadErrorBanner: {
    marginHorizontal: scale(14),
    marginTop: verticalScale(8),
    marginBottom: verticalScale(10),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(12),
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  loadErrorText: {
    color: "#B91C1C",
    fontSize: moderateScale(12),
    fontWeight: "600",
  },
  loadErrorRetry: {
    color: COLORS.blue500,
    fontSize: moderateScale(12),
    fontWeight: "700",
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

  upcomingNoticeCard: {
    marginHorizontal: scale(16),
    marginTop: verticalScale(4),
    marginBottom: verticalScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(16),
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  upcomingNoticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  upcomingNoticeTitle: {
    fontSize: moderateScale(13.5),
    fontWeight: "800",
    color: COLORS.navy900,
  },
  upcomingNoticeSubtitle: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(11.5),
    lineHeight: moderateScale(17),
    color: COLORS.muted,
    fontWeight: "500",
  },
  viewAllFooterWrap: {
    marginTop: verticalScale(12),
    marginBottom: verticalScale(8),
    alignItems: "center",
  },
  viewAllFooterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: COLORS.white,
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  viewAllFooterText: {
    fontSize: moderateScale(13),
    fontWeight: "800",
    color: COLORS.navy900,
  },
});
