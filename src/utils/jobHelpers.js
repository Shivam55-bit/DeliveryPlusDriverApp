import { useState, useEffect } from "react";
import { Linking, Platform, Alert } from "react-native";

/**
 * Strips whitespace, special chars, and lowercases string for exact status/type matching.
 */
export const normalizeValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

/**
 * Returns comprehensive state flags for job status or driver assignment status.
 */
export const getJobState = (jobOrAssignment) => {
  const status = normalizeValue(jobOrAssignment?.status ?? jobOrAssignment?.workStatus);

  return {
    status,
    isPending: ["pending", "assigned", "upcoming"].includes(status),
    isInProgress: [
      "started",
      "inprogress",
      "intransit",
      "arrived",
      "en_route",
      "enroute",
      "working",
    ].includes(status),
    isCompleted: ["completed", "finished", "done"].includes(status),
    isCancelled: ["cancelled", "canceled"].includes(status),
  };
};

/**
 * Extracts a normalized driver identifier from any user or driver object.
 */
export const getDriverId = (userOrDriver) => {
  if (!userOrDriver) return "";
  if (typeof userOrDriver === "string") return userOrDriver.trim();
  return String(
    userOrDriver._id ||
    userOrDriver.id ||
    userOrDriver.driverId ||
    userOrDriver.userId ||
    userOrDriver.email ||
    ""
  ).trim();
};

/**
 * Normalizes the current logged-in driver's specific assignment / work session.
 * Guarantees that each driver gets their own independent timing, status, and agreement.
 */
/**
 * Helper to determine driver price visibility across any job or assignment schema.
 */
export const isDriverPriceVisible = (...sources) => {
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    const val =
      src.showDriverPrice ??
      src.showPriceToDriver ??
      src.pricing?.showDriverPrice ??
      src.pricing?.showPriceToDriver ??
      src.driverPricing?.showDriverPrice ??
      src.driverPricing?.showPriceToDriver ??
      src.billing?.showDriverPrice ??
      src.billing?.showPriceToDriver;

    if (val === true || val === "true" || val === 1 || val === "1") return true;
    if (val === false || val === "false" || val === 0 || val === "0") return false;
  }
  return false;
};

/**
 * Extracts normalized driver pricing type: 'full' | 'custom' | 'percentage' | 'fixed' | 'hourly'.
 */
export const getDriverPriceType = (myAssignment = {}, job = {}) => {
  const rawType =
    myAssignment?.driverPriceType ??
    myAssignment?.pricingType ??
    myAssignment?.pricingSnapshot?.pricingType ??
    myAssignment?.pricing?.pricingType ??
    job?.driverPriceType ??
    job?.pricingType ??
    job?.pricing?.driverPriceType ??
    job?.pricing?.pricingType ??
    job?.driverPricing?.pricingType ??
    "";

  const norm = normalizeValue(rawType);
  if (norm.includes("hour")) return "hourly";
  if (norm.includes("custom")) return "custom";
  if (norm.includes("percent")) return "percentage";
  if (norm.includes("fix") || norm.includes("flat")) return "fixed";
  if (norm.includes("full")) return "full";

  // Check if hourlyRate is explicitly configured > 0
  const hourlyRate = Number(
    myAssignment?.hourlyRate ??
    myAssignment?.pricingSnapshot?.hourlyRate ??
    myAssignment?.pricing?.hourlyRate ??
    job?.hourlyRate ??
    job?.pricing?.hourlyRate ??
    0
  );
  if (hourlyRate > 0) return "hourly";

  return "full";
};

/**
 * Resolves driver price amount from backend fields with graceful fallbacks.
 */
export const resolveDriverPriceAmount = (myAssignment = {}, job = {}, priceType = "full") => {
  const isCompleted = Boolean(
    myAssignment?.isCompleted ||
    job?.status === "completed" ||
    myAssignment?.completedAt ||
    job?.completedAt
  );

  // 1. If completed, strictly prioritize backend completed finalDriverAmount
  if (isCompleted) {
    const completedAmount =
      myAssignment?.pricingSnapshot?.finalDriverAmount ??
      myAssignment?.pricing?.finalDriverAmount ??
      myAssignment?.finalDriverAmount ??
      job?.pricingSnapshot?.finalDriverAmount ??
      job?.pricing?.finalDriverAmount ??
      job?.finalDriverAmount;

    if (
      completedAmount !== null &&
      completedAmount !== undefined &&
      completedAmount !== "" &&
      !Number.isNaN(Number(completedAmount)) &&
      Number(completedAmount) > 0
    ) {
      return Number(completedAmount);
    }
  }

  // 2. Percentage mode resolution
  if (priceType === "percentage") {
    const pct = Number(
      myAssignment?.driverPricePercentage ??
      job?.driverPricePercentage ??
      job?.pricing?.driverPricePercentage ??
      0
    );
    const total = Number(
      job?.totalAmount ??
      job?.billing?.totalAmount ??
      job?.pricing?.totalAmount ??
      job?.pricing?.finalCost ??
      0
    );

    // If explicit display price or final driver amount exists from backend
    const backendCalculated =
      myAssignment?.pricingSnapshot?.finalDriverAmount ??
      myAssignment?.pricing?.finalDriverAmount ??
      myAssignment?.driverDisplayPrice ??
      job?.driverDisplayPrice ??
      job?.pricing?.finalDriverAmount;

    if (
      backendCalculated !== null &&
      backendCalculated !== undefined &&
      backendCalculated !== "" &&
      !Number.isNaN(Number(backendCalculated)) &&
      Number(backendCalculated) > 0
    ) {
      return Number(backendCalculated);
    }

    if (pct > 0 && total > 0) {
      return (total * pct) / 100;
    }

    const rawDriverPrice = myAssignment?.driverPrice ?? job?.driverPrice;
    if (
      rawDriverPrice !== null &&
      rawDriverPrice !== undefined &&
      rawDriverPrice !== "" &&
      !Number.isNaN(Number(rawDriverPrice)) &&
      Number(rawDriverPrice) > 0
    ) {
      return Number(rawDriverPrice);
    }
  }

  // 3. Fallback discovery for Full / Custom / Fixed mode
  const candidates = [
    myAssignment?.pricingSnapshot?.finalDriverAmount,
    myAssignment?.driverDisplayPrice,
    job?.driverDisplayPrice,
    myAssignment?.driverPrice,
    job?.driverPrice,
    myAssignment?.driverFee,
    job?.driverFee,
    myAssignment?.pricing?.driverPrice,
    job?.pricing?.driverPrice,
    job?.billing?.totalAmount,
    job?.totalAmount,
    job?.pricing?.totalAmount,
    job?.pricing?.finalCost,
    job?.pricing?.minimumEstimatedCost,
    job?.pricing?.estimatedCost,
    job?.pricing?.finalDriverAmount,
    job?.pricing?.minimumCharge,
    job?.pricing?.minimumLabourCost,
  ];

  for (const c of candidates) {
    if (c !== null && c !== undefined && c !== "" && !Number.isNaN(Number(c))) {
      const num = Number(c);
      if (num > 0) return num;
    }
  }

  return 0;
};

