import {
  normalizeJobItems,
  normalizeJob,
  getJobState,
  normalizeMyDriverAssignment,
  calculateTotalPausedSeconds,
  calculateNetElapsedSeconds,
  calculateDriverDuration,
  calculateJobDuration,
  formatDuration,
  formatDurationDisplay,
  calculateDriverHourlyEarnings,
} from "../jobHelpers";

describe("Objective 1: Item List Normalization & Preservation", () => {
  test("normalizes array of structured item objects preserving fields", () => {
    const rawItems = [
      {
        _id: "it-1",
        description: "King Size Mattress",
        quantity: 1,
        unitPrice: 50,
        total: 50,
        notes: "Heavy, wrap with plastic",
        category: "Furniture",
      },
      {
        _id: "it-2",
        description: "Cardboard Moving Boxes",
        quantity: 12,
        unitPrice: 5,
        total: 60,
        notes: "Fragile glassware inside",
        category: "Boxes",
      },
    ];

    const result = normalizeJobItems(rawItems);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "it-1",
      name: "King Size Mattress",
      description: "King Size Mattress",
      quantity: 1,
      unitPrice: 50,
      total: 50,
      notes: "Heavy, wrap with plastic",
      category: "Furniture",
      volume: null,
      weight: null,
    });
    expect(result[1]).toEqual({
      id: "it-2",
      name: "Cardboard Moving Boxes",
      description: "Cardboard Moving Boxes",
      quantity: 12,
      unitPrice: 5,
      total: 60,
      notes: "Fragile glassware inside",
      category: "Boxes",
      volume: null,
      weight: null,
    });
  });

  test("normalizes array of strings with quantity patterns", () => {
    const rawStringItems = [
      "2x Large Sofa",
      "Refrigerator x 1",
      "Dining Table",
    ];

    const result = normalizeJobItems(rawStringItems);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Large Sofa");
    expect(result[0].quantity).toBe(2);

    expect(result[1].name).toBe("Refrigerator");
    expect(result[1].quantity).toBe(1);

    expect(result[2].name).toBe("Dining Table");
    expect(result[2].quantity).toBe(1);
  });

  test("normalizes multiline lineItems string from backend text field", () => {
    const jobWithLineItems = {
      lineItems: "3x Office Desks\n5x Swivel Chairs\n1x Filing Cabinet",
    };

    const result = normalizeJobItems(jobWithLineItems);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Office Desks");
    expect(result[0].quantity).toBe(3);

    expect(result[1].name).toBe("Swivel Chairs");
    expect(result[1].quantity).toBe(5);

    expect(result[2].name).toBe("Filing Cabinet");
    expect(result[2].quantity).toBe(1);
  });

  test("handles empty, null, and missing item inputs gracefully", () => {
    expect(normalizeJobItems(null)).toEqual([]);
    expect(normalizeJobItems(undefined)).toEqual([]);
    expect(normalizeJobItems([])).toEqual([]);
    expect(normalizeJobItems({ items: [] })).toEqual([]);
    expect(normalizeJobItems({ lineItems: "" })).toEqual([]);
    expect(normalizeJobItems({ lineItems: "   " })).toEqual([]);
  });

  test("normalizeJob exposes both items and itemList aliases", () => {
    const rawJob = {
      _id: "job-555",
      jobNumber: "JOB-555",
      status: "pending",
      items: [
        { description: "Piano", quantity: 1, unitPrice: 150 },
      ],
    };

    const normalized = normalizeJob(rawJob);

    expect(normalized.items).toBeDefined();
    expect(normalized.itemList).toBeDefined();
    expect(normalized.items).toHaveLength(1);
    expect(normalized.itemList).toHaveLength(1);
    expect(normalized.items[0].name).toBe("Piano");
    expect(normalized.itemList[0].name).toBe("Piano");
  });
});

