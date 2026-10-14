# Driver App GPS Location Tracking

**Project:** DeliveryPlus Driver App  
**Scope:** Driver app  
**Review date:** 2026-10-09  
**Status:** App-side tracking is implemented. Offline API ordering was tightened during review. Production backend behavior and physical-device tracking have not been verified.

## Summary

The current driver app contains foreground/background location tracking and attempts to upload the driver's coordinates while they are online. This document replaces the earlier audit summary, which incorrectly described GPS tracking as absent.

The code uses `react-native-background-geolocation` and sends coordinates to `POST /api/drivers/me/location` through the shared authenticated API client. This confirms what the app is configured to do; it does not confirm that the deployed backend accepts the route/payload or stores and displays the location correctly.

## Location Tracking Changes Present in the App

| Area | Current implementation |
| --- | --- |
| Location library | `react-native-background-geolocation` 5.7.1 is listed in `package.json` and `package-lock.json`; the native iOS pod is present in `Podfile.lock`. |
| Permission prompt | When a driver goes online, the app explains location use and requests location permission. Tracking requires the SDK to report `Always` authorization; declining or denying permission prevents going online through this flow. |
| Android permissions | The manifest declares coarse, fine, and background location permissions, plus foreground-service and foreground-service-location permissions. |
| iOS permissions | `Info.plist` contains When-In-Use and Always location usage descriptions and enables the `location` background mode. |
| Online/offline lifecycle | Going online first requests permission and updates availability with `PUT /api/driver/me/availability`; after the server accepts the change, tracking starts. Going offline first stops local tracking and settles its pending upload, then updates availability and calls `/api/drivers/me/offline` as the final server action. |
| Offline race handling | The previous order called `/api/drivers/me/offline` before setting availability to offline. The flow now stops local tracking first, waits for in-flight uploads, updates availability, and calls the offline endpoint last so a late accepted location is less likely to leave the driver online. This ordering is source-reviewed only; production race behavior is untested. |
| Upload endpoint and payload | For each accepted fix, the app posts `{ "latitude": number, "longitude": number }` to `/api/drivers/me/location`. The shared API client attaches the driver's auth token when available. |
| Location validation | Missing/out-of-range/non-finite coordinates, SDK-marked mock or sample fixes, and fixes older than two minutes are rejected. |
| Update frequency | While online without an active job, location updates are configured around every 45 seconds; with an active job, around every 12 seconds. Uploads are also rate-limited by elapsed time and movement (50 m online, 20 m during an active job). |
| Upload reliability | Upload requests have a 12-second timeout and retry retryable network/408/429/5xx errors up to three attempts with backoff. Only the latest pending fix is retained while an upload is in progress. |
| Background handling | Tracking is configured with `stopOnTerminate: false` and headless support. Android registers a headless location handler in `index.js`; persisted tracking state and stored authentication are checked before a headless fix is uploaded. `startOnBoot` is false, so tracking is not configured to restart automatically after a device reboot. |
| Account/session safeguards | Guest/test sessions are not tracked. Token changes and logout stop tracking before the auth session is cleared. |

## Files Containing the Implementation

- `src/services/locationTrackingService.js` — permission flow, configuration, location validation, upload/retry queue, start/stop and Android headless handling.
- `src/screens/HomeScreen.js` — starts tracking after the online status update and stops it when going offline.
- `App.js` — initializes the tracking service at app startup.
- `index.js` — registers the Android headless location handler.
- `android/app/src/main/AndroidManifest.xml` — Android location and foreground-service permissions.
- `ios/DeliveryPlusDriverApp/Info.plist` — iOS location descriptions and background location mode.
- `package.json`, `package-lock.json`, `ios/Podfile.lock` — location package/native dependency.
- `src/services/__tests__/locationTrackingService.test.js` — location payload validation tests.

## Validation and Remaining Checks

