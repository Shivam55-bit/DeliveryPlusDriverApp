# iOS Location and API 404 Investigation Report

**Project:** DeliveryPlus Driver App  
**Platform:** React Native / iOS  
**Report date:** 2026-10-10  
**Scope:** Driver app only  
**Status:** The exact runtime 404 and end-to-end Online/Offline tracking flow remain unverified.

## Executive summary

The app's API base URL is `https://api.deliveryplus.tech/api`. URL resolution does not indicate an accidental duplicate `/api` segment. The app currently calls a `PUT /driver/me/availability` endpoint when changing availability and uses `POST /drivers/me/location` and `POST /drivers/me/offline` for tracking lifecycle operations.

The exact request that returned the previously observed 404 has not been captured. Home makes several requests, so attributing that 404 to the availability endpoint or another request would be speculation. The current API documentation and the public backend `main` route source do not show the availability route. The docs do list the location and offline routes. This is a source/documentation mismatch, not proof of the deployed backend's exact routes or revision.

No authenticated state-changing request was sent during this investigation. No endpoint was changed, no backend or CRM code was modified, and no simulated coordinates were uploaded.

## 1. 404 request details

| Detail | Finding |
| --- | --- |
| HTTP method | **Not captured.** |
| Full URL | **Not captured.** Likely candidates are listed below; none is asserted to be the failed request. |
| Call origin | **Not captured for the original failure.** Current development diagnostics attach an origin to the relevant Home and tracking requests. |
| HTTP status | The user observed a 404; the corresponding response record is unavailable. |
| Sanitized response body | **Not captured.** |
| Triggering action | **Not confirmed.** The earlier generic error did not identify the request. |

### Requests that could be relevant

The Home screen loads profile, jobs, and notifications, and separately makes the availability request on an Online/Offline action. Location uploads and the final offline request are made by the tracking service:

| Method | App path | Current app call origin |
| --- | --- | --- |
| `GET` | `/auth/me` | `HomeScreen.loadHomeData profile` |
| `GET` | `/jobs/driver/my-jobs` | `HomeScreen.loadHomeData driver jobs` |
| `GET` | `/jobs/my-jobs`, then `/jobs` fallback | `HomeScreen.loadHomeData jobs fallback` |
| `GET` | `/notifications?limit=1` | `HomeScreen.loadHomeData notifications` |
| `PUT` | `/driver/me/availability` | `HomeScreen.handleToggleOnline` |
| `POST` | `/drivers/me/location` | `locationTrackingService.uploadLocation` |
| `POST` | `/drivers/me/offline` | `locationTrackingService.stopDriverTrackingAndMarkOffline` |

For example, the availability path resolves to:

```text
PUT https://api.deliveryplus.tech/api/driver/me/availability
```

The app's development-only API failure logger reports method, resolved URL, status, call origin, and a sanitized response body. The required `[API REQUEST FAILURE]` record must be captured from a real retry to identify the exact 404. Do not share an Authorization header, JWT, or unredacted personal/location data.

## 2. Endpoint and source comparison

The current API documentation lists:

- `POST /drivers/me/location` — submit the latest GPS location.
- `POST /drivers/me/heartbeat` — mark the authenticated driver online.
- `POST /drivers/me/offline` — mark the authenticated driver offline.
- An admin-only tracking read endpoint, which the Driver App must not call.

The documentation reviewed does **not** list `PUT /driver/me/availability`.

The public backend `main` route source reviewed (`src/routes/drivers.js`, `src/routes/users.js`, and `src/routes/driverNotifications.js`) did not show the expected availability, location-upload, or offline routes at the time of that review. That source may not match the deployed revision. The live documentation does list the location and offline routes, so deployment and source may also be out of sync.

**Conclusion:** There is an unresolved availability-route contract mismatch. The exact deployed route configuration must be checked against the captured 404 and the deployed backend revision. Do not substitute or invent an endpoint in the Driver App.

## 3. API base URL check

The configured base URL is:

```text
https://api.deliveryplus.tech/api
```

Axios resolves the app-relative route `/driver/me/availability` with one `/api` prefix. No duplicated `/api/api` segment was found.

## 4. Permission modal and iOS flow

The location explanation is implemented with React Native `Alert.alert`, followed by Core Location's native authorization prompt as required. The app has an **Open Settings** action using `app-settings:` and a **Try Again** action that restarts the permission/Online handler. Native authorization state is available through the Swift `NativeLocationManager` bridge, and the Home screen subscribes to authorization changes and refreshes permission state when the app returns active.

