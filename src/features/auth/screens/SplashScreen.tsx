/**
 * SplashScreen
 *
 * Shown only while the stored session is being read (PROJECT_BIBLE.md section 7.1).
 *
 * Intentionally plain. The roadmap is explicit that splash should not carry
 * animation, and anything shown here delays first paint for every launch.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppConfig } from '@/core/config/AppConfig';
import { Loader } from '@/shared/components/Loader';
import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';

export function SplashScreen() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background, gap: theme.spacing.lg },
      ]}>
      <Text variant="h1" color="primary">
        {AppConfig.app.name}
      </Text>
      <Loader />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
