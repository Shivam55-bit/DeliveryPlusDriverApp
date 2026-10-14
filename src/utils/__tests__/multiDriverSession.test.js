import {
  normalizeMyDriverAssignment,
  normalizeJob,
  calculateDriverDuration,
  getJobPricingSummary,
} from "../jobHelpers";

describe("Multi-Driver Independent Sessions & Timers", () => {
  const driverShivam = {
    _id: "driver-shivam-1",
    name: "Shivam",
    email: "shivam@deliveryplus.com",
  };

  const driverVikash = {
    _id: "driver-vikash-2",
    name: "Vikash",
    email: "vikash@deliveryplus.com",
  };

  const jobScenarioA = {
    _id: "JOB-00131",
    jobNumber: "JOB-00131",
    status: "in_progress",
    startedAt: "2026-09-28T18:35:00.000Z",
    scheduledDate: "2026-09-28",
    pricing: {
      hourlyRate: 100,
      estimatedHours: 2,
      minimumCost: 200,
    },
    driverAssignments: [
      {
        _id: "assign-shivam",
        driverId: "driver-shivam-1",
        driverName: "Shivam",
        role: "primary",
        status: "in_progress",
        startedAt: "2026-09-28T18:35:00.000Z",
        completedAt: null,
      },
      {
        _id: "assign-vikash",
        driverId: "driver-vikash-2",
        driverName: "Vikash",
        role: "assistant",
        status: "assigned",
        startedAt: null,
        completedAt: null,
      },
    ],
  };

  test("SCENARIO A: Driver 1 running, Driver 2 newly assigned -> Driver 2 NEVER inherits Driver 1 startedAt", () => {
    // 1. Inspect Driver 1 (Shivam)
    const shivamAssignment = normalizeMyDriverAssignment(jobScenarioA, driverShivam);
    expect(shivamAssignment.isAssigned).toBe(true);
    expect(shivamAssignment.status).toBe("in_progress");
    expect(shivamAssignment.isInProgress).toBe(true);
    expect(shivamAssignment.isPending).toBe(false);
    expect(shivamAssignment.startedAt).toBe("2026-09-28T18:35:00.000Z");
    expect(shivamAssignment.canStartWork).toBe(false);
    expect(shivamAssignment.canEndWork).toBe(true);

    // 2. Inspect Driver 2 (Vikash)
    const vikashAssignment = normalizeMyDriverAssignment(jobScenarioA, driverVikash);
    expect(vikashAssignment.isAssigned).toBe(true);
    expect(vikashAssignment.status).toBe("assigned");
    expect(vikashAssignment.isInProgress).toBe(false);
    expect(vikashAssignment.isPending).toBe(true);
    expect(vikashAssignment.startedAt).toBeNull(); // MUST NOT BE 18:35:00!
    expect(vikashAssignment.completedAt).toBeNull();
    expect(vikashAssignment.canStartWork).toBe(true);
    expect(vikashAssignment.canEndWork).toBe(false);

    // 3. Full Job normalization for Vikash
    const vikashJob = normalizeJob(jobScenarioA, driverVikash);
    expect(vikashJob.myAssignment.status).toBe("assigned");
    expect(vikashJob.myAssignment.startedAt).toBeNull();
    expect(vikashJob.myAssignment.canStartWork).toBe(true);
  });

  test("SCENARIO B: Driver 1 and Driver 2 both running -> Independent timers & start times", () => {
    const jobScenarioB = {
      ...jobScenarioA,
      driverAssignments: [
        {
          _id: "assign-shivam",
          driverId: "driver-shivam-1",
          driverName: "Shivam",
          role: "primary",
          status: "in_progress",
          startedAt: "2026-09-28T18:35:00.000Z",
          completedAt: null,
        },
        {
          _id: "assign-vikash",
          driverId: "driver-vikash-2",
          driverName: "Vikash",
          role: "assistant",
          status: "in_progress",
          startedAt: "2026-09-28T19:18:00.000Z",
          completedAt: null,
        },
      ],
    };

    const shivamAssignment = normalizeMyDriverAssignment(jobScenarioB, driverShivam);
    const vikashAssignment = normalizeMyDriverAssignment(jobScenarioB, driverVikash);

    expect(shivamAssignment.startedAt).toBe("2026-09-28T18:35:00.000Z");
    expect(vikashAssignment.startedAt).toBe("2026-09-28T19:18:00.000Z");

    expect(shivamAssignment.isInProgress).toBe(true);
    expect(vikashAssignment.isInProgress).toBe(true);
  });

  test("SCENARIO C: Driver 1 completes while Driver 2 is still running", () => {
    const jobScenarioC = {
      ...jobScenarioA,
      driverAssignments: [
        {
          _id: "assign-shivam",
          driverId: "driver-shivam-1",
          driverName: "Shivam",
          role: "primary",
          status: "completed",
          startedAt: "2026-09-28T18:35:00.000Z",
          completedAt: "2026-09-28T20:00:00.000Z",
          totalWorkedMinutes: 85,
        },
        {
          _id: "assign-vikash",
          driverId: "driver-vikash-2",
          driverName: "Vikash",
          role: "assistant",
          status: "in_progress",
          startedAt: "2026-09-28T19:18:00.000Z",
          completedAt: null,
        },
      ],
    };

    const shivamAssignment = normalizeMyDriverAssignment(jobScenarioC, driverShivam);
    const vikashAssignment = normalizeMyDriverAssignment(jobScenarioC, driverVikash);

    // Shivam is completed
    expect(shivamAssignment.isCompleted).toBe(true);
    expect(shivamAssignment.isInProgress).toBe(false);
    expect(shivamAssignment.completedAt).toBe("2026-09-28T20:00:00.000Z");
    expect(shivamAssignment.canEndWork).toBe(false);
    expect(calculateDriverDuration(shivamAssignment)).toBe("1 Hr 25 Min");

    // Vikash is still running
    expect(vikashAssignment.isCompleted).toBe(false);
    expect(vikashAssignment.isInProgress).toBe(true);
    expect(vikashAssignment.completedAt).toBeNull();
    expect(vikashAssignment.canEndWork).toBe(true);
  });

  test("SCENARIO D: Driver 2 also completes -> Independent total duration & completion", () => {
    const jobScenarioD = {
      ...jobScenarioA,
      status: "completed",
      driverAssignments: [
        {
          _id: "assign-shivam",
          driverId: "driver-shivam-1",
          driverName: "Shivam",
          role: "primary",
          status: "completed",
          startedAt: "2026-09-28T18:35:00.000Z",
          completedAt: "2026-09-28T20:00:00.000Z",
          totalWorkedMinutes: 85,
        },
        {
          _id: "assign-vikash",
          driverId: "driver-vikash-2",
          driverName: "Vikash",
          role: "assistant",
          status: "completed",
          startedAt: "2026-09-28T19:18:00.000Z",
          completedAt: "2026-09-28T20:30:00.000Z",
          totalWorkedMinutes: 72,
        },
      ],
    };

    const shivamAssignment = normalizeMyDriverAssignment(jobScenarioD, driverShivam);
    const vikashAssignment = normalizeMyDriverAssignment(jobScenarioD, driverVikash);

    expect(shivamAssignment.isCompleted).toBe(true);
    expect(calculateDriverDuration(shivamAssignment)).toBe("1 Hr 25 Min");

    expect(vikashAssignment.isCompleted).toBe(true);
    expect(calculateDriverDuration(vikashAssignment)).toBe("1 Hr 12 Min");
  });

  test("LEGACY SINGLE-DRIVER COMPATIBILITY: Works as expected when no multi-driver collections exist", () => {
    const legacyJob = {
      _id: "JOB-LEGACY-001",
      jobNumber: "JOB-LEGACY-001",
      driverId: "driver-shivam-1",
      status: "in_progress",
      startedAt: "2026-09-28T10:00:00.000Z",
    };

    const legacyAssignment = normalizeMyDriverAssignment(legacyJob, driverShivam);
    expect(legacyAssignment.isAssigned).toBe(true);
    expect(legacyAssignment.isInProgress).toBe(true);
    expect(legacyAssignment.startedAt).toBe("2026-09-28T10:00:00.000Z");
  });

  test("PRICING PROTECTION: JOB-00130 and JOB-00127 pricing calculations remain 100% untouched and exact", () => {
    const job130 = {
      jobNumber: "JOB-00130",
      pricing: {
        hourlyRate: 1000,
        estimatedHours: 1,
        minimumCost: 1000,
        calloutCharge: 500,
        stairsFee: 500,
      },
      billing: {
        totalAmount: 3000,
      },
    };

    const summary130 = getJobPricingSummary(job130);
    expect(summary130.totalEstimatedCost).toBe(2000);
    expect(summary130.formattedFinalTotal).toBe("$2000.00");

    const job127 = {
      jobNumber: "JOB-00127",
      pricing: {
        hourlyRate: 100,
        estimatedHours: 1,
        minimumCost: 100,
        calloutCharge: 50,
        stairsFee: 50,
      },
      billing: {
        totalAmount: 300,
      },
    };

    const summary127 = getJobPricingSummary(job127);
    expect(summary127.totalEstimatedCost).toBe(200);
    expect(summary127.formattedFinalTotal).toBe("$200.00");
  });
});
