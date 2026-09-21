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
  });
});
