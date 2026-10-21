/**
 * useCustomerProfile
 *
 * What the profile screen shows about the signed-in customer (PROJECT_BIBLE.md
 * section 25), read from the session.
 *
 * ⚠️ The session is the source, and the only one. There is no profile service
 * and no copy of the user in another store: `AuthUser` already holds the name,
 * the phone and the email the backend returned at sign-in, and a second holder
 * would be a second answer that can disagree with the first. When editing a
 * profile arrives it updates the session (`userUpdated`) and this reads it.
 *
 * The rules for what is missing live here rather than in the screen:
 *
 * - a name is the first and last name, trimmed, with blanks dropped; when both
 *   are blank there is no name, and the phone number heads the page instead —
 *   an account created on first verification (section 7A) has only a number —
 *   written as `formatPhone` writes it ("+91 98765 43210"; owner, 21/10/2026),
 *   since the heading is text to read, never a value to send
 * - an email is shown only when there is one; a blank one counts as none
 * - a picture is shown only when one has been stored; the avatar falls back to
 *   initials, and then to a glyph, exactly as it did before there was one
 */

import { useMemo } from 'react';

import { useAuthSession } from '@/features/auth/hooks/useAuth';
import type { AuthUser } from '@/features/auth/types';
import { formatPhone } from '@/shared/presentation/phone';

export interface CustomerProfile {
  /**
   * The parts, as stored, for the form that edits them.
   *
   * Separate from `name` because a form needs the fields the backend holds
   * while the profile needs the one string a person reads; deriving either from
   * the other would lose which part is which.
   */
  firstName: string;
  lastName: string;
  /** The customer's name, or null when the account has none. */
  name: string | null;
  /** What heads the page: the name, or the phone number, formatted, when there is no name. */
  heading: string;
  /**
   * Exactly as the backend holds it. A screen writes it with `formatPhone`; it
   * is never formatted here, because this is the value, not its display.
   */
  phone: string;
  /** Absent when the account has no email. */
  email?: string;
  /** The stored picture, absent until one has been uploaded successfully. */
  avatarUrl?: string;
}

/** Exported for its tests: the rules, without a store. */
export function profileOf(user: AuthUser): CustomerProfile {
  const firstName = typeof user.firstName === 'string' ? user.firstName.trim() : '';
  const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : '';
  const name = [firstName, lastName].filter(Boolean).join(' ');
  const email = user.email?.trim();
  const avatarUrl = user.avatarUrl?.trim();

  return {
    firstName,
    lastName,
    name: name || null,
    heading: name || formatPhone(user.phone),
    phone: user.phone,
    ...(email ? { email } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  };
}

/** The signed-in customer's profile, or null in the instant after signing out. */
export function useCustomerProfile(): CustomerProfile | null {
  const { user } = useAuthSession();

  return useMemo(() => (user ? profileOf(user) : null), [user]);
}
