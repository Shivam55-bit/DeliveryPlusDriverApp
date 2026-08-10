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
 * Returns comprehensive state flags for job status.
 */
export const getJobState = (job) => {
  const status = normalizeValue(job?.status);

  return {
    status,
    isPending: ["pending", "assigned", "upcoming"].includes(status),
    isInProgress: ["started", "inprogress", "intransit", "arrived"].includes(status),
    isCompleted: ["completed", "finished", "done"].includes(status),
    isCancelled: ["cancelled", "canceled"].includes(status),
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
 * Formats ISO timestamps to 12-hour AM/PM string.
 * Prevents "Invalid Date" or "01 Jan 1970".
 */
export const formatTime = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Formats scheduled time (either plain text like "10:00 AM" or ISO timestamp).
 */
export const formatScheduledTime = (value) => {
  if (!value) return "Not available";

  if (
    typeof value === "string" &&
    /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(value.trim())
  ) {
    return value.trim();
  }

  return formatTime(value);
};

/**
 * Formats duration in minutes/seconds to "1 Hr 28 Mins" or "45 Mins".
 */
export const formatDurationDisplay = (totalMinutesOrSeconds, isSeconds = false) => {
  const totalMins = isSeconds
    ? Math.floor(totalMinutesOrSeconds / 60)
    : Math.floor(totalMinutesOrSeconds);

  if (!totalMins || totalMins <= 0) return "0 Mins";

  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (hrs > 0 && mins > 0) {
    return `${hrs} Hr ${mins} Mins`;
  }
  if (hrs > 0) {
    return `${hrs} Hr${hrs > 1 ? "s" : ""}`;
  }
  return `${mins} Mins`;
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
 * Custom hook for running timer using backend `startedAt`.
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
 * Formats elapsed seconds into hh:mm:ss string.
 */
export const formatFormattedTimer = (totalSeconds) => {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (num) => String(num).padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
};

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
 * Complete normalized schema for Job details.
 */
export const normalizeJob = (raw = {}) => {
  const typeInfo = getJobTypeInfo(raw);

  return {
    ...raw,
    backendId: raw._id || raw.backendId || raw.id,
    id: raw._id || raw.backendId || raw.id,
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

    scheduledAt: raw.scheduledAt ?? raw.scheduledDateTime ?? raw.scheduledDate ?? null,
    scheduledTime: raw.scheduledTime ?? raw.scheduleTime ?? null,

    startedAt: raw.startedAt ?? raw.jobStartedAt ?? raw.actualStartTime ?? raw.timerStarted ?? null,
    endedAt: raw.endedAt ?? raw.jobEndedAt ?? raw.actualEndTime ?? raw.completedAt ?? raw.timerEnded ?? null,
    completedAt: raw.completedAt ?? null,

    actualDurationMinutes:
      raw.actualDurationMinutes ??
      raw.durationMinutes ??
      raw.totalWorkedMinutes ??
      null,

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
