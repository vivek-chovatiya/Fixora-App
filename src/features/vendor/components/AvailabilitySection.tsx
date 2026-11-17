/**
 * AvailabilitySection
 *
 * Section 38's "Availability", "Working Hours" and "Manage Availability" on
 * the Profile tab: whether the vendor is accepting new requests, with the
 * switch that changes it, and their usual week in short, with the way to the
 * screen that changes that.
 *
 * ⚠️ Turning new requests off asks first; turning them on does not (section
 * 46: confirm what has consequences). Off costs the vendor work until they
 * remember to turn it back on; on only undoes that. Confirming closes the
 * dialog at once — the switch itself then shows the change in the air, busy
 * and locked, until the service answers (`useAcceptingRequests`); a dialog
 * held open instead could sit behind slower work in the vendor's line.
 *
 * ⚠️ The line under the switch says what the state means and nothing more:
 * new requests stop; work already accepted carries on. The app decides
 * nothing from it — the backend does (section 18A.1).
 *
 * The week is drawn from the profile the vendor tree already holds, which the
 * Working hours screen updates with what it saves — so coming back shows it
 * without a read of its own. Neighbouring days alike share a line
 * ("Mon–Sat 9:00 AM – 7:00 PM"), each line one stop spoken in full words.
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SwitchRow } from '@/features/vendor/components/SwitchRow';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { summariseWorkingHours } from '@/features/vendor/constants/workingHoursPresentation';
import { Card, ConfirmDialog, SecondaryButton, Text } from '@/shared/components';
import type { VendorWorkingDay } from '@/shared/services/types/VendorProfileService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.availability;

export interface AvailabilitySectionProps {
  /** What the switch shows: the value asked for while a change is in the air, else what is stored. */
  accepting: boolean;
  /** A change is in the air: the switch is busy and locked. */
  isChanging: boolean;
  /** Asks the service for the change. Called after the question, when turning off. */
  onChangeAccepting: (accepting: boolean) => void;
  workingHours: readonly VendorWorkingDay[] | undefined;
  onEditHours: () => void;
  disabled?: boolean;
  testID?: string;
}

function AvailabilitySectionComponent({
  accepting,
  isChanging,
  onChangeAccepting,
  workingHours,
  onEditHours,
  disabled = false,
  testID,
}: AvailabilitySectionProps) {
  const theme = useTheme();
  const lines = useMemo(() => summariseWorkingHours(workingHours), [workingHours]);

  const [isConfirmingStop, setIsConfirmingStop] = useState(false);

  const flip = useCallback(
    (next: boolean) => {
      if (next) {
        onChangeAccepting(true);
        return;
      }
      setIsConfirmingStop(true);
    },
    [onChangeAccepting],
  );
  const keepAccepting = useCallback(() => setIsConfirmingStop(false), []);
  const stop = useCallback(() => {
    setIsConfirmingStop(false);
    onChangeAccepting(false);
  }, [onChangeAccepting]);

  const explanation = accepting ? COPY.acceptingOn : COPY.acceptingOff;
  const id = (suffix: string) => (testID ? `${testID}-${suffix}` : undefined);

  return (
    <Card
      bordered
      shadow="sm"
      style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
      testID={testID}>
      <Text variant="overline" color="textTertiary" accessibilityRole="header">
        {COPY.section}
      </Text>

      <SwitchRow
        label={COPY.acceptingLabel}
        description={explanation}
        value={accepting}
        onValueChange={flip}
        isBusy={isChanging}
        disabled={disabled}
        accessibilityLabel={COPY.acceptingSpoken(explanation)}
        accessibilityHint={accepting ? COPY.turnOffHint : COPY.turnOnHint}
        testID={id('accepting')}
      />

      <View
        style={{
          gap: theme.spacing.sm,
          paddingTop: theme.spacing.md,
          borderTopWidth: theme.borderWidth.hairline,
          borderTopColor: theme.colors.border,
        }}>
        <Text variant="caption" color="textTertiary">
          {COPY.hoursLabel}
        </Text>

        {lines.length === 0 ? (
          <Text variant="body" color="textTertiary" testID={id('hours-empty')}>
            {COPY.hoursEmpty}
          </Text>
        ) : (
          lines.map(line => (
            <View
              key={line.key}
              accessible
              accessibilityLabel={line.spoken}
              style={[styles.line, { gap: theme.spacing.md }]}
              testID={id(`hours-${line.key}`)}>
              {/* Both columns a definite width, so either wraps rather than clips (3E-3). */}
              <Text variant="bodyStrong" style={styles.days}>
                {line.days}
              </Text>
              <Text variant="body" color="textSecondary" style={styles.hours}>
                {line.hours}
              </Text>
            </View>
          ))
        )}
      </View>

      <SecondaryButton
        label={COPY.hoursEdit}
        icon="calendar"
        onPress={onEditHours}
        disabled={disabled}
        fullWidth
        accessibilityHint={COPY.hoursEditHint}
      />

      <ConfirmDialog
        visible={isConfirmingStop}
        title={COPY.stopTitle}
        message={COPY.stopMessage}
        cancelLabel={COPY.stopCancel}
        cancelHint={COPY.stopCancelHint}
        confirmLabel={COPY.stopConfirm}
        confirmHint={COPY.stopConfirmHint}
        onCancel={keepAccepting}
        onConfirm={stop}
        testID={id('stop-dialog')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
  },
  days: {
    flex: 1,
  },
  hours: {
    flex: 2,
  },
});

export const AvailabilitySection = memo(AvailabilitySectionComponent);
