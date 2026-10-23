import CoreLocation
import Foundation
import React
import UIKit

@objc(NativeLocationManager)
class NativeLocationManager: RCTEventEmitter, CLLocationManagerDelegate {
  private let locationManager = CLLocationManager()
  private var lastLocation: CLLocation?
  private var pendingAuthorization: RCTPromiseResolveBlock?
  private var trackingActive = false
  private var activeJob = false

  private var lastEmittedLocation: CLLocation?
  private var lastEmittedTimestamp: Date?

  private var backgroundTaskId: UIBackgroundTaskIdentifier = .invalid
  private var bgTaskExpirationTimer: Timer?
  private var watchdogTimer: Timer?
  private var pendingLocationResolvers: [(RCTPromiseResolveBlock, RCTPromiseRejectBlock)] = []
  private var isRequestingLocation = false

  override init() {
    super.init()
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyBest
    locationManager.distanceFilter = kCLDistanceFilterNone
    locationManager.pausesLocationUpdatesAutomatically = false
    locationManager.activityType = .automotiveNavigation
  }

  override func supportedEvents() -> [String]! {
    ["authorizationChanged", "location", "locationError"]
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc(getAuthorizationStatus:rejecter:)
  func getAuthorizationStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let result = authorizationResult()
    #if DEBUG
    NSLog(
      "[LOCATION_PERMISSION_DEBUG] Core Location authorization: %@",
      result["status"] as? String ?? "unknown"
    )
    #endif
    resolve(result)
  }

  @objc(requestWhenInUseAuthorization:rejecter:)
  func requestWhenInUseAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let status = locationManager.authorizationStatus
    guard status == .notDetermined else {
      resolve(authorizationResult())
      return
    }

