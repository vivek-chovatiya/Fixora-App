/**
 * ScheduleRail
 *
 * A horizontal run of choices, for the preferred date and the preferred time.
 *
 * ⚠️ The first option is "no preference", and it is selected until the customer
 * says otherwise. PROJECT_BIBLE.md section 14 makes both fields optional, and a
 * rail with nothing selected reads as a question not yet answered rather than as
 * one answered with a shrug — so having no preference is offered as a choice, in
 * the same shape as every other choice, first.
 *
 * Scrolled rather than wrapped, unlike priority: fourteen days and fourteen
 * hours wrapped into a block would take over the form, and unlike priority the
 * options are a sequence, so running out of sight to the right is the shape the
 * content already has.
 *
 * The rail itself is the shared `SelectionChipRail` since T134 (28/11/2026),
 * when the requests lists' filters needed the same row; this keeps the form's
 * test ids, where "no preference" — an empty value — is `-any`.
 */

import React, { memo, useCallback } from 'react';

import type { ScheduleOption } from '@/features/customer/constants/requestScheduling';
import { SelectionChipRail } from '@/shared/components';

export interface ScheduleRailProps {
  options: readonly ScheduleOption[];
  value: string;
  onChange: (value: string) => void;
  /** Names the group. Without it the rail is a run of unrelated radios. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
}

function ScheduleRailComponent({
  options,
  value,
  onChange,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ScheduleRailProps) {
  const chipTestID = useCallback(
    (optionValue: string) => `${testID}-${optionValue || 'any'}`,
    [testID],
  );

  return (
    <SelectionChipRail
      options={options}
      value={value}
      onChange={onChange}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      chipTestID={testID ? chipTestID : undefined}
    />
  );
}

export const ScheduleRail = memo(ScheduleRailComponent);
