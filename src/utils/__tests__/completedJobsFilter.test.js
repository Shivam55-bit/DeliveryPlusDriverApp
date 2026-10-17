import {
  isJobRecentCompleted,
  filterRecentCompletedJobs,
  filterActiveAndRecentJobs,
  TWENTY_FOUR_HOURS_MS,
} from '../completedJobsFilter';

describe('24-Hour Completed Jobs Visibility Rule', () => {
  const baseTime = 1760695200000; // Reference fixed UTC timestamp (17 Oct 2026, 10:00:00 UTC)

  test('Boundary: Just completed (0s ago) is visible in Recent Completed', () => {
    const job = {
      _id: 'job-1',
      status: 'completed',
      completedAt: new Date(baseTime).toISOString(),
    };
    expect(isJobRecentCompleted(job, baseTime)).toBe(true);
  });

  test('Boundary: Completed 23 hours 59 minutes ago is visible', () => {
    const completedAt = new Date(baseTime - (23 * 60 + 59) * 60 * 1000).toISOString();
    const job = {
      _id: 'job-2',
      status: 'completed',
      completedAt,
    };
    expect(isJobRecentCompleted(job, baseTime)).toBe(true);
  });

  test('Boundary: Completed exactly 24 hours (86,400,000ms) ago is at the inclusive boundary', () => {
    const completedAt = new Date(baseTime - TWENTY_FOUR_HOURS_MS).toISOString();
    const job = {
      _id: 'job-3',
      status: 'completed',
      completedAt,
    };
    expect(isJobRecentCompleted(job, baseTime)).toBe(true);
  });

  test('Boundary: Completed 24 hours and 1 millisecond ago disappears', () => {
    const completedAt = new Date(baseTime - (TWENTY_FOUR_HOURS_MS + 1)).toISOString();
    const job = {
      _id: 'job-4',
      status: 'completed',
      completedAt,
    };
    expect(isJobRecentCompleted(job, baseTime)).toBe(false);
  });

  test('Boundary: Completed 25 hours ago is hidden from Recent Completed', () => {
    const completedAt = new Date(baseTime - 25 * 60 * 60 * 1000).toISOString();
    const job = {
      _id: 'job-5',
      status: 'completed',
      completedAt,
    };
    expect(isJobRecentCompleted(job, baseTime)).toBe(false);
  });

  test('Multi-driver job: handles independent driver session completion times', () => {
    const driverShivamId = 'driver-shivam';
    const driverVikashId = 'driver-vikash';

    const multiDriverJob = {
      _id: 'job-multi',
      status: 'completed',
      completedAt: new Date(baseTime - 2 * 60 * 60 * 1000).toISOString(), // Overall job done 2h ago
      driverAssignments: [
        {
          driverId: driverShivamId,
          completedAt: new Date(baseTime - 26 * 60 * 60 * 1000).toISOString(), // Shivam finished session 26h ago
        },
        {
          driverId: driverVikashId,
          completedAt: new Date(baseTime - 2 * 60 * 60 * 1000).toISOString(), // Vikash finished 2h ago
        },
      ],
    };

    // For Shivam, his session completed > 24 hours ago -> hidden
    expect(isJobRecentCompleted(multiDriverJob, baseTime, driverShivamId)).toBe(false);

    // For Vikash, his session completed 2 hours ago -> visible
    expect(isJobRecentCompleted(multiDriverJob, baseTime, driverVikashId)).toBe(true);
  });

  test('filterActiveAndRecentJobs preserves active/pending jobs and expires old completed jobs', () => {
    const jobs = [
      { _id: 'job-active-1', status: 'started' },
      { _id: 'job-active-2', status: 'assigned' },
      {
        _id: 'job-comp-recent',
        status: 'completed',
        completedAt: new Date(baseTime - 5 * 60 * 60 * 1000).toISOString(), // 5h ago
      },
      {
        _id: 'job-comp-old',
        status: 'completed',
        completedAt: new Date(baseTime - 30 * 60 * 60 * 1000).toISOString(), // 30h ago
      },
    ];

    const result = filterActiveAndRecentJobs(jobs, baseTime);
    expect(result.map((j) => j._id)).toEqual(['job-active-1', 'job-active-2', 'job-comp-recent']);
  });
});
