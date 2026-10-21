/**
 * WorkingHoursScreen
 *
 * The vendor's usual week (PROJECT_BIBLE.md section 38, "Working Hours" and
 * "Manage Availability"), pushed from the Profile tab's "Edit working hours":
 * the seven days, each open or closed, and when an open day opens and closes.
 *
 * ⚠️ Information, not a rule. The backend may use the week for matching and a
 * customer may one day see it; the app enforces none of it (section 18A.1) —
 * a vendor who is accepting new requests can be offered work at any hour.
 * Turning new requests off is the Profile tab's switch, not this screen.
 *
 * ⚠️ Saved as a whole, on Save — unlike the availability switch, which applies
 * at once. A week is several decisions that belong together, and half of one
 * stored would be a week the vendor never chose. The screen opens on the week
 * the vendor tree already holds (no read: the profile is loaded before any
 * vendor screen exists), every time is chosen from a list in half-hour steps,
 * and a day closing at or before it opens is said on that day at once; Save
 * with one sends nothing and says "Check the highlighted days." Save is locked
 * while it runs, and so is every day; a failure keeps the week as edited, with
 * the reason above Save, which is the retry. Success is a toast and goes back,
 * where Profile shows the saved week from the answer adopted into the context.
 *
 * ⚠️ Leaving with unsaved changes asks first, through `beforeRemove` (the Back
 * control, Android back and the gesture). Leaving while the save runs is held
 * and taken once it settles — a success takes it as its own way back; a
 * failure asks the unsaved-changes question itself, never by sending the held
 * action back through the guard, which React Navigation would let skip it
 * (3E-11; see Lessons). Nothing about an unsaved week is kept after leaving.
 *
 * "Copy Monday to all weekdays" gives Tuesday to Friday Monday's hours in one
 * press — the usual week, without ten choices — and says so where a screen
 * reader hears it. Saturday and Sunday are left alone.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { TimeChoiceDialog } from '@/features/vendor/components/TimeChoiceDialog';
import {
  WorkingDayRow,
  type WorkingTimeEdge,
} from '@/features/vendor/components/WorkingDayRow';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { presentDay } from '@/features/vendor/constants/workingHoursPresentation';
import { useSaveWorkingHours } from '@/features/vendor/hooks/useSaveWorkingHours';
import { useVendorProfile } from '@/features/vendor/state/VendorProfileContext';
import {
  buildWorkingHours,
  copyMondayToWeekdays,
  dayProblem,
  draftWeek,
  sameWorkingHours,
  workingTimeOptions,
  type WorkingDayDraft,
} from '@/features/vendor/validation/workingHoursForm';
import type { VendorStackParamList } from '@/navigation/types';
import {
  BackButton,
  ConfirmDialog,
  ErrorState,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Text,
} from '@/shared/components';
import { formatTimeValue } from '@/shared/presentation/clockTime';
import type { VendorProfile } from '@/shared/services/types/VendorProfileService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.workingHours;

/** The day "Copy Monday to all weekdays" copies from; the button sits under it. */
const MONDAY = 'MON';

type Props = NativeStackScreenProps<VendorStackParamList, 'WorkingHours'>;

/** Which time of which day the list is open for. */
interface Choosing {
  day: string;
  edge: WorkingTimeEdge;
}

export function WorkingHoursScreen(props: Props) {
  const { profile } = useVendorProfile();

  // The navigator only mounts this once the profile has loaded.
  if (!profile) {
    return null;
  }

  return <WorkingHoursForm {...props} profile={profile} />;
}