    pendingAuthorization = resolve
    locationManager.requestWhenInUseAuthorization()
  }

  @objc(requestAlwaysAuthorization:rejecter:)
  func requestAlwaysAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let status = locationManager.authorizationStatus
    guard status == .authorizedWhenInUse else {
      resolve(authorizationResult())
      return
    }

    pendingAuthorization = resolve
    locationManager.requestAlwaysAuthorization()
  }

  @objc(startTracking:resolver:rejecter:)
  func startTracking(
    _ activeJob: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let currentAuth = locationManager.authorizationStatus
    guard currentAuth == .authorizedAlways || currentAuth == .authorizedWhenInUse else {
      reject(
        "E_LOCATION_PERMISSION",
        "Location authorization (When In Use or Always) is required for driver tracking.",
        nil
      )
      return
    }

    self.activeJob = activeJob
    trackingActive = true
    lastEmittedLocation = nil
    lastEmittedTimestamp = nil

    locationManager.desiredAccuracy = kCLLocationAccuracyBest
    // kCLDistanceFilterNone allows continuous updates even when stationary
    locationManager.distanceFilter = kCLDistanceFilterNone
    // NEVER allow iOS to pause updates while online - this causes 30+ minute gaps!
    locationManager.pausesLocationUpdatesAutomatically = false
    locationManager.activityType = .automotiveNavigation
    locationManager.allowsBackgroundLocationUpdates = true
    locationManager.showsBackgroundLocationIndicator = true
    locationManager.startUpdatingLocation()

    startWatchdogTimer()

    #if DEBUG
    NSLog("[LOCATION_TRACKING_DEBUG] Core Location updates started (auth=%d, activeJob=%d)", currentAuth.rawValue, activeJob)
    #endif
    resolve(true)
  }

  @objc(updateTrackingOptions:resolver:rejecter:)
  func updateTrackingOptions(
    _ activeJob: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    self.activeJob = activeJob
    #if DEBUG
    NSLog("[LOCATION_TRACKING_DEBUG] Core Location activeJob updated: %d", activeJob)
    #endif
    resolve(true)
  }

  @objc
  func stopTracking() {
    trackingActive = false
    stopWatchdogTimer()
    endBackgroundTaskInternal()
    locationManager.stopUpdatingLocation()
    locationManager.allowsBackgroundLocationUpdates = false
    locationManager.showsBackgroundLocationIndicator = false
    lastEmittedLocation = nil
    lastEmittedTimestamp = nil
    #if DEBUG
    NSLog("[LOCATION_TRACKING_DEBUG] Core Location updates stopped")
    #endif
  }

  @objc(getCurrentLocation:rejecter:)
  func getCurrentLocation(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let now = Date()
    // Return lastLocation if fresh (< 15 seconds) and valid
    if let loc = lastLocation, loc.horizontalAccuracy >= 0, now.timeIntervalSince(loc.timestamp) < 15.0 {
      resolve(locationResult(loc))
      return
    }
    // Return locationManager.location if fresh (< 15 seconds) and valid
    if let loc = locationManager.location, loc.horizontalAccuracy >= 0, now.timeIntervalSince(loc.timestamp) < 15.0 {
      resolve(locationResult(loc))
      return
    }

    // Cache is stale or unavailable. Request fresh one-shot location fix.
    pendingLocationResolvers.append((resolve, reject))
    if !isRequestingLocation {
      isRequestingLocation = true
      locationManager.requestLocation()
      // Safety timeout after 10 seconds
      DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
        guard let self = self, self.isRequestingLocation else { return }
        self.isRequestingLocation = false
        if !self.pendingLocationResolvers.isEmpty {
          if let fallbackLoc = self.lastLocation ?? self.locationManager.location, fallbackLoc.horizontalAccuracy >= 0 {
            let res = self.locationResult(fallbackLoc)
            for (r, _) in self.pendingLocationResolvers { r(res) }
          } else {
            for (_, rej) in self.pendingLocationResolvers {
              rej("E_LOCATION_TIMEOUT", "Fresh location request timed out.", nil)
            }
          }
          self.pendingLocationResolvers.removeAll()
        }
      }
    }
  }

  @objc(beginBackgroundTask:rejecter:)
  func beginBackgroundTask(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    ensureBackgroundTask()
    resolve(NSNumber(value: backgroundTaskId.rawValue))
  }

  @objc(endBackgroundTask:resolver:rejecter:)
  func endBackgroundTask(
    _ taskId: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    endBackgroundTaskInternal()
    resolve(true)
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let result = authorizationResult()
    sendEvent(withName: "authorizationChanged", body: result)

    if manager.authorizationStatus != .notDetermined {
      pendingAuthorization?(result)
      pendingAuthorization = nil
    }

    if trackingActive && (manager.authorizationStatus != .authorizedAlways && manager.authorizationStatus != .authorizedWhenInUse) {
      stopTracking()
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }

    // 1. Validate fix accuracy (negative means invalid hardware reading)
    guard location.horizontalAccuracy >= 0 else {
      #if DEBUG
      NSLog("[LOCATION_TRACKING_DEBUG] Discarding invalid accuracy: %f", location.horizontalAccuracy)
      #endif
      return
    }

    let now = Date()
    let age = now.timeIntervalSince(location.timestamp)

    // 2. Resolve pending one-shot getCurrentLocation requests
    if !pendingLocationResolvers.isEmpty && age <= 15.0 {
      let result = locationResult(location)
      for (res, _) in pendingLocationResolvers {
        res(result)
      }
      pendingLocationResolvers.removeAll()
      isRequestingLocation = false
    }

    guard trackingActive else { return }

    // 3. Discard stale cached fixes from before service started
    guard age <= 30.0 else {
      #if DEBUG
      NSLog("[LOCATION_TRACKING_DEBUG] Discarding stale cached fix: age=%.1fs", age)
      #endif
      return
    }

    lastLocation = location

    // 4. Cadence & distance throttling for JS events:
    // Active job: 20m or 10s
    // Standby/Idle: 40m or 35s
    let minDistance: CLLocationDistance = activeJob ? 20.0 : 40.0
    let minInterval: TimeInterval = activeJob ? 10.0 : 35.0
    let maxBridgeCadence: TimeInterval = 4.0

    let distanceMoved = lastEmittedLocation != nil ? location.distance(from: lastEmittedLocation!) : Double.greatestFiniteMagnitude
    let elapsed = lastEmittedTimestamp != nil ? now.timeIntervalSince(lastEmittedTimestamp!) : Double.greatestFiniteMagnitude

    let shouldEmit: Bool
    if lastEmittedLocation == nil {
      shouldEmit = true
    } else if elapsed < maxBridgeCadence {
      shouldEmit = false
    } else if distanceMoved >= minDistance || elapsed >= minInterval {
      shouldEmit = true
    } else {
      shouldEmit = false
    }

    guard shouldEmit else { return }

    lastEmittedLocation = location
    lastEmittedTimestamp = now

    // 5. Ensure background task assertion is active during event dispatch
    ensureBackgroundTask()

    sendEvent(withName: "location", body: locationResult(location))

    #if DEBUG
    let simulated = location.sourceInformation?.isSimulatedBySoftware ?? false
    NSLog(
      "[LOCATION_TRACKING_DEBUG] Core Location fix emitted (dist=%.1fm, elapsed=%.1fs, simulated=%d)",
      distanceMoved,
      elapsed,
      simulated
    )
    #endif
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    let nsError = error as NSError
    #if DEBUG
    NSLog("[LOCATION_TRACKING_DEBUG] Core Location error: code=%ld, %@", nsError.code, nsError.localizedDescription)
    #endif

    // Ignore temporary kCLErrorLocationUnknown while hardware acquires fix
    if nsError.domain == kCLErrorDomain && nsError.code == CLError.locationUnknown.rawValue {
      return
    }

    if !pendingLocationResolvers.isEmpty {
      for (_, rej) in pendingLocationResolvers {
        rej("E_LOCATION_ERROR", nsError.localizedDescription, error)
      }
      pendingLocationResolvers.removeAll()
      isRequestingLocation = false
    }

    sendEvent(withName: "locationError", body: [
      "code": "E_LOCATION_UPDATE",
      "message": nsError.localizedDescription,
    ])
  }

  private func ensureBackgroundTask() {
    guard UIApplication.shared.applicationState != .active else { return }
    if backgroundTaskId == .invalid {
      backgroundTaskId = UIApplication.shared.beginBackgroundTask(withName: "DeliveryPlusLocationUpload") { [weak self] in
        #if DEBUG
        NSLog("[LOCATION_TRACKING_DEBUG] Background task assertion expired by iOS")
        #endif
        self?.endBackgroundTaskInternal()
      }
      #if DEBUG
      NSLog("[LOCATION_TRACKING_DEBUG] Background task assertion started: %lu", UInt(self.backgroundTaskId.rawValue))
      #endif
    }
    bgTaskExpirationTimer?.invalidate()
    bgTaskExpirationTimer = Timer.scheduledTimer(withTimeInterval: 25.0, repeats: false) { [weak self] _ in
      self?.endBackgroundTaskInternal()
    }
  }

  private func endBackgroundTaskInternal() {
    bgTaskExpirationTimer?.invalidate()
    bgTaskExpirationTimer = nil
    if backgroundTaskId != .invalid {
      let tid = backgroundTaskId
      backgroundTaskId = .invalid
      UIApplication.shared.endBackgroundTask(tid)
      #if DEBUG
      NSLog("[LOCATION_TRACKING_DEBUG] Background task assertion ended: %lu", UInt(tid.rawValue))
      #endif
    }
  }

  private func startWatchdogTimer() {
    stopWatchdogTimer()
    watchdogTimer = Timer.scheduledTimer(withTimeInterval: 45.0, repeats: true) { [weak self] _ in
      guard let self = self, self.trackingActive else { return }
      let now = Date()
      let elapsed = self.lastEmittedTimestamp != nil ? now.timeIntervalSince(self.lastEmittedTimestamp!) : 999.0
      if elapsed >= 50.0 {
        #if DEBUG
        NSLog("[LOCATION_TRACKING_DEBUG] Watchdog detected no fix for %.1fs. Poking Core Location...", elapsed)
        #endif
        self.locationManager.requestLocation()
      }
    }
  }

  private func stopWatchdogTimer() {
    watchdogTimer?.invalidate()
    watchdogTimer = nil
  }

  private func authorizationResult() -> [String: Any] {
    let status: String
    switch locationManager.authorizationStatus {
    case .notDetermined:
      status = "notDetermined"
    case .restricted:
      status = "restricted"
    case .denied:
      status = "denied"
    case .authorizedWhenInUse:
      status = "authorizedWhenInUse"
    case .authorizedAlways:
      status = "authorizedAlways"
    @unknown default:
      status = "unknown"
    }

    let isAlways = locationManager.authorizationStatus == .authorizedAlways
    let isWhenInUse = locationManager.authorizationStatus == .authorizedWhenInUse
    let isGranted = isAlways || isWhenInUse

    let accuracy: String
    if #available(iOS 14.0, *) {
      accuracy = locationManager.accuracyAuthorization == .fullAccuracy ? "full" : "reduced"
    } else {
      accuracy = "full"
    }

    return [
      "status": status,
      "granted": isGranted,
      "isAlways": isAlways,
      "isWhenInUse": isWhenInUse,
      "accuracy": accuracy,
    ]
  }

  private func locationResult(_ location: CLLocation) -> [String: Any] {
    let age = max(0, Date().timeIntervalSince(location.timestamp) * 1000)
    let isSimulated: Bool
    #if targetEnvironment(simulator)
    isSimulated = true
    #else
    isSimulated = location.sourceInformation?.isSimulatedBySoftware ?? false
    #endif

    var coords: [String: Any] = [
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
      "altitude": location.altitude,
    ]
    if location.speed >= 0 {
      coords["speed"] = location.speed
    }
    if location.course >= 0 {
      coords["heading"] = location.course
    }

    return [
      "coords": coords,
      "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
      "age": age,
      "mock": isSimulated,
    ]
  }
}
