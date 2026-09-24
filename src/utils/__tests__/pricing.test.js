import {
  normalizeJob,
  calculateDriverHourlyEarnings,
  getDriverVisiblePriceInfo,
  getJobPricingSummary,
  isDriverPriceVisible,
  getDriverPriceType,
  resolveDriverPriceAmount,
} from "../jobHelpers";

describe("Driver Pricing Logic", () => {
  test("JOB-00103 Full Price Mode ($200) with showDriverPrice: true", () => {
    const job103 = {
      _id: "job_00103_id",
      jobNumber: "JOB-00103",
      jobType: "moving",
      status: "assigned",
      showDriverPrice: true,
      driverPriceType: "full",
      totalAmount: 200,
      pickupAddress: "123 King St, Sydney",
      dropoffAddress: "456 Queen St, Sydney",
    };

    const normalized = normalizeJob(job103, { _id: "driver_1" });
    expect(normalized.canShowPrice).toBe(true);
    expect(normalized.showDriverPrice).toBe(true);
    expect(normalized.driverPrice).toBe(200);
    expect(normalized.formattedPrice).toBe("$200.00");
    expect(normalized.driverPriceType).toBe("full");
  });

  test("Nested pricing/billing structures (pricing.totalAmount, billing.totalAmount)", () => {
    const jobNested = {
      jobNumber: "JOB-00103B",
      jobType: "moving",
      status: "assigned",
      showPriceToDriver: true,
      billing: { totalAmount: 250 },
    };

    const normalized = normalizeJob(jobNested, { _id: "driver_1" });
    expect(normalized.canShowPrice).toBe(true);
    expect(normalized.formattedPrice).toBe("$250.00");
    expect(normalized.driverPrice).toBe(250);
  });

  test("Custom Price Mode ($150) with showDriverPrice: true", () => {
    const jobCustom = {
      jobNumber: "JOB-00104",
      jobType: "delivery",
      status: "assigned",
      showDriverPrice: true,
      driverPriceType: "custom",
      driverPrice: 150,
    };

    const normalized = normalizeJob(jobCustom, { _id: "driver_1" });
    expect(normalized.canShowPrice).toBe(true);
    expect(normalized.formattedPrice).toBe("$150.00");
    expect(normalized.driverPrice).toBe(150);
  });

  test("Percentage Mode (50% of $400 = $200)", () => {
    const jobPct = {
      jobNumber: "JOB-00105",
      jobType: "moving",
      status: "assigned",
      showDriverPrice: true,
      driverPriceType: "percentage",
      driverPricePercentage: 50,
      totalAmount: 400,
    };

    const normalized = normalizeJob(jobPct, { _id: "driver_1" });
    expect(normalized.canShowPrice).toBe(true);
    expect(normalized.formattedPrice).toBe("$200.00");
    expect(normalized.driverPrice).toBe(200);
  });

  test("Hourly Mode ($60/hr, base 2hr = $120 estimated)", () => {
    const jobHourly = {
      jobNumber: "JOB-00106",
      jobType: "moving",
      status: "assigned",
      showDriverPrice: true,
      driverPriceType: "hourly",
      hourlyRate: 60,
      baseHours: 2,
    };

    const normalized = normalizeJob(jobHourly, { _id: "driver_1" });
    expect(normalized.canShowPrice).toBe(true);
    expect(normalized.formattedPrice).toBe("$120.00");
  });

  test("Show Price OFF hides price completely", () => {
    const jobOff = {
      jobNumber: "JOB-00107",
      jobType: "moving",
      status: "assigned",
      showDriverPrice: false,
      totalAmount: 200,
      driverPrice: 200,
    };

    const normalized = normalizeJob(jobOff, { _id: "driver_1" });
    expect(normalized.canShowPrice).toBe(false);
    expect(normalized.formattedPrice).toBeNull();
  });

  test("Completed Job prefers pricingSnapshot finalDriverAmount", () => {
    const jobCompleted = {
      jobNumber: "JOB-00108",
      jobType: "moving",
      status: "completed",
      showDriverPrice: true,
      myAssignment: {
        status: "completed",
        pricingSnapshot: {
          finalDriverAmount: 275,
          baseAmount: 200,
          overtimeAmount: 75,
        },
      },
    };

    const normalized = normalizeJob(jobCompleted, { _id: "driver_1" });
    expect(normalized.canShowPrice).toBe(true);
    expect(normalized.formattedPrice).toBe("$275.00");
    expect(normalized.finalDriverAmount).toBe(275);
  });

  describe("Complete & End Job Pricing Normalization Scenarios", () => {
    const crmHourlyJob = {
      _id: "job_hourly_1",
      jobNumber: "JOB-00200",
      jobType: "moving",
      status: "in_progress",
      showDriverPrice: true,
      driverPriceType: "hourly",
      hourlyRate: 100,
      estimatedHours: 1,
      minimumCost: 100,
      calloutCharge: 50,
      stairsFee: 50,
      travelBackFee: 0,
      minimumEstimatedCost: 200,
    };

    test("11. Exact Scenario: 90 mins worked (30 min overtime) -> Final Total = $250", () => {
      const assignment90Min = {
        status: "in_progress",
        startedAt: "2026-09-21T10:00:00.000Z",
        completedAt: "2026-09-21T11:30:00.000Z",
        totalWorkedMinutes: 90,
      };

      const summary = getJobPricingSummary(crmHourlyJob, assignment90Min);

      expect(summary.hourlyRate).toBe(100);
      expect(summary.baseHours).toBe(1);
      expect(summary.baseAmount).toBe(100);
      expect(summary.calloutFee).toBe(50);
      expect(summary.stairsFee).toBe(50);
      expect(summary.travelBackFee).toBe(0);
      expect(summary.initialTotal).toBe(200);
      expect(summary.totalWorkedMinutes).toBe(90);
      expect(summary.overtimeMinutes).toBe(30);
      expect(summary.overtimeBlocks).toBe(1);
      expect(summary.overtimeAmount).toBe(50);
      expect(summary.finalTotal).toBe(250);
      expect(summary.amountToCollect).toBe(250);
      expect(summary.formattedAmountToCollect).toBe("$250.00");
      expect(summary.formattedOvertimeAmount).toBe("$50.00");
    });

    test("12. No Overtime Scenario: 60 mins worked -> Final Total = $200", () => {
      const assignment60Min = {
        status: "in_progress",
        startedAt: "2026-09-21T10:00:00.000Z",
        completedAt: "2026-09-21T11:00:00.000Z",
        totalWorkedMinutes: 60,
      };

      const summary = getJobPricingSummary(crmHourlyJob, assignment60Min);

      expect(summary.initialTotal).toBe(200);
      expect(summary.totalWorkedMinutes).toBe(60);
      expect(summary.overtimeMinutes).toBe(0);
      expect(summary.overtimeBlocks).toBe(0);
      expect(summary.overtimeAmount).toBe(0);
      expect(summary.finalTotal).toBe(200);
      expect(summary.amountToCollect).toBe(200);
      expect(summary.formattedAmountToCollect).toBe("$200.00");
    });

    test("13. 2 Hours Scenario: 120 mins worked (60 min overtime) -> Final Total = $300", () => {
      const assignment120Min = {
        status: "in_progress",
        startedAt: "2026-09-21T10:00:00.000Z",
        completedAt: "2026-09-21T12:00:00.000Z",
        totalWorkedMinutes: 120,
      };

      const summary = getJobPricingSummary(crmHourlyJob, assignment120Min);

      expect(summary.initialTotal).toBe(200);
      expect(summary.totalWorkedMinutes).toBe(120);
      expect(summary.overtimeMinutes).toBe(60);
      expect(summary.overtimeBlocks).toBe(2);
      expect(summary.overtimeAmount).toBe(100);
      expect(summary.finalTotal).toBe(300);
      expect(summary.amountToCollect).toBe(300);
      expect(summary.formattedAmountToCollect).toBe("$300.00");
    });

    test("14. Show Price OFF hides pricing in getJobPricingSummary", () => {
      const jobOff = {
        ...crmHourlyJob,
        showDriverPrice: false,
      };

      const summary = getJobPricingSummary(jobOff, null);
      expect(summary.showDriverPrice).toBe(false);
      expect(summary.canShowPrice).toBe(false);
    });

    test("15. Acceptance Test: CRM $250 (Base $100 + Callout $50 + Stairs $100) -> Home/Jobs/JobDetail = $250, Complete (90m worked) = $300", () => {
      const crmJob250 = {
        _id: "job_250_id",
        jobNumber: "JOB-00250",
        jobType: "moving",
        status: "in_progress",
        showDriverPrice: true,
        driverPriceType: "hourly",
        hourlyRate: 100,
        estimatedHours: 1,
        minimumCost: 100,
        calloutCharge: 50,
        stairsFee: 100,
        travelBackFee: 0,
        minimumEstimatedCost: 250,
      };

      // 1. Home / Jobs card before completion
      const normalizedPreJob = normalizeJob(crmJob250, { _id: "driver_1" });
      expect(normalizedPreJob.canShowPrice).toBe(true);
      expect(normalizedPreJob.formattedPrice).toBe("$250.00");
      expect(normalizedPreJob.driverPrice).toBe(250);

      // 2. Job Detail Screen before completion
      const detailPricing = calculateDriverHourlyEarnings(normalizedPreJob.myAssignment, crmJob250);
      expect(detailPricing.hourlyRate).toBe(100);
      expect(detailPricing.baseAmount).toBe(100);
      expect(detailPricing.calloutFee).toBe(50);
      expect(detailPricing.stairsFee).toBe(100);
      expect(detailPricing.travelBackFee).toBe(0);
      expect(detailPricing.estimatedTotal).toBe(250);
      expect(detailPricing.formattedEstimatedTotal).toBe("$250.00");

      // 3. Complete & End Job screen after 90 minutes worked (30 min overtime)
      const assignment90m = {
        ...normalizedPreJob.myAssignment,
        startedAt: "2026-09-21T10:00:00.000Z",
        completedAt: "2026-09-21T11:30:00.000Z",
        totalWorkedMinutes: 90,
      };

      const completeSummary = getJobPricingSummary(crmJob250, assignment90m, "CompleteJob");
      expect(completeSummary.initialTotal).toBe(250);
      expect(completeSummary.workedMinutes).toBe(90);
      expect(completeSummary.overtimeMinutes).toBe(30);
      expect(completeSummary.overtimeBlocks).toBe(1);
      expect(completeSummary.overtimeAmount).toBe(50);
      expect(completeSummary.finalTotal).toBe(300);
      expect(completeSummary.amountToCollect).toBe(300);
      expect(completeSummary.formattedAmountToCollect).toBe("$300.00");
    });

    test("16. JOB-00106 ($1600): Before Start and After Start (Timer 00:35:35) pricing remains $1600", () => {
      const job106 = {
        _id: "job_106_id",
        jobNumber: "JOB-00106",
        jobType: "moving",
        status: "assigned",
        showDriverPrice: true,
        driverPriceType: "hourly",
        hourlyRate: 1000,
        estimatedHours: 1,
        minimumCost: 1000,
        calloutCharge: 500,
        stairsFee: 100,
        travelBackFee: 0,
        minimumEstimatedCost: 1600,
      };

      // Before start
      const normBefore = normalizeJob(job106, { _id: "driver_1" });
      expect(normBefore.formattedPrice).toBe("$1600.00");
      expect(normBefore.driverPrice).toBe(1600);

      const pricingBefore = calculateDriverHourlyEarnings(normBefore.myAssignment, job106);
      expect(pricingBefore.calloutFee).toBe(500);
      expect(pricingBefore.stairsFee).toBe(100);
      expect(pricingBefore.estimatedTotal).toBe(1600);
      expect(pricingBefore.formattedEstimatedTotal).toBe("$1600.00");

      // After Start Job (status: in_progress, timer at 35 mins elapsed)
      const inProgressAssignment = {
        ...normBefore.myAssignment,
        status: "in_progress",
        isInProgress: true,
        isPending: false,
        startedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        totalWorkedMinutes: 35,
      };

      const normAfter = normalizeJob(
        { ...job106, status: "in_progress", startedAt: inProgressAssignment.startedAt, myAssignment: inProgressAssignment },
        { _id: "driver_1" }
      );

      // Must remain $1600, NOT drop to $1000 or $1100!
      expect(normAfter.formattedPrice).toBe("$1600.00");
      expect(normAfter.driverPrice).toBe(1600);

      const pricingAfter = calculateDriverHourlyEarnings(inProgressAssignment, job106);
      expect(pricingAfter.calloutFee).toBe(500);
      expect(pricingAfter.stairsFee).toBe(100);
      expect(pricingAfter.estimatedTotal).toBe(1600);
      expect(pricingAfter.formattedEstimatedTotal).toBe("$1600.00");
      expect(pricingAfter.overtimeMinutes).toBe(0);
      expect(pricingAfter.overtimeAmount).toBe(0);
    });

    test("17. JOB-00106 Overtime Steps: 60m ($1600), 61m ($2100), 90m ($2100), 91m ($2600)", () => {
      const job106 = {
        _id: "job_106_id",
        jobNumber: "JOB-00106",
        jobType: "moving",
        status: "in_progress",
        showDriverPrice: true,
        driverPriceType: "hourly",
        hourlyRate: 1000,
        estimatedHours: 1,
        minimumCost: 1000,
        calloutCharge: 500,
        stairsFee: 100,
        travelBackFee: 0,
        minimumEstimatedCost: 1600,
      };

      // 60 mins -> no OT ($1600)
      const s60 = getJobPricingSummary(job106, { totalWorkedMinutes: 60 });
      expect(s60.initialTotal).toBe(1600);
      expect(s60.overtimeMinutes).toBe(0);
      expect(s60.overtimeAmount).toBe(0);
      expect(s60.finalTotal).toBe(1600);

      // 61 mins -> 1 min OT (<15 min) -> 0 OT blocks ($0) -> $1600
      const s61 = getJobPricingSummary(job106, { totalWorkedMinutes: 61 });
      expect(s61.overtimeMinutes).toBe(1);
      expect(s61.overtimeBlocks).toBe(0);
      expect(s61.overtimeAmount).toBe(0);
      expect(s61.finalTotal).toBe(1600);

      // 74 mins -> 14 mins OT (<15 min) -> 0 OT blocks ($0) -> $1600
      const s74 = getJobPricingSummary(job106, { totalWorkedMinutes: 74 });
      expect(s74.overtimeMinutes).toBe(14);
      expect(s74.overtimeBlocks).toBe(0);
      expect(s74.overtimeAmount).toBe(0);
      expect(s74.finalTotal).toBe(1600);

      // 75 mins -> 15 mins OT (15-30 min) -> 1 OT block ($500) -> $2100
      const s75 = getJobPricingSummary(job106, { totalWorkedMinutes: 75 });
      expect(s75.overtimeMinutes).toBe(15);
      expect(s75.overtimeBlocks).toBe(1);
      expect(s75.overtimeAmount).toBe(500);
      expect(s75.finalTotal).toBe(2100);

      // 90 mins -> 30 mins OT (15-30 min) -> 1 OT block ($500) -> $2100
      const s90 = getJobPricingSummary(job106, { totalWorkedMinutes: 90 });
      expect(s90.overtimeMinutes).toBe(30);
      expect(s90.overtimeBlocks).toBe(1);
      expect(s90.overtimeAmount).toBe(500);
      expect(s90.finalTotal).toBe(2100);

      // 91 mins -> 31 mins OT (15-31 min) -> 1 OT block ($500) -> $2100
      const s91 = getJobPricingSummary(job106, { totalWorkedMinutes: 91 });
      expect(s91.overtimeMinutes).toBe(31);
      expect(s91.overtimeBlocks).toBe(1);
      expect(s91.overtimeAmount).toBe(500);
      expect(s91.finalTotal).toBe(2100);

      // 92 mins -> 32 mins OT (32-60 min) -> 2 OT blocks ($1000) -> $2600
      const s92 = getJobPricingSummary(job106, { totalWorkedMinutes: 92 });
      expect(s92.overtimeMinutes).toBe(32);
      expect(s92.overtimeBlocks).toBe(2);
      expect(s92.overtimeAmount).toBe(1000);
      expect(s92.finalTotal).toBe(2600);
    });

    test("18. Partial Start API response merged over full job preserves callout & stairs", () => {
      const fullJobBefore = {
        _id: "job_106_id",
        jobNumber: "JOB-00106",
        pricing: {
          hourlyRate: 1000,
          estimatedHours: 1,
          minimumCost: 1000,
          calloutCharge: 500,
          stairsFee: 100,
          minimumEstimatedCost: 1600,
        },
        showDriverPrice: true,
        driverPriceType: "hourly",
      };

      // Backend returns partial start response
      const partialStartResponse = {
        status: "in_progress",
        startedAt: "2026-09-21T10:00:00.000Z",
        myAssignment: {
          status: "in_progress",
          startedAt: "2026-09-21T10:00:00.000Z",
        },
      };

      const merged = {
        ...fullJobBefore,
        ...partialStartResponse,
        pricing: {
          ...(fullJobBefore.pricing || {}),
          ...(partialStartResponse.pricing || {}),
        },
        myAssignment: {
          ...(fullJobBefore.myAssignment || {}),
          ...(partialStartResponse.myAssignment || {}),
        },
      };

      const norm = normalizeJob(merged, { _id: "driver_1" });
      expect(norm.formattedPrice).toBe("$1600.00");
      expect(norm.driverPrice).toBe(1600);

      const summary = getJobPricingSummary(merged, norm.myAssignment);
      expect(summary.calloutFee).toBe(500);
      expect(summary.stairsFee).toBe(100);
      expect(summary.initialTotal).toBe(1600);
    });

    test("19. JOB-00107 ($900): Before Start and After Start (Timer 00:00:24 and 00:59:59) price remains $900", () => {
      const job107 = {
        _id: "job_107_id",
        jobNumber: "JOB-00107",
        jobType: "moving",
        status: "assigned",
        showDriverPrice: true,
        driverPriceType: "hourly",
        hourlyRate: 600,
        estimatedHours: 1,
        minimumCost: 600,
        calloutCharge: 300,
        travelBackFee: 0,
        minimumEstimatedCost: 900,
      };

      // 1. Before Start: Home, Jobs, JobDetail must all be $900
      const normBefore = normalizeJob(job107, { _id: "driver_1" });
      expect(normBefore.formattedPrice).toBe("$900.00");
      expect(normBefore.driverPrice).toBe(900);

      const detailBefore = calculateDriverHourlyEarnings(normBefore.myAssignment, job107);
      expect(detailBefore.calloutFee).toBe(300);
      expect(detailBefore.baseAmount).toBe(600);
      expect(detailBefore.estimatedTotal).toBe(900);
      expect(detailBefore.formattedEstimatedTotal).toBe("$900.00");

      // 2. Immediately after Start (Timer 00:00:24)
      const assignment24s = {
        ...normBefore.myAssignment,
        status: "in_progress",
        isInProgress: true,
        isPending: false,
        startedAt: new Date(Date.now() - 24 * 1000).toISOString(),
        totalWorkedMinutes: 0,
      };

      const normAfter24s = normalizeJob(
        { ...job107, status: "in_progress", startedAt: assignment24s.startedAt, myAssignment: assignment24s },
        { _id: "driver_1" }
      );
      expect(normAfter24s.formattedPrice).toBe("$900.00");
      expect(normAfter24s.driverPrice).toBe(900);

      const detailAfter24s = calculateDriverHourlyEarnings(assignment24s, job107);
      expect(detailAfter24s.calloutFee).toBe(300);
      expect(detailAfter24s.estimatedTotal).toBe(900);
      expect(detailAfter24s.formattedEstimatedTotal).toBe("$900.00");

      // 3. At 00:59:59 (59 mins worked - within 1 hour base)
      const assignment59m = {
        ...normBefore.myAssignment,
        status: "in_progress",
        isInProgress: true,
        isPending: false,
        startedAt: new Date(Date.now() - 59 * 60 * 1000).toISOString(),
        totalWorkedMinutes: 59,
      };

      const normAfter59m = normalizeJob(
        { ...job107, status: "in_progress", startedAt: assignment59m.startedAt, myAssignment: assignment59m },
        { _id: "driver_1" }
      );
      expect(normAfter59m.formattedPrice).toBe("$900.00");

      const detailAfter59m = calculateDriverHourlyEarnings(assignment59m, job107);
      expect(detailAfter59m.estimatedTotal).toBe(900);
      expect(detailAfter59m.overtimeAmount).toBe(0);
    });

    test("20. JOB-00107 Overtime Calculation: <=60m ($900), 61-90m ($1200), 91-120m ($1500)", () => {
      const job107 = {
        _id: "job_107_id",
        jobNumber: "JOB-00107",
        jobType: "moving",
        status: "in_progress",
        showDriverPrice: true,
        driverPriceType: "hourly",
        hourlyRate: 600,
        estimatedHours: 1,
        minimumCost: 600,
        calloutCharge: 300,
        travelBackFee: 0,
        minimumEstimatedCost: 900,
      };

      // <= 60 mins -> Final $900
      const s60 = getJobPricingSummary(job107, { totalWorkedMinutes: 60 });
      expect(s60.initialTotal).toBe(900);
      expect(s60.overtimeMinutes).toBe(0);
      expect(s60.overtimeAmount).toBe(0);
      expect(s60.finalTotal).toBe(900);

      // 61-90 mins -> 1 block @ $300 -> Final $1200
      const s75 = getJobPricingSummary(job107, { totalWorkedMinutes: 75 });
      expect(s75.overtimeMinutes).toBe(15);
      expect(s75.overtimeBlocks).toBe(1);
      expect(s75.overtimeAmount).toBe(300);
      expect(s75.finalTotal).toBe(1200);

      // 91-120 mins -> 2 blocks @ $600 -> Final $1500
      const s100 = getJobPricingSummary(job107, { totalWorkedMinutes: 100 });
      expect(s100.overtimeMinutes).toBe(40);
      expect(s100.overtimeBlocks).toBe(2);
      expect(s100.overtimeAmount).toBe(600);
      expect(s100.finalTotal).toBe(1500);
    });

    describe("Section 16: Six Regression Test Cases", () => {
      // Case 1: status = assigned, base = 600, callout = 300 -> expected = 900
      test("Case 1: status = assigned, base = 600, callout = 300 -> expected = 900", () => {
        const j = {
          jobNumber: "JOB-00107-C1",
          status: "assigned",
          showDriverPrice: true,
          driverPriceType: "hourly",
          hourlyRate: 600,
          estimatedHours: 1,
          minimumCost: 600,
          calloutCharge: 300,
          minimumEstimatedCost: 900,
        };
        const norm = normalizeJob(j, { _id: "driver_1" });
        expect(norm.formattedPrice).toBe("$900.00");
        expect(norm.driverPrice).toBe(900);
      });

      // Case 2: status = in_progress, same data -> expected = 900
      test("Case 2: status = in_progress, same data -> expected = 900", () => {
        const j = {
          jobNumber: "JOB-00107-C2",
          status: "in_progress",
          showDriverPrice: true,
          driverPriceType: "hourly",
          hourlyRate: 600,
          estimatedHours: 1,
          minimumCost: 600,
          calloutCharge: 300,
          minimumEstimatedCost: 900,
        };
        const norm = normalizeJob(j, { _id: "driver_1" });
        expect(norm.formattedPrice).toBe("$900.00");
        expect(norm.driverPrice).toBe(900);
      });

      // Case 3: timer = 6 minutes -> expected = 900
      test("Case 3: timer = 6 minutes -> expected = 900", () => {
        const j = {
          jobNumber: "JOB-00107-C3",
          status: "in_progress",
          showDriverPrice: true,
          driverPriceType: "hourly",
          hourlyRate: 600,
          estimatedHours: 1,
          minimumCost: 600,
          calloutCharge: 300,
          minimumEstimatedCost: 900,
          startedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
          myAssignment: {
            status: "in_progress",
            startedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            totalWorkedMinutes: 6,
          },
        };
        const norm = normalizeJob(j, { _id: "driver_1" });
        expect(norm.formattedPrice).toBe("$900.00");
        expect(norm.driverPrice).toBe(900);

        const summary = getJobPricingSummary(j, j.myAssignment);
        expect(summary.displayEstimatedPrice).toBe("$900.00");
        expect(summary.workedMinutes).toBe(6);
        expect(summary.overtimeAmount).toBe(0);
      });

      // Case 4: app refresh with in_progress job -> expected = 900
      test("Case 4: app refresh with in_progress job -> expected = 900", () => {
        // Backend raw response from GET /jobs/:id
        const freshRawFromAPI = {
          _id: "job_c4_id",
          jobNumber: "JOB-00107-C4",
          status: "in_progress",
          startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          showDriverPrice: true,
          driverPriceType: "hourly",
          pricing: {
            hourlyRate: 600,
            estimatedHours: 1,
            minimumLabourCost: 600,
            calloutCharge: 300,
            minimumEstimatedCost: 900,
          },
          myAssignment: {
            status: "in_progress",
            startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            pricing: {
              hourlyRate: 600,
              baseHours: 1,
            },
          },
        };
        const norm = normalizeJob(freshRawFromAPI, { _id: "driver_1" });
        expect(norm.formattedPrice).toBe("$900.00");
        expect(norm.driverPrice).toBe(900);

        const detail = calculateDriverHourlyEarnings(norm.myAssignment, freshRawFromAPI);
        expect(detail.calloutFee).toBe(300);
        expect(detail.estimatedTotal).toBe(900);
        expect(detail.formattedEstimatedTotal).toBe("$900.00");
      });

      // Case 5: callout = 0, base = 600 -> expected = 600
      test("Case 5: callout = 0, base = 600 -> expected = 600", () => {
        const j = {
          jobNumber: "JOB-00107-C5",
          status: "in_progress",
          showDriverPrice: true,
          driverPriceType: "hourly",
          hourlyRate: 600,
          estimatedHours: 1,
          minimumCost: 600,
          calloutCharge: 0,
          minimumEstimatedCost: 600,
        };
        const norm = normalizeJob(j, { _id: "driver_1" });
        expect(norm.formattedPrice).toBe("$600.00");
        expect(norm.driverPrice).toBe(600);
      });

      // Case 6: showDriverPrice = false -> price hidden
      test("Case 6: showDriverPrice = false -> price hidden", () => {
        const j = {
          jobNumber: "JOB-00107-C6",
          status: "in_progress",
          showDriverPrice: false,
          driverPriceType: "hourly",
          hourlyRate: 600,
          estimatedHours: 1,
          minimumCost: 600,
          calloutCharge: 300,
          minimumEstimatedCost: 900,
        };
        const norm = normalizeJob(j, { _id: "driver_1" });
        expect(norm.canShowPrice).toBe(false);
        expect(norm.formattedPrice).toBeNull();
      });
    });

    // ── SECTION 19: JOB-00109 Exact Lifecycle & Callout Retention Regression Test ──
    describe("19. JOB-00109 ($2000 Base + $1000 Callout + $100 Stairs = $3100) Lifecycle", () => {
      const rawJobBeforeStart = {
        _id: "job_00109",
        jobNumber: "JOB-00109",
        status: "assigned",
        showDriverPrice: true,
        driverPriceType: "full",
        hourlyRate: 2000,
        estimatedHours: 1,
        minimumCost: 2000,
        callOutFee: 1000,
        calloutCharge: 1000,
        stairsFee: 100,
        minimumEstimatedCost: 3100,
        driverPrice: 3100,
        pricing: {
          hourlyRate: 2000,
          estimatedHours: 1,
          minimumLabourCost: 2000,
          calloutCharge: 1000,
          callOutFee: 1000,
          stairsFee: 100,
          minimumEstimatedCost: 3100,
        },
        billing: {
          hourlyRate: 2000,
          calloutCharge: 1000,
          stairsFee: 100,
          totalAmount: 3100,
        },
      };

      test("STEP 1 & 4: Before Start -> display = $3100.00", () => {
        const norm = normalizeJob(rawJobBeforeStart, { _id: "driver_1" });
        expect(norm.formattedPrice).toBe("$3100.00");
        expect(norm.driverPrice).toBe(3100);

        const summary = getJobPricingSummary(norm);
        expect(summary.hourlyRate).toBe(2000);
        expect(summary.baseAmount).toBe(2000);
        expect(summary.calloutFee).toBe(1000);
        expect(summary.stairsFee).toBe(100);
        expect(summary.initialTotal).toBe(3100);
        expect(summary.estimatedTotal).toBe(3100);
      });

      test("STEP 2 & 4: Immediately after POST /start (partial payload merged) -> display = $3100.00", () => {
        const postStartResponse = {
          _id: "job_00109",
          jobNumber: "JOB-00109",
          status: "in_progress",
          startedAt: new Date().toISOString(),
          pricing: {
            hourlyRate: 2000,
            estimatedHours: 1,
            minimumCost: 2000,
          },
        };

        const mergedAfterStart = {
          ...rawJobBeforeStart,
          ...postStartResponse,
          pricing: {
            ...rawJobBeforeStart.pricing,
            ...postStartResponse.pricing,
          },
        };

        const norm = normalizeJob(mergedAfterStart, { _id: "driver_1" });
        expect(norm.formattedPrice).toBe("$3100.00");
        expect(norm.driverPrice).toBe(3100);

        const summary = getJobPricingSummary(norm);
        expect(summary.calloutFee).toBe(1000);
        expect(summary.stairsFee).toBe(100);
        expect(summary.initialTotal).toBe(3100);
      });

      test("STEP 3 & 4: Fresh GET after start at 10 minutes (within 1 hr base) -> display = $3100.00", () => {
        const freshGetAfterStart = {
          ...rawJobBeforeStart,
          status: "in_progress",
          startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          myAssignment: {
            status: "in_progress",
            startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            totalWorkedMinutes: 10,
          },
        };

        const norm = normalizeJob(freshGetAfterStart, { _id: "driver_1" });
        expect(norm.formattedPrice).toBe("$3100.00");
        expect(norm.driverPrice).toBe(3100);

        const summary = getJobPricingSummary(norm);
        expect(summary.calloutFee).toBe(1000);
        expect(summary.stairsFee).toBe(100);
        expect(summary.initialTotal).toBe(3100);
        expect(summary.finalTotal).toBe(3100);
      });

      test("STEP 8: Overtime after 90 minutes (30 min overtime on $2000/hr = +$1000) -> finalTotal = $4100.00", () => {
        const jobWithOvertime = {
          ...rawJobBeforeStart,
          status: "in_progress",
          myAssignment: {
            status: "in_progress",
            startedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
            totalWorkedMinutes: 90,
          },
        };

        const summary = getJobPricingSummary(jobWithOvertime);
        expect(summary.initialTotal).toBe(3100);
        expect(summary.overtimeMinutes).toBe(30);
        expect(summary.overtimeBlocks).toBe(1);
        expect(summary.overtimeAmount).toBe(1000); // 1 block * (2000 / 2)
        expect(summary.finalTotal).toBe(4100); // 3100 + 1000
      });
    });
  });

  describe("Complete & End Job Screen Overtime Pricing Acceptance Tests (Base $100, Callout $50, Stairs $50 -> Initial $200, Rate $100/hr)", () => {
    const baseJob = {
      _id: "complete_job_test_id",
      jobNumber: "JOB-COMPLETE-01",
      jobType: "moving",
      status: "in_progress",
      showDriverPrice: true,
      driverPriceType: "hourly",
      hourlyRate: 100,
      estimatedHours: 1,
      minimumCost: 100,
      calloutCharge: 50,
      stairsFee: 50,
      minimumEstimatedCost: 200,
    };

    test("Case A: Base duration = 60, Actual = 60 -> Final = $200 (Overtime = $0)", () => {
      const summary = getJobPricingSummary(baseJob, { totalWorkedMinutes: 60 });
      expect(summary.estimatedTotal).toBe(200);
      expect(summary.minimumDurationMinutes).toBe(60);
      expect(summary.actualWorkedMinutes).toBe(60);
      expect(summary.extraMinutes).toBe(0);
      expect(summary.hourlyRate).toBe(100);
      expect(summary.overtimeAmount).toBe(0);
      expect(summary.finalAmount).toBe(200);
      expect(summary.amountToCollect).toBe(200);
    });

    test("Case B: Actual = 74 -> Final = $200 (Overtime = $0, <15 min grace)", () => {
      const summary = getJobPricingSummary(baseJob, { totalWorkedMinutes: 74 });
      expect(summary.estimatedTotal).toBe(200);
      expect(summary.minimumDurationMinutes).toBe(60);
      expect(summary.actualWorkedMinutes).toBe(74);
      expect(summary.extraMinutes).toBe(14);
      expect(summary.hourlyRate).toBe(100);
      expect(summary.overtimeAmount).toBe(0);
      expect(summary.finalAmount).toBe(200);
      expect(summary.amountToCollect).toBe(200);
    });

    test("Case C: Actual = 75 (Extra 15m) -> Final = $250 (Overtime = $50, half-hour slab)", () => {
      const summary = getJobPricingSummary(baseJob, { totalWorkedMinutes: 75 });
      expect(summary.estimatedTotal).toBe(200);
      expect(summary.minimumDurationMinutes).toBe(60);
      expect(summary.actualWorkedMinutes).toBe(75);
      expect(summary.extraMinutes).toBe(15);
      expect(summary.hourlyRate).toBe(100);
      expect(summary.overtimeAmount).toBe(50);
      expect(summary.finalAmount).toBe(250);
      expect(summary.amountToCollect).toBe(250);
    });

    test("Case D: Actual = 90 (Extra 30m) -> Final = $250 (Overtime = $50, half-hour slab)", () => {
      const summary = getJobPricingSummary(baseJob, { totalWorkedMinutes: 90 });
      expect(summary.estimatedTotal).toBe(200);
      expect(summary.minimumDurationMinutes).toBe(60);
      expect(summary.actualWorkedMinutes).toBe(90);
      expect(summary.extraMinutes).toBe(30);
      expect(summary.hourlyRate).toBe(100);
      expect(summary.overtimeAmount).toBe(50);
      expect(summary.finalAmount).toBe(250);
      expect(summary.amountToCollect).toBe(250);
    });

    test("Case E1: Actual = 91 (Extra 31m) -> Final = $250 (Overtime = $50, half-hour slab 15-31m)", () => {
      const summary = getJobPricingSummary(baseJob, { totalWorkedMinutes: 91 });
      expect(summary.estimatedTotal).toBe(200);
      expect(summary.minimumDurationMinutes).toBe(60);
      expect(summary.actualWorkedMinutes).toBe(91);
      expect(summary.extraMinutes).toBe(31);
      expect(summary.hourlyRate).toBe(100);
      expect(summary.overtimeAmount).toBe(50);
      expect(summary.finalAmount).toBe(250);
      expect(summary.amountToCollect).toBe(250);
    });

    test("Case E2: Actual = 92 (Extra 32m) -> Final = $300 (Overtime = $100, full-hour slab 32-60m)", () => {
      const summary = getJobPricingSummary(baseJob, { totalWorkedMinutes: 92 });
      expect(summary.estimatedTotal).toBe(200);
      expect(summary.minimumDurationMinutes).toBe(60);
      expect(summary.actualWorkedMinutes).toBe(92);
      expect(summary.extraMinutes).toBe(32);
      expect(summary.hourlyRate).toBe(100);
      expect(summary.overtimeAmount).toBe(100);
      expect(summary.finalAmount).toBe(300);
      expect(summary.amountToCollect).toBe(300);
    });

    test("Case 76 Min Current Real Job: Actual = 76 (Extra 16m) -> Estimated = $200, Overtime = $50, Final = $250", () => {
      const summary = getJobPricingSummary(baseJob, { totalWorkedMinutes: 76 });
      expect(summary.estimatedTotal).toBe(200);
      expect(summary.minimumDurationMinutes).toBe(60);
      expect(summary.actualWorkedMinutes).toBe(76);
      expect(summary.formattedWorkedTime).toBe("76 Min");
      expect(summary.extraMinutes).toBe(16);
      expect(summary.formattedOvertimeMinutes).toBe("16 Min");
      expect(summary.hourlyRate).toBe(100);
      expect(summary.overtimeAmount).toBe(50);
      expect(summary.formattedOvertimeAmount).toBe("$50.00");
      expect(summary.finalAmount).toBe(250);
      expect(summary.formattedFinalAmount).toBe("$250.00");
      expect(summary.amountToCollect).toBe(250);
      expect(summary.formattedAmountToCollect).toBe("$250.00");
    });

    test("Active in-progress job calculates preview from startedAt (76 min elapsed, totalWorkedMinutes=0)", () => {
      const startedAt76MinAgo = new Date(Date.now() - 76 * 60 * 1000).toISOString();
      const activeAssignment = {
        status: "in_progress",
        startedAt: startedAt76MinAgo,
        completedAt: null,
        totalWorkedMinutes: 0,
      };

      const summary = getJobPricingSummary(baseJob, activeAssignment);
      expect(summary.estimatedTotal).toBe(200);
      expect(summary.actualWorkedMinutes).toBe(76);
      expect(summary.formattedWorkedTime).toBe("76 Min");
      expect(summary.extraMinutes).toBe(16);
      expect(summary.formattedOvertimeMinutes).toBe("16 Min");
      expect(summary.overtimeAmount).toBe(50);
      expect(summary.formattedOvertimeAmount).toBe("$50.00");
      expect(summary.finalAmount).toBe(250);
      expect(summary.amountToCollect).toBe(250);
    });

    test("Backend authoritative value priority upon completion", () => {
      const completedAssignment = {
        status: "completed",
        isCompleted: true,
        startedAt: "2026-09-23T10:00:00.000Z",
        completedAt: "2026-09-23T11:16:00.000Z",
        totalWorkedMinutes: 76,
        pricingSnapshot: {
          extraMinutes: 16,
          overtimeAmount: 50,
          finalAmount: 250,
        },
      };

      const summary = getJobPricingSummary(baseJob, completedAssignment);
      expect(summary.actualWorkedMinutes).toBe(76);
      expect(summary.extraMinutes).toBe(16);
      expect(summary.overtimeAmount).toBe(50);
      expect(summary.finalAmount).toBe(250);
    });
  });

  describe("JOB-00120 Real Test Case & Boundary Tests (Rate $250/hr, Base 60m, Callout $125, Stairs $50 -> Initial $425)", () => {
    const job120 = {
      _id: "job_00120_id",
      jobNumber: "JOB-00120",
      jobType: "moving",
      status: "in_progress",
      showDriverPrice: true,
      driverPriceType: "hourly",
      hourlyRate: 250,
      estimatedHours: 1,
      minimumCost: 250,
      calloutCharge: 125,
      stairsFee: 50,
      travelBackFee: 0,
      minimumEstimatedCost: 425,
    };

    test("JOB-00120 Completed Real Job: Actual 91 Min (Extra 31m) -> Overtime = $125, Final = $550", () => {
      const summary = getJobPricingSummary(job120, { totalWorkedMinutes: 91 });
      expect(summary.baseAmount).toBe(250);
      expect(summary.calloutFee).toBe(125);
      expect(summary.stairsFee).toBe(50);
      expect(summary.estimatedTotal).toBe(425);
      expect(summary.initialTotal).toBe(425);
      expect(summary.actualWorkedMinutes).toBe(91);
      expect(summary.formattedWorkedTime).toBe("91 Min");
      expect(summary.extraMinutes).toBe(31);
      expect(summary.formattedOvertimeMinutes).toBe("31 Min");
      expect(summary.hourlyRate).toBe(250);
      expect(summary.overtimeBlocks).toBe(1);
      expect(summary.overtimeAmount).toBe(125);
      expect(summary.formattedOvertimeAmount).toBe("$125.00");
      expect(summary.finalAmount).toBe(550);
      expect(summary.formattedFinalAmount).toBe("$550.00");
      expect(summary.amountToCollect).toBe(550);
      expect(summary.formattedAmountToCollect).toBe("$550.00");
    });

    test("Boundary 1: Actual 74 Min (Extra 14m) -> Overtime = $0, Final = $425", () => {
      const summary = getJobPricingSummary(job120, { totalWorkedMinutes: 74 });
      expect(summary.estimatedTotal).toBe(425);
      expect(summary.actualWorkedMinutes).toBe(74);
      expect(summary.extraMinutes).toBe(14);
      expect(summary.overtimeBlocks).toBe(0);
      expect(summary.overtimeAmount).toBe(0);
      expect(summary.finalAmount).toBe(425);
      expect(summary.amountToCollect).toBe(425);
    });

    test("Boundary 2: Actual 75 Min (Extra 15m) -> Overtime = $125, Final = $550", () => {
      const summary = getJobPricingSummary(job120, { totalWorkedMinutes: 75 });
      expect(summary.estimatedTotal).toBe(425);
      expect(summary.actualWorkedMinutes).toBe(75);
      expect(summary.extraMinutes).toBe(15);
      expect(summary.overtimeBlocks).toBe(1);
      expect(summary.overtimeAmount).toBe(125);
      expect(summary.finalAmount).toBe(550);
      expect(summary.amountToCollect).toBe(550);
    });

    test("Boundary 3: Actual 90 Min (Extra 30m) -> Overtime = $125, Final = $550", () => {
      const summary = getJobPricingSummary(job120, { totalWorkedMinutes: 90 });
      expect(summary.estimatedTotal).toBe(425);
      expect(summary.actualWorkedMinutes).toBe(90);
      expect(summary.extraMinutes).toBe(30);
      expect(summary.overtimeBlocks).toBe(1);
      expect(summary.overtimeAmount).toBe(125);
      expect(summary.finalAmount).toBe(550);
      expect(summary.amountToCollect).toBe(550);
    });

    test("Boundary 4: Actual 91 Min (Extra 31m) -> Overtime = $125, Final = $550 (31m is HALF RATE)", () => {
      const summary = getJobPricingSummary(job120, { totalWorkedMinutes: 91 });
      expect(summary.estimatedTotal).toBe(425);
      expect(summary.actualWorkedMinutes).toBe(91);
      expect(summary.extraMinutes).toBe(31);
      expect(summary.overtimeBlocks).toBe(1);
      expect(summary.overtimeAmount).toBe(125);
      expect(summary.finalAmount).toBe(550);
      expect(summary.amountToCollect).toBe(550);
    });

    test("Boundary 5: Actual 92 Min (Extra 32m) -> Overtime = $250, Final = $675 (32m is FULL RATE)", () => {
      const summary = getJobPricingSummary(job120, { totalWorkedMinutes: 92 });
      expect(summary.estimatedTotal).toBe(425);
      expect(summary.actualWorkedMinutes).toBe(92);
      expect(summary.extraMinutes).toBe(32);
      expect(summary.overtimeBlocks).toBe(2);
      expect(summary.overtimeAmount).toBe(250);
      expect(summary.finalAmount).toBe(675);
      expect(summary.amountToCollect).toBe(675);
    });

    test("Boundary 6: Actual 120 Min (Extra 60m) -> Overtime = $250, Final = $675", () => {
      const summary = getJobPricingSummary(job120, { totalWorkedMinutes: 120 });
      expect(summary.estimatedTotal).toBe(425);
      expect(summary.actualWorkedMinutes).toBe(120);
      expect(summary.extraMinutes).toBe(60);
      expect(summary.overtimeBlocks).toBe(2);
      expect(summary.overtimeAmount).toBe(250);
      expect(summary.finalAmount).toBe(675);
      expect(summary.amountToCollect).toBe(675);
    });

    test("JOB-00120 Active Preview from startedAt (91 mins elapsed) calculates Extra 31m, OT $125, Final $550", () => {
      const startedAt91MinAgo = new Date(Date.now() - 91 * 60 * 1000).toISOString();
      const activeAssignment = {
        status: "in_progress",
        startedAt: startedAt91MinAgo,
        completedAt: null,
        totalWorkedMinutes: 0,
      };

      const summary = getJobPricingSummary(job120, activeAssignment);
      expect(summary.estimatedTotal).toBe(425);
      expect(summary.actualWorkedMinutes).toBe(91);
      expect(summary.formattedWorkedTime).toBe("91 Min");
      expect(summary.extraMinutes).toBe(31);
      expect(summary.formattedOvertimeMinutes).toBe("31 Min");
      expect(summary.overtimeAmount).toBe(125);
      expect(summary.formattedOvertimeAmount).toBe("$125.00");
      expect(summary.finalAmount).toBe(550);
      expect(summary.amountToCollect).toBe(550);
    });

    test("JOB-00120 Backend authoritative values preferred on completion", () => {
      const completedAssignment = {
        status: "completed",
        isCompleted: true,
        startedAt: "2026-09-23T10:00:00.000Z",
        completedAt: "2026-09-23T11:31:00.000Z",
        totalWorkedMinutes: 91,
        pricingSnapshot: {
          extraMinutes: 31,
          overtimeAmount: 125,
          finalAmount: 550,
        },
      };

      const summary = getJobPricingSummary(job120, completedAssignment);
      expect(summary.actualWorkedMinutes).toBe(91);
      expect(summary.extraMinutes).toBe(31);
      expect(summary.overtimeAmount).toBe(125);
      expect(summary.finalAmount).toBe(550);
    });

    test("JOB-00120 detects and reports backend pricing mismatch if backend still returns old $250 for 31m", () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const completedWithOldBackendBug = {
        status: "completed",
        isCompleted: true,
        startedAt: "2026-09-23T10:00:00.000Z",
        completedAt: "2026-09-23T11:31:00.000Z",
        totalWorkedMinutes: 91,
        pricingSnapshot: {
          extraMinutes: 31,
          overtimeAmount: 250, // old backend bug at 31 min
          finalAmount: 675,
        },
      };

      const summary = getJobPricingSummary(job120, completedWithOldBackendBug);
      // Authoritative backend value is used
      expect(summary.overtimeAmount).toBe(250);
      expect(summary.finalAmount).toBe(675);
      // Mismatch was clearly logged/identified
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[PRICING MISMATCH] Backend overtimeAmount ($250.00) differs from app rule ($125.00)")
      );

      consoleWarnSpy.mockRestore();
    });
  });
});

