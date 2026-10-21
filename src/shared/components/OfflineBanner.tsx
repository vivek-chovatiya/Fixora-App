/**
 * OfflineBanner
 *
 * One strip across the top of the app while the device is offline
 * (PROJECT_BIBLE.md section 49, "Network error … allow Retry"; section 57's
 * shared "Network Errors"). Mounted once, in AppRoot, above the navigators.
 *
 * It is a signal, not a gate. Nothing is blocked and nothing is retried: the
 * screens keep their own "No connection" errors and their own Try again, and
 * this only says, wherever the user is, why things may be failing. When the
 * device is online it renders nothing at all.
 *
 * It sits in the layout rather than over it, so it pushes the app down instead
 * of covering a screen's header and its back control. That is why AppRoot puts
 * the navigators under a SafeAreaProvider of their own, below this strip: a
 * screen's SafeAreaView pads by its provider's overlap with the status bar, and
 * under the app-wide provider every screen would add a second status-bar gap
 * below the banner. The banner pays the status bar's inset itself, and its
 * fill runs up behind the bar.
 *
 * Its look is the network failure's own (`ERROR_PRESENTATION.network`: the
 * offline glyph in the warning tone), on the warning fill StaleNotice uses, so
 * a lost connection reads the same here as on any screen that failed because
 * of it. Said in words beside the glyph, never by colour alone.
 *
 * ⚠️ Announced once, politely, when it appears, and spoken as one block. It is
 * not pressable: there is nothing to do from here, and a control that does
 * nothing is worse than none.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ERROR_PRESENTATION } from '@/shared/components/errorPresentation';
import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { useTheme } from '@/shared/theme';

/**
 * What the banner says, frozen as a feature's copy file is. It lives here
 * because it belongs to no feature.
 *
 * It claims nothing it cannot know: not that nothing works, not when the
 * connection will return. "Some things" is exact — whatever is already on
 * screen stays usable.
 */
export const OFFLINE_BANNER_COPY = Object.freeze({
  title: "You're offline.",
  message: 'Some things may not load until you reconnect.',
});

/** The whole banner as one sentence pair, for a screen reader. */
const SPOKEN = `${OFFLINE_BANNER_COPY.title} ${OFFLINE_BANNER_COPY.message}`;

export interface OfflineBannerProps {
  testID?: string;
}

function OfflineBannerComponent({ testID = 'offline-banner' }: OfflineBannerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();

  if (!isOffline) {
    return null;
  }

  const presentation = ERROR_PRESENTATION.network;

  return (
    <View
      style={{
        paddingTop: insets.top + theme.spacing.sm,
        paddingBottom: theme.spacing.sm,
        paddingHorizontal: theme.screenPadding,
        backgroundColor: theme.colors.warningSubtle,
        borderBottomWidth: theme.borderWidth.hairline,
        borderBottomColor: theme.colors.border,
      }}
      testID={testID}>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={SPOKEN}
        style={[styles.row, { gap: theme.spacing.sm, maxWidth: theme.maxContentWidth }]}>
        <Icon name={presentation.icon} size="md" color={presentation.tone} />
        {/*
          `flex: 1`, not `flexShrink`: a wrapping Text sized by its own content
          in a row can lose its last line at 360dp (WORKING_NOTES section 11).
        */}
        <Text variant="body" style={styles.copy}>
          <Text variant="bodyStrong">{OFFLINE_BANNER_COPY.title}</Text>{' '}
          {OFFLINE_BANNER_COPY.message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  copy: {
    flex: 1,
  },
});

export const OfflineBanner = memo(OfflineBannerComponent);
