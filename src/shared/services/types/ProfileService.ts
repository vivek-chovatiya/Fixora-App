/**
 * ProfileService
 *
 * Changing what the account says about its owner (PROJECT_BIBLE.md section 25:
 * "Actions: Edit Profile, Change Profile Image").
 *
 * ⚠️ Separate from `AuthService` on purpose. Authentication answers "is this
 * person who they say they are" — codes, sessions, the vendor's standing
 * credential. This answers "what is their name". They change at different
 * times, they will almost certainly be different endpoints, and a name edit
 * must never sit on the interface that issues credentials.
 *
 * ⚠️ Every operation returns the whole updated `AuthUser`, not an
 * acknowledgement. The session is the one place this application keeps the
 * customer's identity (section 12 of the constitution: promote to global state
 * only when unrelated modules need it, and never keep two answers). A caller
 * that got back `void` would have to guess what the server stored and write its
 * guess into the session; returning the record means the backend stays the
 * authority over its own normalisation — trimming, casing, whatever it does to
 * an email — and the device simply adopts the result.
 *
 * ⚠️ The phone number is absent from every input here. Section 7A makes it the
 * identity a customer signs in with, so changing it is changing which account
 * this is; that needs a verification flow of its own and is not this phase.
 */

import type { AuthUser } from '@/features/auth/types';

/**
 * Ceiling on each part of a name, in characters.
 *
 * ⚠️ Section 25 sets none. This is long enough for any real name — the longest
 * in the mock data is 28 characters — and short enough that a pasted paragraph
 * is refused. The backend's own limit is the authority once there is one, and
 * WORKING_NOTES lists it as an open decision.
 */
export const PROFILE_NAME_MAX_LENGTH = 50;

/**
 * What Edit Profile can change.
 *
 * `email` absent means the customer cleared it — the address is removed, not
 * left alone. There is no way to say "leave it as it is", because the form
 * always submits the whole set of editable fields and a partial update would
 * make "I deleted my email" indistinguishable from "I did not touch it".
 */
export interface CustomerProfileUpdate {
  firstName: string;
  /** May be blank: not every name has a second part. */
  lastName: string;
  email?: string;
}

export interface ProfileService {
  /** Rejects with a `validation` error when the backend refuses the values. */
  updateProfile(input: CustomerProfileUpdate): Promise<AuthUser>;

  /**
   * Attaches an already-uploaded image to the account.
   *
   * Takes a remote URL because uploading is `ImageService`'s work and is
   * finished by the time this is called. Splitting it this way keeps one
   * uploader for every image in the application, and means a failed upload
   * never reaches the profile at all.
   */
  setProfileImage(remoteUrl: string): Promise<AuthUser>;

  removeProfileImage(): Promise<AuthUser>;
}
