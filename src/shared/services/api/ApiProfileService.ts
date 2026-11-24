/**
 * ApiProfileService
 *
 * ProfileService against the real backend: a customer editing their own name
 * and email (PROJECT_BIBLE.md section 25). Replaces `MockProfileService`, which
 * changed only the copy of the user held on this device.
 *
 * Endpoint: `POST /customers/update` `{ id, firstName, lastName, email? }`, or
 * `{ id, profileImage }` for the photo, answering with the customer's record,
 * read here into the session's `AuthUser` — the same fields `/auth/me` and the
 * sign-in session carry, so the session adopts the backend's own normalisation
 * (a trimmed, lower-cased email). `/auth/me` itself is not needed: the session
 * already holds the id, and the update answers with the record.
 *
 * Decisions:
 * - **Only the signed-in customer's own id is ever sent.** The backend does not
 *   check that the id is the caller's own — any signed-in account can update any
 *   customer, status and phone included (WORKING_NOTES: backend risk) — so the
 *   id comes from the session, the body carries the editable fields and nothing
 *   else, and an answer for any other id is refused.
 * - **Clearing an email sends `email: null`** (Phase 4B contract §7), and only
 *   when the customer had one: the interface says an absent email means it was
 *   removed, and a customer with none has nothing to remove. The backend
 *   removes it, or refuses with `EMAIL_REQUIRED_FOR_SIGN_IN` when the email is
 *   their only way to sign in — nothing changes then, the names included, so
 *   the form keeps every value it was given and says why.
 * - **A new photo is the URL `ImageService` uploaded** (`profile`), sent as it
 *   is: the backend takes its own `/uploads/...` path back in the full-URL form
 *   (contract §2). The photo read back — the session's `avatarUrl` — goes
 *   through `toImageUrl`, so a stored path becomes an address this phone loads.
 *
 * ⚠️ Names are trimmed and the first is required, as the mock does, so a
 * refusal reads the same either way; the backend remains the authority on the
 * rest (its own lengths, the email's shape, an email another account holds).
 */

import { createLogger } from '@/core/logger/Logger';
import type { AuthUser } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import {
  malformedResponse,
  optionalString,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import { toImageUrl } from '@/shared/services/api/uploadUrls';
import {
  PROFILE_NAME_MAX_LENGTH,
  type CustomerProfileUpdate,
  type ProfileService,
} from '@/shared/services/types/ProfileService';
import { AppError } from '@/shared/types/error';

const log = createLogger('ApiProfileService');

function text(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === 'string' ? (record[key] as string) : '';
}

/**
 * The customer record as the session's user. Blank names are allowed, as the
 * session allows them: a customer created by their first verification has none.
 */
function toUser(raw: unknown, expectedId: string): AuthUser {
  const record = requireRecord(raw, 'customer');
  const id = requireString(record, 'id', 'customer');
  if (id !== expectedId) {
    throw malformedResponse('customer.id');
  }
  const email = optionalString(record, 'email');
  const avatarUrl = toImageUrl(record.profileImage);

  return {
    id,
    firstName: text(record, 'firstName'),
    lastName: text(record, 'lastName'),
    phone: requireString(record, 'phone', 'customer'),
    role: 'customer',
    // Absent rather than undefined, so the stored session holds no empty keys.
    ...(email ? { email } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  };
}

export interface ApiProfileServiceOptions {
  /** Whoever is signed in, or null. Only a customer has this profile. */
  currentUser: () => Promise<AuthUser | null>;
}

export class ApiProfileService extends BaseApiService implements ProfileService {
  private readonly currentUser: () => Promise<AuthUser | null>;

  constructor(options: ApiProfileServiceOptions) {
    super('/customers');
    this.currentUser = options.currentUser;
  }

  async updateProfile(input: CustomerProfileUpdate): Promise<AuthUser> {
    const user = await this.requireCustomer();

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const email = input.email?.trim();

    if (!firstName) {
      throw new AppError({ kind: 'validation', message: 'Profile refused before sending: no first name' });
    }
    if (firstName.length > PROFILE_NAME_MAX_LENGTH || lastName.length > PROFILE_NAME_MAX_LENGTH) {
      throw new AppError({ kind: 'validation', message: 'Profile refused before sending: name too long' });
    }
    // Removed only when there was one to remove; `null` is the contract's "none".
    const removesEmail = !email && Boolean(user.email);

    const data = await this.post<unknown>('/update', {
      id: user.id,
      firstName,
      lastName,
      ...(email ? { email } : {}),
      ...(removesEmail ? { email: null } : {}),
    });

    // Whether, never what: a name and an email are the customer's own.
    log.info('Profile updated', { hasEmail: Boolean(email), removedEmail: removesEmail });
    return toUser(data, user.id);
  }

  async setProfileImage(remoteUrl: string): Promise<AuthUser> {
    const user = await this.requireCustomer();
    if (remoteUrl.trim() === '') {
      // Blank is the backend's "clear": a new photo that is nothing is not one.
      throw new AppError({ kind: 'validation', message: 'Profile photo refused before sending: no URL' });
    }

    const data = await this.post<unknown>('/update', { id: user.id, profileImage: remoteUrl });
    return toUser(data, user.id);
  }

  async removeProfileImage(): Promise<AuthUser> {
    const user = await this.requireCustomer();

    const data = await this.post<unknown>('/update', { id: user.id, profileImage: null });
    return toUser(data, user.id);
  }

  /** What an authenticated endpoint does to nobody, or to a vendor. */
  private async requireCustomer(): Promise<AuthUser> {
    const user = await this.currentUser();
    if (!user || user.role !== 'customer') {
      throw new AppError({ kind: 'unauthorized', message: 'Profile: no customer session' });
    }
    return user;
  }
}
