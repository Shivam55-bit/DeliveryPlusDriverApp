# GPS Android Real-Device and iOS Readiness Report

**Project:** DeliveryPlus Driver App  
**Scope:** Driver app only  
**Assessment date:** 2026-10-11  
**Overall result:** Android real-device acceptance is **NOT MET**. iOS source review is complete, but iOS build and device behavior remain **UNVERIFIED**.

## Android

### Connected device and installed app

- ADB reported the attached Xiaomi 2312BPC51H in state `device` (not offline or unauthorized).
- Android version: 15 (API 35). Device Location Services were enabled (`location_mode=3`).
- Installed package: `com.deliveryplusdriverapp`; installed version code: 1; target SDK: 36.
- At inspection time, the app was not foregrounded. No permission prompt or app-driven tracking session was exercised.
- Current runtime grants for coarse, fine, and background location were all false. Location app-ops were `ignore`.
- This snapshot does not establish whether permissions had previously been denied or had never been requested.
- No app data was reset, and the installed app was not uninstalled or replaced.

### Build and installation

- `app:compileDebugKotlin`: **PASS**.
- Android Debug APK build: **FAIL/BLOCKED** in React Native Reanimated's CMake/Ninja step with `ninja: error: manifest 'build.ninja' still dirty after 100 tries`.
- Android Release build: **FAIL/BLOCKED** at the same CMake/Ninja step. CMake also warned that Reanimated's object output directory was 177 characters and that object paths could exceed its 250-character safe limit.
- Build environment observed: Java 17.0.12, CMake 3.22.1 (`3.22.1-g37088a8-dirty`), Ninja 1.10.2, and NDK 27.1.12297006. The project targets those configured native tools.
- Installed package versions are React Native 0.85.2, Reanimated 4.6.0, and Worklets 0.12.1; Reanimated's compatibility table lists RN 0.85 and Worklets 0.12.x for 4.6.x.
- CMake caches reference the current project root, CMake 3.22.1, Ninja, and the configured NDK. Ninja correctly escapes the spaces in the project path. The mapped-drive (`subst`) attempt did not shorten CMake's canonical source path.
- **Recovery attempted:** removed only Reanimated's generated Debug CMake/Ninja directory (`android/.cxx/Debug/5g1i03cu`) and matching C++ intermediate/log directory (`android/build/intermediates/cxx/Debug/5g1i03cu`), totaling about 5.35 MB. No source, other modules, shared Gradle caches, signing material, or unrelated directories were removed. A fresh arm64-only Debug APK build still failed after 3m 54s with the same error; further build attempts were stopped.
- **Root-cause evidence:** CMake repeatedly printed `Configuring done`, `Generating done`, and its build-directory path, but Ninja reran CMake until its 100-try limit. `ninja -d explain` reports the CMake manifest dependencies (including `CMakeCache.txt` and generated compiler configuration) as dirty. Running Reanimated's generated `VerifyGlobs.cmake` directly returned 0 without changing its stamp, so a changing source glob was not observed. In the fresh failed build, `build.ninja` was timestamped `15:37:13.746` and `CMakeFiles/cmake.check_cache` `15:37:13.836`; the cache-check stamp was recreated about 90 ms after the manifest. This is evidence of a non-stabilizing generated CMake/Ninja regeneration state, but does **not** prove that stamp ordering alone is the cause.
- **Root cause status:** the loop is isolated to Reanimated's generated CMake/Ninja regeneration on this Windows setup, not to a C++ compilation diagnostic. The exact upstream/tooling trigger remains **unresolved**. The long-object-path warning is a separate Release-build risk and was not shown to trigger the Debug manifest loop.
- Disk space immediately before the recovery build was approximately 11.76 GB free and about 11.80 GB afterward. The physical short-path copy was not attempted.
- No Debug APK was produced at the expected output path. ADB listed no connected device after the recovery build, so no install or upgrade-install was attempted.

### Current Android device access

