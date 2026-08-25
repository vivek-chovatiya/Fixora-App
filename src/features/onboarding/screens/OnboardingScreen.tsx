/**
 * OnboardingScreen
 *
 * The whole introduction, in one route and three pages.
 *
 * One route rather than three, because the three pages are one experience: they
 * share a header, a pager and a footer, and splitting them would mean animating
 * three stack transitions to imitate a swipe the platform already does. It also
 * keeps "which page am I on" as local state instead of something reconstructed
 * from a navigation stack.
 *
 * Finishing and skipping are the same act. Both mark the introduction seen and
 * both land on sign in — the difference is only how much was read, and pretending
 * otherwise would mean showing it again to someone who has already decided they
 * do not want it.
 *
 * Nothing here reaches a backend, because there is nothing to ask one. The only
 * state that outlives the screen is a single local flag.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { createLogger } from '@/core/logger/Logger';
import { getOnboardingStorage } from '@/core/storage/OnboardingStorage';
import { OnboardingPage } from '@/features/onboarding/components/OnboardingPage';
import { OnboardingPagination } from '@/features/onboarding/components/OnboardingPagination';
import { ONBOARDING_COPY } from '@/features/onboarding/constants/onboardingCopy';
import type { AuthStackParamList } from '@/navigation/types';
import { Screen, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const log = createLogger('Onboarding');

const PAGES = ONBOARDING_COPY.pages;

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const theme = useTheme();

  const pagerRef = useRef<ScrollView>(null);

  /** Measured rather than taken from the window, which is wrong in split screen. */
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [index, setIndex] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrame({ width, height });
  }, []);

  const goToPage = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(next, PAGES.length - 1));

      setIndex(target);
      pagerRef.current?.scrollTo({ x: target * frame.width, animated: true });
    },
    [frame.width],
  );

  /**
   * Follows a swipe. Only the settled position counts — reacting to every frame
   * of a drag would flicker the dots back and forth while the user is still
   * deciding.
   */
  const handleMomentumEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (frame.width <= 0) {
        return;
      }

      setIndex(Math.round(event.nativeEvent.contentOffset.x / frame.width));
    },
    [frame.width],
  );

  /**
   * Ends the introduction.
   *
   * The flag is written before leaving, but leaving does not wait on it — the
   * storage layer swallows its own failures, and the worst case is seeing this
   * again next launch. Blocking the user behind a device write to show them a
   * screen they have finished with would be the wrong trade.
   *
   * Permissions are deliberately untouched. Whatever was refused stays refused,
   * and is asked for again by the feature that actually needs it, in the moment
   * the user is trying to use it.
   */
  const finish = useCallback(() => {
    getOnboardingStorage()
      .setOnboardingCompleted()
      .catch(error => {
        log.warn('Could not record onboarding completion', { error: String(error) });
      });

    navigation.replace('AuthEntry');
  }, [navigation]);

  /**
   * Moves on from a page once its question has been answered.
   *
   * Takes the page it came from rather than reading `index`, because all three
   * pages are mounted and the one that answered is not necessarily the one on
   * screen — a prompt resolving late must not drag the user forward from
   * wherever they have since swiped to.
   */
  const advanceFrom = useCallback(
    (from: number) => {
      if (from >= PAGES.length - 1) {
        finish();
        return;
      }

      goToPage(from + 1);
    },
    [finish, goToPage],
  );

  const handleBack = useCallback(() => {
    goToPage(index - 1);
  }, [goToPage, index]);

  return (
    <Screen padded={false} testID="onboarding-screen">
      {/*
        Back appears from the second page on, and its slot is held open before
        then so that Skip does not slide sideways as the user advances.
      */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: theme.screenPadding,
            paddingVertical: theme.spacing.sm,
            minHeight: theme.hitSlop.minTarget,
          },
        ]}>
        {index > 0 ? (
          <HeaderAction
            label={ONBOARDING_COPY.back}
            hint={ONBOARDING_COPY.backHint}
            tone="primary"
            align="left"
            onPress={handleBack}
            testID="onboarding-back"
          />
        ) : (
          // Holds the slot open so Skip does not slide sideways on page two.
          <View style={styles.headerSlot} />
        )}

        <HeaderAction
          label={ONBOARDING_COPY.skip}
          hint={ONBOARDING_COPY.skipHint}
          tone="textSecondary"
          align="right"
          onPress={finish}
          testID="onboarding-skip"
        />
      </View>

      <View style={styles.pager} onLayout={handleLayout} testID="onboarding-pager-frame">
        {frame.width > 0 ? (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumEnd}
            // The pager itself is not a control; its pages are. Without this a
            // screen reader offers a horizontal scroller with no way to know
            // what scrolling it would achieve.
            accessibilityRole="none"
            testID="onboarding-pager">
            {PAGES.map((page, pageIndex) => (
              <OnboardingPage
                key={page.id}
                copy={page}
                index={pageIndex}
                onAdvance={advanceFrom}
                width={frame.width}
                height={frame.height}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: theme.screenPadding,
            // Tight to the pager above, comfortable against the screen edge
            // below. It carried a button's worth of padding until that button
            // left, and kept the hole it used to fill.
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.screenPadding,
            maxWidth: theme.maxContentWidth,
          },
        ]}>
        {/*
          Position only. The forward action lives in the permission card now,
          because answering the question and continuing are the same act — a
          separate Next below it asked the user to confirm a decision they had
          already made.
        */}
        <OnboardingPagination
          count={PAGES.length}
          activeIndex={index}
          testID="onboarding-pagination"
        />
      </View>
    </Screen>
  );
}

interface HeaderActionProps {
  label: string;
  hint: string;
  tone: 'primary' | 'textSecondary';
  align: 'left' | 'right';
  onPress: () => void;
  testID: string;
}

/**
 * A plain text action in the header bar.
 *
 * Local to this screen. The shared library has filled and outlined buttons, and
 * neither is right here — Back and Skip must stay quiet next to the primary
 * action below, which is the one the user is meant to take. Two of them on one
 * screen is not an abstraction worth building.
 *
 * Pressable rather than a Text with `onPress`, so the target is a full touch
 * target rather than the height of the word inside it.
 */
function HeaderAction({ label, hint, tone, align, onPress, testID }: HeaderActionProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.headerSlot,
        {
          minHeight: theme.hitSlop.minTarget,
          justifyContent: 'center',
          alignItems: align === 'right' ? 'flex-end' : 'flex-start',
          opacity: pressed ? theme.opacity.pressed : 1,
        },
      ]}
      testID={testID}>
      <Text variant="label" color={tone}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSlot: {
    // Both slots claim the same share, so the pair stays balanced whether or not
    // Back is showing.
    flex: 1,
  },
  pager: {
    // Takes everything the header and footer leave. The pages size themselves
    // from what this measures, so nothing depends on a device dimension.
    flex: 1,
  },
  footer: {
    width: '100%',
    alignSelf: 'center',
  },
});
