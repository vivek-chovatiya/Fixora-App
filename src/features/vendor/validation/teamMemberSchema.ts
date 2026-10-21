/**
 * Team member form schema (Phase 3E-7).
 *
 * The form's rules are the service's rules said to a person: a name and a role
 * are required (owner decision, 2026-10-08) and bounded by the contract's
 * ceilings; the phone is optional, and when one is given it must pass the app's
 * one phone rule (`shared/validation/phone`) — the same messages a vendor saw
 * when they registered, rather than a second rule that could drift from it.
 *
 * Values are trimmed here, so what is validated is what is sent.
 */

import { z } from 'zod';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  TEAM_MEMBER_NAME_MAX_LENGTH,
  TEAM_MEMBER_ROLE_MAX_LENGTH,
  type TeamMember,
  type TeamMemberInput,
} from '@/shared/services/types/VendorTeamService';
import { normalisePhone, phoneSchema } from '@/shared/validation/phone';

const COPY = VENDOR_COPY.validation;

export const teamMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, COPY.memberNameRequired)
    .max(TEAM_MEMBER_NAME_MAX_LENGTH, COPY.memberNameTooLong(TEAM_MEMBER_NAME_MAX_LENGTH)),
  role: z
    .string()
    .trim()
    .min(1, COPY.memberRoleRequired)
    .max(TEAM_MEMBER_ROLE_MAX_LENGTH, COPY.memberRoleTooLong(TEAM_MEMBER_ROLE_MAX_LENGTH)),
  // Optional: blank is no phone. Anything typed is held to the shared rule, with its own words.
  phone: z
    .string()
    .trim()
    .superRefine((value, context) => {
      if (!value) {
        return;
      }
      const checked = phoneSchema.safeParse(value);
      if (!checked.success) {
        context.addIssue({ code: 'custom', message: checked.error.issues[0]?.message });
      }
    }),
});

export type TeamMemberForm = z.infer<typeof teamMemberSchema>;

/** What the form opens with: a member's details, or nothing for a new one. */
export function teamMemberFormValues(member?: TeamMember): TeamMemberForm {
  return {
    name: member?.name ?? '',
    role: member?.role ?? '',
    phone: member?.phone ?? '',
  };
}

/**
 * The form's values as the service's input.
 *
 * A blank phone is sent as absent — the vendor gave none, or cleared it —
 * rather than as an empty string the backend would have to interpret. A phone
 * is sent as digits, as every phone number leaving the app is.
 *
 * ⚠️ The photo is not one of the form's fields: it is uploaded when chosen and
 * held beside the form (the business picture's way, `buildVendorProfileUpdate`),
 * so it is handed in here — the uploaded URL the form is showing, or nothing.
 * Nothing is sent as absent, and on an edit absent removes the member's photo
 * (`updateMember` replaces every detail), so the caller always passes the one
 * on screen.
 */
export function buildTeamMemberInput(values: TeamMemberForm, photoUrl?: string): TeamMemberInput {
  return {
    name: values.name,
    role: values.role,
    ...(values.phone ? { phone: normalisePhone(values.phone) } : {}),
    ...(photoUrl ? { photoUrl } : {}),
  };
}
