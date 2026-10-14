import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "./api";

export const DRIVER_JOBS_PATH = "/jobs/driver/my-jobs";
const PERSISTED_JOBS_CACHE_KEY = "@delivery_plus_cached_driver_jobs";
const CACHE_TTL_MS = 15000; // 15 seconds fresh cache TTL

let inMemoryCachedJobs = null;
let cacheTimestamp = 0;
let inFlightJobsPromise = null;

export const extractDriverJobs = (response) => {
  let payload = response;

  for (let depth = 0; depth < 4; depth += 1) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (!payload || typeof payload !== "object") {
      break;
    }

    const jobs =
      payload.jobs ??
      payload.bookings ??
      payload.results ??
      payload.items;

    if (Array.isArray(jobs)) {
      return jobs;
    }

    payload = payload.data;
  }

  throw new Error("Driver jobs API returned an unrecognized response shape.");
};

/**
 * Returns synchronously cached jobs if available in memory.
 */
export const getCachedDriverJobs = () => {
  return inMemoryCachedJobs;
};

/**
 * Asynchronously loads persisted jobs from AsyncStorage for instant app launch.
 */
export const loadPersistedDriverJobs = async () => {
  if (inMemoryCachedJobs && inMemoryCachedJobs.length > 0) {
    return inMemoryCachedJobs;
  }

  try {
    const raw = await AsyncStorage.getItem(PERSISTED_JOBS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!inMemoryCachedJobs) {
          inMemoryCachedJobs = parsed;
        }
        return parsed;
      }
    }
  } catch (err) {
    // ignore cache read failure
  }
  return null;
};

/**
 * Saves jobs to AsyncStorage in the background without blocking execution.
 */
const persistJobsCache = (jobs) => {
  if (!Array.isArray(jobs)) return;
  AsyncStorage.setItem(PERSISTED_JOBS_CACHE_KEY, JSON.stringify(jobs)).catch(() => {});
};

/**
 * Retrieves a single cached job by its ID or reference number.
 */
export const getCachedJob = (jobId) => {
  if (!jobId || !Array.isArray(inMemoryCachedJobs)) return null;
  const targetId = String(jobId).toLowerCase();
  return (
    inMemoryCachedJobs.find((j) => {
      const jId = String(j._id || j.id || j.backendId || "").toLowerCase();
      const ref = String(j.jobNumber || j.jobReference || j.referenceNumber || "").toLowerCase();
      return jId === targetId || ref === targetId;
    }) || null
  );
};

/**
 * Updates or merges a specific job into the in-memory and persisted cache immediately.
 */
export const updateCachedJob = (updatedJob) => {
  if (!updatedJob || typeof updatedJob !== "object") return;
  const targetId = String(
    updatedJob._id || updatedJob.id || updatedJob.backendId || updatedJob.jobNumber || ""
  ).toLowerCase();

  if (!targetId) return;

  if (Array.isArray(inMemoryCachedJobs)) {
    const index = inMemoryCachedJobs.findIndex((j) => {
      const jId = String(j._id || j.id || j.backendId || "").toLowerCase();
      const ref = String(j.jobNumber || j.jobReference || j.referenceNumber || "").toLowerCase();
      return jId === targetId || ref === targetId;
    });

    if (index >= 0) {
      inMemoryCachedJobs[index] = { ...inMemoryCachedJobs[index], ...updatedJob };
    } else {
      inMemoryCachedJobs.unshift(updatedJob);
    }
    persistJobsCache(inMemoryCachedJobs);
  }
};

/**
 * Invalidates the jobs cache so the next request performs a network revalidation.
 */
export const invalidateDriverJobsCache = () => {
  cacheTimestamp = 0;
};

/**
 * High-performance fetch with in-flight request deduplication and memory caching.
 * If multiple screens request jobs simultaneously, only ONE HTTP request is dispatched.
 */
export const fetchDriverJobs = async (origin, { force = false } = {}) => {
  const now = Date.now();
  const isFresh = Boolean(
    !force &&
    inMemoryCachedJobs &&
    Array.isArray(inMemoryCachedJobs) &&
    now - cacheTimestamp < CACHE_TTL_MS
  );

  if (isFresh) {
    return inMemoryCachedJobs;
  }

  // Deduplicate in-flight requests
  if (inFlightJobsPromise) {
    return inFlightJobsPromise;
  }

  inFlightJobsPromise = (async () => {
    try {
      const response = await API.get(DRIVER_JOBS_PATH, {
        diagnosticOrigin: origin,
      });

      const jobs = extractDriverJobs(response);
      inMemoryCachedJobs = jobs;
      cacheTimestamp = Date.now();
      persistJobsCache(jobs);
      return jobs;
    } finally {
      inFlightJobsPromise = null;
    }
  })();

  return inFlightJobsPromise;
};