- The phone was previously observed as Xiaomi 2312BPC51H, Android 15 (API 35), in ADB `device` state.
- During this recovery session, ADB later returned an empty device list (`adb devices -l`); the phone is currently unavailable to this validation attempt.
- No device settings, app data, permissions, or backend state were changed during the recovery attempt.

### Permissions, service, and GPS

| Check | Result |
|---|---|
| Foreground location request on device | **UNVERIFIED**; app was not launched into the permission flow |
| Coarse and fine permission grants | **NOT GRANTED** at inspection |
| Precise location | **UNVERIFIED**; no runtime permission dialog was exercised |
| Settings navigation / Allow all the time / return refresh / Try Again | **UNVERIFIED** |
| Native permission refresh on device | **UNVERIFIED** |
| `NativeLocationModule` registration and service declaration | Source inspected; runtime registration/start not exercised |
| Foreground notification and actual GPS fixes | **UNVERIFIED** |
| Native events reaching React Native | **UNVERIFIED** |
| Locked-screen/background updates | **UNVERIFIED** |
| Service stop after Offline | **UNVERIFIED** |
| Xiaomi battery/background restrictions | Not changed; OEM-specific settings were not exercised |

The source contains the native module registration and foreground location service declaration, but source inspection is not evidence that the service starts or receives fixes on this device. At the time of inspection, no active tracking session had been started.

### Backend, Online/Offline, and CRM

- No authenticated driver session or authorized production test account was confirmed.
- No availability, location, or Offline API requests were made. No production driver state was changed.
- No real device coordinates were sent; the documentation example coordinates were not used.
- Consequently, there is no HTTP response status, actual-coordinate upload, MongoDB persistence confirmation, CRM map confirmation, or backend Online/Offline confirmation.
- Assigned-job fetching was not exercised.
- The Offline race regression tests cover waiting for an in-flight upload, blocking new fixes during deactivation, and preventing a retry after Offline begins. A delayed successful upload is also prevented from restoring stale last-upload metadata after tracking has stopped or the session token changes. These are automated shared-service checks, not proof of production API ordering or server state.

### Performance and reliability

- No device tracking interval, upload cadence, battery use, memory behavior, or screen-lock behavior could be measured because no APK was built and no tracking session ran.
- The configurable active-job and idle intervals remain best-effort source behavior; no on-device observation is claimed.
- No React-render, job-refetch, or job-action latency measurements were collected.

### Automated verification

- Full Jest suite: **PASS**, 12 suites / 130 tests.
- Focused location, native bridge, and Offline suites: **PASS**, 16 tests.
- ESLint on changed JavaScript files: **PASS**.
- Editor diagnostics for changed JavaScript, tests, Swift, and Objective-C bridge files: **no errors reported**.
- Android Kotlin compilation: **PASS**.
- Debug APK build: **FAIL/BLOCKED**.
- Release build: **FAIL/BLOCKED**.

### Android files changed

- [`src/services/locationTrackingService.js`](./src/services/locationTrackingService.js): ignore completion-side throttle metadata updates from a location request if tracking has stopped or the session token changed.
- [`src/services/__tests__/locationTrackingOffline.test.js`](./src/services/__tests__/locationTrackingOffline.test.js): add Offline/in-flight-upload regression coverage.
- [`src/services/__tests__/nativeLocationService.test.js`](./src/services/__tests__/nativeLocationService.test.js): add iOS native-start rejection and listener-cleanup coverage; shared test file.

### Android remaining blockers

1. Resolve the still-unconfirmed Reanimated CMake/Ninja regeneration trigger before another build attempt; do not repeat the same build without a toolchain-level corrective action.
2. Reconnect the phone, then install a newly verified Debug APK using data-preserving upgrade-install semantics and exercise the permission flow on-device.
3. With an authorized driver test session and explicit approval for production state changes (or an approved non-production environment), verify genuine GPS uploads and Online/Offline API behavior.
4. Confirm backend persistence and CRM Live Tracking with the backend/CRM owners; test safe movement, screen lock, Offline stop, and absence of later uploads.
5. Measure actual cadence, battery/background restrictions, job fetching, and performance on the device.

