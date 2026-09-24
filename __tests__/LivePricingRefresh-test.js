import {
  getJobPricingSummary,
  normalizeJob,
  calculateDriverHourlyEarnings,
  getDriverVisiblePriceInfo,
} from "../src/utils/jobHelpers";

describe("Live Pricing Refresh for Running / In-Progress Jobs", () => {
  test("Scenario: CRM admin edits stairs fee on running job (50 -> 100) updates estimated total (150 -> 200)", () => {
    // 1. Initial job state before CRM edit
    const initialJobData = {
      _id: "job-live-001",
      jobNumber: "JOB-00201",
      status: "in_progress",
      showDriverPrice: true,
      startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      myAssignment: {
        driverId: "driver-123",
        status: "in_progress",
        showDriverPrice: true,
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        pricingSnapshot: {
          hourlyRate: 50,
          baseAmount: 50,
          calloutFee: 50,
          stairsFee: 50,
          travelBackFee: 0,
          estimatedTotal: 150,
        },
      },
      pricing: {
        hourlyRate: 50,
        minimumCost: 50,
        calloutFee: 50,
        stairsFee: 50,
        travelBackFee: 0,
        estimatedTotal: 150,
      },
    };

    const initialNormalized = normalizeJob(initialJobData, { _id: "driver-123" });
    const initialPricing = getJobPricingSummary(initialNormalized, initialNormalized.myAssignment);

    expect(initialPricing.baseAmount).toBe(50);
    expect(initialPricing.calloutFee).toBe(50);
    expect(initialPricing.stairsFee).toBe(50);
    expect(initialPricing.estimatedTotal).toBe(150);

    // 2. Admin edits running job in CRM: Stairs fee changed from 50 to 100
    const updatedBackendJobData = {
      ...initialJobData,
      pricing: {
        hourlyRate: 50,
        minimumCost: 50,
        calloutFee: 50,
        stairsFee: 100, // Updated by CRM
        travelBackFee: 0,
      },
      stairsFee: 100,
    };

    // Driver app receives fresh job from GET /jobs/:id and normalizes it
    const updatedNormalized = normalizeJob(updatedBackendJobData, { _id: "driver-123" });
    const updatedPricing = getJobPricingSummary(updatedNormalized, updatedNormalized.myAssignment);

    expect(updatedPricing.baseAmount).toBe(50);
    expect(updatedPricing.calloutFee).toBe(50);
    expect(updatedPricing.stairsFee).toBe(100);
    expect(updatedPricing.estimatedTotal).toBe(200);
    expect(updatedNormalized.stairsFee).toBe(100);
    expect(updatedNormalized.estimatedTotal).toBe(200);

    // Visible price info for cards (Home / Jobs / JobDetail)
    const priceInfo = getDriverVisiblePriceInfo(updatedNormalized, updatedNormalized.myAssignment);
    expect(priceInfo.driverPrice).toBe(200);
    expect(priceInfo.formattedPrice).toBe("$200.00");
  });

  test("Complete Job Screen uses latest updated pricing ($200) + calculates overtime accurately", () => {
    // In-progress job with updated stairs fee ($100), total estimated $200
    const runningJobWithUpdatedStairs = {
      _id: "job-live-002",
      jobNumber: "JOB-00202",
      status: "in_progress",
      showDriverPrice: true,
      startedAt: new Date(Date.now() - 76 * 60 * 1000).toISOString(),
      myAssignment: {
        driverId: "driver-123",
        status: "in_progress",
        showDriverPrice: true,
        startedAt: new Date(Date.now() - 76 * 60 * 1000).toISOString(),
      },
      pricing: {
        hourlyRate: 100,
        minimumHours: 1,
        minimumCost: 50,
        calloutFee: 50,
        stairsFee: 100, // Updated in CRM
        travelBackFee: 0,
      },
    };

    const normalized = normalizeJob(runningJobWithUpdatedStairs, { _id: "driver-123" });
    const pricingSummary = getJobPricingSummary(normalized, normalized.myAssignment);

    expect(pricingSummary.estimatedTotal).toBe(200);
    expect(pricingSummary.stairsFee).toBe(100);
    expect(pricingSummary.calloutFee).toBe(50);
    expect(pricingSummary.baseAmount).toBe(50);

    // 76 min worked (16 min extra on 60 min base) -> 16 min extra = $50 overtime
    expect(pricingSummary.actualWorkedMinutes).toBe(76);
    expect(pricingSummary.extraMinutes).toBe(16);
    expect(pricingSummary.overtimeAmount).toBe(50);

    // Final settlement amount to collect = $200 base estimated + $50 overtime = $250
    expect(pricingSummary.amountToCollect).toBe(250);
    expect(pricingSummary.finalAmount).toBe(250);
  });
});
