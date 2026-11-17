/**
 * PhoneCountryPrefix
 *
 * The dialling code shown inside a phone field, ahead of the number.
 *
 * ⚠️ It is not a picker, and it does not look like one. There is no chevron
 * because there is nothing to open: choosing a country is multi-country
 * support, which PROJECT_BIBLE.md lists as a future phase and says explicitly
 * not to implement prematurely. A chevron here would promise a sheet that does
 * not exist, which is worse than not offering one.
 *
 * ⚠️ It is also display only. The code is not prepended to what the user types
 * and never reaches a service — `normalisePhone` still sends the digits entered
 * and nothing else, so no backend contract changes. What this says is which
 * country the app serves, which on a single-country product is the whole truth.
 *
 * When multi-country arrives, this is the component that grows a chevron and an
 * `onPress`, and `AppConfig.phone.dialCode` becomes a default rather than a
 * constant. Nothing else on the screen has to move.
 */

import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppConfig } from '@/core/config/AppConfig';
import { Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

/**
 * Relative rather than aliased, and required rather than imported: Metro's
 * resolver is configured for source extensions, so `@/features/...` does not
 * resolve an image.
 *
 * A drawn flag rather than the emoji one. Emoji flags render as two letters on
 * most Android builds, and CLAUDE.md forbids emoji as interface furniture in
 * any case.
 *
 * Drawn, and not cropped. The first version of this file was a crop with the
 * flag sitting in the bottom corner of a white canvas behind twenty-one rows of
 * padding, which rendered as a squashed flag low in its box — the box was
 * centred correctly the whole time, and nudging the layout would have hidden the
 * fault rather than fixed it.
 */
const FLAG = require('../assets/flag-in.png');

/** The artwork as drawn — the standard 5:4 flag ratio. */
const FLAG_ASPECT = 20 / 16;

export interface PhoneCountryPrefixProps {
  testID?: string;
}

function PhoneCountryPrefixComponent({ testID }: PhoneCountryPrefixProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing.xs }]} testID={testID}>
      <Image
        source={FLAG}
        style={{
          width: theme.spacing.xl,
          aspectRatio: FLAG_ASPECT,
          borderRadius: theme.radius.sm,
          /*
            An edge, because the middle band is white and the field it sits on
            is `surface`. Without it the flag reads as two loose stripes rather
            than as one object, and in dark mode it loses its top and bottom
            instead of its middle. A token, so it follows the theme either way.
          */
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.colors.border,
        }}
        // Decoration. The code beside it is the information, and a screen
        // reader announcing "flag" before "+91" adds nothing.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <Text variant="body">{AppConfig.phone.dialCode}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export const PhoneCountryPrefix = memo(PhoneCountryPrefixComponent);
