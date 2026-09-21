import {
  calculateDriverHourlyEarnings,
  normalizeMyDriverAssignment,
  getDriverVisiblePriceInfo,
} from "../src/utils/jobHelpers";

describe("Driver Hourly Earnings with 30-Minute Overtime Slabs", () => {
  describe("1. Rate $100 / Hr, Base 2 Hr Slabs", () => {
    const baseJob = { isMovingJob: true, showDriverPrice: true };

    test("2 Hr 00 Min (120 min) -> Base $200.00, Overtime $0.00, Final $200.00", () => {
      const assignment = { totalWorkedMinutes: 120, hourlyRate: 100, baseHours: 2, showDriverPrice: true };
      const res = calculateDriverHourlyEarnings(assignment, baseJob);
      expect(res.baseAmount).toBe(200);
      expect(res.overtimeMinutes).toBe(0);
      expect(res.overtimeBlocks).toBe(0);
      expect(res.overtimeAmount).toBe(0);
      expect(res.finalDriverAmount).toBe(200);
      expect(res.formattedFinalAmount).toBe("$200.00");
    });

    test("2 Hr 01 Min (121 min) -> Overtime 1m, 1 Block, Extra $50.00, Final $250.00", () => {
      const assignment = { totalWorkedMinutes: 121, hourlyRate: 100, baseHours: 2, showDriverPrice: true };
      const res = calculateDriverHourlyEarnings(assignment, baseJob);
      expect(res.overtimeMinutes).toBe(1);
      expect(res.overtimeBlocks).toBe(1);
      expect(res.overtimeAmount).toBe(50);
      expect(res.finalDriverAmount).toBe(250);
      expect(res.formattedFinalAmount).toBe("$250.00");
    });

    test("2 Hr 29 Min (149 min) -> Overtime 29m, 1 Block, Extra $50.00, Final $250.00", () => {
      const assignment = { totalWorkedMinutes: 149, hourlyRate: 100, baseHours: 2, showDriverPrice: true };
      const res = calculateDriverHourlyEarnings(assignment, baseJob);
      expect(res.overtimeMinutes).toBe(29);
      expect(res.overtimeBlocks).toBe(1);
      expect(res.overtimeAmount).toBe(50);
      expect(res.finalDriverAmount).toBe(250);
      expect(res.formattedFinalAmount).toBe("$250.00");
    });

    test("2 Hr 30 Min (150 min) -> Overtime 30m, 1 Block, Extra $50.00, Final $250.00", () => {
      const assignment = { totalWorkedMinutes: 150, hourlyRate: 100, baseHours: 2, showDriverPrice: true };
      const res = calculateDriverHourlyEarnings(assignment, baseJob);
      expect(res.overtimeMinutes).toBe(30);
      expect(res.overtimeBlocks).toBe(1);
      expect(res.overtimeAmount).toBe(50);
      expect(res.finalDriverAmount).toBe(250);
      expect(res.formattedFinalAmount).toBe("$250.00");
    });

    test("2 Hr 31 Min (151 min) -> Overtime 31m, 2 Blocks, Extra $100.00, Final $300.00", () => {
      const assignment = { totalWorkedMinutes: 151, hourlyRate: 100, baseHours: 2, showDriverPrice: true };
      const res = calculateDriverHourlyEarnings(assignment, baseJob);
      expect(res.overtimeMinutes).toBe(31);
      expect(res.overtimeBlocks).toBe(2);
      expect(res.overtimeAmount).toBe(100);
      expect(res.finalDriverAmount).toBe(300);
      expect(res.formattedFinalAmount).toBe("$300.00");
    });

    test("3 Hr 00 Min (180 min) -> Overtime 60m, 2 Blocks, Extra $100.00, Final $300.00", () => {
      const assignment = { totalWorkedMinutes: 180, hourlyRate: 100, baseHours: 2, showDriverPrice: true };
      const res = calculateDriverHourlyEarnings(assignment, baseJob);
      expect(res.overtimeMinutes).toBe(60);
      expect(res.overtimeBlocks).toBe(2);
      expect(res.overtimeAmount).toBe(100);
      expect(res.finalDriverAmount).toBe(300);
      expect(res.formattedFinalAmount).toBe("$300.00");
    });

    test("3 Hr 30 Min (210 min) -> Overtime 90m, 3 Blocks, Extra $150.00, Final $350.00", () => {
      const assignment = { totalWorkedMinutes: 210, hourlyRate: 100, baseHours: 2, showDriverPrice: true };
      const res = calculateDriverHourlyEarnings(assignment, baseJob);
      expect(res.overtimeMinutes).toBe(90);
      expect(res.overtimeBlocks).toBe(3);
      expect(res.overtimeAmount).toBe(150);
      expect(res.finalDriverAmount).toBe(350);
      expect(res.formattedFinalAmount).toBe("$350.00");
    });
  });

  describe("2. Rate $200 / Hr, Base 2 Hr Slabs", () => {
    const baseJob = { isMovingJob: true, showDriverPrice: true };

    test("2 Hr 00 Min -> $400.00", () => {
      const res = calculateDriverHourlyEarnings({ totalWorkedMinutes: 120, hourlyRate: 200, baseHours: 2, showDriverPrice: true }, baseJob);
      expect(res.finalDriverAmount).toBe(400);
      expect(res.formattedFinalAmount).toBe("$400.00");
    });

    test("2 Hr 30 Min -> $500.00", () => {
      const res = calculateDriverHourlyEarnings({ totalWorkedMinutes: 150, hourlyRate: 200, baseHours: 2, showDriverPrice: true }, baseJob);
      expect(res.finalDriverAmount).toBe(500);
      expect(res.formattedFinalAmount).toBe("$500.00");
    });

    test("3 Hr 00 Min -> $600.00", () => {
      const res = calculateDriverHourlyEarnings({ totalWorkedMinutes: 180, hourlyRate: 200, baseHours: 2, showDriverPrice: true }, baseJob);
      expect(res.finalDriverAmount).toBe(600);
      expect(res.formattedFinalAmount).toBe("$600.00");
    });

    test("3 Hr 30 Min -> $700.00", () => {
      const res = calculateDriverHourlyEarnings({ totalWorkedMinutes: 210, hourlyRate: 200, baseHours: 2, showDriverPrice: true }, baseJob);
      expect(res.finalDriverAmount).toBe(700);
      expect(res.formattedFinalAmount).toBe("$700.00");
    });
  });

  describe("3. Multi-Driver Independent Isolation", () => {
    const rawJob = {
      _id: "JOB01",
      jobReference: "JOB01",
      isMovingJob: true,
      hourlyRate: 100,
      baseHours: 2,
      showDriverPrice: true,
      assignedDrivers: [
        {
          driverId: "shivam_1",
          driverName: "Shivam",
          startedAt: "2026-09-18T09:00:00.000Z",
          completedAt: "2026-09-18T11:30:00.000Z",
          totalWorkedMinutes: 150,
        },
        {
          driverId: "vikash_2",
          driverName: "Vikash",
          startedAt: "2026-09-18T09:30:00.000Z",
          completedAt: "2026-09-18T12:30:00.000Z",
          totalWorkedMinutes: 180,
        },
        {
          driverId: "garvita_3",
          driverName: "Garvita",
          startedAt: "2026-09-18T10:00:00.000Z",
          completedAt: "2026-09-18T12:00:00.000Z",
          totalWorkedMinutes: 120,
        },
      ],
    };

    test("Shivam gets independent amount $250.00 (2h30m)", () => {
      const myAssignment = normalizeMyDriverAssignment(rawJob, { _id: "shivam_1" });
      const earnings = calculateDriverHourlyEarnings(myAssignment, rawJob);
      expect(earnings.finalDriverAmount).toBe(250);
      expect(earnings.formattedFinalAmount).toBe("$250.00");
    });

    test("Vikash gets independent amount $300.00 (3h00m)", () => {
      const myAssignment = normalizeMyDriverAssignment(rawJob, { _id: "vikash_2" });
      const earnings = calculateDriverHourlyEarnings(myAssignment, rawJob);
      expect(earnings.finalDriverAmount).toBe(300);
      expect(earnings.formattedFinalAmount).toBe("$300.00");
    });

    test("Garvita gets independent amount $200.00 (2h00m)", () => {
      const myAssignment = normalizeMyDriverAssignment(rawJob, { _id: "garvita_3" });
      const earnings = calculateDriverHourlyEarnings(myAssignment, rawJob);
      expect(earnings.finalDriverAmount).toBe(200);
      expect(earnings.formattedFinalAmount).toBe("$200.00");
    });
  });

  describe("4. showDriverPrice Visibility Toggle", () => {
    test("Hides price and breakdown when showDriverPrice is false", () => {
      const job = { isMovingJob: true, showDriverPrice: false, hourlyRate: 100, baseHours: 2 };
      const assignment = { totalWorkedMinutes: 150, showDriverPrice: false };
      const earnings = calculateDriverHourlyEarnings(assignment, job);
      const priceInfo = getDriverVisiblePriceInfo(job, assignment);

      expect(earnings.showDriverPrice).toBe(false);
      expect(earnings.canShowPrice).toBe(false);
      expect(priceInfo.canShowPrice).toBe(false);
      expect(priceInfo.formattedPrice).toBeNull();
    });
  });

  describe("5. Backend Snapshot Support", () => {
    test("Prefers backend pricing snapshot over recalculation", () => {
      const assignment = {
        totalWorkedMinutes: 150,
        pricingSnapshot: {
          hourlyRate: 120,
          baseHours: 2,
          baseAmount: 240,
          overtimeMinutes: 30,
          overtimeBlocks: 1,
          overtimeAmount: 60,
          finalDriverAmount: 300,
        },
        showDriverPrice: true,
      };
      const earnings = calculateDriverHourlyEarnings(assignment, { isMovingJob: true, showDriverPrice: true });
      expect(earnings.baseAmount).toBe(240);
      expect(earnings.finalDriverAmount).toBe(300);
      expect(earnings.formattedFinalAmount).toBe("$300.00");
    });
  });

  describe("6. Non-Hourly / Fixed Price Mode", () => {
    test("Preserves fixed price without overtime slabs", () => {
      const assignment = {
        totalWorkedMinutes: 200,
        driverPriceType: "fixed",
        driverPrice: 175,
        showDriverPrice: true,
      };
      const job = { pricingType: "fixed", driverPrice: 175, showDriverPrice: true };
      const earnings = calculateDriverHourlyEarnings(assignment, job);
      expect(earnings.isHourly).toBe(false);
      expect(earnings.finalDriverAmount).toBe(175);
      expect(earnings.formattedFinalAmount).toBe("$175.00");
    });
  });
});
