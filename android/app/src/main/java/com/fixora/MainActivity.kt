package com.fixora

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Starts with no saved fragment state, deliberately.
   *
   * `react-native-screens` gives `ScreenFragment` a no-argument constructor that
   * does nothing but throw: a screen only means anything alongside the JavaScript
   * that describes it, and Android's `FragmentManager` calls that constructor
   * when it rebuilds fragments from a saved `Bundle` — before React Native has
   * started, with no screen to attach. The result is the crash seen during Phase
   * 3C-2 verification, "Screen fragments should never be restored."
   *
   * Passing `null` to `super.onCreate` withholds that saved state, so nothing is
   * restored and nothing is thrown. Nothing is lost by it: React Navigation
   * rebuilds the stack from JavaScript, which is where this application's
   * navigation state lives in the first place.
   *
   * The manifest's `configChanges` already keeps rotation, keyboard and dark mode
   * from recreating this activity at all. What is left is what it cannot cover —
   * a density or display-size change, "Don't keep activities", and the activity
   * being restored after the process was killed in the background — which is the
   * ordinary end of any app left alone for long enough.
   *
   * See react-native-screens issue #17 for the upstream instruction.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Fixora"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
