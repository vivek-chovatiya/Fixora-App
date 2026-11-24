import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/shared/components';
import { notificationApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';

/** Header bell with unread count; refreshes whenever its screen gains focus. */
export function HeaderBell({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      notificationApi
        .unreadCount()
        .then(r => active && setCount(r.unreadCount))
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <Pressable testID="header-bell" accessibilityRole="button" accessibilityLabel={`Notifications, ${count} unread`} onPress={onPress} hitSlop={10} style={{ marginRight: theme.spacing.lg }}>
      <Icon name="notifications" size="lg" color="textPrimary" />
      {count > 0 ? (
        <View style={{ position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: theme.colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="overline" color="textInverse" testID="header-bell-count">
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
