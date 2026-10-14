import {
  fetchDriverJobs,
  getCachedDriverJobs,
  getCachedJob,
  updateCachedJob,
  invalidateDriverJobsCache,
} from "../driverJobs";
import API from "../api";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe("driverJobs caching and in-flight deduplication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateDriverJobsCache();
  });

  test("deduplicates concurrent in-flight requests into a single network call", async () => {
    let resolveApiCall;
    const pendingPromise = new Promise((resolve) => {
      resolveApiCall = resolve;
    });

    API.get.mockReturnValueOnce(pendingPromise);

    const call1 = fetchDriverJobs("Screen1");
    const call2 = fetchDriverJobs("Screen2");
    const call3 = fetchDriverJobs("Screen3");

    expect(API.get).toHaveBeenCalledTimes(1);

    const mockJobsResponse = {
      jobs: [
        { _id: "job-1", jobNumber: "JOB-101", status: "assigned" },
        { _id: "job-2", jobNumber: "JOB-102", status: "in-progress" },
      ],
    };

    resolveApiCall(mockJobsResponse);

    const [res1, res2, res3] = await Promise.all([call1, call2, call3]);

    expect(res1).toHaveLength(2);
    expect(res2).toHaveLength(2);
    expect(res3).toHaveLength(2);
    expect(API.get).toHaveBeenCalledTimes(1);
  });

  test("serves fresh jobs from in-memory cache without hitting network again", async () => {
    API.get.mockResolvedValueOnce({
      jobs: [{ _id: "job-1", jobNumber: "JOB-101" }],
    });

    const initialJobs = await fetchDriverJobs("Screen1");
    expect(initialJobs).toHaveLength(1);
    expect(API.get).toHaveBeenCalledTimes(1);

    // Immediate second call should be served from memory cache
    const cachedJobs = await fetchDriverJobs("Screen2");
    expect(cachedJobs).toHaveLength(1);
    expect(API.get).toHaveBeenCalledTimes(1); // Still 1!
  });

  test("retrieves a cached job by ID or jobNumber", () => {
    updateCachedJob({ _id: "job-abc", jobNumber: "JOB-999", name: "Alice" });

    expect(getCachedJob("job-abc")?.name).toBe("Alice");
    expect(getCachedJob("JOB-999")?.name).toBe("Alice");
    expect(getCachedJob("non-existent")).toBeNull();
  });

  test("updates cached job status synchronously upon mutation", () => {
    updateCachedJob({ _id: "job-1", jobNumber: "JOB-101", status: "assigned" });
    expect(getCachedJob("job-1")?.status).toBe("assigned");

    updateCachedJob({ _id: "job-1", status: "in_progress", startedAt: "2026-10-13T10:00:00Z" });
    expect(getCachedJob("job-1")?.status).toBe("in_progress");
    expect(getCachedJob("job-1")?.startedAt).toBe("2026-10-13T10:00:00Z");
  });

  test("forces network fetch after invalidateDriverJobsCache()", async () => {
    API.get
      .mockResolvedValueOnce({ jobs: [{ _id: "job-1" }] })
      .mockResolvedValueOnce({ jobs: [{ _id: "job-1" }, { _id: "job-2" }] });

    await fetchDriverJobs("Call1");
    expect(API.get).toHaveBeenCalledTimes(1);

    invalidateDriverJobsCache();

    const refreshed = await fetchDriverJobs("Call2");
    expect(refreshed).toHaveLength(2);
    expect(API.get).toHaveBeenCalledTimes(2);
  });
});
