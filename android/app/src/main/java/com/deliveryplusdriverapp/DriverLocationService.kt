package com.deliveryplusdriverapp

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class DriverLocationService : Service() {

  companion object {
    const val ACTION_START = "com.deliveryplusdriverapp.action.START_LOCATION"
    const val ACTION_STOP = "com.deliveryplusdriverapp.action.STOP_LOCATION"
    const val EXTRA_INTERVAL_MS = "location_interval_ms"
    const val EXTRA_DISTANCE_METERS = "location_distance_meters"
    const val CHANNEL_ID = "driver_location_channel"
    const val NOTIFICATION_ID = 4107

    @Volatile
    var isRunning: Boolean = false
      private set

    fun getLastKnownLocation(context: Context, precise: Boolean): Location? {
      val locationManager =
        context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
      val providers = if (precise) {
        listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
      } else {
        listOf(LocationManager.NETWORK_PROVIDER)
      }

      return providers.firstNotNullOfOrNull { provider ->
        try {
          locationManager.getLastKnownLocation(provider)
        } catch (_: SecurityException) {
          null
        } catch (_: IllegalArgumentException) {
          null
        }
      }
    }
  }

  private var locationManager: LocationManager? = null
  private var listener: LocationListener? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopTracking()
        return START_NOT_STICKY
      }
      ACTION_START, null -> {
        try {
          startTracking(intent)
        } catch (error: Exception) {
          val message = error.message ?: "Unable to start location tracking"
          stopTracking()
          (application as? MainApplication)?.nativeLocationModule
            ?.completeTrackingStart(false, message)
          return START_NOT_STICKY
        }
      }
    }
    return START_STICKY
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Driver location tracking",
        NotificationManager.IMPORTANCE_LOW
      )
      getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("DeliveryPlus driver tracking")
      .setContentText("Your location is shared while you are online.")
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .build()
  }

  private fun startTracking(intent: Intent?) {
    val coarseGranted = hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
    val preciseGranted = hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)
    if (!coarseGranted && !preciseGranted) {
      throw SecurityException("Foreground location permission is required")
    }

    val manager =
      getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        ?: throw IllegalStateException("Android location service is unavailable")
    if (!isLocationEnabled(manager)) {
      throw IllegalStateException("Enable device location services to go online")
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        buildNotification(),
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
      )
    } else {
      startForeground(NOTIFICATION_ID, buildNotification())
    }

    listener?.let { previousListener ->
      locationManager?.removeUpdates(previousListener)
    }
    locationManager = manager
    val intervalMs = intent?.getLongExtra(EXTRA_INTERVAL_MS, 15000L) ?: 15000L
    val distanceMeters = intent?.getFloatExtra(EXTRA_DISTANCE_METERS, 20f) ?: 20f
    val minimumInterval = intervalMs.coerceAtLeast(5000L)
    val minimumDistance = distanceMeters.coerceAtLeast(0f)
    val providers = if (preciseGranted) {
      listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
    } else {
      listOf(LocationManager.NETWORK_PROVIDER)
    }.filter { provider ->
      try {
        manager.isProviderEnabled(provider)
      } catch (_: SecurityException) {
        false
      } catch (_: IllegalArgumentException) {
        false
      }
    }
    if (providers.isEmpty()) {
      throw IllegalStateException("No enabled location provider is available")
    }

    val activeListener = object : LocationListener {
      override fun onLocationChanged(location: Location) {
        (application as? MainApplication)?.nativeLocationModule?.emitLocation(location)
      }

      override fun onProviderEnabled(provider: String) = Unit

      override fun onProviderDisabled(provider: String) {
        (application as? MainApplication)?.nativeLocationModule
          ?.emitLocationError("The $provider location provider was disabled")
      }

      override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
    }
    listener = activeListener

    providers.forEach { provider ->
      manager.requestLocationUpdates(
        provider,
        minimumInterval,
        minimumDistance,
        activeListener,
        Looper.getMainLooper()
      )
    }

    isRunning = true
    (application as? MainApplication)?.nativeLocationModule?.completeTrackingStart(true)
  }

  private fun hasPermission(permission: String): Boolean =
    ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

  private fun isLocationEnabled(manager: LocationManager): Boolean {
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        manager.isLocationEnabled
      } else {
        manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
          manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
      }
    } catch (_: SecurityException) {
      false
    }
  }

  private fun stopTracking() {
    listener?.let { activeListener ->
      locationManager?.removeUpdates(activeListener)
    }
    listener = null
    locationManager = null
    isRunning = false
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    listener?.let { activeListener ->
      locationManager?.removeUpdates(activeListener)
    }
    listener = null
    locationManager = null
    isRunning = false
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
