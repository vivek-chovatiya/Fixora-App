/**
 * Edit Profile form schema (PROJECT_BIBLE.md section 25, Phase 3D-8).
 *
 * ⚠️ Only the fields section 25 says the profile displays and that Edit Profile
 * can change: the name and the email. The phone number is not here at all —
 * section 7A makes it the identity a customer signs in with, so it is shown
 * read-only and never submitted.
 *
 * ⚠️ A first name is required and a last name is not. Section 25 says nothing
 * about either, so the rule is chosen rather than found, and it is chosen this
 * way because plenty of people have one name and none has none: requiring both
 * would make a mononym unsaveable, while requiring neither would let somebody
 * empty their profile until the app calls them by their phone number again.
 * 3D-7's no-name fallback stays for accounts that have never been edited.
 *
 * The email is optional and may be emptied, which is how it is removed. An
 * address that is typed must still look like one — `optionalEmailSchema` is the
 * same rule vendor registration already uses, reused rather than rewritten.
 *
 * ⚠️ Every message is read through a function (`{ error: () => … }`). The
 * schema is built once, when this module loads; a string read then would stay
 * in that moment's language after the app's language changes (Phase 5,
 * 28/11/2026).
 */

import { z } from 'zod';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { PROFILE_NAME_MAX_LENGTH } from '@/shared/services/types/ProfileService';
import { optionalEmailSchema } from '@/shared/validation/email';

const COPY = CUSTOMER_COPY.editProfile;

const tooLong = {
  error: () => COPY.nameTooLong.replace('{count}', String(PROFILE_NAME_MAX_LENGTH)),
};

export const profileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { error: () => COPY.firstNameRequired })
    .max(PROFILE_NAME_MAX_LENGTH, tooLong),
  /*
    Trimmed but not required: blank is a real answer, and 3D-7's name rule
    already drops the empty part when it joins the two.
  */
  lastName: z.string().trim().max(PROFILE_NAME_MAX_LENGTH, tooLong),
  email: optionalEmailSchema,
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
