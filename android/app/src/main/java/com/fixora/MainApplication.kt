package com.fixora

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    createDefaultNotificationChannel()
    loadReactNative(this)
  }

  /**
   * The channel push messages arrive on (phase5-contract.md section 6).
   *
   * Created here, at every start of the process, rather than when JavaScript first
   * hears of push: a message can arrive while the app is closed, and Android 8+
   * drops a notification whose channel does not exist yet. Creating a channel that
   * already exists only refreshes its name and description, never the importance
   * or sound the person may have changed in Settings, so doing it every time is
   * safe and keeps the name current.
   *
   * It is created whether or not Firebase is configured: an empty channel is
   * invisible until something is posted to it, and it means switching push on
   * later needs nothing here.
   *
   * High importance, because the backend sends every message as high priority and
   * each one is about work somebody is waiting on — a request accepted, a new
   * request for a vendor.
   *
   * ⚠️ The id is `R.string.notification_channel_default_id` ("fixora-default"),
   * which the manifest's default and the backend's push service also use. Change
   * all three or none.
   */
  private fun createDefaultNotificationChannel() {
    // Channels exist from Android 8 (API 26); minSdk is 24.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val channel =
      NotificationChannel(
        getString(R.string.notification_channel_default_id),
        getString(R.string.notification_channel_default_name),
        NotificationManager.IMPORTANCE_HIGH,
      ).apply { description = getString(R.string.notification_channel_default_description) }

    getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
  }
}