/**
 * Normalizes the current logged-in driver's specific assignment / work session.
 * Guarantees that each driver gets their own independent timing, status, and agreement.
 */
export const normalizeMyDriverAssignment = (rawJob = {}, currentUser = null) => {
  if (!rawJob || typeof rawJob !== "object") {
    return {
      isAssigned: false,
      assignmentId: null,
      driverId: null,
      driverName: "",
      assignedAt: null,
      status: "pending",
      isPending: false,
      isInProgress: false,
      isCompleted: false,
      startedAt: null,
      completedAt: null,
      totalWorkedMinutes: null,
      role: "driver",
      isPrimary: false,
      startAgreement: null,
      canStartWork: false,
      canEndWork: false,
      canCompleteJob: false,
      pricing: null,
      pricingSnapshot: null,
      hourlyRate: null,
      baseHours: null,
      driverPrice: null,
      driverDisplayPrice: null,
      driverPriceType: "full",
      showDriverPrice: false,
      finalDriverAmount: null,
    };
  }

  const currentId = getDriverId(currentUser);
  const currentEmail = String(currentUser?.email || "").trim().toLowerCase();

  const jobOverallState = getJobState(rawJob);

  // 1. Direct assignment property from backend
  if (rawJob.myAssignment && typeof rawJob.myAssignment === "object") {
    const a = rawJob.myAssignment;
    const aState = getJobState(a);
    const startedAt =
      a.startedAt ||
      a.jobStartedAt ||
      a.actualStartTime ||
      (jobOverallState.isInProgress
        ? rawJob.driverStartedAt || rawJob.startedAt || rawJob.jobStartedAt || rawJob.actualStartTime
        : null);
    const completedAt =
      a.completedAt ||
      a.endedAt ||
      a.actualEndTime ||
      (jobOverallState.isCompleted
        ? rawJob.driverCompletedAt || rawJob.completedAt || rawJob.endedAt || rawJob.actualEndTime
        : null);
    const isCompleted = aState.isCompleted || (jobOverallState.isCompleted && !aState.isInProgress) || Boolean(completedAt);
    const isInProgress = !isCompleted && (aState.isInProgress || jobOverallState.isInProgress || Boolean(startedAt));
    const isPending = !isCompleted && !isInProgress;

    const showDriverPrice = isDriverPriceVisible(a, rawJob);
    const driverPriceType =
      a.driverPriceType ??
      a.pricingType ??
      a.pricing?.pricingType ??
      a.pricingSnapshot?.pricingType ??
      rawJob.driverPriceType ??
      rawJob.pricingType ??
      rawJob.pricing?.driverPriceType ??
      rawJob.pricing?.pricingType ??
      "full";

    const driverPrice =
      a.driverPrice ??
      a.driverFee ??
      a.pricing?.driverPrice ??
      a.pricing?.finalDriverAmount ??
      rawJob.driverPrice ??
      rawJob.driverDisplayPrice ??
      (driverPriceType === "percentage" ? null : (rawJob.totalAmount ?? rawJob.billing?.totalAmount ?? null));

    const driverDisplayPrice =
      a.driverDisplayPrice ??
      rawJob.driverDisplayPrice ??
      a.driverPrice ??
      rawJob.driverPrice ??
      null;

    const finalDriverAmount =
      a.pricingSnapshot?.finalDriverAmount ??
      a.pricing?.finalDriverAmount ??
      a.finalDriverAmount ??
      rawJob.finalDriverAmount ??
      rawJob.pricing?.finalDriverAmount ??
      null;

    return {
      isAssigned: true,
      assignmentId: a._id || a.id || a.assignmentId || "my-assignment",
      driverId: a.driverId || a.driver?._id || currentId,
      driverName: a.driverName || a.driver?.name || currentUser?.name || "Driver",
      assignedAt: a.assignedAt || a.createdAt || rawJob.scheduledDate || null,
      status: isCompleted ? "completed" : isInProgress ? "in_progress" : "assigned",
      isPending,
      isInProgress,
      isCompleted,
      startedAt,
      completedAt,
      totalWorkedMinutes: a.totalWorkedMinutes ?? a.actualDurationMinutes ?? a.workedMinutes ?? null,
      role: a.role || a.driverRole || "driver",
      isPrimary: a.role === "primary" || a.isPrimary === true,
      startAgreement: a.startAgreement || rawJob.startAgreement || null,
      canStartWork: isPending,
      canEndWork: isInProgress,
      canCompleteJob: a.role === "primary" || a.canCompleteJob === true || a.isPrimary === true,
      pricing: a.pricing || null,
      pricingSnapshot: a.pricingSnapshot || null,
      hourlyRate: a.hourlyRate ?? a.pricingSnapshot?.hourlyRate ?? a.pricing?.hourlyRate ?? rawJob.hourlyRate ?? rawJob.pricing?.hourlyRate ?? null,
      baseHours: a.baseHours ?? a.estimatedHours ?? a.pricingSnapshot?.baseHours ?? a.pricing?.baseHours ?? rawJob.baseHours ?? rawJob.estimatedHours ?? null,
      driverPrice,
      driverDisplayPrice,
      driverPriceType,
      driverPricePercentage: a.driverPricePercentage ?? a.pricing?.driverPricePercentage ?? rawJob.driverPricePercentage ?? rawJob.pricing?.driverPricePercentage ?? 0,
      showDriverPrice,
      finalDriverAmount,
    };
  }

  // 2. Search assignment collections (assignedDrivers, driverAssignments, workSessions, drivers, team)
  const candidateLists = [
    rawJob.assignedDrivers,
    rawJob.driverAssignments,
    rawJob.workSessions,
    rawJob.drivers,
    rawJob.team,
  ];

  let matchedAssignment = null;

  for (const list of candidateLists) {
    if (Array.isArray(list) && list.length > 0) {
      const found = list.find((item) => {
        if (!item) return false;
        if (typeof item === "string") {
          return currentId && item.trim() === currentId;
        }
        const itemId = getDriverId(item.driver || item.driverId || item.user || item);
        const itemEmail = String(
          item.email || item.driver?.email || item.user?.email || ""
        ).trim().toLowerCase();

        if (currentId && itemId && itemId === currentId) return true;
        if (currentEmail && itemEmail && itemEmail === currentEmail) return true;
        return false;
      });

      if (found) {
        matchedAssignment = typeof found === "string" ? { driverId: found } : found;
        break;
      }
    }
  }

  if (matchedAssignment) {
    const aState = getJobState(matchedAssignment);
    const startedAt =
      matchedAssignment.startedAt ||
      matchedAssignment.jobStartedAt ||
      matchedAssignment.actualStartTime ||
      matchedAssignment.workStartedAt ||
      (jobOverallState.isInProgress
        ? rawJob.driverStartedAt || rawJob.startedAt || rawJob.jobStartedAt || rawJob.actualStartTime
        : null);
    const completedAt =
      matchedAssignment.completedAt ||
      matchedAssignment.endedAt ||
      matchedAssignment.actualEndTime ||
      matchedAssignment.workEndedAt ||
      (jobOverallState.isCompleted
        ? rawJob.driverCompletedAt || rawJob.completedAt || rawJob.endedAt || rawJob.actualEndTime
        : null);
    const isCompleted = aState.isCompleted || (jobOverallState.isCompleted && !aState.isInProgress) || Boolean(completedAt);
    const isInProgress = !isCompleted && (aState.isInProgress || jobOverallState.isInProgress || Boolean(startedAt));
    const isPending = !isCompleted && !isInProgress;

    const showDriverPrice = isDriverPriceVisible(matchedAssignment, rawJob);
    const driverPriceType =
      matchedAssignment.driverPriceType ??
      matchedAssignment.pricingType ??
      matchedAssignment.pricing?.pricingType ??
      matchedAssignment.pricingSnapshot?.pricingType ??
      rawJob.driverPriceType ??
      rawJob.pricingType ??
      rawJob.pricing?.driverPriceType ??
      rawJob.pricing?.pricingType ??
      "full";

    const driverPrice =
      matchedAssignment.driverPrice ??
      matchedAssignment.driverFee ??
      matchedAssignment.pricing?.driverPrice ??
      matchedAssignment.pricing?.finalDriverAmount ??
      rawJob.driverPrice ??
      rawJob.driverDisplayPrice ??
      (driverPriceType === "percentage" ? null : (rawJob.totalAmount ?? rawJob.billing?.totalAmount ?? null));

    const driverDisplayPrice =
      matchedAssignment.driverDisplayPrice ??
      rawJob.driverDisplayPrice ??
      matchedAssignment.driverPrice ??
      rawJob.driverPrice ??
      null;

    const finalDriverAmount =
      matchedAssignment.pricingSnapshot?.finalDriverAmount ??
      matchedAssignment.pricing?.finalDriverAmount ??
      matchedAssignment.finalDriverAmount ??
      rawJob.finalDriverAmount ??
      rawJob.pricing?.finalDriverAmount ??
      null;

    return {
      isAssigned: true,
      assignmentId:
        matchedAssignment._id ||
        matchedAssignment.id ||
        matchedAssignment.assignmentId ||
        "assignment-" + (currentId || "1"),
      driverId:
        getDriverId(matchedAssignment.driver || matchedAssignment.driverId) ||
        currentId,
      driverName:
        matchedAssignment.driverName ||
        matchedAssignment.driver?.name ||
        currentUser?.name ||
        "Driver",
      assignedAt:
        matchedAssignment.assignedAt ||
        matchedAssignment.createdAt ||
        rawJob.scheduledDate ||
        null,
      status: isCompleted ? "completed" : isInProgress ? "in_progress" : "assigned",
      isPending,
      isInProgress,
      isCompleted,
      startedAt,
      completedAt,
      totalWorkedMinutes:
        matchedAssignment.totalWorkedMinutes ??
        matchedAssignment.workedMinutes ??
        matchedAssignment.actualDurationMinutes ??
        null,
      role: matchedAssignment.role || matchedAssignment.driverRole || "driver",
      isPrimary:
        matchedAssignment.role === "primary" ||
        matchedAssignment.isPrimary === true,
      startAgreement:
        matchedAssignment.startAgreement ||
        matchedAssignment.startSignOff ||
        rawJob.startAgreement ||
        null,
      canStartWork: isPending,
      canEndWork: isInProgress,
      canCompleteJob:
        matchedAssignment.role === "primary" ||
        matchedAssignment.canCompleteJob === true ||
        matchedAssignment.isPrimary === true,
      pricing: matchedAssignment.pricing || null,
      pricingSnapshot: matchedAssignment.pricingSnapshot || null,
      hourlyRate: matchedAssignment.hourlyRate ?? matchedAssignment.pricingSnapshot?.hourlyRate ?? matchedAssignment.pricing?.hourlyRate ?? rawJob.hourlyRate ?? rawJob.pricing?.hourlyRate ?? null,
      baseHours: matchedAssignment.baseHours ?? matchedAssignment.estimatedHours ?? matchedAssignment.pricingSnapshot?.baseHours ?? matchedAssignment.pricing?.baseHours ?? rawJob.baseHours ?? rawJob.estimatedHours ?? null,
      driverPrice,
      driverDisplayPrice,
      driverPriceType,
      driverPricePercentage: matchedAssignment.driverPricePercentage ?? matchedAssignment.pricing?.driverPricePercentage ?? rawJob.driverPricePercentage ?? rawJob.pricing?.driverPricePercentage ?? 0,
      showDriverPrice,
      finalDriverAmount,
    };
  }

  // 3. Fallback for single-driver / legacy job format
  const rawAssignedDrivers = rawJob.assignedDrivers || rawJob.driverAssignments || [];
  const isExplicitMultiDriverJob =
    Array.isArray(rawAssignedDrivers) && rawAssignedDrivers.length > 0;

  const jobDriverId = getDriverId(rawJob.assignedDriver || rawJob.driver || rawJob.driverId);
  const isDriverMatch =
    !currentId ||
    !jobDriverId ||
    jobDriverId === currentId ||
    !isExplicitMultiDriverJob;

  if (isDriverMatch && !isExplicitMultiDriverJob) {
    const startedAt =
      rawJob.driverStartedAt ||
      rawJob.startedAt ||
      rawJob.jobStartedAt ||
      rawJob.actualStartTime ||
      null;
    const completedAt =
      rawJob.driverCompletedAt ||
      rawJob.completedAt ||
      rawJob.endedAt ||
      rawJob.actualEndTime ||
      null;
    const isCompleted = jobOverallState.isCompleted || Boolean(completedAt);
    const isInProgress = !isCompleted && (jobOverallState.isInProgress || Boolean(startedAt));
    const isPending = !isCompleted && !isInProgress;

    const showDriverPrice = isDriverPriceVisible(rawJob);
    const driverPriceType =
      rawJob.driverPriceType ??
      rawJob.pricingType ??
      rawJob.pricing?.driverPriceType ??
      rawJob.pricing?.pricingType ??
      "full";

    const driverPrice =
      rawJob.driverPrice ??
      rawJob.driverDisplayPrice ??
      rawJob.driverFee ??
      rawJob.pricing?.driverPrice ??
      rawJob.pricing?.finalDriverAmount ??
      (driverPriceType === "percentage" ? null : (rawJob.totalAmount ?? rawJob.billing?.totalAmount ?? null));

    const driverDisplayPrice =
      rawJob.driverDisplayPrice ??
      rawJob.driverPrice ??
      null;

    const finalDriverAmount =
      rawJob.pricingSnapshot?.finalDriverAmount ??
      rawJob.pricing?.finalDriverAmount ??
      rawJob.finalDriverAmount ??
      null;

    return {
      isAssigned: true,
      assignmentId: rawJob._id || rawJob.id || "legacy-assignment",
      driverId: jobDriverId || currentId,
      driverName: currentUser?.name || rawJob.driverName || "Driver",
      assignedAt: rawJob.scheduledDate || rawJob.createdAt || null,
      status: isCompleted ? "completed" : isInProgress ? "in_progress" : "assigned",
      isPending,
      isInProgress,
      isCompleted,
      startedAt,
      completedAt,
      totalWorkedMinutes:
        rawJob.totalWorkedMinutes ?? rawJob.actualDurationMinutes ?? rawJob.workedMinutes ?? null,
      role: "primary",
      isPrimary: true,
      startAgreement: rawJob.startAgreement || null,
      canStartWork: isPending,
      canEndWork: isInProgress,
      canCompleteJob: true,
      pricing: rawJob.pricing || null,
      pricingSnapshot: rawJob.pricingSnapshot || null,
      hourlyRate: rawJob.hourlyRate ?? rawJob.pricingSnapshot?.hourlyRate ?? rawJob.pricing?.hourlyRate ?? null,
      baseHours: rawJob.baseHours ?? rawJob.estimatedHours ?? rawJob.pricingSnapshot?.baseHours ?? rawJob.pricing?.baseHours ?? null,
      driverPrice,
      driverDisplayPrice,
      driverPriceType,
      driverPricePercentage: rawJob.driverPricePercentage ?? rawJob.pricing?.driverPricePercentage ?? 0,
      showDriverPrice,
      finalDriverAmount,
    };
  }

  // 4. Current driver is NOT assigned to this job
  return {
    isAssigned: false,
    assignmentId: null,
    driverId: currentId,
    driverName: currentUser?.name || "Driver",
    assignedAt: null,
    status: "unassigned",
    isPending: false,
    isInProgress: false,
    isCompleted: false,
    startedAt: null,
    completedAt: null,
    totalWorkedMinutes: null,
    role: "none",
    isPrimary: false,
    startAgreement: null,
    canStartWork: false,
    canEndWork: false,
    canCompleteJob: false,
    pricing: null,
    pricingSnapshot: null,
    hourlyRate: null,
    baseHours: null,
    driverPrice: null,
    driverDisplayPrice: null,
    driverPriceType: "full",
    showDriverPrice: false,
    finalDriverAmount: null,
  };
};

