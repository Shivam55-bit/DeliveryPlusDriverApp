import { extractDriverJobs } from "../driverJobs";

describe("extractDriverJobs", () => {
  const jobs = [{ jobNumber: "JOB-00146" }];

  test.each([
    ["a direct array", jobs],
    ["a jobs envelope", { jobs }],
    ["a nested jobs envelope", { data: { jobs } }],
    ["a paginated items envelope", { data: { items: jobs, pagination: { page: 1 } } }],
    ["a successful empty response", { jobs: [] }],
  ])("accepts %s", (_description, response) => {
    expect(extractDriverJobs(response)).toEqual(
      response?.jobs || response?.data?.items || response?.data?.jobs || response
    );
  });

  test("rejects an unknown response shape instead of treating it as empty", () => {
    expect(() => extractDriverJobs({ data: { pagination: { total: 1 } } }))
      .toThrow("Driver jobs API returned an unrecognized response shape.");
  });
});