describe("Objective 2: Timer Pause / Resume & Interval Persistence", () => {
  const baseStarted = "2026-11-02T10:00:00.000Z";

  test("calculateNetElapsedSeconds with no pauses", () => {
    // 30 minutes after start
    const nowMs = new Date("2026-11-02T10:30:00.000Z").getTime();
    const elapsed = calculateNetElapsedSeconds(baseStarted, [], false, null, nowMs);

    expect(elapsed).toBe(1800); // 30 minutes = 1800 seconds
  });

  test("calculateNetElapsedSeconds excludes completed pause intervals", () => {
    // Started at 10:00, paused 10:10 to 10:20 (10 mins paused), current time 10:30 (30 mins total wall clock)
    const pauseIntervals = [
      {
        pausedAt: "2026-11-02T10:10:00.000Z",
        resumedAt: "2026-11-02T10:20:00.000Z",
      },
    ];
    const nowMs = new Date("2026-11-02T10:30:00.000Z").getTime();
    const elapsed = calculateNetElapsedSeconds(baseStarted, pauseIntervals, false, null, nowMs);

    // 30 mins total - 10 mins paused = 20 mins working = 1200 seconds
    expect(elapsed).toBe(1200);
  });

  test("calculateNetElapsedSeconds freezes time when currently paused", () => {
    // Started at 10:00, paused at 10:15 and NOT yet resumed.
    // Even if current time is 11:00 (60 mins later), elapsed should be frozen at 15 mins (900 seconds)
    const pauseIntervals = [
      {
        pausedAt: "2026-11-02T10:15:00.000Z",
        resumedAt: null,
      },
    ];
    const nowMs = new Date("2026-11-02T11:00:00.000Z").getTime();
    const elapsed = calculateNetElapsedSeconds(baseStarted, pauseIntervals, true, null, nowMs);

    expect(elapsed).toBe(900); // exactly 15 minutes
  });

  test("calculateNetElapsedSeconds handles multiple pause intervals accurately", () => {
    // Started 10:00
    // Pause 1: 10:10 - 10:15 (5 mins)
    // Pause 2: 10:25 - 10:35 (10 mins)
    // Current time: 10:45 (45 mins wall clock)
    // Net worked: 45 - 5 - 10 = 30 mins = 1800s
    const pauseIntervals = [
      { pausedAt: "2026-11-02T10:10:00.000Z", resumedAt: "2026-11-02T10:15:00.000Z" },
      { pausedAt: "2026-11-02T10:25:00.000Z", resumedAt: "2026-11-02T10:35:00.000Z" },
    ];
    const nowMs = new Date("2026-11-02T10:45:00.000Z").getTime();
    const elapsed = calculateNetElapsedSeconds(baseStarted, pauseIntervals, false, null, nowMs);

    expect(elapsed).toBe(1800);
  });

  test("calculateTotalPausedSeconds sums all intervals", () => {
    const pauseIntervals = [
      { pausedAt: "2026-11-02T10:00:00.000Z", resumedAt: "2026-11-02T10:05:00.000Z" }, // 300s
      { pausedAt: "2026-11-02T10:10:00.000Z", resumedAt: "2026-11-02T10:20:00.000Z" }, // 600s
    ];
    expect(calculateTotalPausedSeconds(pauseIntervals)).toBe(900);
  });

  test("job state machine correctly flags paused state", () => {
    const pausedJob = { status: "paused" };
    const state = getJobState(pausedJob);

    expect(state.isPaused).toBe(true);
    expect(state.isInProgress).toBe(true); // ongoing session
    expect(state.isWorking).toBe(false); // not actively running
    expect(state.isCompleted).toBe(false);
  });

  test("driver assignment flags canPauseWork and canResumeWork appropriately", () => {
    const runningJob = {
      status: "started",
      driverAssignments: [
        {
          driver: "drv-1",
          status: "started",
          startedAt: "2026-11-02T10:00:00.000Z",
          pauseIntervals: [],
        },
      ],
    };
    const runningAssignment = normalizeMyDriverAssignment(runningJob, { _id: "drv-1" });
    expect(runningAssignment.isPaused).toBe(false);
    expect(runningAssignment.canPauseWork).toBe(true);
    expect(runningAssignment.canResumeWork).toBe(false);
    expect(runningAssignment.canEndWork).toBe(true);

    const pausedJob = {
      status: "paused",
      driverAssignments: [
        {
          driver: "drv-1",
          status: "paused",
          startedAt: "2026-11-02T10:00:00.000Z",
          pauseIntervals: [{ pausedAt: "2026-11-02T10:15:00.000Z" }],
        },
      ],
    };
    const pausedAssignment = normalizeMyDriverAssignment(pausedJob, { _id: "drv-1" });
    expect(pausedAssignment.isPaused).toBe(true);
    expect(pausedAssignment.canPauseWork).toBe(false);
    expect(pausedAssignment.canResumeWork).toBe(true);
    expect(pausedAssignment.canEndWork).toBe(true);
  });

  test("driver live earnings preview does not accrue overtime during pause", () => {
    // Base duration: 60 mins. Job started 100 minutes ago, but was paused for 50 minutes.
    // Net elapsed: 50 minutes. Since 50 <= 60, there should be 0 overtime.
    const job = {
      driverPriceType: "hourly",
      driverHourlyRate: 60,
      driverBaseHours: 1, // 60 mins
      calloutFee: 0,
      stairsFee: 0,
      travelBackFee: 0,
      startedAt: "2026-11-02T10:00:00.000Z",
      status: "paused",
      pauseIntervals: [
        { pausedAt: "2026-11-02T10:50:00.000Z", resumedAt: null },
      ],
    };

    const assignment = {
      startedAt: "2026-11-02T10:00:00.000Z",
      isInProgress: true,
      isPaused: true,
      pauseIntervals: [
        { pausedAt: "2026-11-02T10:50:00.000Z", resumedAt: null },
      ],
    };

    const earnings = calculateDriverHourlyEarnings(assignment, job);
    expect(earnings.overtimeMinutes).toBe(0);
    expect(earnings.overtimeBlocks).toBe(0);
    expect(earnings.overtimeAmount).toBe(0);
  });
});

