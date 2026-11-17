/**
 * VendorTeamService
 *
 * The people who work for the signed-in vendor (PROJECT_BIBLE.md section 39:
 * "View Team Members, Add Team Member, Edit Team Member … View Team Member";
 * Phase 3E-7). A list the vendor keeps, and nothing more.
 *
 * ⚠️ Simple on purpose — section 39: "Phase 1 team management should remain
 * simple", section 40: "Do not build a complex workforce-management system in
 * Phase 1." A member is a name, a role, optionally a phone number and a photo,
 * and a status — active or disabled. There
 * is no assignment to requests (section 40), no permissions or hierarchy, no
 * login — team members never sign in (section 7A.3) — and no attendance, pay,
 * availability, location or notifications. Assignment, when it comes, refers
 * to a member by `id`; nothing here has to move for it.
 *
 * ⚠️ Section 39's Status and "Disable Team Member" came after 3E-7: every
 * member has a `status`, and `setMemberStatus` is the one way to change it —
 * never `addMember` or `updateMember`, whose input carries no status, so
 * saving a member's details can never quietly re-enable them. Disabled is a
 * mark the vendor keeps, and nothing more in Phase 1: a disabled member stays
 * on the team, in their place, and nothing signs in, is assigned or is
 * stopped because of it (section 40 is not built).
 *
 * ⚠️ Section 39's Profile Image is `photoUrl` (2026-10-21): optional, an
 * uploaded picture's remote URL — never a file on the device, which would show
 * nothing anywhere else. It is a detail like the phone, so it obeys the same
 * rule: `updateMember` replaces every detail, and an input without `photoUrl`
 * means the member has no photo — on an edit, that removes the one they had.
 * The app therefore always sends the photo it is showing.
 *
 * ⚠️ Every mutation returns the whole team, not the one member it touched — as
 * `AddressBookService` does. The service decides the order, and a screen that
 * spliced a record into its own copy would become a second authority on it;
 * adopting the answer is also how a removal refreshes the list without a
 * second read.
 *
 * ⚠️ Scoped by the session, so no call takes a vendor id. Whose team it is, is
 * decided by who is signed in — never by a route or a caller. Every call
 * rejects with `unauthorized` when nobody is signed in and when the session is
 * a customer's. A member id that is not on this vendor's team is `notFound`,
 * not `forbidden` — including one that exists on somebody else's — so another
 * team's members cannot be discovered by asking.
 *
 * A frontend contract: no backend team endpoint exists yet.
 */

/**
 * The longest name and role the app accepts. The app's ceilings, not the
 * backend's — none has been agreed — sized for the longest real names and
 * titles rather than to make a layout look tidy.
 */
export const TEAM_MEMBER_NAME_MAX_LENGTH = 80;
export const TEAM_MEMBER_ROLE_MAX_LENGTH = 60;

/**
 * The statuses the app knows, and the only two it ever sends (section 39:
 * "Status", "Disable Team Member"). A new member is `ACTIVE`.
 *
 * ⚠️ Not the type of `TeamMember.status`, which is a plain string: the backend
 * owns the vocabulary and may one day answer with a value the app has never
 * heard of. Reading one is the presentation table's job
 * (`teamMemberStatus.ts`), which falls back safely; these are what the app
 * sends and compares against.
 */
export const TEAM_MEMBER_STATUS = Object.freeze({
  active: 'ACTIVE',
  disabled: 'DISABLED',
} as const);

/** A status the app may ask for. */
export type SettableTeamMemberStatus =
  (typeof TEAM_MEMBER_STATUS)[keyof typeof TEAM_MEMBER_STATUS];

/** One person on the vendor's team. */
export interface TeamMember {
  /** The team's own handle for this member. Assignment would refer to it. */
  id: string;

  /** Who they are, as the vendor writes it. Required. */
  name: string;

  /** What they do — section 39's "Designation". Required (owner decision, 2026-10-08). */
  role: string;

  /**
   * How to reach them, as digits — the canonical form every phone number in
   * the app is sent in (`normalisePhone`). Absent when the vendor gave none,
   * never an empty string. Contact only: a team member has no account.
   */
  phone?: string;

  /**
   * Section 39's "Profile Image": the remote URL of an uploaded picture
   * (`ImageService.upload`), http or https. Absent when there is none — never
   * an empty string — and the app then shows the member's initials.
   */
  photoUrl?: string;

  /**
   * Section 39's "Status", as the backend says it — `ACTIVE` or `DISABLED`
   * today (`TEAM_MEMBER_STATUS`), a plain string so a value the app does not
   * know is still read rather than refused. Changed only by
   * `setMemberStatus`.
   */
  status: string;
}

/**
 * What the vendor supplies to add a member or change their details. No id —
 * the service issues it — and no status: a new member is always `ACTIVE`, and
 * an edit keeps whatever status the member has.
 */
export type TeamMemberInput = Omit<TeamMember, 'id' | 'status'>;

export interface VendorTeamService {
  /**
   * The vendor's team, in the order members were added.
   *
   * Empty is an ordinary answer — every new business starts with nobody.
   */
  listMembers(): Promise<TeamMember[]>;

  /**
   * Adds one, `ACTIVE`, and answers with the whole team.
   *
   * Rejects with `validation` when the name or role is missing or too long, the
   * phone is not a phone number, or the photo is not an http(s) URL.
   */
  addMember(input: TeamMemberInput): Promise<TeamMember[]>;

  /**
   * Replaces one member's details, keeping their `id`, status and place in the
   * list. Every detail: a phone or `photoUrl` left out of the input is removed.
   *
   * Rejects with `notFound` when the id is not on this vendor's team, and with
   * `validation` as `addMember` does.
   */
  updateMember(memberId: string, input: TeamMemberInput): Promise<TeamMember[]>;

  /**
   * Marks one member disabled, or active again (section 39's "Disable Team
   * Member"), keeping everything else about them — details, id and place —
   * and answers with the whole team.
   *
   * Asking for the status a member already has succeeds and changes nothing,
   * so a retry after a lost answer is safe. Rejects with `notFound` when the id
   * is not on this vendor's team, and with `validation` for a status other
   * than the two in `TEAM_MEMBER_STATUS`.
   */
  setMemberStatus(memberId: string, status: SettableTeamMemberStatus): Promise<TeamMember[]>;

  /**
   * Takes one off the team, and answers with who remains.
   *
   * Rejects with `notFound` when the id is not on this vendor's team.
   */
  removeMember(memberId: string): Promise<TeamMember[]>;
}