function WorkingHoursForm({ navigation, profile }: Props & { profile: VendorProfile }) {
  const theme = useTheme();
  const { save, isSaving, error: saveError, isBusy } = useSaveWorkingHours();

  /* The week ---------------------------------------------------------------- */

  // Seeded once: the week this screen opened on, and what "unsaved" is measured against.
  const [initial] = useState(() => draftWeek(profile.workingHours));
  const [week, setWeek] = useState<WorkingDayDraft[]>(initial);
  const [triedToSave, setTriedToSave] = useState(false);
  const [hasCopiedMonday, setHasCopiedMonday] = useState(false);

  const problems = useMemo(() => week.map(dayProblem), [week]);
  const hasProblems = problems.some(problem => problem !== null);
  const isDirty = useMemo(() => !sameWorkingHours(week, initial), [initial, week]);

  /** One day changed; everything else as it was. Any edit clears "copied". */
  const changeDay = useCallback((day: string, change: Partial<WorkingDayDraft>) => {
    setWeek(current =>
      current.map(entry => (entry.day === day ? { ...entry, ...change } : entry)),
    );
    setHasCopiedMonday(false);
  }, []);

  const toggleDay = useCallback(
    (day: string, isOpen: boolean) => changeDay(day, { isOpen }),
    [changeDay],
  );

  const copyMonday = useCallback(() => {
    setWeek(copyMondayToWeekdays);
    setHasCopiedMonday(true);
  }, []);

  /* Choosing a time --------------------------------------------------------- */

  const [choosing, setChoosing] = useState<Choosing | null>(null);
  const chooseTime = useCallback(
    (day: string, edge: WorkingTimeEdge) => setChoosing({ day, edge }),
    [],
  );
  const closeChoice = useCallback(() => setChoosing(null), []);

  const chosenDay = choosing ? week.find(entry => entry.day === choosing.day) : undefined;
  const chosenValue = choosing && chosenDay ? chosenDay[choosing.edge] : null;
  const timeOptions = useMemo(
    () =>
      workingTimeOptions(chosenValue ?? undefined).map(value => ({
        value,
        label: formatTimeValue(value),
      })),
    [chosenValue],
  );

  const applyChoice = useCallback(
    (value: string) => {
      if (choosing) {
        changeDay(
          choosing.day,
          choosing.edge === 'opensAt' ? { opensAt: value } : { closesAt: value },
        );
      }
      setChoosing(null);
    },
    [changeDay, choosing],
  );

  /* Leaving with unsaved changes ------------------------------------------ */

  const allowLeave = useRef(false);
  const interrupted = useRef<NavigationAction | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  /*
    A leave asked for while the save runs is held, not taken, and sent once
    the save has settled — the team form's rule (3E-11). The latest one asked
    for is kept, sent exactly once (taken before it is sent) and never after
    unmount.
  */
  const heldLeave = useRef<NavigationAction | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (allowLeave.current) {
          return;
        }
        // Read from the hook's ref: true from the instant a save starts.
        if (isBusy()) {
          event.preventDefault();
          heldLeave.current = event.data.action;
          return;
        }
        if (!isDirty) {
          return;
        }
        event.preventDefault();
        interrupted.current = event.data.action;
        setIsDiscarding(true);
      }),
    [isBusy, isDirty, navigation],
  );

  /** The latest render's answer, for a release that runs after an await. */
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  /**
   * Sends a held leave once the save has settled, asking first when there are
   * unsaved changes — exactly what the guard would have done.
   *
   * ⚠️ Asked here, not by sending the action back through the guard: React
   * Navigation marks an action that has already been through this screen's
   * `beforeRemove` and skips the listener when it is sent again, so a held
   * leave re-sent after a failed save would leave with the week unasked about.
   */
  const releaseHeldLeave = useCallback(() => {
    if (!mountedRef.current || isBusy() || !heldLeave.current) {
      return;
    }
    const action = heldLeave.current;
    heldLeave.current = null;

    if (isDirtyRef.current) {
      interrupted.current = action;
      setIsDiscarding(true);
      return;
    }
    navigation.dispatch(action);
  }, [isBusy, navigation]);

  const confirmDiscard = useCallback(() => {
    setIsDiscarding(false);
    allowLeave.current = true;

    const action = interrupted.current;
    interrupted.current = null;
    if (action) {
      navigation.dispatch(action);
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const keepEditing = useCallback(() => {
    interrupted.current = null;
    setIsDiscarding(false);
  }, []);

  /* Saving ------------------------------------------------------------------ */

  const submit = useCallback(async () => {
    if (hasProblems) {
      setTriedToSave(true);
      return;
    }

    const saved = await save(buildWorkingHours(week));
    if (!saved) {
      // Failed, or already running: a held leave goes on, asking about the unsaved week first.
      releaseHeldLeave();
      return;
    }

    allowLeave.current = true;
    // One navigation, never two: the leave held while saving, or the save's own way back.
    const held = heldLeave.current;
    heldLeave.current = null;
    if (!mountedRef.current) {
      return;
    }
    if (held) {
      navigation.dispatch(held);
      return;
    }
    navigation.goBack();
  }, [hasProblems, navigation, releaseHeldLeave, save, week]);

  const onSave = useCallback(() => {
    // Never rejects: a failed save is the hook's `error`.
    submit().catch(() => undefined);
  }, [submit]);

  /* Drawing ----------------------------------------------------------------- */

  const monday = week.find(entry => entry.day === MONDAY);
  const mondayIndex = week.findIndex(entry => entry.day === MONDAY);
  const chosenDayName = choosing ? presentDay(choosing.day).long : '';

  return (
    <Screen
      scrollable
      header={
        <View
          style={[
            styles.bar,
            { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget },
          ]}>
          <BackButton
            onPress={navigation.goBack}
            accessibilityLabel={COPY.back}
            testID="working-hours-back"
          />
        </View>
      }
      contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
      testID="working-hours">
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="working-hours-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {week.map((entry, index) => (
          <React.Fragment key={entry.day}>
            <WorkingDayRow
              draft={entry}
              problem={problems[index]}
              onToggle={toggleDay}
              onChooseTime={chooseTime}
              disabled={isSaving}
              testID={`working-hours-day-${entry.day}`}
            />

            {index === mondayIndex && monday ? (
              <View style={{ gap: theme.spacing.xs }}>
                <SecondaryButton
                  label={COPY.copyMonday}
                  onPress={copyMonday}
                  // Copying a day that is wrong would make five days wrong.
                  disabled={isSaving || problems[index] !== null}
                  fullWidth
                  accessibilityHint={COPY.copyMondayHint}
                />
                {hasCopiedMonday ? (
                  <Text
                    variant="caption"
                    color="textSecondary"
                    accessibilityLiveRegion="polite"
                    testID="working-hours-copied">
                    {COPY.copiedMonday}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </React.Fragment>
        ))}
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {triedToSave && hasProblems ? (
          <Text
            variant="caption"
            color="danger"
            accessibilityLiveRegion="polite"
            testID="working-hours-fix-errors">
            {COPY.fixErrors}
          </Text>
        ) : null}

        {saveError ? (
          <ErrorState
            error={saveError}
            title={COPY.saveFailedTitle}
            fullScreen={false}
            testID="working-hours-save-error"
          />
        ) : null}

        <PrimaryButton
          fullWidth
          label={isSaving ? COPY.saving : COPY.save}
          onPress={onSave}
          isLoading={isSaving}
          accessibilityHint={COPY.saveHint}
        />
      </View>

      <TimeChoiceDialog
        visible={choosing !== null}
        title={
          choosing?.edge === 'closesAt'
            ? COPY.closesTitle(chosenDayName)
            : COPY.opensTitle(chosenDayName)
        }
        options={timeOptions}
        value={chosenValue}
        onChoose={applyChoice}
        onCancel={closeChoice}
        groupLabel={COPY.timesLabel}
        cancelLabel={COPY.chooseCancel}
        cancelHint={COPY.chooseCancelHint}
        testID="working-hours-times"
      />

      <ConfirmDialog
        visible={isDiscarding}
        title={COPY.discardTitle}
        message={COPY.discardMessage}
        cancelLabel={COPY.discardKeep}
        cancelHint={COPY.discardKeepHint}
        confirmLabel={COPY.discardConfirm}
        confirmHint={COPY.discardConfirmHint}
        onCancel={keepEditing}
        onConfirm={confirmDiscard}
        testID="working-hours-discard-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
});
