/**
 * useTeamMemberForm
 *
 * Reading one team member to edit, and saving the form — a new member or a
 * changed one (PROJECT_BIBLE.md section 39, Phase 3E-7).
 *
 *   validated form → VendorTeamService.addMember / updateMember
 *
 * ⚠️ The member is read from the service, never carried in the route. The route
 * holds an id; a record handed along in params is a copy that can be stale by
 * the time it is saved (`EditAddressScreen` reads its address the same way). A
 * member who is no longer on the team — removed elsewhere, or an id that was
 * never this vendor's — is `isNotFound`, an answer and not an error.
 *
 * ⚠️ One save at a time. `isSaving` disables the button, but state lands a render
 * late and two quick presses can both get in before it does, so the ref is what
 * actually refuses the second one; it is released in a `finally`, so a failure
 * never leaves Save dead. A failure keeps every value; Save is the retry.
 *
 * Success is said here, once, as a toast; leaving the form is the screen's.
 *
 * ⚠️ The status (section 39's "Disable Team Member") is changed here too, and
 * on its own: `setStatus` calls `setMemberStatus` at once, not on Save, and
 * touches nothing the vendor has typed — the form's values are the screen's
 * and are never reseeded. Its answer is the whole team, and the member is then
 * read from that answer, so the form shows the status the service stored
 * rather than one it assumed. The form reads its member once and never again
 * while it is open, so no older read can arrive after the answer. Saving and
 * changing the status never overlap: each refuses while either is running,
 * by ref, before state can catch up. The outcome is a toast — the vendor
 * side's convention (`useVendorTeam`'s removal) — and a failure changes
 * nothing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { ERROR_PRESENTATION, useToast } from '@/shared/components';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import {
  TEAM_MEMBER_STATUS,
  type SettableTeamMemberStatus,
  type TeamMember,
  type TeamMemberInput,
} from '@/shared/services/types/VendorTeamService';
import { AppError } from '@/shared/types/error';

const COPY = VENDOR_COPY.teamForm;

const log = createLogger('useTeamMemberForm');

/**
 * What a status change came to. `ignored` is a request made while a status
 * change or a save was already running, or while adding.
 */
export type TeamStatusOutcome = 'changed' | 'failed' | 'ignored';

export interface TeamMemberFormState {
  /** Whether this is a member being changed rather than one being added. */
  isEditing: boolean;

  /** The member being edited, once read. Undefined while adding. */
  member: TeamMember | undefined;
  /** Reading the member to edit. Never true while adding. */
  isLoading: boolean;
  /** The member could not be read. */
  loadError: AppError | null;
  /** Read, and not on this vendor's team. */
  isNotFound: boolean;
  retryLoad: () => void;

  /** Resolves with the whole team once stored, or null when it failed or was already running. */
  save: (input: TeamMemberInput) => Promise<TeamMember[] | null>;
  isSaving: boolean;
  saveError: AppError | null;

  /**
   * Marks the member being edited disabled, or active again — at once, not on
   * Save. Resolves once the service has answered, having said the outcome.
   */
  setStatus: (status: SettableTeamMemberStatus) => Promise<TeamStatusOutcome>;
  /** A status change is running. */
  isChangingStatus: boolean;

  /**
   * Whether a save or a status change is running at this moment. Read from the
   * refs, so it is true from the instant either starts — before `isSaving` or
   * `isChangingStatus` has landed — and false by the time its promise settles.
   * For the screen's leave guard, which must not let the team re-read before
   * the write it is waiting on.
   */
  isBusy: () => boolean;
}

export function useTeamMemberForm(memberId: string | undefined): TeamMemberFormState {
  const { showToast } = useToast();
  const isEditing = memberId !== undefined;

  const team = useSingleFlightQuery<TeamMember[]>(
    useCallback(() => getService('vendorTeam').listMembers(), []),
    [],
    { enabled: isEditing },
  );

  /*
    The team a status change answered with, once there is one: newer than the
    read the form opened on, which is never repeated while the form is open.
  */
  const [statusAnswer, setStatusAnswer] = useState<TeamMember[] | null>(null);
  const latestTeam = statusAnswer ?? team.data;

  const member = useMemo(
    () => (isEditing ? latestTeam?.find(candidate => candidate.id === memberId) : undefined),
    [isEditing, memberId, latestTeam],
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutation = useServiceMutation<[TeamMemberInput], TeamMember[]>(
    useCallback(
      (input: TeamMemberInput) =>
        memberId === undefined
          ? getService('vendorTeam').addMember(input)
          : getService('vendorTeam').updateMember(memberId, input),
      [memberId],
    ),
  );
  const { mutate } = mutation;

  const inFlight = useRef(false);
  const statusInFlight = useRef(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const save = useCallback(
    async (input: TeamMemberInput) => {
      if (inFlight.current || statusInFlight.current) {
        return null;
      }
      inFlight.current = true;
      try {
        const saved = await mutate(input);
        if (saved) {
          showToast({
            message: isEditing ? COPY.saved : COPY.added,
            tone: 'success',
            icon: 'success',
          });
        }
        return saved;
      } finally {
        inFlight.current = false;
      }
    },
    [isEditing, mutate, showToast],
  );

  const setStatus = useCallback(
    async (status: SettableTeamMemberStatus): Promise<TeamStatusOutcome> => {
      if (memberId === undefined || inFlight.current || statusInFlight.current) {
        return 'ignored';
      }
      statusInFlight.current = true;
      setIsChangingStatus(true);
      const disabling = status === TEAM_MEMBER_STATUS.disabled;

      try {
        const answer = await getService('vendorTeam').setMemberStatus(memberId, status);
        if (mountedRef.current) {
          setStatusAnswer(answer);
        }
        showToast({
          message: disabling ? COPY.disabled : COPY.enabled,
          tone: 'success',
          icon: 'success',
        });
        return 'changed';
      } catch (caught) {
        const error = AppError.from(caught);
        // By kind only, never by name.
        log.warn('Team member status not changed', { kind: error.kind });
        const { tone, icon } = ERROR_PRESENTATION[error.kind];
        showToast({
          message: `${disabling ? COPY.disableFailed : COPY.enableFailed} ${error.userMessage}`,
          tone,
          icon,
        });
        return 'failed';
      } finally {
        statusInFlight.current = false;
        if (mountedRef.current) {
          setIsChangingStatus(false);
        }
      }
    },
    [memberId, showToast],
  );

  const isBusy = useCallback(() => inFlight.current || statusInFlight.current, []);

  return {
    isEditing,
    member,
    isLoading: isEditing && team.isLoading,
    loadError: team.data === undefined ? team.error : null,
    isNotFound: isEditing && latestTeam !== undefined && member === undefined,
    retryLoad: team.retry,
    save,
    isSaving: mutation.isSubmitting,
    saveError: mutation.error,
    setStatus,
    isChangingStatus,
    isBusy,
  };
}
