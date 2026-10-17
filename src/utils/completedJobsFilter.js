/**
 * DeliveryPlus Driver App — 24-Hour Completed Jobs Visibility Rule
 *
 * Business Rule:
 * 1. When a job is completed, it remains visible in the Driver App Recent Completed list for exactly 24 hours.
 * 2. After 24 elapsed hours (86,400,000 ms), it automatically disappears from the recent completed list.
 * 3. The job remains permanently stored in MongoDB and visible in CRM Admin / backend records.
 * 4. Uses server-generated canonical completed timestamp (UTC).
 */

export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000; // 86,400,000 ms

/**
 * Resolves the canonical completed timestamp for a job.
 * Checks driver-specific assignment completion first (for multi-driver jobs),
 * followed by overall job completedAt, and completion subdocument.
 */
export function getJobCompletedTimestamp(job, driverId = null) {
  if (!job) return null;

  // 1. Check driver assignment specific completion if driverId provided
  if (driverId && Array.isArray(job.driverAssignments)) {
    const assignment = job.driverAssignments.find((a) => {
      const aId = a?.driverId?._id || a?.driverId || a?.driver;
      return String(aId) === String(driverId);
    });
    if (assignment?.completedAt) {
      const ts = new Date(assignment.completedAt).getTime();
      if (!isNaN(ts)) return ts;
    }
  }

  // 2. Canonical job completedAt
  if (job.completedAt) {
    const ts = new Date(job.completedAt).getTime();
    if (!isNaN(ts)) return ts;
  }

  // 3. Completion subdocument completedAt
  if (job.completion?.completedAt) {
    const ts = new Date(job.completion.completedAt).getTime();
    if (!isNaN(ts)) return ts;
  }

  // 4. Fallback to updatedAt if status is completed
  if (job.updatedAt) {
    const ts = new Date(job.updatedAt).getTime();
    if (!isNaN(ts)) return ts;
  }

  return null;
}

/**
 * Checks if a completed job was completed within the last 24 elapsed hours.
 * Returns true if completed <= 24 hours ago.
 * Returns false if completed > 24 hours ago, or if not completed.
 */
export function isJobRecentCompleted(job, nowMs = Date.now(), driverId = null) {
  if (!job) return false;

  const isCompletedStatus =
    job.status === 'completed' ||
    job.status === 'finished' ||
    Boolean(job.isCompleted);

  if (!isCompletedStatus) return false;

  const completedTs = getJobCompletedTimestamp(job, driverId);
  if (!completedTs) {
    // If completed status but missing timestamp, keep visible for safe grace period
    return true;
  }

  const elapsedMs = Number(nowMs) - completedTs;
  // Elapsed must be >= 0 and <= 24 hours
  return elapsedMs >= 0 && elapsedMs <= TWENTY_FOUR_HOURS_MS;
}

/**
 * Filters an array of jobs, keeping only completed jobs that finished within 24 hours.
 */
export function filterRecentCompletedJobs(jobs, nowMs = Date.now(), driverId = null) {
  if (!Array.isArray(jobs)) return [];
  return jobs.filter((job) => isJobRecentCompleted(job, nowMs, driverId));
}

/**
 * Filters a full job list:
 * - Active / in-progress / upcoming / pending jobs are always preserved.
 * - Completed jobs are only kept if completed within 24 hours.
 */
export function filterActiveAndRecentJobs(jobs, nowMs = Date.now(), driverId = null) {
  if (!Array.isArray(jobs)) return [];
  return jobs.filter((job) => {
    const isCompleted =
      job.status === 'completed' ||
      job.status === 'finished' ||
      Boolean(job.isCompleted);

    if (!isCompleted) {
      return true; // Keep active / upcoming / pending jobs
    }

    return isJobRecentCompleted(job, nowMs, driverId);
  });
}
