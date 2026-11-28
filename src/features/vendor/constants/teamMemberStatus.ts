/**
 * Team member status presentation
 *
 * What a team member's status (PROJECT_BIBLE.md section 39: "Status",
 * "Disable Team Member") says on screen and to a screen reader, and which of
 * the two status actions it allows.
 *
 * ⚠️ It maps, it never decides. The status is the backend's plain string; this
 * table only words the two the app knows — `ACTIVE` and `DISABLED` — and says
 * whether the member counts as disabled for what the form offers. The status
 * is changed by the service (`setMemberStatus`), never here.
 *
 * ⚠️ Active draws nothing on a card. It is how nearly everybody is, and a
 * badge on every card saying so would be noise that hides the one that
 * matters; the edit form, which is about this one member, names it. Disabled
 * is a neutral badge — a mark the vendor chose, not a warning or a failure.
 *
 * ⚠️ A status the app has never seen falls back safely, and the decision is
 * this: it is drawn as a neutral "Status unavailable" badge on the card and in
 * the form — the raw value is never shown, as for an unknown request status
 * (3E-3, `jobPresentation.ts`) — and it is treated as **not disabled** for
 * actions. The form then offers "Disable member", which sets a status the app
 * knows; it never offers "Enable member" for a state it cannot say is
 * disabled. A missing or non-string status is unknown too: the contract
 * requires one, so its absence is not quietly read as active. Its words say
 * so: the form's sentence for it is neither the active nor the disabled one
 * (a review found it first called an unknown member active).
 */

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { StatusTone } from '@/shared/components/StatusBadge';
import { TEAM_MEMBER_STATUS } from '@/shared/services/types/VendorTeamService';

const COPY = VENDOR_COPY.team;
const FORM = VENDOR_COPY.teamForm;

export interface TeamMemberStatusPresentation {
  /** The badge's words: "Active", "Disabled", "Status unavailable". */
  label: string;
  tone: StatusTone;
  /** The edit form's sentence under the badge: what the status means and what the action does. */
  formMessage: string;
  /** Whether the member's card shows the badge. Only active goes without. */
  showOnCard: boolean;
  /**
   * Whether the member counts as disabled for what may be done: the form
   * offers Enable when true and Disable when false.
   */
  isDisabled: boolean;
}

/*
  ⚠️ `label` and `formMessage` are getters over copy keys. They were strings
  read when this module loaded, which kept a member's badge and the form's
  status sentence in that moment's language after the app switched (Phase 5,
  28/11/2026). The three presentations stay the same three objects.
*/
function statusPresentation(
  label: 'statusActive' | 'statusDisabled' | 'statusUnknown',
  formMessage: 'statusActiveMessage' | 'statusDisabledMessage' | 'statusUnknownMessage',
  look: Pick<TeamMemberStatusPresentation, 'tone' | 'showOnCard' | 'isDisabled'>,
): TeamMemberStatusPresentation {
  return Object.freeze({
    get label(): string {
      return COPY[label];
    },
    get formMessage(): string {
      return FORM[formMessage];
    },
    ...look,
  });
}

const ACTIVE = statusPresentation('statusActive', 'statusActiveMessage', {
  tone: 'success',
  showOnCard: false,
  isDisabled: false,
});

const DISABLED = statusPresentation('statusDisabled', 'statusDisabledMessage', {
  tone: 'neutral',
  showOnCard: true,
  isDisabled: true,
});

const UNKNOWN = statusPresentation('statusUnknown', 'statusUnknownMessage', {
  tone: 'neutral',
  showOnCard: true,
  isDisabled: false,
});

/**
 * A member's status, ready to draw. Compared trimmed and upper-cased, so a
 * backend that answers `disabled` is still understood.
 */
export function presentTeamMemberStatus(status: unknown): TeamMemberStatusPresentation {
  const token = typeof status === 'string' ? status.trim().toUpperCase() : '';

  switch (token) {
    case TEAM_MEMBER_STATUS.active:
      return ACTIVE;
    case TEAM_MEMBER_STATUS.disabled:
      return DISABLED;
    default:
      return UNKNOWN;
  }
}
