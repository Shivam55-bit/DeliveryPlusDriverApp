# Assigned Jobs Read-Only Audit

**Project:** DeliveryPlus Driver App  
**Platform:** iPhone 17 Pro Simulator, iOS 26.3  
**Audit date:** 10 October 2026  
**Mode:** Diagnosis only; no application, backend, CRM, or production job data was changed.

## Summary

The simulator's stored authenticated driver session successfully retrieved both CRM-assigned jobs from the deployed driver-scoped endpoint. The app's current job normalization logic also accepts both returned jobs and matches them to the authenticated user's assignment ID.

This does **not** establish that the Jobs tab currently displays those jobs. The reported Jobs-tab error could not be reproduced in the UI because simulator accessibility automation was unavailable. Accordingly, the exact cause of the historical/in-app error remains unconfirmed, and this audit does not claim the issue is fixed.

## Live API requests

The following read-only requests were made using the simulator's stored session. The bearer token and personal/customer details were not included in output or this report.

| Method and full URL | HTTP status | Observed timing | Sanitized response |
|---|---:|---:|---|
| `GET https://api.deliveryplus.tech/api/auth/me` | 200 | 328 ms | Authenticated user returned with role `driver`. The payload did not include a separate Driver profile ID. |
| `GET https://api.deliveryplus.tech/api/jobs/driver/my-jobs` | 200 | 328 ms | `{"success":true,"message":"Success","data":{"jobs":[...]}}`; two jobs returned: JOB-00146 and JOB-00147. |
| `GET https://api.deliveryplus.tech/api/jobs/my-jobs` | 400 | 339 ms | `{"success":false,"message":"Invalid ID format."}` |
| `GET https://api.deliveryplus.tech/api/jobs` | 403 | 318 ms | `{"success":false,"message":"Access denied."}` |

No 404 was reproduced by these authenticated requests. The responses from the candidate routes show that `/jobs/my-jobs` and `/jobs` are not valid fallbacks for the authenticated driver-jobs request in this session.

### Driver jobs response details

The successful response had `data.jobs` and contained:

| Job | Job status | Assignment status | Scheduled date |
|---|---|---|---|
| JOB-00146 | `assigned` | `assigned` | 17 October 2026 |
| JOB-00147 | `assigned` | `assigned` | 23 October 2026 |

Customer contact, address, and other personal fields are intentionally omitted.

## Driver identity mapping

- The cached authenticated user ID matched the user ID returned by `/api/auth/me`.
- Both jobs' `myAssignment.driverId` and `driverAssignments[].driverId` matched that authenticated user ID (masked suffix `…c9b3`).
- The `/api/auth/me` response did not expose a separate Driver profile ID. The live job payload therefore verifies the assignment-to-authenticated-user match, but does not establish a distinct `Driver._id` mapping.
- Matching was based on IDs, not the displayed driver name.

## App-side response and dashboard check

The actual response payload was passed through the app's current job response extraction and assignment-normalization logic in a read-only in-memory harness. The harness set the React Native `__DEV__` flag to `false`; it did not edit project files.

| Result | Count |
|---|---:|
| Jobs returned by API | 2 |
| Assigned and matched | 2 |
| In progress | 0 |
| Completed | 0 |
| Filtered as not assigned to this driver | 0 |

The app parser accepts the response's `data.jobs` structure. Both future-scheduled jobs passed normalization; their dates did not filter them out. The resulting counts for this payload are **Assigned: 2, In Progress: 0, Completed: 0**.

## App call sites and UI reproduction

The app's configured job endpoint is `/jobs/driver/my-jobs`, resolved against `https://api.deliveryplus.tech/api`. The relevant app call paths are:

- Home loading: `loadHomeData` in [HomeScreen.js](./src/screens/HomeScreen.js), which fetches the authenticated user and driver jobs.
- Jobs tab loading: `fetchJobs` in [JobsScreen.js](./src/screens/JobsScreen.js).
- Shared job request and response extraction: [driverJobs.js](./src/services/driverJobs.js).
- API base URL, authentication, and response unwrapping: [api.js](./src/services/api.js).
- Assignment identity and job normalization: [jobHelpers.js](./src/utils/jobHelpers.js).

