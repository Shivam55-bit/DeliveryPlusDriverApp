import { isJobScheduledOnDate } from "../jobHelpers";

describe("isJobScheduledOnDate", () => {
  const targetDate = new Date(2026, 9, 10, 12);

  test("matches scheduled calendar dates without shifting date-only ISO values", () => {
    expect(
      isJobScheduledOnDate(
        { scheduledDate: "2026-10-10T00:00:00.000Z" },
        targetDate
      )
    ).toBe(true);
  });

  test("does not include future scheduled jobs in today's list", () => {
    expect(
      isJobScheduledOnDate(
        { scheduledDate: "2026-10-17T00:00:00.000Z" },
        targetDate
      )
    ).toBe(false);
  });

  test("excludes missing or invalid schedules", () => {
    expect(isJobScheduledOnDate({}, targetDate)).toBe(false);
    expect(
      isJobScheduledOnDate({ scheduledDate: "not-a-date" }, targetDate)
    ).toBe(false);
  });

  test("correctly converts UTC evening timestamp to Sydney next morning for today's jobs", () => {
    // 2026-10-09T23:00:00.000Z is 2026-10-10 10:00:00 AM in Australia/Sydney (+11 AEDT)
    expect(
      isJobScheduledOnDate(
        { scheduledDate: "2026-10-09T23:00:00.000Z" },
        targetDate
      )
    ).toBe(true);
  });

  test("includes active in-progress jobs on today's dashboard even if scheduled previously", () => {
    const overnightJob = {
      scheduledDate: "2026-10-08T10:00:00.000Z",
      status: "in-progress",
    };
    expect(isJobScheduledOnDate(overnightJob, targetDate)).toBe(true);
  });

  test("excludes completed jobs from prior days", () => {
    const priorCompletedJob = {
      scheduledDate: "2026-10-08T10:00:00.000Z",
      status: "completed",
    };
    expect(isJobScheduledOnDate(priorCompletedJob, targetDate)).toBe(false);
  });
});