/**
 * Normalizes job type (moving vs delivery).
 */
export const getJobTypeInfo = (job = {}) => {
  const normalizedType = normalizeValue(
    job?.jobType ?? job?.type ?? job?.serviceType ?? job?.service
  );

  const isMovingJob =
    normalizedType.includes("moving") ||
    normalizedType.includes("shift") ||
    normalizedType.includes("relocation");

  const isDeliveryJob = !isMovingJob;

  const jobTypeKey = isMovingJob ? "moving" : "delivery";
  const jobTypeLabel = isMovingJob ? "Moving" : "Delivery";

  return {
    jobTypeKey,
    isMovingJob,
    isDeliveryJob,
    jobTypeLabel,
  };
};

/**
 * Formats a Date object or string to "25 September 2026" or "25 Sep 2026".
 * Handles pure YYYY-MM-DD date strings without timezone shifts.
 */
export const formatJobDate = (value, shortMonth = false) => {
  if (!value) return "--";

  try {
    if (typeof value === "string") {
      const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString("en-AU", {
          day: "numeric",
          month: shortMonth ? "short" : "long",
          year: "numeric",
        });
      }
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: shortMonth ? "short" : "long",
      year: "numeric",
    });
  } catch (e) {
    return "--";
  }
};

/**
 * Formats ISO timestamps or time strings to 12-hour AM/PM string (e.g., "09:18 AM").
 */
