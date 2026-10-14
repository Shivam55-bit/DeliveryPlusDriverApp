import CoreLocation
import Foundation
import React

@objc(NativeLocationManager)
class NativeLocationManager: RCTEventEmitter, CLLocationManagerDelegate {
  private let locationManager = CLLocationManager()
  private var lastLocation: CLLocation?
  private var pendingAuthorization: RCTPromiseResolveBlock?
  private var trackingActive = false

  override init() {
    super.init()
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyBest
    locationManager.distanceFilter = 50
    locationManager.pausesLocationUpdatesAutomatically = true
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

    trackingActive = true
    locationManager.desiredAccuracy = kCLLocationAccuracyBest
    locationManager.distanceFilter = activeJob ? 20 : 50
    locationManager.pausesLocationUpdatesAutomatically = !activeJob
    locationManager.allowsBackgroundLocationUpdates = true
    locationManager.showsBackgroundLocationIndicator = true
    locationManager.startUpdatingLocation()
    #if DEBUG
    NSLog("[LOCATION_TRACKING_DEBUG] Core Location updates started (auth=%d)", currentAuth.rawValue)
    #endif
    resolve(true)
  }

  @objc
  func stopTracking() {
    trackingActive = false
    locationManager.stopUpdatingLocation()
    locationManager.allowsBackgroundLocationUpdates = false
    locationManager.showsBackgroundLocationIndicator = false
    #if DEBUG
    NSLog("[LOCATION_TRACKING_DEBUG] Core Location updates stopped")
    #endif
  }

  @objc(getCurrentLocation:rejecter:)
  func getCurrentLocation(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let location = lastLocation ?? locationManager.location else {
      reject("E_LOCATION_UNAVAILABLE", "No current location available.", nil)
      return
    }

    resolve(locationResult(location))
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
    lastLocation = location
    sendEvent(withName: "location", body: locationResult(location))
    #if DEBUG
    let simulated = location.sourceInformation?.isSimulatedBySoftware ?? false
    NSLog("[LOCATION_TRACKING_DEBUG] Core Location fix received (simulated=%d)", simulated)
    #endif
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    let nsError = error as NSError
    sendEvent(withName: "locationError", body: [
      "code": "E_LOCATION_UPDATE",
      "message": nsError.localizedDescription,
    ])
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
