/**
 * RoleCard
 *
 * One of the two choices on the entry screen: an illustration, the role, what
 * it is for, and the outcome it leads to.
 *
 * ⚠️ A card is a route and nothing else. It authenticates nobody and stores
 * nothing — see AuthEntryScreen for why a tap here is worth exactly nothing.
 *
 * The whole card is the target. The circle at the trailing edge looks like a
 * button and deliberately is not one: nesting a second pressable inside this
 * one would give a screen reader two ways to do the same thing and a sighted
 * user a small target beside a large one. It is hidden from assistive
 * technology for the same reason the chevron always was.
 *
 * Everything that differs between the two cards is a tone, and a tone is a pair
 * of colour tokens. That is what keeps the vendor card from being a second
 * design: it is this one, in green.
 */

import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Card, Icon, Text } from '@/shared/components';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

export type RoleCardTone = 'customer' | 'vendor';

interface ToneStyle {
  /** Ink for the glyph, the badge label and the chevron. */
  accent: keyof ColorTokens;
  /** Fill behind the glyph and the badge. */
  subtle: keyof ColorTokens;
  icon: IconName;
  /**
   * Relative rather than aliased, and required rather than imported: Metro's
   * resolver is configured for source extensions, so `@/features/...` does not
   * resolve an image.
   *
   * The artwork arrived as opaque crops with the page background baked in, and
   * was cut to a rounded tile with real alpha before landing here — see the
   * generator note in the commit. Without that the tiles are white squares on a
   * dark card.
   */
  art: number;
}

const TONES: Readonly<Record<RoleCardTone, ToneStyle>> = {
  customer: {
    accent: 'primary',
    subtle: 'primarySubtle',
    icon: 'customer',
    art: require('../assets/role-customer.png'),
  },
  vendor: {
    // The existing success pair, not a new green. A second green a few points
    // away from this one would be a token nobody could choose between.
    accent: 'success',
    subtle: 'successSubtle',
    icon: 'business',
    art: require('../assets/role-vendor.png'),
  },
};

/** The illustration as drawn: a rounded tile, slightly taller than it is wide. */
const ART_ASPECT = 96 / 110;

export interface RoleCardProps {
  tone: RoleCardTone;
  title: string;
  description: string;
  /** The outcome, shown as a badge. The title already names the role. */
  badge: string;
  hint: string;
  onPress: () => void;
  testID: string;
}

function RoleCardComponent({
  tone,
  title,
  description,
  badge,
  hint,
  onPress,
  testID,
}: RoleCardProps) {
  const theme = useTheme();
  const palette = TONES[tone];

  // Composed from tokens rather than picked: two touch targets wide, which is
  // enough for the artwork to read as an illustration rather than as a big icon.
  const artWidth = theme.spacing.giant * 2;

  return (
    <Card
      onPress={onPress}
      // Bordered as well as raised: a soft shadow all but disappears against a
      // dark background, and this is the only thing the screen asks for.
      bordered
      // Large surfaces need a wider radius to look equally rounded — the 12dp
      // that suits a list row reads as a near-square corner at this size.
      radiusToken="xl"
      shadow="lg"
      style={{ padding: theme.spacing.md }}
      accessibilityLabel={title}
      accessibilityHint={hint}
      testID={testID}>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <Image
          source={palette.art}
          // Sized by width alone. The aspect keeps the two tiles identical
          // whatever their artwork does, so the pair cannot end up a few points
          // out of step with each other.
          style={{
            width: artWidth,
            aspectRatio: ART_ASPECT,
            borderRadius: theme.radius.lg,
          }}
          // Decoration. The title and description carry the meaning, and a
          // screen reader announcing "illustration of a shop" before "Vendor"
          // would put the picture ahead of the point.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID={`${testID}-art`}
        />

        <View style={[styles.body, { gap: theme.spacing.sm }]}>
          <View style={[styles.heading, { gap: theme.spacing.sm }]}>
            <View
              style={[
                styles.glyph,
                {
                  backgroundColor: theme.colors[palette.subtle],
                  borderRadius: theme.radius.full,
                  width: theme.spacing.xxxl,
                  height: theme.spacing.xxxl,
                },
              ]}>
              <Icon name={palette.icon} size="md" color={palette.accent} />
            </View>

            <Text variant="h3" numberOfLines={1}>
              {title}
            </Text>
          </View>

          <Text variant="body" color="textSecondary">
            {description}
          </Text>

          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors[palette.subtle],
                borderRadius: theme.radius.full,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
              },
            ]}>
            <Text variant="label" color={palette.accent} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.chevron,
            theme.shadows.sm,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.full,
              width: theme.spacing.huge,
              height: theme.spacing.huge,
              /*
                Ringed, not just raised.

                The disc is the card's own surface colour, so on the light theme
                the shadow is the only thing separating the two — and on the
                dark theme shadows do not read at all, which left the chevron
                floating with no disc behind it. A hairline ring costs nothing
                against the light shadow and is the whole affordance in dark.
              */
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.borderStrong,
            },
          ]}
          // Affordance only. The card is the button.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Icon name="forward" size="md" color={palette.accent} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    // Hugs its words rather than stretching across the column, which is what
    // makes it a badge instead of a bar.
    alignSelf: 'flex-start',
  },
  chevron: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const RoleCard = memo(RoleCardComponent);
