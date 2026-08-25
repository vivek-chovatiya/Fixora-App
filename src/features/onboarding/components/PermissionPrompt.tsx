/**
 * PermissionPrompt
 *
 * Explains one permission, offers to ask for it, and moves the introduction on.
 *
 * The explanation comes first and the system dialog second, always. A native
 * prompt that appears with no context gets refused, and on both platforms a
 * refusal is close to permanent — the system stops offering the dialog, and only
 * a trip to Settings undoes it. So the one cheap thing this screen can do is
 * make sure the user knows what they are answering before they answer it.
 *
 * ⚠️ These two buttons are also the page's only way forward. There is no Next
 * beneath them any more, which means answering the question and continuing are
 * the same act — and it means this component must never reach a state with
 * nothing to press. Every branch below ends in something that calls `onAnswered`.
 *
 * Declining is a real option, not a dead end dressed as one. Every path through
 * here leaves onboarding working, because none of these permissions is needed to
 * introduce the app.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PermissionCopy } from '@/features/onboarding/constants/onboardingCopy';
import { ONBOARDING_COPY } from '@/features/onboarding/constants/onboardingCopy';
import { usePermission, type PermissionPhase } from '@/features/onboarding/hooks/usePermission';
import { Card, Icon, PrimaryButton, SecondaryButton, Text } from '@/shared/components';
import { useTheme, type ColorTokens } from '@/shared/theme';

export interface PermissionPromptProps {
  copy: PermissionCopy;
  /**
   * Moves the introduction on. Called once the question has an answer, whichever
   * answer it is. Must be stable, or the effect below fires again on re-render.
   */
  onAnswered: () => void;
  testID: string;
}

/** What the outcome looks like once there is one to report. */
interface Outcome {
  message: string;
  tone: keyof ColorTokens;
}

/**
 * Answers that end the question here.
 *
 * `blocked` is deliberately absent. The system will not show a dialog again, so
 * the page stays put and offers Settings instead — sliding away from that would
 * take the only route out of it with them.
 */
const RESOLVED: readonly PermissionPhase[] = ['granted', 'denied', 'unavailable'];

export function PermissionPrompt({ copy, onAnswered, testID }: PermissionPromptProps) {
  const theme = useTheme();
  const { phase, request, decline, openSettings } = usePermission(copy.kind);

  const outcome = useMemo(() => resolveOutcome(phase, copy), [phase, copy]);

  const isBusy = phase === 'requesting';

  /**
   * Whether this page has already handed over.
   *
   * All three pages are mounted at once, so a prompt the user has answered stays
   * alive behind them. Without this, coming back to it would bounce them
   * forward again the moment it re-rendered.
   */
  const hasAnswered = useRef(false);

  useEffect(() => {
    if (!RESOLVED.includes(phase) || hasAnswered.current) {
      return;
    }

    hasAnswered.current = true;
    onAnswered();
  }, [phase, onAnswered]);

  const handleDecline = useCallback(() => {
    decline();
    hasAnswered.current = true;
    onAnswered();
  }, [decline, onAnswered]);

  const isResolved = RESOLVED.includes(phase);

  return (
    <Card
      bordered
      // Stretched rather than left to size itself. The page centres its column
      // so the artwork sits in the middle, and a card inside a centring parent
      // shrink-wraps its content — which quietly made these buttons as narrow as
      // their labels instead of as wide as the card.
      style={styles.card}
      testID={testID}>
      <View style={[styles.body, { gap: theme.spacing.md }]}>
        <View style={[styles.heading, { gap: theme.spacing.md }]}>
          <View
            style={[
              styles.iconTile,
              {
                width: theme.hitSlop.minTarget,
                height: theme.hitSlop.minTarget,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.primarySubtle,
              },
            ]}>
            <Icon name={copy.icon} size="lg" color="primary" />
          </View>

          <Text variant="h3" style={styles.title}>
            {copy.title}
          </Text>
        </View>

        <Text variant="body" color="textSecondary">
          {copy.body}
        </Text>

        {outcome ? (
          <Text
            variant="body"
            color={outcome.tone}
            // Announced when it changes: the user has just acted, and the result
            // of that action is the one thing worth interrupting for.
            accessibilityLiveRegion="polite"
            testID={`${testID}-outcome`}>
            {outcome.message}
          </Text>
        ) : null}

        {isResolved ? (
          /*
            Only reachable by coming back to a page already answered. The
            question is settled, so the single thing left to offer is the way
            onward — which must exist, because nothing else on the page moves.
          */
          <PrimaryButton
            fullWidth
            label={ONBOARDING_COPY.continueAction}
            onPress={onAnswered}
            accessibilityHint={ONBOARDING_COPY.continueHint}
          />
        ) : (
          /*
            Side by side, refusal on the left. The pair reads as one question
            with two answers rather than as a recommended action with an
            afterthought stacked beneath it.
          */
          <View style={[styles.actions, { gap: theme.spacing.sm }]}>
            <SecondaryButton
              label={copy.decline}
              onPress={handleDecline}
              disabled={isBusy}
              accessibilityHint={copy.declineHint}
              style={styles.action}
            />

            {phase === 'blocked' ? (
              // Asking again would do nothing — the system has stopped offering
              // the dialog — so the only honest action left is Settings.
              <PrimaryButton
                label={ONBOARDING_COPY.openSettings}
                onPress={openSettings}
                accessibilityHint={ONBOARDING_COPY.openSettingsHint}
                style={styles.action}
              />
            ) : (
              <PrimaryButton
                label={copy.allow}
                onPress={request}
                isLoading={isBusy}
                accessibilityHint={copy.allowHint}
                style={styles.action}
              />
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

/**
 * What to say about where the request got to.
 *
 * `idle` and `requesting` say nothing: the explanation above is still the whole
 * message, and narrating the wait would only add a line that flickers.
 * `declined` says nothing either — the user's own choice needs no confirmation
 * back at them.
 */
function resolveOutcome(phase: PermissionPhase, copy: PermissionCopy): Outcome | null {
  switch (phase) {
    case 'granted':
      return { message: copy.granted, tone: 'success' };
    case 'denied':
      // Reassuring rather than warning-coloured. Refusing is allowed, and
      // nothing about the app is broken by it.
      return { message: copy.denied, tone: 'textSecondary' };
    case 'blocked':
      return { message: copy.blocked, tone: 'textSecondary' };
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
  },
  body: {
    width: '100%',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    // Takes what the tile leaves, so a long title wraps rather than pushing the
    // card wider than the screen.
    flex: 1,
  },
  iconTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
  },
  action: {
    // Equal halves, so neither answer looks like the expected one by size.
    flex: 1,
  },
});
