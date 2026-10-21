/**
 * AppErrorBoundary
 *
 * Catches a screen that fails to render and offers a calm way back, instead of
 * letting the failure close the app (PROJECT_BIBLE.md section 57, "Crash
 * Handling"; section 47, "Do not show blank screens").
 *
 * It wraps the navigation tree inside AppRoot. Inside the theme and safe-area
 * providers, so the fallback is themed and inset like any other screen; inside
 * Redux, so the session outlives the failure — "Try again" remounts the
 * navigators, and a signed-in user lands on the first screen of their own side
 * of the app, still signed in.
 *
 * A failure is recorded once, through `recordError` (`source: 'render'`, not
 * fatal — the app carries on), and then the fallback is shown. The fallback
 * never shows the error's message: it is developer-facing, and section 49
 * forbids a raw error reaching the user.
 *
 * A class because React offers error boundaries only as classes.
 *
 * Not ErrorState, though it borrows its look. ErrorState presents an AppError —
 * a service's answer, whose kind picks the icon, the title and whether retry is
 * offered. A render failure is a fault in the app rather than an answer from a
 * service: there is no AppError to present, retry is always worth offering
 * because it re-renders rather than re-fetches, and the title is the only
 * heading on the screen, so it is announced as one. The icon, tone and title
 * come from the `unknown` presentation, so the two read as the same kind of
 * message.
 *
 * ⚠️ Keep the fallback to the simplest shared primitives. If it threw as well,
 * the error would escape to React Native and a release build would close.
 *
 * ⚠️ Render failures only. A press handler, timer or callback that throws is
 * the global handler's (`app/globalErrorHandler.ts`).
 */

import React, { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/shared/components/Button';
import { ERROR_PRESENTATION } from '@/shared/components/errorPresentation';
import { Icon } from '@/shared/components/Icon';
import { Screen } from '@/shared/components/Screen';
import { Text } from '@/shared/components/Text';
import { recordError } from '@/shared/services/telemetry';
import { useTheme } from '@/shared/theme';

/**
 * What the fallback says, frozen as a feature's copy file is. It lives here
 * because it belongs to no feature.
 *
 * The message tells the user what to do and claims nothing it cannot know —
 * not that their data is safe, not that anyone has been told.
 */
export const APP_ERROR_FALLBACK_COPY = Object.freeze({
  message:
    'Sorry — the app hit a problem. Try again, and if it keeps happening, restart the app.',
  retry: 'Try again',
});

export interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasFailed: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasFailed: true };
  }

  // Recorded here rather than in getDerivedStateFromError, which runs during
  // render and must stay free of side effects; this runs once for each failure
  // that reaches the screen.
  componentDidCatch(error: unknown): void {
    recordError(error, { fatal: false, source: 'render' });
  }

  private readonly retry = (): void => {
    this.setState({ hasFailed: false });
  };

  render(): ReactNode {
    if (this.state.hasFailed) {
      return <AppErrorFallback onRetry={this.retry} />;
    }

    return this.props.children;
  }
}

interface AppErrorFallbackProps {
  onRetry: () => void;
}

function AppErrorFallback({ onRetry }: AppErrorFallbackProps) {
  const theme = useTheme();
  const presentation = ERROR_PRESENTATION.unknown;

  return (
    // Scrollable so that at 360dp with the largest font the button scrolls into
    // reach rather than off the bottom; centred while it all fits.
    <Screen scrollable contentContainerStyle={styles.centred} testID="app-error-fallback">
      <View
        // It replaces whatever had focus. Announced, or a screen reader user is
        // left on nothing and hears nothing.
        accessibilityLiveRegion="polite"
        style={[styles.content, { padding: theme.spacing.xl, gap: theme.spacing.md }]}>
        <Icon name={presentation.icon} size="xxl" color={presentation.tone} />

        <View style={[styles.copy, { gap: theme.spacing.xs }]}>
          <Text variant="h3" align="center" accessibilityRole="header">
            {presentation.title}
          </Text>
          <Text variant="body" color="textSecondary" align="center">
            {APP_ERROR_FALLBACK_COPY.message}
          </Text>
        </View>

        <PrimaryButton label={APP_ERROR_FALLBACK_COPY.retry} icon="retry" onPress={onRetry} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centred: {
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  copy: {
    alignItems: 'center',
  },
});
