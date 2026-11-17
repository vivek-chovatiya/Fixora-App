/**
 * TeamMemberFormScreen
 *
 * Adding somebody to the vendor's team, or changing their details
 * (PROJECT_BIBLE.md section 39, Phase 3E-7). One form, one route —
 * `EditTeamMember`, with a `memberId` to edit and without one to add — because
 * adding and editing differ only in what the form opens with
 * (`EditAddressScreen`'s reasoning, 3D-9).
 *
 * ⚠️ Name and role are required, the phone is optional (owner decision,
 * 2026-10-08), and the rules are the service's said to a person
 * (`teamMemberSchema`): field messages under each field, a live "Check the
 * highlighted fields." beside Save, and nothing sent until they pass. A phone,
 * when given, is held to the app's one phone rule.
 *
 * ⚠️ One save at a time, and nothing lost. The button shows busy, a ref in
 * `useTeamMemberForm` refuses a second press before state catches up, and a
 * failure keeps every value with the reason above Save, which is the retry.
 * Success says so (a toast) and goes back to the team, which reads itself again.
 *
 * ⚠️ The member is read from the service, never passed in, so an edit always
 * starts from what is stored. One that is no longer on the team — removed
 * meanwhile, or an id that was never this vendor's — says so calmly, with no
 * form and no retry: trying again cannot bring them back.
 *
 * ⚠️ Leaving with unsaved changes asks first, through `beforeRemove`, so the
 * Android back button and the back gesture are guarded too (3D-8, 3E-1).
 * Leaving while a save or a status change is running is held until it has
 * settled, then taken — once — so the team behind reads itself again after the
 * write, never before it. A save that succeeds takes the held leave as its own
 * way back; one that fails sends it through the unsaved-changes question.
 *
 * ⚠️ Editing (never adding) ends with section 39's Status: what the member is
 * marked as, and one action — "Disable member", which asks first, or "Enable
 * member", which does not, since it only takes the mark off. It is done at
 * once, not on Save: the status is not one of the fields and nothing typed
 * above it is touched, so it is never an unsaved change and never wakes the
 * discard guard by itself. While it runs its button is busy and Save waits;
 * while Save runs, it waits. The outcome is a toast, and a failure leaves the
 * status as it was. A new member is always active, so the add form has no
 * status at all.
 *
 * ⚠️ The form opens with section 39's Profile Image (2026-10-21): the business
 * picture's pattern (`VendorProfileFormScreen`), not a new one — take or choose
 * a photo through `useImageUpload`, uploaded the moment it is chosen, a failure
 * kept with Try again and Discard, Remove for one that is there. The uploaded
 * URL is only a value in this form until Save, so leaving without saving
 * leaves the member's photo as it was. Save waits while an upload is running
 * (its URL would miss the save) and the photo waits while Save runs; a failed
 * upload touches nothing typed. A photo chosen and not yet saved is an unsaved
 * change, so leaving asks first. The card is `PhotoField`, shared with the
 * business picture since Phase 3G-4; it was a copy of that card until then.
 *
 * Nothing here invites, assigns, schedules or pays anybody: a team member is a
 * name, a role, a number, a photo and a status.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { PhotoField } from '@/features/vendor/components/PhotoField';
import { presentTeamMemberStatus } from '@/features/vendor/constants/teamMemberStatus';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  useTeamMemberForm,
  type TeamMemberFormState,
} from '@/features/vendor/hooks/useTeamMemberForm';
import {
  buildTeamMemberInput,
  teamMemberFormValues,
  teamMemberSchema,
  type TeamMemberForm,
} from '@/features/vendor/validation/teamMemberSchema';
import type { VendorStackParamList } from '@/navigation/types';
import {
  BackButton,
  Button,
  ConfirmDialog,
  ControlledInput,
  EmptyState,
  ErrorState,
  PhoneInput,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Skeleton,
  StatusBadge,
  Text,
} from '@/shared/components';
import { useImageUpload } from '@/shared/hooks/useImageUpload';
import {
  TEAM_MEMBER_NAME_MAX_LENGTH,
  TEAM_MEMBER_ROLE_MAX_LENGTH,
  TEAM_MEMBER_STATUS,
  type TeamMember,
} from '@/shared/services/types/VendorTeamService';
import { useTheme } from '@/shared/theme';
import { capPhoneInput } from '@/shared/validation/phone';

const COPY = VENDOR_COPY.teamForm;

/** Roughly the three fields, while the member being edited is read. */
const LOADING_BLOCK_HEIGHTS = [72, 72, 72] as const;

