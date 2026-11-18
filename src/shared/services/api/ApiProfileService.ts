/**
 * ApiProfileService
 *
 * ProfileService against the real backend: a customer editing their own name
 * and email (PROJECT_BIBLE.md section 25). Replaces `MockProfileService`, which
 * changed only the copy of the user held on this device.
 *
 * Endpoint: `POST /customers/update` `{ id, firstName, lastName, email? }`,
 * answering with the customer's record, read here into the session's
 * `AuthUser` — the same fields `/auth/me` and the sign-in session carry, so the
 * session adopts the backend's own normalisation (a trimmed, lower-cased email).
 * `/auth/me` itself is not needed: the session already holds the id, and the
 * update answers with the record.
 *
 * Decisions:
 * - **Only the signed-in customer's own id is ever sent.** The backend does not
 *   check that the id is the caller's own — any signed-in account can update any
 *   customer, status and phone included (WORKING_NOTES: backend risk) — so the
 *   id comes from the session, the body carries the three editable fields and
 *   nothing else, and an answer for any other id is refused.
 * - **Clearing an email fails clearly.** The interface says an absent email
 *   means the customer removed it; the backend's email field takes an address
 *   or nothing, never "none". Leaving the old one quietly in place would tell
 *   the customer it was removed when it was not, so the update is refused before
 *   anything is sent (`EMAIL_REMOVAL_NOT_SUPPORTED`) and nothing changes — the
 *   names included, so the form keeps every value it was given.
 * - **A new photo fails clearly** (`PROFILE_PHOTO_NOT_SUPPORTED`). There is no
 *   upload endpoint, so the URL `ImageService` hands over (still a mock: a file
 *   on this phone) points nowhere the backend could serve; storing it would put
 *   a broken image on the account. Removing the photo works.
 *
 * ⚠️ Names are trimmed and the first is required, as the mock does, so a
 * refusal reads the same either way; the backend remains the authority on the
 * rest (its own lengths, the email's shape, an email another account holds).
 */

import { createLogger } from '@/core/logger/Logger';
import type { AuthUser } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import { notSupported } from '@/shared/services/api/notSupported';
import {
  malformedResponse,
  optionalString,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
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
  const avatarUrl = optionalString(record, 'profileImage');

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
    if (!email && user.email) {
      throw notSupported('Removing a customer email', 'EMAIL_REMOVAL_NOT_SUPPORTED');
    }

    const data = await this.post<unknown>('/update', {
      id: user.id,
      firstName,
      lastName,
      ...(email ? { email } : {}),
    });

    // Whether, never what: a name and an email are the customer's own.
    log.info('Profile updated', { hasEmail: Boolean(email) });
    return toUser(data, user.id);
  }

  async setProfileImage(_remoteUrl: string): Promise<AuthUser> {
    await this.requireCustomer();
    throw notSupported('Setting a profile photo (no upload endpoint)', 'PROFILE_PHOTO_NOT_SUPPORTED');
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
