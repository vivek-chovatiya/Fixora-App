/**
 * RequestStatusOverview
 *
 * Where a request stands, and the path it is on (PROJECT_BIBLE.md sections 20
 * and 21).
 *
 * ⚠️ It draws what the status says has happened, and nothing more. Steps before
 * the current one are complete; the current one is marked as current; every step
 * after it is drawn hollow and quiet, because it has not happened — a request
 * that is searching must never look as though it has been assigned. States that
 * are not on the path (cancelled, not accepted, on hold, unknown) get the heading
 * and the sentence and no path at all, rather than a path with a gap in it.
 *
 * ⚠️ It is not a tracker. It does not refresh itself, animate, count down or
 * estimate. It is redrawn when the screen reads the request again.
 *
 * One node to assistive technology. The markers and connectors are decoration;
 * what a screen reader hears is the summary `describeRequestStatus` writes —
 * the state, what it means, what is complete and what is current. State is never
 * carried by colour alone: the heading is words, completed steps carry a tick,
 * the current step a filled centre, and upcoming ones an empty ring.
 *
 * Feature-local: the details screen is its only consumer.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import {
  describeRequestStatus,
  presentRequestState,
  requestProgressOf,
  requestStateOf,
  type RequestDispatch,
  type RequestProgressStep,
  type RequestStepProgress,
} from '@/features/customer/constants/requestStatus';
import { Icon, Text } from '@/shared/components';
import type { RequestStatus } from '@/shared/services/types/RequestService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.requestDetails;

export interface RequestStatusOverviewProps {
  /** The backend's status, as the record carries it. */
  status: RequestStatus;
  /** Whether the customer chose a professional — which wait this is. */
  dispatch: RequestDispatch;
  /** Lands on the node that announces the whole block. */
  testID?: string;
}

/** A step's marker: a tick, a filled centre, or an empty ring. */
function StepMarker({ progress }: { progress: RequestStepProgress }) {
  const theme = useTheme();

  const size = theme.spacing.xl;

  if (progress === 'complete') {
    return (
      <View
        style={[
          styles.marker,
          {
            width: size,
            height: size,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.primary,
          },
        ]}>
        <Icon name="selected" size="xs" color="onPrimary" />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.marker,
        {
          width: size,
          height: size,
          borderRadius: theme.radius.full,
          borderWidth: theme.borderWidth.thin,
          borderColor: progress === 'current' ? theme.colors.primary : theme.colors.borderStrong,
          backgroundColor: theme.colors.surface,
        },
      ]}>
      {progress === 'current' ? (
        <View
          style={{
            width: theme.spacing.sm,
            height: theme.spacing.sm,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.primary,
          }}
        />
      ) : null}
    </View>
  );
}

function ProgressSteps({ steps }: { steps: RequestProgressStep[] }) {
  const theme = useTheme();

  return (
    <View
      // Decoration: the parent's label already says all of this in words.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ paddingTop: theme.spacing.xs }}
      testID="request-status-progress">
      {steps.map((step, index) => {
        const next = steps[index + 1];
        const isUpcoming = step.progress === 'upcoming';

        return (
          <View
            key={step.stage}
            style={[styles.step, { gap: theme.spacing.md }]}
            testID={`request-status-step-${step.stage}-${step.progress}`}>
            <View style={styles.rail}>
              <StepMarker progress={step.progress} />
              {next ? (
                <View
                  style={[
                    styles.connector,
                    {
                      width: theme.borderWidth.thin,
                      minHeight: theme.spacing.md,
                      // Filled only up to the step that is current: the line
                      // towards a step that has not happened stays a line
                      // towards nothing yet.
                      backgroundColor:
                        next.progress === 'upcoming'
                          ? theme.colors.borderStrong
                          : theme.colors.primary,
                    },
                  ]}
                />
              ) : null}
            </View>

            <View
              style={[
                styles.grow,
                { paddingBottom: next ? theme.spacing.md : theme.spacing.none },
              ]}>
              <Text
                variant={step.progress === 'current' ? 'bodyStrong' : 'body'}
                color={isUpcoming ? 'textTertiary' : 'textPrimary'}>
                {step.title}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RequestStatusOverviewComponent({ status, dispatch, testID }: RequestStatusOverviewProps) {
  const theme = useTheme();

  const presentation = presentRequestState(requestStateOf(status, dispatch));
  const steps = requestProgressOf(presentation.state, dispatch);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={describeRequestStatus(presentation, steps)}
      style={{ gap: theme.spacing.md }}
      testID={testID}>
      <View style={[styles.heading, { gap: theme.spacing.md }]}>
        <View
          style={[
            styles.mark,
            {
              width: theme.spacing.huge,
              height: theme.spacing.huge,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors[`${presentation.tone}Subtle`],
            },
          ]}>
          <Icon name={presentation.icon} size="lg" color={presentation.tone} />
        </View>

        <View style={[styles.grow, { gap: theme.spacing.xxs }]}>
          <Text variant="overline" color="textTertiary">
            {COPY.statusLabel}
          </Text>
          <Text variant="h3" testID="request-status-title">
            {presentation.title}
          </Text>
        </View>
      </View>

      <Text variant="body" color="textSecondary" testID="request-status-description">
        {presentation.description}
      </Text>

      {steps ? <ProgressSteps steps={steps} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: {
    // Takes the slack, so a long title wraps inside the card.
    flex: 1,
  },
  step: {
    flexDirection: 'row',
    // Stretch, so the rail is as tall as the label beside it and the connector
    // reaches the next marker however the label wraps.
    alignItems: 'stretch',
  },
  rail: {
    alignItems: 'center',
  },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
  },
});

export const RequestStatusOverview = memo(RequestStatusOverviewComponent);
