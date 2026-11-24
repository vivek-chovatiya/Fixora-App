import React, { memo } from 'react';
import { Pressable, View } from 'react-native';

import { CATEGORY_ICON_SUGGESTIONS } from '@/features/admin/constants';
import { DynamicIcon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

/** Visual picker for a category glyph, so admins never type icon library names. */
export const IconPicker = memo(function IconPicker({ value, onChange }: { value: string; onChange: (glyph: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label" color="textSecondary">
        Icon
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {CATEGORY_ICON_SUGGESTIONS.map(glyph => {
          const selected = glyph === value;
          return (
            <Pressable
              key={glyph}
              testID={`icon-option-${glyph}`}
              accessibilityRole="button"
              accessibilityLabel={glyph.replace(/-/g, ' ')}
              accessibilityState={{ selected }}
              onPress={() => onChange(glyph)}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                backgroundColor: selected ? theme.colors.primarySubtle : pressed ? theme.colors.surfaceAlt : theme.colors.surface,
              })}>
              <DynamicIcon glyph={glyph} size="md" color={selected ? 'primary' : 'textSecondary'} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});
