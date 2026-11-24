/**
 * Screen
 *
 * Standard screen container: themed background, safe area, consistent padding,
 * optional scrolling with pull-to-refresh, and an optional sticky footer for the
 * primary action.
 */

import React, { useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/shared/theme';

export interface ScreenProps {
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Apps targeting SDK 35+ are drawn edge-to-edge on Android 15+, where
 * `windowSoftInputMode="adjustResize"` no longer shrinks the window. Without
 * padding the keyboard covers the lower inputs, so those versions avoid it here.
 */
const ANDROID_EDGE_TO_EDGE_API = 35;
const keyboardBehavior: 'padding' | undefined =
  Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= ANDROID_EDGE_TO_EDGE_API) ? 'padding' : undefined;

export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshing = false,
  onRefresh,
  footer,
  edges = ['bottom'],
  contentStyle,
  testID,
}: PropsWithChildren<ScreenProps>) {
  const theme = useTheme();
  const padding: ViewStyle = padded ? { padding: theme.screenPadding, gap: theme.spacing.lg } : {};
  // KeyboardAvoidingView measures itself relative to its parent, but keyboard
  // coordinates are window-relative; the offset is where this screen starts in the window
  // (below the navigation header and status bar).
  const wrapperRef = useRef<View>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const measureOffset = () => {
    if (!keyboardBehavior) return;
    wrapperRef.current?.measureInWindow((_x, y) => setKeyboardOffset(current => (Math.abs(current - y) > 1 ? y : current)));
  };

  const body = scroll ? (
    <ScrollView
      testID={testID}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[padding, { paddingBottom: theme.spacing.huge }, contentStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        ) : undefined
      }>
      {children}
    </ScrollView>
  ) : (
    <View testID={testID} style={[{ flex: 1 }, padding, contentStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View ref={wrapperRef} onLayout={measureOffset} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior} keyboardVerticalOffset={keyboardOffset}>
        {body}
        {footer ? (
          <View
            style={{
              padding: theme.screenPadding,
              gap: theme.spacing.sm,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