The reason the permission sheet could not be dismissed in the earlier simulator attempt was not established. The available evidence does not distinguish an iOS prompt issue from simulator-control limitations. The current code inspection is not a substitute for testing Continue, Open Settings, Try Again, and return-from-Settings on a running app.

The iOS configuration includes When-In-Use and Always usage descriptions and the `location` background mode. Core Location tracking refuses to start unless authorization is `authorizedAlways`.

## 5. Current Online/Offline implementation (source inspection)

### Going Online

1. The app requests the required location permission.
2. If permission is denied or incomplete, it presents a background-permission Alert with Settings and retry actions.
3. It calls `PUT /driver/me/availability` with `availability: "available"`.
4. After a successful availability response, it starts native location tracking.
5. A failure of the availability request prevents the UI from setting Online.

This is a code-path description, **not** a verified server or device result.

### Going Offline

1. The app stops the location watch.
2. It calls `PUT /driver/me/availability` with `availability: "offline"`.
3. It then calls `POST /drivers/me/offline`.
4. If the final offline request fails, the app reports that availability was set Offline but GPS shutdown was not confirmed.

This order is source-reviewed only. No in-flight upload race, server response, or offline state was verified end to end.

## 6. Tracking and location verification

The current checkout contains a Swift Core Location manager and a React Native tracking service. The JavaScript tracking service validates coordinates and rejects simulated fixes before upload. The native iOS bridge marks simulator-provided coordinates as simulated.

No successful authorized production location upload was recorded. MongoDB persistence and CRM map updates were not verified. Simulator coordinates must remain test-only and must not be sent to production.

The current `GPS_LOCATION_AUDIT.md` in this checkout also reports `react-native-background-geolocation` in the app dependency/lock files and a Transistorsoft release-license requirement. Therefore, this checkout cannot be described as fully migrated to free native GPS tracking until the dependency and release configuration are audited and resolved.

## 7. Verification status

| Check | Result |
| --- | --- |
| Base URL and duplicate `/api` check | Checked; one `/api` prefix is used. |
| Exact runtime 404 method, URL, origin, and body | **Not captured.** |
| Availability endpoint acceptance | **Not verified.** |
| Location/offline route acceptance by deployed backend | **Not verified.** |
| Current public backend route source | Reviewed; does not establish deployed revision. |
| iOS authorization and settings-return behavior | Source-inspected; full interactive flow not verified in this report. |
| Online server confirmation and native start | **Not verified end to end.** |
| Offline server confirmation and upload shutdown | **Not verified end to end.** |
| Simulator GPS fix | Native code identifies simulator fixes as simulated; no production upload made. |
| Physical-device background GPS | **Not verified.** |
| MongoDB persistence and CRM map movement | **Not verified.** |
| Debug/Release build and installation for this retry | **Not verified.** |

## 8. Files and implementation areas reviewed

- `src/services/api.js` — API base URL, authenticated client, and sanitized development API failure diagnostics.
- `src/screens/HomeScreen.js` — Home requests, permission prompt, availability request, Online/Offline state, and settings/retry actions.
- `src/services/nativeLocationService.js` — React Native bridge calls and permission-state mapping.
- `src/services/locationTrackingService.js` — location validation, upload, tracking start/stop, retry, and offline call.
- `ios/DeliveryPlusDriverApp/NativeLocationManager.swift` — Core Location authorization, tracking, and simulator-fix marking.
- `ios/DeliveryPlusDriverApp/NativeLocationManagerBridge.m` — React Native bridge exports.
- `ios/DeliveryPlusDriverApp/Info.plist` — iOS location descriptions and background mode.
- `GPS_LOCATION_AUDIT.md` — existing tracking implementation and verification notes.

No backend, CRM, MongoDB, pricing, job, or payment code was modified for this report.

## 9. Remaining actions

1. Run the app on the target iPhone and reproduce the action that shows the 404.
2. Capture the single `[API REQUEST FAILURE]` entry, keeping credentials and personal/location data redacted.
3. Compare its exact method and URL against the deployed backend revision and documented contract.
4. If the deployed route is missing, stop and coordinate the backend contract; do not invent an app endpoint.
5. Once the route is confirmed, verify Online authorization → server response → native tracking start, and Offline stop → availability update → final offline request.
6. Verify real GPS upload, backend persistence, and CRM map update on an authorized physical-device test before claiming production readiness.
