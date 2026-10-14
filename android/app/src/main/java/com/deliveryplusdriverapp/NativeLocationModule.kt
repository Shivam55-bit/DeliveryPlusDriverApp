package com.deliveryplusdriverapp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.facebook.react.modules.core.DeviceEventManagerModule

class NativeLocationModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val EVENT_LOCATION = "NativeLocationUpdate"
    const val EVENT_ERROR = "NativeLocationError"
    private const val FOREGROUND_REQUEST_CODE = 19011
    private const val BACKGROUND_REQUEST_CODE = 19012
    private const val PREFERENCES_NAME = "driver_location_permissions"
    private const val FOREGROUND_REQUESTED_KEY = "foreground_requested"
    private const val BACKGROUND_REQUESTED_KEY = "background_requested"
  }

  private val handler = Handler(Looper.getMainLooper())
  private var pendingStartPromise: Promise? = null

  init {
    (reactContext.applicationContext as? MainApplication)?.nativeLocationModule = this
  }

  override fun getName(): String = "NativeLocationModule"

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  @ReactMethod
  fun getLocationPermissionStatus(promise: Promise) {
    try {
      val coarseGranted = hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
      val preciseGranted = hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)
      val foregroundGranted = coarseGranted || preciseGranted
      val backgroundGranted =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
          hasPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
      val locationServicesEnabled = isLocationServicesEnabled()
      val activity = reactContext.currentActivity
      val preferences = reactContext.getSharedPreferences(PREFERENCES_NAME, 0)
      val foregroundRequested =
        preferences.getBoolean(FOREGROUND_REQUESTED_KEY, false)
      val backgroundRequested =
        preferences.getBoolean(BACKGROUND_REQUESTED_KEY, false)
      val foregroundCanShowRationale = activity?.let {
        it.shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_COARSE_LOCATION) ||
          it.shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)
      } ?: false
      val backgroundCanShowRationale = activity?.shouldShowRequestPermissionRationale(
        Manifest.permission.ACCESS_BACKGROUND_LOCATION
      ) ?: false

      val result = Arguments.createMap().apply {
        putBoolean("foregroundGranted", foregroundGranted)
        putBoolean("coarseGranted", coarseGranted)
        putBoolean("preciseGranted", preciseGranted)
        putString(
          "precision",
          when {
            preciseGranted -> "precise"
            coarseGranted -> "approximate"
            else -> "denied"
          }
        )
        putBoolean("backgroundGranted", backgroundGranted)
        putBoolean("locationServicesEnabled", locationServicesEnabled)
        putBoolean(
          "foregroundPermanentlyDenied",
          !foregroundGranted && foregroundRequested && !foregroundCanShowRationale
        )
        putBoolean(
          "backgroundPermanentlyDenied",
          Build.VERSION.SDK_INT == Build.VERSION_CODES.Q &&
            !backgroundGranted &&
            backgroundRequested &&
            !backgroundCanShowRationale
        )
        putBoolean("trackingServiceRunning", DriverLocationService.isRunning)
        putInt("androidVersion", Build.VERSION.SDK_INT)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("E_LOCATION_PERMISSION_STATUS", "Unable to read Android location status", error)
    }
  }

  @ReactMethod
  fun requestForegroundPermission(promise: Promise) {
    requestPermissionSet(
      arrayOf(
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.ACCESS_FINE_LOCATION
      ),
      FOREGROUND_REQUEST_CODE,
      FOREGROUND_REQUESTED_KEY,
      promise,
      requireAll = false
    )
  }

  @ReactMethod
  fun requestBackgroundPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.resolve(Arguments.createMap().apply {
        putBoolean("granted", true)
        putBoolean("requiresSettings", false)
      })
      return
    }

    if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) &&
      !hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
    ) {
      promise.reject(
        "E_FOREGROUND_PERMISSION_REQUIRED",
        "Grant foreground location before requesting background location"
      )
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      promise.resolve(Arguments.createMap().apply {
        putBoolean("granted", hasPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION))
        putBoolean("requiresSettings", true)
      })
      return
    }

    requestPermissionSet(
      arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
      BACKGROUND_REQUEST_CODE,
      BACKGROUND_REQUESTED_KEY,
      promise,
      requireAll = true
    )
  }

  private fun requestPermissionSet(
    permissions: Array<String>,
    requestCode: Int,
    requestedKey: String,
    promise: Promise,
    requireAll: Boolean
  ) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("E_ACTIVITY_NOT_AVAILABLE", "Current activity is unavailable")
      return
    }

    val missing = permissions.filterNot(::hasPermission)
    if (missing.isEmpty()) {
      promise.resolve(Arguments.createMap().apply {
        putBoolean("granted", true)
        putBoolean("canAskAgain", true)
        putBoolean("neverAskAgain", false)
      })
      return
    }

    val permissionAwareActivity = activity as? PermissionAwareActivity
    if (permissionAwareActivity == null) {
      promise.reject(
        "E_PERMISSION_ACTIVITY",
        "Current activity cannot request runtime permissions"
      )
      return
    }

    val preferences = reactContext.getSharedPreferences(PREFERENCES_NAME, 0)
    val requestedBefore = preferences.getBoolean(requestedKey, false)
    preferences.edit().putBoolean(requestedKey, true).apply()

    try {
      permissionAwareActivity.requestPermissions(
        missing.toTypedArray(),
        requestCode,
        PermissionListener { returnedCode, _, _ ->
          if (returnedCode != requestCode) {
            false
          } else {
            val permissionResults = permissions.map(::hasPermission)
            val granted = if (requireAll) {
              permissionResults.all { it }
            } else {
              permissionResults.any { it }
            }
            val canAskAgain = missing.any {
              activity.shouldShowRequestPermissionRationale(it)
            }
            val neverAskAgain = !granted && requestedBefore && !canAskAgain
            promise.resolve(Arguments.createMap().apply {
              putBoolean("granted", granted)
              putBoolean("canAskAgain", canAskAgain)
              putBoolean("neverAskAgain", neverAskAgain)
            })
            true
          }
        }
      )
    } catch (error: Exception) {
      promise.reject("E_PERMISSION_REQUEST", "Unable to request Android location permission", error)
    }
  }

  @ReactMethod
  fun openAppLocationSettings(promise: Promise) {
    launchSettings(
      Intent(
        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        Uri.fromParts("package", reactContext.packageName, null)
      ),
      promise
    )
  }

  @ReactMethod
  fun openDeviceLocationSettings(promise: Promise) {
    launchSettings(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS), promise)
  }

  private fun launchSettings(intent: Intent, promise: Promise) {
    try {
      val activity = reactContext.currentActivity
      if (activity == null) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
      } else {
        activity.startActivity(intent)
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_LOCATION_SETTINGS", "Unable to open Android location settings", error)
    }
  }

  @ReactMethod
  fun startTracking(config: ReadableMap?, promise: Promise) {
    val status = readPermissionStatus()
    if (!status.foregroundGranted) {
      promise.reject("E_LOCATION_PERMISSION", "Foreground location permission is required")
      return
    }
    if (!status.backgroundGranted) {
      promise.reject("E_BACKGROUND_PERMISSION", "Background location permission is required")
      return
    }
    if (!status.locationServicesEnabled) {
      promise.reject("E_LOCATION_SERVICES_DISABLED", "Enable device location services to go online")
      return
    }

    synchronized(this) {
      if (pendingStartPromise != null) {
        promise.reject("E_LOCATION_START_IN_PROGRESS", "Location tracking is already starting")
        return
      }
      pendingStartPromise = promise
    }

    val startTimeout = Runnable {
      val timedOutPromise = synchronized(this) {
        if (pendingStartPromise === promise) {
          pendingStartPromise = null
          promise
        } else {
          null
        }
      }
      timedOutPromise?.reject(
        "E_LOCATION_START_TIMEOUT",
        "The Android location foreground service did not start in time"
      )
    }
    handler.postDelayed(startTimeout, 10000L)

    val intervalMs =
      config?.getDoubleOrNull("minimumIntervalMs")?.toLong() ?: 15000L
    val distanceMeters =
      config?.getDoubleOrNull("minimumDistanceMeters")?.toFloat() ?: 20f
    val intent = Intent(reactContext, DriverLocationService::class.java).apply {
      action = DriverLocationService.ACTION_START
      putExtra(DriverLocationService.EXTRA_INTERVAL_MS, intervalMs)
      putExtra(DriverLocationService.EXTRA_DISTANCE_METERS, distanceMeters)
    }

    try {
      ContextCompat.startForegroundService(reactContext, intent)
    } catch (error: Exception) {
      completeTrackingStart(false, error.message ?: "Unable to start location service")
    }
  }

  private fun ReadableMap.getDoubleOrNull(key: String): Double? =
    if (hasKey(key) && !isNull(key)) getDouble(key) else null

  fun completeTrackingStart(success: Boolean, message: String? = null) {
    val promise = synchronized(this) {
      pendingStartPromise.also { pendingStartPromise = null }
    }
    if (promise == null) {
      if (!success) {
        emitLocationError(message ?: "Location foreground service failed to start")
      }
      return
    }

    if (success) {
      promise.resolve(true)
    } else {
      promise.reject("E_LOCATION_SERVICE_START", message ?: "Unable to start location service")
    }
  }

  @ReactMethod
  fun stopTracking(promise: Promise) {
    synchronized(this) {
      pendingStartPromise?.reject(
        "E_LOCATION_START_CANCELLED",
        "Location tracking was stopped before the service started"
      )
      pendingStartPromise = null
    }
    reactContext.stopService(Intent(reactContext, DriverLocationService::class.java))
    promise.resolve(true)
  }

  @ReactMethod
  fun getCurrentPosition(timeoutMs: Double, promise: Promise) {
    val status = readPermissionStatus()
    if (!status.foregroundGranted) {
      promise.reject("E_LOCATION_PERMISSION", "Foreground location permission is required")
      return
    }
    if (!status.locationServicesEnabled) {
      promise.reject("E_LOCATION_SERVICES_DISABLED", "Device location services are disabled")
      return
    }

    val location = DriverLocationService.getLastKnownLocation(reactContext, status.preciseGranted)
    if (location == null) {
      promise.reject("E_LOCATION_UNAVAILABLE", "No device location is currently available")
      return
    }
    promise.resolve(locationMap(location))
  }

  fun emitLocation(location: Location) {
    val coords = Arguments.createMap().apply {
      putDouble("latitude", location.latitude)
      putDouble("longitude", location.longitude)
      putDouble("accuracy", location.accuracy.toDouble())
    }
    val params = Arguments.createMap().apply {
      putMap("coords", coords)
      putDouble("timestamp", location.time.toDouble())
    }
    emitEvent(EVENT_LOCATION, params)
  }

  fun emitLocationError(message: String) {
    emitEvent(EVENT_ERROR, Arguments.createMap().apply {
      putString("message", message)
    })
  }

  private fun emitEvent(name: String, params: com.facebook.react.bridge.WritableMap) {
    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(name, params)
    } catch (error: Exception) {
      android.util.Log.w("NativeLocationModule", "Unable to emit $name", error)
    }
  }

  private fun locationMap(location: Location) = Arguments.createMap().apply {
    putDouble("latitude", location.latitude)
    putDouble("longitude", location.longitude)
    putDouble("accuracy", location.accuracy.toDouble())
    putDouble("timestamp", location.time.toDouble())
  }

  private fun hasPermission(permission: String): Boolean =
    ContextCompat.checkSelfPermission(reactContext, permission) ==
      PackageManager.PERMISSION_GRANTED

  private fun isLocationServicesEnabled(): Boolean {
    val locationManager =
      reactContext.getSystemService(android.content.Context.LOCATION_SERVICE) as? LocationManager
        ?: return false
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        locationManager.isLocationEnabled
      } else {
        locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
          locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
      }
    } catch (_: SecurityException) {
      false
    }
  }

  private fun readPermissionStatus() = PermissionStatus(
    foregroundGranted =
      hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION) ||
        hasPermission(Manifest.permission.ACCESS_FINE_LOCATION),
    preciseGranted = hasPermission(Manifest.permission.ACCESS_FINE_LOCATION),
    backgroundGranted =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        hasPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
    locationServicesEnabled = isLocationServicesEnabled()
  )

  private data class PermissionStatus(
    val foregroundGranted: Boolean,
    val preciseGranted: Boolean,
    val backgroundGranted: Boolean,
    val locationServicesEnabled: Boolean
  )

  override fun onCatalystInstanceDestroy() {
    if ((reactContext.applicationContext as? MainApplication)?.nativeLocationModule === this) {
      (reactContext.applicationContext as? MainApplication)?.nativeLocationModule = null
    }
    super.onCatalystInstanceDestroy()
  }
}
