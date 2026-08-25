/**
 * OnboardingIllustration
 *
 * The artwork slot for each onboarding page.
 *
 * ⚠️ A stand-in. The supplied design uses illustrated scenes the project does
 * not own yet, and there is no vector renderer to draw them with —
 * `react-native-svg` is deliberately not a dependency. What is here composes the
 * theme and registry glyphs into something with the same weight and silhouette
 * as the real artwork: a large tinted round stage with the subject centred and
 * two smaller supporting motifs orbiting it.
 *
 * The logo is the exception: where a scene's subject is the app itself, it is
 * the real mark drawn by BrandMark, not a glyph chosen to resemble one.
 *
 * The point of the component is the seam. Every page asks for an illustration by
 * name and reserves a square for it; none of them knows what is inside. Dropping
 * in `<Image>` or SVG later changes this file alone, and no screen's layout
 * moves — which is exactly what "replaceable" has to mean to be worth claiming.
 *
 * Decorative throughout. The heading and body carry the meaning, so a screen
 * reader is told nothing here rather than being read a list of shapes.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandMark } from '@/shared/components/BrandMark';
import { Icon } from '@/shared/components/Icon';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

import type { OnboardingPageCopy } from '@/features/onboarding/constants/onboardingCopy';

export interface OnboardingIllustrationProps {
  /** Which page's scene to draw. Keyed by page identity, never by index. */
  name: OnboardingPageCopy['id'];
  /** Longest edge. The caller owns how much room the artwork gets. */
  size: number;
  testID?: string;
}

interface Motif {
  icon: IconName;
  tone: keyof ColorTokens;
}

interface Scene {
  /**
   * `mark` draws the Fixora logo through BrandMark rather than a glyph.
   *
   * The first page is the app introducing itself, so its subject is the app.
   * Naming it rather than reaching for a look-alike glyph is what keeps a second
   * approximation of the logo from existing.
   */
  subject: IconName | 'mark';
  supporting: readonly [Motif, Motif];
}

/**
 * What each page is about, said in glyphs.
 *
 * The subject is the page's own idea; the two supporting motifs are what the
 * final artwork would show around it. Tones come from the semantic palette, so
 * the scenes stay legible when the theme flips.
 */
const SCENES: Readonly<Record<OnboardingPageCopy['id'], Scene>> = {
  services: {
    subject: 'mark',
    supporting: [
      { icon: 'verified', tone: 'success' },
      { icon: 'business', tone: 'primary' },
    ],
  },
  compare: {
    subject: 'customer',
    supporting: [
      { icon: 'star', tone: 'warning' },
      { icon: 'search', tone: 'primary' },
    ],
  },
  track: {
    subject: 'requests',
    supporting: [
      { icon: 'success', tone: 'success' },
      { icon: 'notifications', tone: 'primary' },
    ],
  },
};

function OnboardingIllustrationComponent({ name, size, testID }: OnboardingIllustrationProps) {
  const theme = useTheme();

  const scene = SCENES[name];

  // Everything is a fraction of the size the caller granted, so the scene is
  // whole at 360dp and at 1080dp without a breakpoint anywhere.
  const stage = size;
  const subject = size * 0.34;
  const badge = size * 0.22;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { width: stage, height: stage }]}
      testID={testID}>
      <View
        style={[
          styles.stage,
          {
            width: stage,
            height: stage,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.primarySubtle,
          },
        ]}
      />

      <View
        style={[
          styles.centred,
          {
            width: subject * 1.9,
            height: subject * 1.9,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.surface,
          },
        ]}>
        {scene.subject === 'mark' ? (
          <BrandMark size="lg" />
        ) : (
          <Icon name={scene.subject} size={subject} color="primary" />
        )}
      </View>

      {/*
        Placed on the diagonal rather than at the cardinal points, which reads as
        composed rather than as a diagram.
      */}
      <Badge
        motif={scene.supporting[0]}
        size={badge}
        style={{ top: stage * 0.08, right: stage * 0.06 }}
      />
      <Badge
        motif={scene.supporting[1]}
        size={badge}
        style={{ bottom: stage * 0.1, left: stage * 0.04 }}
      />
    </View>
  );
}

interface BadgeProps {
  motif: Motif;
  size: number;
  style: { top?: number; bottom?: number; left?: number; right?: number };
}

function Badge({ motif, size, style }: BadgeProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.badge,
        style,
        theme.shadows.sm,
        {
          width: size,
          height: size,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.surface,
        },
      ]}>
      <Icon name={motif.icon} size={size * 0.55} color={motif.tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    position: 'absolute',
  },
  centred: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const OnboardingIllustration = memo(OnboardingIllustrationComponent);
