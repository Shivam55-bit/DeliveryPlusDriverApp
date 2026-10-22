import { computeDriverOnlineStatus } from "../../screens/HomeScreen";

describe("computeDriverOnlineStatus", () => {
  test("returns true when driver has an active in-progress job even if availability is busy", () => {
    const status = computeDriverOnlineStatus({
      profileData: { availability: "busy" },
      homeJobs: [{ status: "inProgress", myAssignment: { isInProgress: true } }],
      persistedShift: null,
    });
    expect(status).toBe(true);
  });

  test("returns true when driver is on busy, on_job, or on_duty shift state", () => {
    expect(
      computeDriverOnlineStatus({
        profileData: { availability: "busy" },
        homeJobs: [],
        persistedShift: null,
      })
    ).toBe(true);

    expect(
      computeDriverOnlineStatus({
        profileData: { availability: "on_job" },
        homeJobs: [],
        persistedShift: null,
      })
    ).toBe(true);

    expect(
      computeDriverOnlineStatus({
        profileData: { availability: "working" },
        homeJobs: [],
        persistedShift: null,
      })
    ).toBe(true);
  });

  test("returns true after completing a job when still on shift", () => {
    expect(
      computeDriverOnlineStatus({
        profileData: { availability: "completed" },
        homeJobs: [],
        persistedShift: "online",
      })
    ).toBe(true);
  });

  test("returns false when driver is explicitly offline and has no active jobs", () => {
    expect(
      computeDriverOnlineStatus({
        profileData: { availability: "offline" },
        homeJobs: [],
        persistedShift: null,
      })
    ).toBe(false);

    expect(
      computeDriverOnlineStatus({
        profileData: { availability: "off_duty" },
        homeJobs: [],
        persistedShift: null,
      })
    ).toBe(false);

    expect(
      computeDriverOnlineStatus({
        profileData: { availability: "available" },
        homeJobs: [],
        persistedShift: "offline",
      })
    ).toBe(false);
  });

  test("active delivery job overrides offline preference to ensure live dispatch tracking", () => {
    expect(
      computeDriverOnlineStatus({
        profileData: { availability: "busy" },
        homeJobs: [{ status: "inProgress" }],
        persistedShift: "offline",
      })
    ).toBe(true);
  });

  test("persistedShift online keeps driver online even if backend profile has isOnline: false", () => {
    expect(
      computeDriverOnlineStatus({
        profileData: { isOnline: false, name: "Shivam" },
        homeJobs: [],
        persistedShift: "online",
      })
    ).toBe(true);
  });

  test("positive availability states override backend isOnline: false", () => {
    expect(
      computeDriverOnlineStatus({
        profileData: { isOnline: false, availability: "available" },
        homeJobs: [],
        persistedShift: null,
      })
    ).toBe(true);

    expect(
      computeDriverOnlineStatus({
        profileData: { isOnline: false, availability: "busy" },
        homeJobs: [],
        persistedShift: null,
      })
    ).toBe(true);
  });

  test("remains online after completing a delivery job when driver is still on shift", () => {
    expect(
      computeDriverOnlineStatus({
        profileData: { isOnline: false, availability: "completed" },
        homeJobs: [], // no active in-progress job anymore
        persistedShift: "online",
      })
    ).toBe(true);
  });
});