export const formatJobTime = (value) => {
  if (!value) return "--";

  if (
    typeof value === "string" &&
    /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(value.trim())
  ) {
    return value.trim();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" && value.trim() ? value.trim() : "--";
  }

  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Legacy alias for formatJobTime
 */
export const formatTime = (value) => {
  const result = formatJobTime(value);
  return result === "--" ? "Not available" : result;
};

/**
 * Formats scheduled time for exact vs window mode
 */
export const formatScheduledTimeDisplay = (job = {}) => {
  const mode = normalizeValue(job?.scheduleMode);

  if (mode === "window" || (job?.scheduledStartTime && job?.scheduledEndTime)) {
    const start = formatJobTime(job?.scheduledStartTime || job?.scheduledTime);
    const end = formatJobTime(job?.scheduledEndTime);
    if (start !== "--" && end !== "--") {
      return `${start} - ${end}`;
    }
  }

  const exactTime =
    job?.scheduledTime ??
    job?.scheduleTime ??
    job?.scheduledAt ??
    job?.scheduledDate;

  const formatted = formatJobTime(exactTime);
  return formatted !== "--" ? formatted : "--";
};

/**
 * Legacy alias for formatScheduledTime
 */
export const formatScheduledTime = (value) => {
  if (!value) return "Not available";
  const formatted = formatJobTime(value);
  return formatted !== "--" ? formatted : "Not available";
};

/**
 * Formats duration in minutes to "3 Hr 29 Min", "45 Min", or "3 Hr"
 */
export const formatDuration = (totalMinutesOrSeconds, isSeconds = false) => {
  const totalMins = isSeconds
    ? Math.floor(Number(totalMinutesOrSeconds || 0) / 60)
    : Math.floor(Number(totalMinutesOrSeconds || 0));

  if (!totalMins || totalMins <= 0) return "0 Min";

  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (hrs > 0 && mins > 0) {
    return `${hrs} Hr ${mins} Min`;
  }
  if (hrs > 0) {
    return `${hrs} Hr`;
  }
  return `${mins} Min`;
};

/**
 * Legacy alias for formatDurationDisplay
 */
export const formatDurationDisplay = (totalMinutesOrSeconds, isSeconds = false) => {
  return formatDuration(totalMinutesOrSeconds, isSeconds);
};

/**
 * Calculates completed job duration from backend totalWorkedMinutes or (completedAt - startedAt)
 */
export const calculateJobDuration = (job = {}) => {
  if (
    job?.totalWorkedMinutes !== null &&
    job?.totalWorkedMinutes !== undefined &&
    !Number.isNaN(Number(job.totalWorkedMinutes)) &&
    Number(job.totalWorkedMinutes) > 0
  ) {
    return formatDuration(job.totalWorkedMinutes, false);
  }

  const startVal = job?.startedAt ?? job?.jobStartedAt ?? job?.actualStartTime;
  const endVal =
    job?.completedAt ??
    job?.endedAt ??
    job?.actualEndTime ??
    job?.jobEndedAt;

  if (startVal && endVal) {
    const startTime = new Date(startVal).getTime();
    const endTime = new Date(endVal).getTime();

    if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime >= startTime) {
      const diffMinutes = Math.floor((endTime - startTime) / (1000 * 60));
      return formatDuration(diffMinutes, false);
    }
  }

  return "0 Min";
};

