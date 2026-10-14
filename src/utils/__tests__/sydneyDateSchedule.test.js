import {
  isJobScheduledOnDate,
  getSydneyDateParts,
  formatJobDate,
  formatScheduledTime,
  OPERATIONAL_TIMEZONE,
} from "../jobHelpers";

describe("Sydney Operational Timezone & Job Schedule Validation", () => {
  const job146 = {
    jobNumber: "JOB-00146",
    scheduledDate: "2026-10-17T10:00:00+11:00",
    scheduledTime: "10:00 AM",
    status: "assigned",
  };

  const job147 = {
    jobNumber: "JOB-00147",
    scheduledDate: "2026-10-23T14:30:00+11:00",
    scheduledTime: "02:30 PM",
    status: "assigned",
  };

  test("confirms operational timezone is Australia/Sydney", () => {
    expect(OPERATIONAL_TIMEZONE).toBe("Australia/Sydney");
  });

  test("verifies 13 October 2026 is NOT today for jobs scheduled on 17 & 23 October", () => {
    const today13Oct = new Date("2026-10-13T09:00:00+11:00"); // Sydney AEDT

    expect(isJobScheduledOnDate(job146, today13Oct)).toBe(false);
    expect(isJobScheduledOnDate(job147, today13Oct)).toBe(false);
  });

  test("verifies JOB-00146 matches Today when date is 17 October 2026", () => {
    const date17Oct = new Date("2026-10-17T11:00:00+11:00");
    expect(isJobScheduledOnDate(job146, date17Oct)).toBe(true);
    expect(isJobScheduledOnDate(job147, date17Oct)).toBe(false);
  });

  test("verifies JOB-00147 matches Today when date is 23 October 2026", () => {
    const date23Oct = new Date("2026-10-23T15:00:00+11:00");
    expect(isJobScheduledOnDate(job146, date23Oct)).toBe(false);
    expect(isJobScheduledOnDate(job147, date23Oct)).toBe(true);
  });

  test("includes active in-progress job spanning midnight on today's dashboard", () => {
    const overnightActiveJob = {
      jobNumber: "JOB-OVERNIGHT",
      scheduledDate: "2026-10-12T22:00:00.000Z",
      status: "inprogress",
    };

    const today13Oct = new Date("2026-10-13T02:00:00+11:00");
    expect(isJobScheduledOnDate(overnightActiveJob, today13Oct, { includeActiveInProgress: true })).toBe(true);
  });

  test("formats dates and scheduled times cleanly in Sydney timezone", () => {
    expect(formatJobDate(job146.scheduledDate, true)).toContain("Oct");
    expect(formatJobDate(job146.scheduledDate, true)).toContain("2026");
  });

  test("correctly computes next upcoming jobs preview when today has 0 jobs", () => {
    const allJobs = [
      { raw: job147, status: "upcoming", id: "JOB-00147" },
      { raw: job146, status: "upcoming", id: "JOB-00146" },
      { raw: { scheduledDate: "2026-10-30T10:00:00.000Z" }, status: "upcoming", id: "JOB-00150" },
      { raw: { scheduledDate: "2026-11-05T10:00:00.000Z" }, status: "upcoming", id: "JOB-00155" },
    ];

    const today13Oct = new Date("2026-10-13T09:00:00+11:00");
    const todays = allJobs.filter((j) => isJobScheduledOnDate(j.raw, today13Oct));
    expect(todays).toHaveLength(0);

    const upcoming = allJobs
      .filter((j) => !isJobScheduledOnDate(j.raw, today13Oct) && j.status === "upcoming")
      .sort((a, b) => new Date(a.raw.scheduledDate) - new Date(b.raw.scheduledDate));

    // Next 2-3 upcoming preview
    const preview = upcoming.slice(0, 3);
    expect(preview).toHaveLength(3);
    expect(preview[0].id).toBe("JOB-00146"); // 17 Oct first
    expect(preview[1].id).toBe("JOB-00147"); // 23 Oct second
    expect(preview[2].id).toBe("JOB-00150"); // 30 Oct third
  });
});