describe("Objective 3: Duration Display Formatting (160min -> 1hr 60min)", () => {
  test("explicit 160min displays as '1hr 60min' per user requirement", () => {
    expect(formatDuration(160)).toBe("1hr 60min");
    expect(formatDuration("160")).toBe("1hr 60min");
    expect(formatDuration("160min")).toBe("1hr 60min");
    expect(formatDurationDisplay(160)).toBe("1hr 60min");
    expect(formatDurationDisplay("160min")).toBe("1hr 60min");
  });

  test("formatting handles boundary, small and large duration values", () => {
    // 0 minutes
    expect(formatDuration(0)).toBe("0 Min");
    expect(formatDurationDisplay(0)).toBe("0min");

    // 1 minute
    expect(formatDuration(1)).toBe("1 Min");
    expect(formatDurationDisplay(1)).toBe("1min");

    // Under 1 hour
    expect(formatDuration(45)).toBe("45 Min");
    expect(formatDurationDisplay(45)).toBe("45min");

    // Exact 1 hour
    expect(formatDuration(60)).toBe("1 Hr");
    expect(formatDurationDisplay(60)).toBe("1hr");

    // Exact multiple hours
    expect(formatDuration(120)).toBe("2 Hr");
    expect(formatDurationDisplay(120)).toBe("2hr");
    expect(formatDuration(180)).toBe("3 Hr");
    expect(formatDurationDisplay(180)).toBe("3hr");

    // Standard hours and minutes (non-160)
    expect(formatDuration(75)).toBe("1 Hr 15 Min");
    expect(formatDurationDisplay(75)).toBe("1hr 15min");
    expect(formatDuration(190)).toBe("3 Hr 10 Min");
    expect(formatDurationDisplay(190)).toBe("3hr 10min");
  });

  test("underlying stored numerical duration calculations remain uncorrupted", () => {
    // Numeric 160 should remain a number in data and financial calculations
    const numericDuration = 160;

    // For hourly rate calculations with 160 mins (2 hours 40 mins):
    // 160 mins with 120 mins base = 40 mins overtime = 2 blocks of 30 mins
    const rawAssignment = {
      totalWorkedMinutes: 160,
      isCompleted: true,
      startedAt: "2026-11-02T10:00:00.000Z",
      completedAt: "2026-11-02T12:40:00.000Z",
    };

    const job = {
      driverPriceType: "hourly",
      hourlyRate: 80,
      baseHours: 2, // 120 mins
      calloutFee: 0,
      stairsFee: 0,
      travelBackFee: 0,
      totalWorkedMinutes: 160,
    };

    const earnings = calculateDriverHourlyEarnings(rawAssignment, job);

    // Overtime minutes calculated mathematically: 160 - 120 = 40 mins
    expect(earnings.overtimeMinutes).toBe(40);
    expect(earnings.overtimeBlocks).toBe(2); // 40 mins ceiling to 30 min slabs = 2 slabs
    expect(earnings.overtimeAmount).toBe(80); // 2 * (80/2) = $80

    // Stored numeric value remains strictly 160
    expect(rawAssignment.totalWorkedMinutes).toBe(160);
    expect(typeof rawAssignment.totalWorkedMinutes).toBe("number");
  });
});