- Focused Jest tests for location payload validation passed: 8 tests.
- ESLint on the changed screen, tracking service, and focused test reported no errors; four warnings remain in `HomeScreen.js`.
- iOS Simulator Debug build succeeded. This verifies compilation only, not GPS permissions, real GPS fixes, or live tracking.
- Android Debug build did not complete: Gradle failed while packaging `react-native-worklets` after reporting `No space left on device`. This does not verify Android GPS behavior.
- No authorized production driver credentials were available. No live request was sent, so route existence, authentication, accepted payload, HTTP persistence response, and API error behavior remain unverified.
- `xcrun simctl` showed a booted iPhone simulator, not a physical iPhone; `adb devices` showed no connected Android device. No physical-device permission or GPS test was run.
- GPS permission status and SDK runtime state are not confirmed on a device. iOS background, Android foreground-service notification, background/locked-screen, and reboot behavior remain untested.
- No real GPS upload was accepted during this review. MongoDB persistence, CRM tracking read, and live map pin/movement therefore remain **pending**.
- Offline ordering is improved in app code as described above, but the race has not been verified against the production backend or under a real in-flight request.
- The installed SDK README states that release builds require a Transistorsoft license; no license key/configuration was found in the app source or native app configuration reviewed. Debug builds do not require the key according to the package documentation. Release-build licensing remains a blocker to confirm.

## Verification Results

| Check | Result |
| --- | --- |
| iOS physical device | Not tested; only an iOS simulator was available. |
| Android physical device | Not tested; no Android device was connected. Android Debug build failed because the build host ran out of disk space during native library packaging. |
| Permission prompt / grant | Configured in app code; actual grant not verified. |
| SDK tracking state / real GPS fix | Not verified on a device. |
| Upload endpoint HTTP result / accepted fixes | Pending authorized production test; no fabricated coordinates were sent. |
| MongoDB `currentLocation` persistence | Pending backend verification. |
| CRM tracking read / map pin / movement | Pending CRM verification. |
| Background and locked-screen behavior | Not tested on physical devices. |
| Offline race | Client request order improved; production behavior not tested. |
| Release license | Required for release per installed SDK docs; key/configuration not found, so release readiness is unconfirmed. |

## Files Changed During This Review

- `src/screens/HomeScreen.js` — stop local tracking before the offline availability request and perform the location-specific offline API call afterward.
- `GPS_LOCATION_AUDIT.md` — corrected implementation summary and recorded verification status/blockers.

No backend or CRM source was changed.

## iOS Permission Detection Follow-up (2026-10-10)

- Root cause: the app was reading `Geolocation.getAuthorization()` even though the installed React Native runtime does not provide that permission bridge. The existing `NativeLocationManager.swift` was also not registered in the Xcode target or exported to JavaScript, so the app could not reliably read the system's Core Location authorization.
- The iOS app now uses an exported `NativeLocationManager` Core Location bridge. It returns a structured authorization result, maps `authorizedAlways` to the accepted background-tracking state, resolves staged authorization requests from delegate callbacks, emits authorization changes, and starts/stops native location updates.
- The Home screen now checks native authorization on AppState resume and subscribes to authorization-change events. The Online permission path queries the native status afresh and skips permission requests when Always is already granted.
- Development diagnostics log authorization state and tracking lifecycle without logging coordinates or tokens. Simulator-generated coordinates are marked as mock and rejected by the upload validator.
- iPhone 17 Pro Simulator on iOS 26.3: the fresh permission prompt was observed. After setting simulator Always permission and returning to the app, the native Core Location bridge logged `authorizedAlways`. The permission-detection check is verified in Simulator.
- The Debug Simulator build succeeded. ESLint reported no errors; four existing Home screen warnings remain.
- Full Online then Offline activation was not verified: the interactive permission prompt did not close through available simulator controls, and an API 404 appeared during the attempted flow, so server-confirmed availability and native tracking start could not be established. No simulated coordinates were uploaded.
- Physical-device GPS/background behavior remains **NOT VERIFIED**.
