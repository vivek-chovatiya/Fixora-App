/**
 * MOCK VENDOR TEAM DATA — DEVELOPMENT ONLY
 *
 * The team a mock vendor starts with, so the Team tab (PROJECT_BIBLE.md
 * section 39, Phase 3E-7) has something to show before anybody adds a member.
 * Fixtures, not people: nobody here exists, and the phone numbers are in the
 * same made-up `90000…` range as the demo vendors' own.
 *
 * ⚠️ A starting point, not a table. The mock offers a vendor this team only
 * until their team is first written; from then on the saved team is the whole
 * answer, so a vendor who removes everybody is never handed these back.
 *
 * ⚠️ Per vendor, by id. Ravi (`usr_vendor_1`), who has been trading a while,
 * has three people; Meena (`usr_vendor_2`), who has just set up, has nobody —
 * which is also what makes "Vendor B sees none of Vendor A's team" checkable by
 * signing in. Any vendor registered in the app starts with nobody too.
 *
 * The three are chosen to be the states a member card must draw: a plain one,
 * one whose every field is long enough to wrap at 360dp, and one with no phone.
 * No role here names a service category (section 11).
 *
 * ⚠️ Everybody starts `ACTIVE`, as a member the vendor adds does. Disabled is
 * something the vendor does to a member (section 39), so it is reached by
 * doing it — and a team already saved on a device from before statuses
 * existed reads as all active anyway (`MockVendorTeamStorage`).
 */

import {
  TEAM_MEMBER_STATUS,
  type TeamMember,
} from '@/shared/services/types/VendorTeamService';

const ACTIVE = TEAM_MEMBER_STATUS.active;

const RAVI_TEAM: readonly TeamMember[] = Object.freeze([
  { id: 'tm_1', name: 'Suresh Naik', role: 'Senior technician', phone: '9000000101', status: ACTIVE },
  {
    // The stress case: a long name and a long role.
    id: 'tm_2',
    name: 'Venkata Subrahmanya Lakshmi Narasimhamurthy-Ramachandran',
    role: 'Installation and wiring specialist, weekend shifts',
    phone: '9000000102',
    status: ACTIVE,
  },
  // No phone: it is optional, and the card must not draw an empty line for it.
  { id: 'tm_3', name: 'Farhan Ali', role: 'Helper', status: ACTIVE },
]);

const VENDOR_TEAMS: Readonly<Record<string, readonly TeamMember[]>> = Object.freeze({
  usr_vendor_1: RAVI_TEAM,
});

/** The team a vendor starts with before anything is saved. Fresh objects each call. */
export function mockStartingTeamFor(vendorId: string): TeamMember[] {
  return (VENDOR_TEAMS[vendorId] ?? []).map(member => ({ ...member }));
}