type Props = NativeStackScreenProps<VendorStackParamList, 'EditTeamMember'>;

export function TeamMemberFormScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const form = useTeamMemberForm(route.params?.memberId);
  const { isEditing } = form;

  let body: React.ReactNode;
  if (!isEditing) {
    body = <TeamMemberFields navigation={navigation} form={form} />;
  } else if (form.isLoading) {
    body = (
      <View
        style={{ gap: theme.spacing.lg }}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={COPY.loading}
        testID="team-member-form-loading">
        {LOADING_BLOCK_HEIGHTS.map((height, index) => (
          <Skeleton key={index} height={height} radiusToken="lg" />
        ))}
      </View>
    );
  } else if (form.member) {
    // Mounted once the member is known, so the form is seeded from it exactly once.
    body = <TeamMemberFields navigation={navigation} form={form} member={form.member} />;
  } else if (form.isNotFound) {
    body = (
      <EmptyState
        title={COPY.notFoundTitle}
        message={COPY.notFoundMessage}
        icon="help"
        actionLabel={COPY.back}
        onAction={navigation.goBack}
        fullScreen={false}
        testID="team-member-form-not-found"
      />
    );
  } else if (form.loadError) {
    body = (
      <ErrorState
        error={form.loadError}
        title={COPY.failedTitle}
        onRetry={form.retryLoad}
        fullScreen={false}
        testID="team-member-form-error"
      />
    );
  }

  return (
    <Screen
      scrollable
      keyboardAvoiding
      header={
        <View
          style={[
            styles.bar,
            { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget },
          ]}>
          <BackButton
            onPress={navigation.goBack}
            accessibilityLabel={COPY.back}
            testID="team-member-form-back"
          />
        </View>
      }
      contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
      testID="team-member-form">
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="team-member-form-heading">
          {isEditing ? COPY.editTitle : COPY.addTitle}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {isEditing ? COPY.editSubtitle : COPY.addSubtitle}
        </Text>
      </View>

      {body}
    </Screen>
  );
}

interface TeamMemberFieldsProps {
  navigation: Props['navigation'];
  form: TeamMemberFormState;
  /** The member being edited; absent while adding. */
  member?: TeamMember;
}

