/**
 * Screen
 *
 * The outermost container for every screen: safe-area insets, background and
 * page padding in one place.
 *
 * Presentation only. It does not fetch, and it does not decide between loading,
 * empty and error — screens compose Loader, EmptyState and ErrorState inside it.
 * Folding those into Screen would force every screen through one opinionated
 * shape, and half of them need the header visible while the body loads.
 *
 * `edges` defaults to top and bottom. Left and right are omitted because page
 * padding already covers horizontal insets on all but landscape notched devices.
 */

import React, { memo, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme, type ColorTokens } from '@/shared/theme';

export interface ScreenProps {
  children: ReactNode;
  /**
   * A bar pinned above the content: a back control, a screen title, a filter row.
   *
   * It sits outside the scroll area and outside the page padding, so it stays
   * put while the body scrolls beneath it and can run edge to edge if it wants
   * to. That is the difference that matters — a back control placed inside a
   * vertically-centred body drifts to the middle of the screen, and one placed
   * inside a scroll view leaves with the content.
   */
  header?: ReactNode;
  /** Wraps content in a ScrollView. Never use with a FlatList — nest no lists. */
  scrollable?: boolean;
  /** Applies the standard page padding. Disable for edge-to-edge lists. */
  padded?: boolean;
  edges?: readonly Edge[];
  background?: keyof ColorTokens;
  /** Enables pull-to-refresh. Requires `scrollable` (PROJECT_BIBLE.md section 23). */
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** Lifts content above the keyboard. Enable on screens with text inputs. */
  keyboardAvoiding?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom'];

function ScreenComponent({
  children,
  header,
  scrollable = false,
  padded = true,
  edges = DEFAULT_EDGES,
  background = 'background',
  onRefresh,
  isRefreshing = false,
  keyboardAvoiding = false,
  contentContainerStyle,
  style,
  testID,
}: ScreenProps) {
  const theme = useTheme();

  const padding = padded ? { padding: theme.screenPadding } : null;

  const body = scrollable ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.scrollContent, padding, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, padding, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.fill, { backgroundColor: theme.colors[background] }, style]}
      testID={testID}>
      {/*
        Above the keyboard-avoiding view, not inside it: the bar is already clear
        of the keyboard, and lifting it too would push it off the top of the
        screen as the keyboard opened.
      */}
      {header}

      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.fill}
          // Padding on both platforms. `windowSoftInputMode="adjustResize"` used
          // to make this unnecessary on Android, but edge-to-edge — which the
          // platform now enforces from Android 15 regardless of the
          // `edgeToEdgeEnabled` build flag — stops the window being resized and
          // hands the keyboard over as an inset instead. Leaving the behaviour
          // unset there made this component a no-op: the keyboard simply covered
          // whatever was beneath it, submit buttons included.
          behavior="padding">
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export const Screen = memo(ScreenComponent);