The live endpoint probes establish that the backend currently serves both jobs for this session. They do not capture the precise request or thrown exception from the Jobs screen itself. The Jobs tab could not be opened through simulator UI automation, so its reported “Unable to refresh jobs” message was not reproduced or diagnosed to a specific app-side exception.

## Root cause assessment

**Not established.** The current evidence rules out “the deployed driver-jobs endpoint returns no assigned jobs” for this authenticated simulator session: it returned two valid assignments. It does not identify why the displayed UI previously showed zero counts or an error.

Possible app-side/runtime causes cannot be distinguished from stale UI state or an earlier transient request based on the available capture. The exact historical 404, including its originating request and response body, also remains unidentified; none of the authenticated requests listed above returned 404.

**Assessment:** The backend driver-jobs route is currently returning the expected jobs. An app/runtime or stale-state issue is plausible, but is not proven. No backend contract mismatch was observed for `/jobs/driver/my-jobs`; the other two candidate routes are not suitable fallbacks based on their actual responses.

## Recommended minimal next step

In the same simulator session, refresh Home and open the Jobs tab. If the Jobs tab still fails, capture its sanitized request method/URL/status and exception from the app's runtime logs. Do not share the bearer token. This will show whether the UI is calling the expected endpoint and whether the failure occurs during transport, response extraction, or assignment normalization.

## Scope and change record

- Read-only GET requests only; no job mutations or lifecycle actions were performed.
- No backend, CRM, database, or production records were modified.
- This report documents the audit; existing unrelated/uncommitted worktree changes were left untouched.
- **Verification status:** API response and in-memory normalization verified; in-app Jobs-tab visibility not verified.

## Follow-up fix and simulator verification — 10 October 2026

The original audit's UI limitation was resolved during a follow-up implementation pass.

- The production route remained `GET https://api.deliveryplus.tech/api/jobs/driver/my-jobs`; the authenticated response was HTTP 200 with JOB-00146 and JOB-00147. No alternative jobs routes were added or called.
- The Jobs and Home screen normalizers imported `getDriverVisiblePrice` and `formatCurrency`, but neither helper was exported by `jobHelpers.js`. The missing `getDriverVisiblePrice` call reproduced `TypeError: getDriverVisiblePrice is not a function`. After exposing that helper, `formatCurrency` was likewise required to complete normalization.
- Jobs displayed the generic refresh error because its catch handled the normalization exception. Home's outer catch left its initial numeric-zero stats in place, making the dashboard appear to have no assignments.
- Both helpers are now exported. Home begins with unavailable counter values on a failed first load, exposes the existing retry state for normalization failures, and filters `Today's Jobs` by scheduled calendar date while retaining future jobs in the driver job collection. The Jobs list displays formatted scheduled dates and labels assigned jobs as “Assigned.”
- After restarting the iPhone 17 Pro simulator with the same session, Home showed **Assigned: 2, In Progress: 0, Completed: 0** and “No jobs scheduled today” on 10 October. The driver was Offline and the assignments remained present.
- The user confirmed that the running Jobs tab displayed **JOB-00146** and **JOB-00147**, both Assigned. Screen-level normalization of the live HTTP 200 payload also produced both assigned jobs with dates 17 October 2026 and 23 October 2026.
- The Home simulator screenshot was captured at `/tmp/deliveryplus-restarted-fixed.png`. A Jobs-tab screenshot was not obtained; Jobs visibility was confirmed by the user.
- Focused tests: 5 suites passed, 82 tests passed. ESLint reported zero errors and 9 warnings.

**Follow-up verification status:** PASS for the requested Home counters and Jobs-tab visibility. Pull-to-refresh, signature/POD, and completion actions were not exercised; their flows were not changed.