/**
 * Calculates driver specific worked duration from assignment totalWorkedMinutes or (completedAt - startedAt)
 */
export const calculateDriverDuration = (myAssignment = {}) => {
  if (
    myAssignment?.totalWorkedMinutes !== null &&
    myAssignment?.totalWorkedMinutes !== undefined &&
    !Number.isNaN(Number(myAssignment.totalWorkedMinutes)) &&
    Number(myAssignment.totalWorkedMinutes) > 0
  ) {
    return formatDuration(myAssignment.totalWorkedMinutes, false);
  }

  const startVal = myAssignment?.startedAt;
  const endVal = myAssignment?.completedAt;

  if (startVal && endVal) {
    const startTime = new Date(startVal).getTime();
    const endTime = new Date(endVal).getTime();

    if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime >= startTime) {
      const diffMinutes = Math.floor((endTime - startTime) / (1000 * 60));
      return formatDuration(diffMinutes, false);
    }
  }

  return "0 Min";
};

/**
 * Custom hook for live running timer using backend `startedAt`.
 */
export const useElapsedTime = (startedAt, isRunning) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt || !isRunning) {
      setSeconds(0);
      return undefined;
    }

    const update = () => {
      const start = new Date(startedAt).getTime();

      if (!Number.isFinite(start)) {
        setSeconds(0);
        return;
      }

      setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, isRunning]);

  return seconds;
};

/**
 * Formats live elapsed seconds into "01 Hr 25 Min 16 Sec" or "25 Min 16 Sec"
 */
export const formatLiveTimer = (totalSeconds) => {
  const safeSecs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hrs = Math.floor(safeSecs / 3600);
  const mins = Math.floor((safeSecs % 3600) / 60);
  const secs = safeSecs % 60;

  const pad = (num) => String(num).padStart(2, "0");

  if (hrs > 0) {
    return `${pad(hrs)} Hr ${pad(mins)} Min ${pad(secs)} Sec`;
  }
  return `${pad(mins)} Min ${pad(secs)} Sec`;
};

/**
 * Formats elapsed seconds into hh:mm:ss string.
 */
export const formatFormattedTimer = (totalSeconds) => {
  const safeSecs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hrs = Math.floor(safeSecs / 3600);
  const mins = Math.floor((safeSecs % 3600) / 60);
  const secs = safeSecs % 60;

  const pad = (num) => String(num).padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
};

export const formatAddress = (...parts) => {
  const normalized = parts
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean);

  const uniqueParts = normalized.reduce((acc, part) => {
    const lowerPart = part.toLowerCase();
    if (acc.some((existing) => existing.toLowerCase().includes(lowerPart))) {
      return acc;
    }
    return [...acc, part];
  }, []);

  return uniqueParts.join(", ");
};

export const getPickupAddress = (raw = {}) =>
  formatAddress(
    raw.pickupAddress ??
    raw.pickUpAddress ??
    raw.pickupLocation ??
    raw.pickup?.address ??
    (typeof raw.pickup === "string" ? raw.pickup : ""),
    raw.pickupSuburb,
    raw.pickupState,
    raw.pickupPostcode
  );

export const getDropAddress = (raw = {}) =>
  formatAddress(
    raw.dropAddress ??
    raw.dropoffAddress ??
    raw.dropOffAddress ??
    raw.deliveryAddress ??
    raw.dropLocation ??
    raw.drop?.address ??
    (typeof raw.drop === "string" ? raw.drop : ""),
    raw.dropSuburb,
    raw.dropState,
    raw.dropPostcode
  );

/**
 * Opens Apple Maps (iOS) or Google Maps (Android) with encoded address.
 */
