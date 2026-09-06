/**
 * HomeGreeting
 *
 * Who is looking at the screen, and roughly when.
 *
 * Two lines rather than one sentence: the time of day is context and the name is
 * the point, so they are set at different weights instead of being run together
 * and given equal emphasis. It is also what keeps a long name from pushing the
 * greeting onto a second line.
 *
 * The avatar is decoration and nothing else — it is not a route to the profile.
 * The bottom bar already owns that, and a second way in would be one more thing
 * to explain and one more target competing with the screen's actual purpose.
 * Being decoration, it is hidden from assistive technology, which is announcing
 * the name a line to its left already.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface HomeGreetingProps {
  greeting: string;
  name: string;
  testID?: string;
}

function HomeGreetingComponent({ greeting, name, testID }: HomeGreetingProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing.md }]} testID={testID}>
      <View style={styles.copy}>
        <Text variant="body" color="textSecondary">
          {greeting}
        </Text>
        {/*
          Set below the prompt beneath it, on purpose. Who the user is, is
          context; what they came to do is the screen. Reversing the two makes a
          home screen that greets well and answers nothing.
        */}
        <Text variant="h2" numberOfLines={1}>
          {name}
        </Text>
      </View>

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Avatar name={name} size="sm" testID={testID ? `${testID}-avatar` : undefined} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    // Takes the slack so the avatar stays pinned to the trailing edge and a long
    // name truncates rather than pushing it off the screen.
    flex: 1,
  },
});

export const HomeGreeting = memo(HomeGreetingComponent);