/** The photo, the three fields, Save, the discard guard and — when editing — the status. */
function TeamMemberFields({ navigation, form, member }: TeamMemberFieldsProps) {
  const theme = useTheme();
  const { save, isSaving, saveError, isEditing, setStatus, isChangingStatus, isBusy } = form;

  const {
    control,
    handleSubmit,
    watch,
    formState: { isDirty, errors, isSubmitted },
  } = useForm<TeamMemberForm>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: teamMemberFormValues(member),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const hasFieldErrors = isSubmitted && Object.keys(errors).length > 0;

  /* The photo: uploaded when chosen, saved with the form ------------------- */

  // Seeded once, from the member as stored; a status answer never reseeds it.
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(member?.photoUrl);
  const photo = useImageUpload({
    attach: setPhotoUrl,
    detach: () => setPhotoUrl(undefined),
  });

  /*
    Unsaved: a field changed, a photo that is not the stored one, or one chosen
    that has not uploaded yet — uploading or failed. Leaving then would lose
    what the vendor picked, so it asks, as it does for typing.
  */
  const hasChanges = isDirty || photoUrl !== member?.photoUrl || photo.pending !== null;

  /* Leaving with unsaved changes ------------------------------------------ */

  const allowLeave = useRef(false);
  const interrupted = useRef<NavigationAction | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  /*
    ⚠️ A leave asked for while a save or a status change is running is held,
    not taken, and sent once the change has settled. Letting it through at once
    sent the vendor back to a Team tab that read itself again before the write
    had landed — found on review: Enable, then Back a moment later, and the
    list said "Disabled" under a toast saying "Team member enabled." Held, the
    tab's read always comes after the write. The latest leave asked for is the
    one kept; it is sent exactly once (taken before it is sent), never after
    unmount, and never while the other change is still running.
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
        // Read from the hook's refs: true from the instant a change starts.
        if (isBusy()) {
          event.preventDefault();
          heldLeave.current = event.data.action;
          return;
        }
        if (!hasChanges) {
          return;
        }
        event.preventDefault();
        interrupted.current = event.data.action;
        setIsDiscarding(true);
      }),
    [hasChanges, isBusy, navigation],
  );

  /** The latest render's answer, for a release that runs after an await. */
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;

  /**
   * Sends a held leave once nothing is running, asking first when there is
   * unsaved typing — exactly what the guard above would have done.
   *
   * ⚠️ Asked here, not by sending the action back through the guard. React
   * Navigation marks an action that has already been through this screen's
   * `beforeRemove` and skips the listener when it is sent again (the way a
   * confirmed discard gets out), so a held leave re-sent after a failed save
   * left with the typing unasked about — caught by a test.
   *
   * A change that was refused because the other was running calls this too,
   * and finds it still busy: the one running releases it when it settles.
   */
  const releaseHeldLeave = useCallback(() => {
    if (!mountedRef.current || isBusy() || !heldLeave.current) {
      return;
    }
    const action = heldLeave.current;
    heldLeave.current = null;

    if (hasChangesRef.current) {
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

  const submit = useCallback(
    async (values: TeamMemberForm) => {
      // The photo on screen, always: on an edit, sending none removes the stored one.
      const saved = await save(buildTeamMemberInput(values, photoUrl));
      if (!saved) {
        // Failed, or refused while a status change ran: a held leave goes on,
        // asking first about the typing that was not saved.
        releaseHeldLeave();
        return;
      }

      allowLeave.current = true;
      // One navigation, never two: the leave that was held while saving, if
      // the vendor asked for one, otherwise the save's own way back.
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
    },
    [navigation, photoUrl, releaseHeldLeave, save],
  );

  const submitForm = handleSubmit(submit);

  const onSave = useCallback(() => {
    /*
      Not while a photo is still uploading: its URL would miss this save. Both
      checks, because each covers a frame the other cannot: `isRunning` is true
      from the tap that starts an upload, before `isBusy` lands; `isBusy` stays
      true for the frame after it ends, before the uploaded URL reaches this
      handler.
    */
    if (photo.isBusy || photo.isRunning()) {
      return;
    }
    // Never rejects: a failed save is the hook's `saveError`.
    submitForm();
  }, [photo, submitForm]);

  /*
    Not while a save or a status change is running. `isBusy` reads the hook's
    refs, so a tap in the frame before `isSaving` lands is refused too — a photo
    uploaded under a save in the air would never reach it.
  */
  const takePhoto = useCallback(() => {
    if (!isBusy()) {
      photo.choose('camera');
    }
  }, [isBusy, photo]);
  const choosePhoto = useCallback(() => {
    if (!isBusy()) {
      photo.choose('gallery');
    }
  }, [isBusy, photo]);
  const removePhoto = useCallback(() => {
    if (!isBusy()) {
      photo.remove();
    }
  }, [isBusy, photo]);
  const retryPhoto = useCallback(() => {
    if (!isBusy()) {
      photo.retry();
    }
  }, [isBusy, photo]);

  /** A status change, then any leave held while it ran. */
  const changeStatus = useCallback<TeamMemberFormState['setStatus']>(
    async status => {
      const outcome = await setStatus(status);
      releaseHeldLeave();
      return outcome;
    },
    [releaseHeldLeave, setStatus],
  );

  return (
    <View style={{ gap: theme.spacing.xl }}>
      {/*
        Section 39's Profile Image. The picture is not a stop of its own (no
        `pictureSpoken`): the actions already say whether there is a photo.
      */}
      <PhotoField
        photo={photo}
        photoUrl={photoUrl}
        name={watch('name')}
        copy={COPY}
        // One thing at a time: never while the member is being saved or their status changed.
        locked={isSaving || isChangingStatus}
        onTakePhoto={takePhoto}
        onChoosePhoto={choosePhoto}
        onRemovePhoto={removePhoto}
        onRetryPhoto={retryPhoto}
        testID="team-member-photo"
      />

      <View style={{ gap: theme.spacing.lg }}>
        <ControlledInput
          control={control}
          name="name"
          label={COPY.nameLabel}
          required
          placeholder={COPY.namePlaceholder}
          maxLength={TEAM_MEMBER_NAME_MAX_LENGTH}
          autoCapitalize="words"
          editable={!isSaving}
          testID="team-member-name"
        />

        <ControlledInput
          control={control}
          name="role"
          label={COPY.roleLabel}
          required
          placeholder={COPY.rolePlaceholder}
          maxLength={TEAM_MEMBER_ROLE_MAX_LENGTH}
          autoCapitalize="sentences"
          editable={!isSaving}
          testID="team-member-role"
        />

        <ControlledInput
          control={control}
          name="phone"
          as={PhoneInput}
          sanitize={capPhoneInput}
          label={COPY.phoneLabel}
          placeholder={COPY.phonePlaceholder}
          helperText={COPY.phoneHelper}
          editable={!isSaving}
          testID="team-member-phone"
        />
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {hasFieldErrors ? (
          <Text
            variant="caption"
            color="danger"
            accessibilityLiveRegion="polite"
            testID="team-member-fix-errors">
            {COPY.fixErrors}
          </Text>
        ) : null}

        {saveError ? (
          <ErrorState
            error={saveError}
            title={COPY.saveFailedTitle}
            fullScreen={false}
            testID="team-member-save-error"
          />
        ) : null}

        <PrimaryButton
          fullWidth
          label={isSaving ? COPY.saving : isEditing ? COPY.saveEdit : COPY.saveAdd}
          icon={isEditing ? undefined : 'add'}
          onPress={onSave}
          isLoading={isSaving}
          // Waits for a status change, so the two never cross on the wire, and
          // for a photo upload, whose URL would otherwise miss the save.
          disabled={isChangingStatus || photo.isBusy}
          accessibilityHint={isEditing ? COPY.saveEditHint : COPY.saveAddHint}
        />
      </View>

      {isEditing && member ? (
        <TeamMemberStatusSection
          member={member}
          setStatus={changeStatus}
          isChangingStatus={isChangingStatus}
          isSaving={isSaving}
        />
      ) : null}

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
        testID="team-member-discard-dialog"
      />
    </View>
  );
}

interface TeamMemberStatusSectionProps {
  /** The member as the service last answered — their stored name and status. */
  member: TeamMember;
  setStatus: TeamMemberFormState['setStatus'];
  isChangingStatus: boolean;
  /** Save is running: the status action waits for it. */
  isSaving: boolean;
}

/**
 * Section 39's Status, at the foot of the edit form: the badge, a sentence on
 * what it means, and the one action the status allows.
 *
 * ⚠️ Nothing here reads or writes the form's fields. The dialog names the
 * member as stored, not as half-typed above it.
 */
function TeamMemberStatusSection({
  member,
  setStatus,
  isChangingStatus,
  isSaving,
}: TeamMemberStatusSectionProps) {
  const theme = useTheme();
  const status = presentTeamMemberStatus(member.status);

  const [isConfirming, setIsConfirming] = useState(false);

  const askToDisable = useCallback(() => setIsConfirming(true), []);
  const keepActive = useCallback(() => setIsConfirming(false), []);
  const confirmDisable = useCallback(() => {
    setStatus(TEAM_MEMBER_STATUS.disabled).then(outcome => {
      // Closed on the answer, either way — the toast says which. A second press
      // while the first is in the air is not an answer; the first one closes it.
      if (outcome !== 'ignored') {
        setIsConfirming(false);
      }
    });
  }, [setStatus]);
  // Taking the mark off loses nothing, so it does not ask.
  const enable = useCallback(() => {
    setStatus(TEAM_MEMBER_STATUS.active);
  }, [setStatus]);

  return (
    <View
      style={{
        gap: theme.spacing.md,
        paddingTop: theme.spacing.lg,
        borderTopWidth: theme.borderWidth.hairline,
        borderTopColor: theme.colors.border,
      }}
      testID="team-member-status">
      <Text variant="overline" color="textTertiary" accessibilityRole="header">
        {COPY.statusSection}
      </Text>

      <StatusBadge label={status.label} tone={status.tone} testID="team-member-status-badge" />

      <Text variant="body" color="textSecondary" testID="team-member-status-message">
        {status.formMessage}
      </Text>

      {status.isDisabled ? (
        <SecondaryButton
          fullWidth
          label={COPY.enable}
          onPress={enable}
          isLoading={isChangingStatus}
          disabled={isSaving}
          accessibilityHint={COPY.enableHint}
        />
      ) : (
        /*
          The quiet red, not the filled one (3G-4): Disable only opens the
          dialog, and the dialog's Disable is the loud, final step.
        */
        <Button
          fullWidth
          variant="dangerSecondary"
          label={COPY.disable}
          onPress={askToDisable}
          isLoading={isChangingStatus}
          disabled={isSaving}
          accessibilityHint={COPY.disableHint}
        />
      )}

      <ConfirmDialog
        visible={isConfirming}
        title={COPY.disableTitle(member.name)}
        message={COPY.disableMessage}
        cancelLabel={COPY.disableCancel}
        cancelHint={COPY.disableCancelHint}
        confirmLabel={COPY.disableConfirm}
        confirmHint={COPY.disableConfirmHint}
        onCancel={keepActive}
        onConfirm={confirmDisable}
        isConfirming={isChangingStatus}
        testID="team-member-disable-dialog"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
});