export const openMap = (address) => {
  if (!address || !address.trim()) {
    Alert.alert("Missing Address", "Address is not available for navigation.");
    return;
  }

  const query = encodeURIComponent(address.trim());

  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${query}`,
    android: `google.navigation:q=${query}`,
  });

  if (url) {
    Linking.openURL(url).catch((err) => {
      Alert.alert("Error", "Could not open map navigation: " + err.message);
    });
  }
};

/**
 * Complete normalized schema for Job details with driver-specific assignment.
 */
export const normalizeJob = (raw = {}, currentUser = null) => {
  const typeInfo = getJobTypeInfo(raw);
  const myAssignment = normalizeMyDriverAssignment(raw, currentUser);
  const priceInfo = getDriverVisiblePriceInfo(raw, myAssignment);

  const showDriverPrice = priceInfo.showPriceToDriver;
  const driverPriceType = priceInfo.driverPriceType;
  const driverDisplayPrice = priceInfo.driverPrice;
  const driverPrice = priceInfo.driverPrice;
  const finalDriverAmount = priceInfo.earnings?.finalDriverAmount ?? priceInfo.driverPrice;

  if (__DEV__) {
    console.log("[PRICE DEBUG]", {
      jobNumber: raw?.jobNumber || raw?.jobReference || raw?.referenceNumber || raw?._id,
      showDriverPrice: raw?.showDriverPrice ?? raw?.showPriceToDriver ?? raw?.pricing?.showDriverPrice,
      driverPriceType: raw?.driverPriceType ?? raw?.pricingType ?? raw?.pricing?.pricingType,
      driverPrice: raw?.driverPrice ?? raw?.pricing?.driverPrice,
      driverDisplayPrice: raw?.driverDisplayPrice,
      totalAmount: raw?.totalAmount,
      billing: raw?.billing,
      normalizedPrice: driverDisplayPrice,
    });
  }

  const startedAt =
    raw.startedAt ??
    raw.jobStartedAt ??
    raw.actualStartTime ??
    raw.timerStarted ??
    null;

  const completedAt =
    raw.completedAt ??
    raw.endedAt ??
    raw.jobEndedAt ??
    raw.actualEndTime ??
    raw.timerEnded ??
    null;

  const scheduledDate =
    raw.scheduledDate ??
    raw.scheduledAt ??
    raw.scheduledDateTime ??
    raw.date ??
    null;

  const scheduledTime =
    raw.scheduledTime ??
    raw.scheduleTime ??
    null;

  const scheduledStartTime =
    raw.scheduledStartTime ??
    raw.scheduledStart ??
    null;

  const scheduledEndTime =
    raw.scheduledEndTime ??
    raw.scheduledEnd ??
    null;

  const totalWorkedMinutes =
    raw.totalWorkedMinutes ??
    raw.actualDurationMinutes ??
    raw.durationMinutes ??
    null;

  return {
    ...raw,
    backendId: raw._id || raw.backendId || raw.id,
    id: raw._id || raw.backendId || raw.id,
    jobNumber: raw.jobNumber || raw.jobReference || raw.referenceNumber || raw._id || "N/A",
    myAssignment,
    jobReference:
      raw.jobReference ??
      raw.jobNumber ??
      raw.referenceNumber ??
      raw._id ??
      "N/A",
    jobType: raw.jobType ?? raw.type ?? raw.serviceType ?? null,
    jobTypeKey: typeInfo.jobTypeKey,
    jobTypeLabel: typeInfo.jobTypeLabel,
    isMovingJob: typeInfo.isMovingJob,
    isDeliveryJob: typeInfo.isDeliveryJob,

    status: raw.status ?? "pending",

    showDriverPrice,
    showPriceToDriver: showDriverPrice,
    driverPriceType,
    driverPrice,
    driverDisplayPrice,
    finalDriverAmount,
    formattedPrice: priceInfo.formattedPrice,
    canShowPrice: priceInfo.canShowPrice,

    scheduledDate,
    scheduleMode: raw.scheduleMode ?? raw.scheduleType ?? "exact",
    scheduledTime,
    scheduledStartTime,
    scheduledEndTime,
    scheduledAt: raw.scheduledAt ?? scheduledDate,

    startedAt,
    endedAt: completedAt,
    completedAt,

    totalWorkedMinutes,
    actualDurationMinutes: totalWorkedMinutes,

    startAgreement:
      raw.startAgreement ??
      (raw.startSignature || raw.startCustomerSignature || raw.startTermsAccepted
        ? {
          termsRead: Boolean(raw.startTermsRead ?? true),
          termsAccepted: Boolean(raw.startTermsAccepted ?? true),
          stairsAtProperty:
            raw.stairsAtProperty !== undefined
              ? Boolean(raw.stairsAtProperty)
              : raw.stairsOption === "yes",
          stairsOption:
            raw.stairsOption ?? (raw.stairsAtProperty ? "yes" : "no"),
          customerSignature:
            raw.startCustomerSignature ?? raw.startSignature ?? null,
          customerSignatureName:
            raw.startCustomerSignatureName ??
            raw.startSignatoryName ??
            raw.customerName ??
            "",
          agreementVersion: raw.agreementVersion ?? "1.0",
          acceptedAt: raw.startAcceptedAt ?? startedAt ?? null,
        }
        : null),

    completion:
      raw.completion ??
      (raw.customerEndSignature || raw.completionNotes || raw.hasDamage !== undefined
        ? {
          termsAccepted: Boolean(raw.completionTermsAccepted ?? raw.termsAccepted),
          deliveryConfirmed: Boolean(raw.deliveryConfirmed),
          stairsAtProperty: Boolean(raw.stairsAtProperty),
          stairsWaiverAccepted: Boolean(raw.stairsWaiverAccepted),
          hasDamage: Boolean(raw.hasDamage),
          damageReport: raw.damageReport ?? "",
          customerSignature: raw.customerEndSignature ?? raw.customerSignature ?? null,
          customerSignatureName: raw.customerSignatureName ?? "",
          customerSignatureDate: raw.customerSignatureDate ?? completedAt ?? null,
          photos: raw.photos ?? raw.damagePhotos ?? [],
          paymentMethod: raw.paymentMethod ?? "cash",
          amountReceived: raw.amountReceived ?? null,
          paymentNotes: raw.paymentNotes ?? "",
          paymentProofUrl: raw.paymentProofUrl ?? null,
          completionNotes: raw.completionNotes ?? "",
        }
        : null),

    pickupAddress: getPickupAddress(raw),
    dropoffAddress: getDropAddress(raw),
    dropAddress: getDropAddress(raw),
    pickup: getPickupAddress(raw),
    drop: getDropAddress(raw),

    customerName:
      raw.customerName ??
      raw.customer?.name ??
      raw.customerId?.name ??
      raw.name ??
      "Customer",

    customerPhone:
      raw.customerPhone ??
      raw.customer?.phone ??
      raw.customerId?.phone ??
      raw.phone ??
      "",

    notes: raw.notes ?? raw.pickupNotes ?? raw.instructions ?? "",

    itemList: raw.itemList ?? raw.items ?? [],

    pricing: raw.pricing ?? {
      hourlyRate: raw.hourlyRate,
      minimumLabourCost: raw.minimumLabourCost ?? raw.minimumCost,
      movers: raw.movers ?? raw.moversCount,
      truckCount: raw.truckCount ?? raw.trucks,
      calloutCharge: raw.calloutCharge,
      calloutTime: raw.calloutTime,
      travelBackCharge: raw.travelBackCharge,
      travelBackTime: raw.travelBackTime,
      minimumCharge: raw.minimumCharge,
      minimumEstimatedCost: raw.minimumEstimatedCost ?? raw.estimatedCost,
      extraTime: raw.extraTime,
      extraTimeCharge: raw.extraTimeCharge,
      finalCost: raw.finalCost,
      amountPaid: raw.amountPaid,
      outstandingAmount: raw.outstandingAmount,
    },
  };
};

/**
 * Calculates final driver earnings for hourly jobs based strictly on the current driver's
 * own work session (myAssignment), applying 30-minute overtime slabs.
 *
 * Rules:
 * - Base duration = baseHours (default 2 Hr if unspecified)
 * - Base Amount = hourlyRate * baseHours
 * - Overtime = max(0, myAssignment.totalWorkedMinutes - (baseHours * 60))
 * - Overtime Blocks = ceil(overtimeMinutes / 30)
 * - Overtime Charge = overtimeBlocks * (hourlyRate / 2)
 * - Final Driver Amount = Base Amount + Overtime Charge
 *
 * Multi-driver isolation: Only uses myAssignment's own session time, never global job times.
 * Supports pricingSnapshot from backend and graceful fallbacks.
 */
/**
 * Unified Pricing Normalizer for all Job types (Hourly, Full, Custom, Percentage, Fixed).
 * Accurately extracts base amount, line item charges (callout, stairs, travelBack),
 * overtime slabs (30-min blocks), and calculates estimatedTotal and final amountToCollect.
 */
export const getJobPricingSummary = (job = {}, myAssignment = null, screenName = "") => {
  const assignment = myAssignment || job?.myAssignment || null;
  const snapshot = assignment?.pricingSnapshot || assignment?.pricing || {};
  const jobPricing = job?.pricing || {};
  const billing = job?.billing || {};

  const showDriverPrice = isDriverPriceVisible(assignment, job);
  const priceType = getDriverPriceType(assignment, job);
  const isHourly = priceType === "hourly";

  // 1. Hourly Rate
  const rawHourlyRate =
    snapshot?.hourlyRate ??
    assignment?.hourlyRate ??
    jobPricing?.hourlyRate ??
    job?.hourlyRate ??
    0;
  const hourlyRate = Math.max(0, Number(rawHourlyRate) || 0);

  // 2. Base Hours
  const rawBaseHours =
    snapshot?.baseHours ??
    snapshot?.estimatedHours ??
    assignment?.baseHours ??
    assignment?.estimatedHours ??
    jobPricing?.estimatedHours ??
    jobPricing?.baseHours ??
    jobPricing?.minimumChargeHours ??
    jobPricing?.minimumHours ??
    job?.estimatedHours ??
    job?.baseHours ??
    job?.minimumChargeHours ??
    job?.minimumHours ??
    (isHourly ? 1 : 1);
  const baseHours = Math.max(0, Number(rawBaseHours) || (isHourly ? 1 : 1));
  const baseMinutes = Math.round(baseHours * 60);

  // 3. Base Amount / Minimum Cost (Labour only)
  const rawBaseAmount =
    snapshot?.baseAmount ??
    snapshot?.minimumCost ??
    snapshot?.minimumLaborCost ??
    snapshot?.minimumLabourCost ??
    jobPricing?.minimumLabourCost ??
    jobPricing?.minimumLaborCost ??
    jobPricing?.minimumLaborCharge ??
    jobPricing?.minimumCost ??
    jobPricing?.baseAmount ??
    jobPricing?.baseCost ??
    job?.minimumLabourCost ??
    job?.minimumLaborCost ??
    job?.minimumLaborCharge ??
    job?.minimumCost ??
    job?.baseAmount ??
    job?.baseCost ??
    (isHourly ? hourlyRate * baseHours : 0);
  const baseAmount = Math.max(0, Number(rawBaseAmount) || (isHourly ? hourlyRate * baseHours : 0));

  // 4. Line Items / Additional Fees
  const calloutFee = Math.max(
    0,
    Number(
      snapshot?.calloutFee ??
      snapshot?.calloutCharge ??
      jobPricing?.calloutCharge ??
      jobPricing?.calloutFee ??
      job?.calloutCharge ??
      job?.calloutFee ??
      0
    ) || 0
  );

  const stairsFee = Math.max(
    0,
    Number(
      snapshot?.stairsFee ??
      snapshot?.stairsCharge ??
      jobPricing?.stairsFee ??
      jobPricing?.stairsCharge ??
      job?.stairsFee ??
      job?.stairsCharge ??
      0
    ) || 0
  );

  const travelBackFee = Math.max(
    0,
    Number(
      snapshot?.travelBackFee ??
      snapshot?.travelBackCharge ??
      jobPricing?.travelBackCharge ??
      jobPricing?.travelBackFee ??
      job?.travelBackCharge ??
      job?.travelBackFee ??
      0
    ) || 0
  );

  const extraCharges = Math.max(
    0,
    Number(
      snapshot?.extraCharges ??
      jobPricing?.extraCharges ??
      jobPricing?.extraTimeCharge ??
      job?.extraCharges ??
      0
    ) || 0
  );

  // 5. Initial / Estimated Total (before overtime)
  const explicitEstimatedTotal = Number(
    snapshot?.initialTotal ??
    snapshot?.minimumEstimatedCost ??
    snapshot?.estimatedTotal ??
    snapshot?.estimatedCost ??
    jobPricing?.initialTotal ??
    jobPricing?.minimumEstimatedCost ??
    jobPricing?.estimatedTotal ??
    jobPricing?.estimatedCost ??
    jobPricing?.minimumCharge ??
    job?.initialTotal ??
    job?.minimumEstimatedCost ??
    job?.estimatedTotal ??
    (priceType === "percentage" || priceType === "custom"
      ? 0
      : (job?.billing?.estimatedTotal ?? job?.billing?.totalAmount ?? job?.totalAmount ?? 0))
  );

  const calculatedInitialTotal = isHourly
    ? (baseAmount + calloutFee + stairsFee + travelBackFee + extraCharges)
    : (resolveDriverPriceAmount(assignment, job, priceType) || baseAmount);

  const initialTotal = explicitEstimatedTotal > 0 ? explicitEstimatedTotal : calculatedInitialTotal;

  // 6. Worked Duration
  let totalWorkedMinutes = 0;
  if (
    assignment?.totalWorkedMinutes !== null &&
    assignment?.totalWorkedMinutes !== undefined &&
    !Number.isNaN(Number(assignment.totalWorkedMinutes)) &&
    Number(assignment.totalWorkedMinutes) >= 0
  ) {
    totalWorkedMinutes = Math.floor(Number(assignment.totalWorkedMinutes));
  } else if (job?.totalWorkedMinutes !== null && job?.totalWorkedMinutes !== undefined && Number(job?.totalWorkedMinutes) >= 0) {
    totalWorkedMinutes = Math.floor(Number(job.totalWorkedMinutes));
  } else if (assignment?.startedAt && assignment?.completedAt) {
    const startMs = new Date(assignment.startedAt).getTime();
    const endMs = new Date(assignment.completedAt).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
      totalWorkedMinutes = Math.floor((endMs - startMs) / (1000 * 60));
    }
  } else if (assignment?.startedAt) {
    const startMs = new Date(assignment.startedAt).getTime();
    if (Number.isFinite(startMs)) {
      totalWorkedMinutes = Math.max(0, Math.floor((Date.now() - startMs) / (1000 * 60)));
    }
  }

  // 7. Overtime Calculation (for hourly jobs with 30-min slabs)
  let overtimeMinutes = 0;
  let overtimeBlocks = 0;
  let overtimeAmount = 0;

  if (isHourly && hourlyRate > 0) {
    const hasBackendOvertimeMinutes =
      snapshot?.overtimeMinutes !== undefined &&
      snapshot?.overtimeMinutes !== null &&
      !Number.isNaN(Number(snapshot.overtimeMinutes));
    overtimeMinutes = hasBackendOvertimeMinutes
      ? Math.max(0, Number(snapshot.overtimeMinutes))
      : Math.max(0, totalWorkedMinutes - baseMinutes);

    const hasBackendOvertimeBlocks =
      snapshot?.overtimeBlocks !== undefined &&
      snapshot?.overtimeBlocks !== null &&
      !Number.isNaN(Number(snapshot.overtimeBlocks));
    overtimeBlocks = hasBackendOvertimeBlocks
      ? Math.max(0, Number(snapshot.overtimeBlocks))
      : overtimeMinutes > 0
        ? Math.ceil(overtimeMinutes / 30)
        : 0;

    const halfHourlyRate = hourlyRate / 2;
    const hasBackendOvertimeAmount =
      snapshot?.overtimeAmount !== undefined &&
      snapshot?.overtimeAmount !== null &&
      !Number.isNaN(Number(snapshot.overtimeAmount));
    overtimeAmount = hasBackendOvertimeAmount
      ? Number(snapshot.overtimeAmount)
      : overtimeBlocks * halfHourlyRate;
  }

  // 8. Final Total / Amount To Collect
  const backendFinalAmount = Number(
    snapshot?.finalDriverAmount ??
    snapshot?.finalAmount ??
    snapshot?.finalTotal ??
    snapshot?.finalCost ??
    jobPricing?.finalCost ??
    jobPricing?.finalAmount ??
    jobPricing?.finalDriverAmount ??
    billing?.totalAmount ??
    0
  );

  let finalTotal = initialTotal;
  if (isHourly) {
    if (backendFinalAmount > 0 && backendFinalAmount >= initialTotal + overtimeAmount) {
      finalTotal = backendFinalAmount;
    } else {
      finalTotal = initialTotal + overtimeAmount;
    }
  } else {
    finalTotal = backendFinalAmount > 0 ? backendFinalAmount : initialTotal;
  }

  const formatBaseHoursLabel = (hrs) => {
    if (!hrs || hrs <= 0) return "0 Hr";
    const whole = Math.floor(hrs);
    const frac = hrs - whole;
    if (frac === 0) return `${whole} Hr`;
    const mins = Math.round(frac * 60);
    return whole > 0 ? `${whole} Hr ${mins} Min` : `${mins} Min`;
  };

  const canShowPrice = showDriverPrice && Number.isFinite(finalTotal) && finalTotal > 0;

  const summary = {
    isHourly,
    priceType,
    showDriverPrice,
    canShowPrice,

    hourlyRate,
    formattedHourlyRate: hourlyRate > 0 ? `$${hourlyRate.toFixed(2)}/hr` : null,

    baseHours,
    formattedBaseDuration: formatBaseHoursLabel(baseHours),

    baseAmount,
    formattedBaseAmount: `$${baseAmount.toFixed(2)}`,

    calloutFee,
    formattedCalloutFee: `$${calloutFee.toFixed(2)}`,

    stairsFee,
    formattedStairsFee: `$${stairsFee.toFixed(2)}`,

    travelBackFee,
    formattedTravelBackFee: `$${travelBackFee.toFixed(2)}`,

    extraCharges,
    formattedExtraCharges: `$${extraCharges.toFixed(2)}`,

    initialTotal,
    estimatedTotal: initialTotal,
    formattedInitialTotal: `$${initialTotal.toFixed(2)}`,
    formattedEstimatedTotal: `$${initialTotal.toFixed(2)}`,

    workedMinutes: totalWorkedMinutes,
    totalWorkedMinutes,
    formattedWorkedTime: formatDuration(totalWorkedMinutes, false),

    overtimeMinutes,
    formattedOvertimeMinutes: `${overtimeMinutes} Min`,
    overtimeBlocks,
    overtimeAmount,
    formattedOvertimeAmount: `$${overtimeAmount.toFixed(2)}`,

    finalAmount: finalTotal,
    finalTotal,
    amountToCollect: finalTotal,
    formattedFinalAmount: `$${finalTotal.toFixed(2)}`,
    formattedFinalTotal: `$${finalTotal.toFixed(2)}`,
    formattedAmountToCollect: `$${finalTotal.toFixed(2)}`,

    displayEstimatedPrice: `$${initialTotal.toFixed(2)}`,
    displayFinalPrice: `$${finalTotal.toFixed(2)}`,
  };

  if (__DEV__) {
    console.log("[PRICING DEBUG]", {
      screen: screenName || "jobHelpers",
      jobNumber: job?.jobNumber || job?.jobReference || job?.referenceNumber || job?._id,
      hourlyRate: summary.hourlyRate,
      baseAmount: summary.baseAmount,
      calloutFee: summary.calloutFee,
      stairsFee: summary.stairsFee,
      travelBackFee: summary.travelBackFee,
      initialTotal: summary.initialTotal,
      workedMinutes: summary.workedMinutes,
      overtimeMinutes: summary.overtimeMinutes,
      overtimeAmount: summary.overtimeAmount,
      finalAmount: summary.finalAmount,
    });
  }

  return summary;
};

/**
 * Calculates final driver earnings based strictly on current driver work session.
 * Supports pricingSnapshot from backend and graceful fallbacks.
 */
export const calculateDriverHourlyEarnings = (myAssignment = {}, job = {}) => {
  const summary = getJobPricingSummary(job, myAssignment);
  return {
    isHourly: summary.isHourly,
    priceType: summary.priceType,
    showDriverPrice: summary.showDriverPrice,
    canShowPrice: summary.canShowPrice,

    totalWorkedMinutes: summary.totalWorkedMinutes,
    formattedWorkedTime: summary.formattedWorkedTime,

    hourlyRate: summary.hourlyRate,
    formattedHourlyRate: summary.formattedHourlyRate,

    baseHours: summary.baseHours,
    formattedBaseDuration: summary.formattedBaseDuration,

    baseAmount: summary.baseAmount,
    formattedBaseAmount: summary.formattedBaseAmount,

    calloutFee: summary.calloutFee,
    formattedCalloutFee: summary.formattedCalloutFee,

    stairsFee: summary.stairsFee,
    formattedStairsFee: summary.formattedStairsFee,

    travelBackFee: summary.travelBackFee,
    formattedTravelBackFee: summary.formattedTravelBackFee,

    extraCharges: summary.extraCharges,
    formattedExtraCharges: summary.formattedExtraCharges,

    initialTotal: summary.initialTotal,
    estimatedTotal: summary.estimatedTotal,
    formattedInitialTotal: summary.formattedInitialTotal,
    formattedEstimatedTotal: summary.formattedEstimatedTotal,

    overtimeMinutes: summary.overtimeMinutes,
    formattedOvertimeMinutes: summary.formattedOvertimeMinutes,
    overtimeBlocks: summary.overtimeBlocks,
    overtimeAmount: summary.overtimeAmount,
    formattedOvertimeAmount: summary.formattedOvertimeAmount,

    finalDriverAmount: summary.finalTotal,
    formattedFinalAmount: summary.formattedFinalTotal,

    summary,
  };
};

/**
 * Determines driver price visibility and formats visible price.
 * Driver-specific when myAssignment is provided.
 */
export const getDriverVisiblePriceInfo = (job = {}, myAssignment = null) => {
  const assignment = myAssignment || job?.myAssignment || null;
  const summary = getJobPricingSummary(job, assignment);

  const isCompleted = Boolean(
    assignment?.isCompleted ||
    job?.status === "completed" ||
    assignment?.completedAt ||
    job?.completedAt
  );

  const displayedAmount = isCompleted ? summary.finalTotal : summary.estimatedTotal;
  const formattedPrice = summary.canShowPrice
    ? (isCompleted ? summary.formattedFinalTotal : summary.formattedEstimatedTotal)
    : null;

  return {
    showPriceToDriver: summary.showDriverPrice,
    driverPrice: displayedAmount,
    driverPriceType: summary.priceType,
    driverPricePercentage:
      job?.driverPricePercentage ??
      assignment?.driverPricePercentage ??
      job?.pricing?.driverPricePercentage ??
      0,
    formattedPrice,
    canShowPrice: summary.canShowPrice,
    earnings: calculateDriverHourlyEarnings(assignment, job),
    pricingSummary: summary,
  };
};

