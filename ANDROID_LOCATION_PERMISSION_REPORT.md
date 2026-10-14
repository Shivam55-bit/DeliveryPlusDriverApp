# Android Location Permission Fix — Progress Report

**Project:** DeliveryPlus Driver App  
**Scope:** Android driver location permission and tracking  
**Report status:** Implementation and automated checks complete; full APK/device verification pending  
**Device inspected:** Xiaomi 2312BPC51H, Android 15 (API 35)  
**App target SDK:** 36  
**Compile SDK:** 36

## What caused the repeated “Background location required” message?

The permission flow had several connected defects:

1. The JS service requested fine foreground and background location together with `requestMultiple`. Android 11+ does not grant “Allow all the time” through that combined runtime prompt; the user must grant foreground access first and then enable background access separately in Settings. The combined request therefore appeared denied to the app.
2. Android permission detection checked only fine location and returned `"granted"` without checking background access or whether device Location services were enabled.
3. The Android Settings action returned `false` and did not open Settings. The Home screen also did not refresh permission state after the user returned.
4. JS looked for `NativeLocationManager`, while the Kotlin module registers as `NativeLocationModule`. Consequently, Android did not use that native module for tracking.
5. The Kotlin location service was not declared in `AndroidManifest.xml`, and it requested location updates before entering foreground mode. The Android native service therefore was not a functioning background-tracking path.

These issues explain why the app could keep showing the background-permission error even when the driver tried to follow its Settings action.

## Changes made

- Changed Android permission handling to query actual native permission and Location-service state. Foreground status records coarse/approximate versus fine/precise access and distinguishes first request from a permanently denied permission.
- Split foreground permission requests (coarse and fine together) from the separate background request. For Android 11+, the app now directs the user to app Location settings to choose **Allow all the time**; it does not try to request foreground and background permissions together.
- Added Android app-permission and device-Location Settings actions, fresh status checks on return from Settings, and a permission dialog with **Continue**, **Open Settings**, **Try Again**, and **Not Now**. The Android Try Again action reads native state again.
- Connected JS tracking to the correctly named Android native module and native location events.
- Declared `DriverLocationService` as a non-exported `location` foreground service. It calls `startForeground` with the location service type before registering location updates, rejects starts when required permission or device Location services are unavailable, and removes its listener and notification on stop.
- Kept Online dependent on server availability confirmation and successful tracking startup. A failed tracking startup attempts to stop tracking and roll availability back to Offline. Offline stops collection and prevents new uploads, waits for in-flight uploads, updates availability, and calls the final Offline endpoint; failures are surfaced and queued for reconciliation.
- Did not change assigned-job loading or job/pricing/POD/notification/API code.

## Permission state observed

| Permission/service | Before implementation | After implementation in this session |
|---|---|---|
| Coarse foreground location | Not granted | Not granted; no permission prompt was triggered during verification |
| Fine foreground location | Not granted | Not granted; no permission prompt was triggered during verification |
| Background location | Not granted | Not granted; no Settings grant was made during verification |
| Device Location services | Enabled on inspected device | Enabled on last reported device inspection |

The implementation changed how permissions will be requested and detected; it did not grant permissions or simulate the user’s Settings choice. The observed runtime grant state therefore remains denied.

## Verification so far

- Focused location service Jest tests: **13 passed** across 2 suites.
- Full Jest regression suite: **127 passed** across 11 suites.
- Android Kotlin compilation: **passed** (`:app:compileDebugKotlin`).
- JavaScript lint for changed service files/tests: **passed**. HomeScreen lint reported five existing warnings and no errors.
- Full APK build from the long workspace path failed in Reanimated’s CMake/Ninja step with `manifest 'build.ninja' still dirty after 100 tries`—the known Windows long-path/native-build issue, not a Kotlin compile error. A short-path build retry is underway; its result is pending.
- No live Online/Offline API transition, GPS upload, or real-coordinate test was performed.

## Changed files

- [HomeScreen.js](./src/screens/HomeScreen.js)
- [nativeLocationService.js](./src/services/nativeLocationService.js)
- [locationTrackingService.js](./src/services/locationTrackingService.js)
- [NativeLocationModule.kt](./android/app/src/main/java/com/deliveryplusdriverapp/NativeLocationModule.kt)
- [DriverLocationService.kt](./android/app/src/main/java/com/deliveryplusdriverapp/DriverLocationService.kt)
- [AndroidManifest.xml](./android/app/src/main/AndroidManifest.xml)
- [MainApplication.kt](./android/app/src/main/java/com/deliveryplusdriverapp/MainApplication.kt)
- [nativeLocationService.test.js](./src/services/__tests__/nativeLocationService.test.js)
- [locationTrackingService.test.js](./src/services/__tests__/locationTrackingService.test.js)

## Still to verify

- Complete the debug APK build and install it on the inspected Android 15 phone.
- On that phone, interactively verify first-run foreground permission, approximate and precise choices, the Android 11+ background Settings flow, **Allow all the time**, Settings return, Try Again, disabled Location services, and permanently denied handling.
- With an authorized driver test account and backend, verify Online is confirmed only after the native service starts, location updates during app background/screen lock, Offline stops uploads and reaches the final endpoint, and logout cleanup succeeds.
- Confirm the dashboard still shows the expected assignments `JOB-00146` and `JOB-00147`. These job details and the live tracking lifecycle have not been rechecked on-device in this permission-fix run.

**Result:** Not yet a real-device PASS. The code and automated checks address the identified permission-flow defects, but Android prompt behavior, background GPS tracking, lock-screen operation, and backend Online/Offline behavior still require on-device verification.