**Android acceptance: NOT MET.** Physical-device tracking from GPS through backend and CRM, including reliable Offline stop, was not demonstrated.

## iOS

### Source audit

- [`ios/DeliveryPlusDriverApp/NativeLocationManager.swift`](./ios/DeliveryPlusDriverApp/NativeLocationManager.swift) uses Core Location and exposes native tracking through the expected `NativeLocationManager` module name.
- [`ios/DeliveryPlusDriverApp/NativeLocationManagerBridge.m`](./ios/DeliveryPlusDriverApp/NativeLocationManagerBridge.m) exports the Swift tracking-start method with promise callbacks.
- [`ios/DeliveryPlusDriverApp.xcodeproj/project.pbxproj`](./ios/DeliveryPlusDriverApp.xcodeproj/project.pbxproj) includes both native location source files in the app target.
- [`ios/DeliveryPlusDriverApp/Info.plist`](./ios/DeliveryPlusDriverApp/Info.plist) contains location usage descriptions and declares the `location` background mode.
- The JavaScript bridge uses the same native module name. Its listener lifecycle removes the prior subscription before registering a replacement and cleans up on stop/start failure.

### Source defect and correction

Previously, the native `startTracking` method returned no promise result even though JavaScript awaited it as a startup handshake. Missing Always authorization could therefore emit a native error without rejecting the JavaScript startup operation. The bridge now rejects when Always authorization is absent and resolves after Core Location updates are started. A focused Jest test covers rejection and listener cleanup.

This confirms only the source-level handshake. It does not prove permission prompts, authorization callbacks, delivery of a first fix, background execution, or a successful upload.

### Free GPS dependency review

- Source manifests, lockfiles, `Podfile.lock`, and native source were searched for `react-native-background-geolocation`, Transistorsoft binaries, and known paid GPS tracking SDK references; none were found.
- The inspected source uses native Android location APIs and iOS Core Location.
- A release APK/binary was not produced, so the final Android release artifact could not be inspected. iOS CocoaPods/Xcode dependency resolution and binary inspection remain pending.
- No paid GPS tracking SDK was added or removed.

### Validation status

| iOS validation | Status |
|---|---|
| Static source/bridge/configuration review | **COMPLETE** |
| Swift/Objective-C compilation | **UNVERIFIED**; no macOS/Xcode environment |
| Signing/archive | **UNVERIFIED** |
| Runtime permission flow | **UNVERIFIED** |
| Background operation and screen-lock behavior | **UNVERIFIED** |
| Physical iPhone GPS and backend upload | **UNVERIFIED**; no iPhone available |

**iOS source status:** Source review is complete and the startup-handshake correction is ready for Xcode validation. This is not an iOS build, device, or production-readiness PASS.

### Future iOS validation checklist

1. On macOS, install/resolve the project’s pinned CocoaPods dependencies and build the app target in Xcode.
2. Verify signing and deployment configuration.
3. On an iPhone, test When In Use to Always authorization, denial/recovery, and returning from Settings.
4. Verify bridge startup success/failure, native location events, listener cleanup, and session/logout behavior.
5. Verify foreground and permitted background location behavior, including screen lock and Offline stop.
6. Using an authorized test environment/account, verify genuine-coordinate upload and server-side Offline state.
7. Re-check resolved iOS dependency/licensing state and inspect the built artifact before release.

## Final acceptance summary

- **Android real-device acceptance:** **NOT MET / BLOCKED** by APK build failure and unperformed runtime/backend/CRM verification.
- **Latest Debug recovery attempt:** **FAIL**; targeted generated-cache reset did not fix the Ninja regeneration loop. No APK was installed.
- **iOS source review:** **COMPLETE**; source-level startup-handshake defect corrected.
- **iOS build, signing, permissions, background behavior, and real GPS upload:** **UNVERIFIED** and require macOS/Xcode plus a physical iPhone.
- This recovery attempt changed no application source or iOS files; it removed only the scoped generated Reanimated Debug outputs described above and updated this report.
- No fabricated coordinates were sent, no backend/CRM/MongoDB records were modified, and no app data was wiped.
