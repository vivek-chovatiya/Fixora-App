/**
 * OnboardingPage
 *
 * One page of the introduction: artwork, the promise, and the permission that
 * belongs to it.
 *
 * It scrolls vertically inside the horizontal pager. That is not caution about
 * hypothetical devices — a page carries an illustration, a two-line heading, a
 * paragraph and a permission card with two buttons, which does not fit 640dp of
 * height. Without this the permission actions are simply below the fold and
 * unreachable, on a screen whose entire purpose is asking for them.
 *
 * The artwork is sized from the space the page was given rather than from a
 * constant, so it is generous on a tall phone and shrinks out of the way on a
 * short one instead of pushing the words off the bottom.
 */

import React, { memo, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { OnboardingPageCopy } from '@/features/onboarding/constants/onboardingCopy';
import { OnboardingIllustration } from '@/features/onboarding/components/OnboardingIllustration';
import { PermissionPrompt } from '@/features/onboarding/components/PermissionPrompt';
import { Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface OnboardingPageProps {
  copy: OnboardingPageCopy;
  /** Position in the flow, handed back so the screen knows where to go next. */
  index: number;
  /** Moves the introduction on from this page. Must be stable. */
  onAdvance: (index: number) => void;
  /** The pager's measured width. Each page is exactly one of these wide. */
  width: number;
  /** The pager's measured height, which is what the artwork is sized against. */
  height: number;
}

/**
 * How much of a page's height the artwork may take.
 *
 * Capped in both directions: a share of the height so it cannot crowd the words
 * on a short screen, and a share of the width so it cannot become a circle wider
 * than the phone on a tall one.
 *
 * Both shares went up when the Next button left the footer. That button's space
 * became slack the centred column split evenly, which read as a hole between the
 * permission card and the dots; giving it to the artwork puts it somewhere the
 * eye expects it.
 *
 * The width share is the one that matters on an ordinary phone: at 420dp wide
 * and 770dp of pager, the width cap binds first, so raising the height share
 * alone changed nothing at all.
 */
const ARTWORK_HEIGHT_SHARE = 0.44;
const ARTWORK_WIDTH_SHARE = 0.72;

function OnboardingPageComponent({
  copy,
  index,
  onAdvance,
  width,
  height,
}: OnboardingPageProps) {
  const theme = useTheme();

  // Bound to this page so the prompt can stay ignorant of where it sits.
  const handleAnswered = useCallback(() => onAdvance(index), [onAdvance, index]);

  const artwork = Math.max(
    0,
    Math.min(height * ARTWORK_HEIGHT_SHARE, width * ARTWORK_WIDTH_SHARE),
  );

  return (
    <View style={{ width }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: theme.screenPadding,
            paddingTop: theme.screenPadding,
            gap: theme.spacing.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.column, { maxWidth: theme.maxContentWidth, gap: theme.spacing.xxl }]}>
          {artwork > 0 ? (
            <OnboardingIllustration
              name={copy.id}
              size={artwork}
              testID={`onboarding-illustration-${copy.id}`}
            />
          ) : null}

          <View style={[styles.words, { gap: theme.spacing.sm }]}>
            {/*
              The heading is a heading to assistive technology as well as to the
              eye, so a screen reader can jump between pages by their titles.
            */}
            <Text variant="h1" align="center" accessibilityRole="header">
              {copy.title}
            </Text>
            <Text variant="body" color="textSecondary" align="center">
              {copy.body}
            </Text>
          </View>

          <PermissionPrompt
            copy={copy.permission}
            onAnswered={handleAnswered}
            testID={`onboarding-permission-${copy.id}`}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    // Grows to fill a tall screen so the page is centred, and grows past it on a
    // short one so everything stays reachable by scrolling.
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // None at the foot: the footer below supplies its own, and padding on both
    // sides of the same seam is what made the gap read double.
    paddingBottom: 0,
  },
  column: {
    width: '100%',
    alignItems: 'center',
  },
  words: {
    width: '100%',
  },
});

export const OnboardingPage = memo(OnboardingPageComponent);
