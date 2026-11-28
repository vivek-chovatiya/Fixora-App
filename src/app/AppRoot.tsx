/**
 * AppRoot
 *
 * Everything that needs to sit *inside* the providers: the session restore, the
 * themed navigation container and the status bar.
 *
 * Kept separate from App so that App is purely the provider stack, and so this
 * can call useTheme and useAppDispatch — which a component rendering the
 * providers cannot do.
 *
 * The navigation tree sits inside `AppErrorBoundary` (PROJECT_BIBLE.md section
 * 57, "Crash Handling"), so a screen that fails to render is replaced by a
 * themed way back rather than closing the app. The status bar sits outside it,
 * so the fallback keeps the bar the theme chose instead of the platform default.
 *
 * The offline banner (sections 49 and 57) sits above the navigators, inside the
 * boundary, and pushes them down while it shows. Two things keep every screen
 * correct under it, and both are measured rather than assumed:
 * - The navigators have a SafeAreaProvider of their own. A screen's
 *   SafeAreaView pads by its provider's overlap with the status bar; under the
 *   app-wide provider it would add a second status-bar gap below the banner,
 *   which has already paid that inset itself.
 * - The banner's height is handed down as the window offset, which `Screen`
 *   gives its KeyboardAvoidingView (shared/components/windowOffset.ts).
 *
 * ⚠️ Nothing is retried when the connection returns. Each screen keeps its own
 * Try again; a reload from here would hit every mounted screen at once.
 *
 * Push notifications (phase5-contract.md section 6.3) are handled here for the
 * life of the app (`usePushNotifications`), because a tap has to open a screen
 * from outside every screen: the container is given `navigationRef` for that
 * alone, and the hook's callback as `onReady` / `onStateChange`, so a tap held
 * until the role's stack is mounted is opened then. With push off they do
 * nothing.
 *
 * ⚠️ Those two props, not listeners on `navigationRef`. The container below is
 * re-mounted on every change of language, and a listener added to the ref
 * while a container is mounted goes with that container (see
 * `usePushNotifications`).
 *
 * The app's language (phase5-contract.md section 7, 28/11/2026) is applied
 * here too, in two ways:
 * - Nothing below the status bar is drawn until the saved language has been
 *   read (`restoreSavedLocale`, started by `bootstrapApp`), so the first screen
 *   — the splash included — is never drawn in English and then redrawn. The
 *   wait is capped (`AppConfig.locale.restoreTimeoutMs`): a read that never
 *   answers starts the app in English with the chooser, as a first launch
 *   does, rather than leaving this blank page up for ever.
 * - The tree inside the error boundary is keyed by the language, so changing it
 *   re-mounts every screen at once and each reads its copy again. Where the
 *   user was is kept: the navigation state at the moment of the change is
 *   handed to the new container as its `initialState`, so changing the
 *   language from a profile lands back on that profile, not on the first tab.
 *
 * ⚠️ The key is the language alone. Keying the session restore above it as
 * well would re-read the stored session on every change of language, and the
 * providers above AppRoot (store, theme, toasts) must survive it untouched.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { NavigationContainer, type NavigationState } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppDispatch } from '@/app/hooks';
import { getLocaleState, subscribeLocale, type LocaleState } from '@/core/i18n';
import { restoreSession } from '@/features/auth/state/authThunks';
import { startRestoringSavedLocale } from '@/features/language/state/localeChoice';
import { usePushNotifications } from '@/features/notifications/hooks/usePushNotifications';
import { navigationRef } from '@/navigation/navigationRef';
import { createNavigationTheme } from '@/navigation/navigationTheme';
import { RootNavigator } from '@/navigation/RootNavigator';
import { AppErrorBoundary, OfflineBanner, WindowOffsetContext } from '@/shared/components';
import { useTheme } from '@/shared/theme';

/**
 * The locale store as AppRoot needs it: the state, and — captured at the
 * moment the language changes, before the tree is re-mounted — where the user
 * was, for the new container to open on.
 *
 * Its own subscription rather than `useSyncExternalStore`, because the
 * navigation state has to be read while the old container is still mounted:
 * by the time a render saw the new language, the key would already have
 * thrown that container away.
 */
function useLanguageMount(): { state: LocaleState; keptNavigation: NavigationState | undefined } {
  const [state, setState] = useState<LocaleState>(getLocaleState);
  const mountedLocale = useRef(state.locale);
  const keptNavigation = useRef<NavigationState | undefined>(undefined);

  useEffect(() => {
    const follow = () => {
      const next = getLocaleState();
      if (next.locale !== mountedLocale.current) {
        mountedLocale.current = next.locale;
        // Not ready when no navigator is mounted — the first-launch chooser, or
        // the splash — and then there is nowhere to keep.
        keptNavigation.current = navigationRef.isReady()
          ? (navigationRef.getRootState() as NavigationState | undefined)
          : undefined;
      }
      setState(next);
    };
    // A change between the first render and this subscription is not missed.
    follow();
    // Belt to `bootstrapApp`'s braces: one read, shared, whoever asks first.
    startRestoringSavedLocale();
    return subscribeLocale(follow);
  }, []);

  return { state, keptNavigation: keptNavigation.current };
}

export function AppRoot() {
  const theme = useTheme();
  const dispatch = useAppDispatch();

  const pushNavigationChanged = usePushNotifications();

  const { state: language, keptNavigation } = useLanguageMount();

  // Runs once. Until it resolves, auth status is `bootstrapping` and the splash
  // screen is shown, so the login screen never flashes before a stored session
  // is found.
  useEffect(() => {
    void restoreSession(dispatch);
  }, [dispatch]);

  // Zero while online: the wrapper below is empty when the banner is hidden.
  const [bannerHeight, setBannerHeight] = useState(0);
  const handleBannerLayout = useCallback((event: LayoutChangeEvent) => {
    setBannerHeight(event.nativeEvent.layout.height);
  }, []);

  const statusBar = (
    <StatusBar
      barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
      backgroundColor={theme.colors.background}
    />
  );

  // The saved language is one storage read away: an empty page of the theme's
  // own colour for that moment, never a screen in a language about to change.
  if (!language.isRestored) {
    return (
      <>
        {statusBar}
        <View
          style={[styles.pending, { backgroundColor: theme.colors.background }]}
          testID="app-language-pending"
        />
      </>
    );
  }

  return (
    <>
      {statusBar}
      <AppErrorBoundary key={language.locale}>
        <View onLayout={handleBannerLayout}>
          <OfflineBanner />
        </View>
        <WindowOffsetContext.Provider value={bannerHeight}>
          <SafeAreaProvider>
            <NavigationContainer
              ref={navigationRef}
              theme={createNavigationTheme(theme)}
              initialState={keptNavigation}
              onReady={pushNavigationChanged}
              onStateChange={pushNavigationChanged}>
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </WindowOffsetContext.Provider>
      </AppErrorBoundary>
    </>
  );
}

const styles = StyleSheet.create({
  pending: {
    flex: 1,
  },
});
