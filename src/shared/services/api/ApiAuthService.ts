/**
 * ApiAuthService
 *
 * AuthService against the real backend, built to the shared sign-in contract of
 * 17/11/2026 (`/auth/customer/*`, `/auth/vendor/*`, `/auth/logout`;
 * PROJECT_BIBLE.md sections 7, 7A, 28 and 29) as amended by phase5-contract.md
 * sections 1 and 2 (28/11/2026): vendors sign in with a one-time code every
 * time, registration ends in a session, and every challenge says which channel
 * carried the code. `MockAuthService` is the behaviour it matches: the screens
 * were built against that, and nothing above the service may notice which one
 * is registered.
 *
 * Decisions:
 * - Every response is read field by field into the app's own types. Nothing
 *   else the backend sends — `_id`, the top-level `role`, `isNewAccount` —
 *   passes the service.
 * - A phone number is sent as `normalisePhone` gives it, which is what the
 *   contract stores and compares. Callers already normalise; doing it again
 *   here costs nothing and means no caller can forget.
 * - A session must be for the role the call signs in. A vendor session from
 *   the customer's verification would open the wrong application, so it is
 *   refused as a server fault rather than trusted.
 * - Failures are HttpClient's: the kind from the status, the copy from the
 *   backend's `code` (`AppError.messageForCode`) — `OTP_DELIVERY_FAILED` (503)
 *   included, which reads as a retryable server failure.
 * - Signing out asks HttpClient not to treat its own 401 as a dead session:
 *   it is already ending the session, and the thunk clears it either way.
 *
 * ⚠️ The permanent vendor auth code is gone (contract section 1.3): its routes
 * answer 404 now. Nothing here may call `/vendor/signin`,
 * `/vendor/auth-code/*` or `/vendors/auth-code/regenerate` again.
 */

import type { AuthUser, SessionPayload, UserRole } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import {
  malformedResponse,
  optionalString,
  requireNumber,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import { toImageUrl } from '@/shared/services/api/uploadUrls';
import type {
  AuthService,
  OtpChallenge,
  OtpDeliveryChannel,
  VendorRegistration,
  VendorRegistrationDetails,
} from '@/shared/services/types/AuthService';
import { normalisePhone } from '@/shared/validation/phone';

/**
 * The challenge's `deliveryChannel`, as the app's value.
 *
 * ⚠️ Lenient on purpose, unlike the fields around it. It only chooses words, so
 * a missing one (a backend not yet on phase5-contract.md section 2) or one the
 * app does not know (a channel added later) reads as `NONE` — today's wording —
 * rather than refusing a code the user has already been sent.
 */
function toDeliveryChannel(value: unknown): OtpDeliveryChannel {
  return value === 'WHATSAPP' ? 'WHATSAPP' : 'NONE';
}

function toChallenge(raw: unknown, what = 'challenge'): OtpChallenge {
  const record = requireRecord(raw, what);
  const expiresAt = requireString(record, 'expiresAt', what);
  if (Number.isNaN(Date.parse(expiresAt))) {
    throw malformedResponse(`${what}.expiresAt`);
  }
  const resendAfterSeconds = requireNumber(record, 'resendAfterSeconds', what);
  if (resendAfterSeconds < 0) {
    throw malformedResponse(`${what}.resendAfterSeconds`);
  }

  return {
    maskedDestination: requireString(record, 'maskedDestination', what),
    expiresAt,
    resendAfterSeconds,
    deliveryChannel: toDeliveryChannel(record.deliveryChannel),
  };
}

function toUserRole(value: string | undefined): UserRole | undefined {
  const role = value?.toLowerCase();
  return role === 'customer' || role === 'vendor' ? role : undefined;
}

/**
 * The contract's `Session` as the app's `SessionPayload`.
 *
 * The names may be blank: a customer's account is created by their first
 * verification (section 7A.1), before anybody has asked their name, and the
 * app's user always has a string there.
 */
function toSession(raw: unknown, expected: UserRole): SessionPayload {
  const record = requireRecord(raw, 'session');
  const token = requireString(record, 'token', 'session');
  const user = requireRecord(record.user, 'session.user');

  const role = toUserRole(optionalString(user, 'role')) ?? toUserRole(optionalString(record, 'role'));
  if (role !== expected) {
    throw malformedResponse('session.user.role');
  }

  const email = optionalString(user, 'email');
  // The stored `profileImage` path, as an address this phone can load (Phase 4B).
  const avatarUrl = toImageUrl(user.avatarUrl);
  const authUser: AuthUser = {
    id: requireString(user, 'id', 'session.user'),
    firstName: typeof user.firstName === 'string' ? user.firstName : '',
    lastName: typeof user.lastName === 'string' ? user.lastName : '',
    phone: requireString(user, 'phone', 'session.user'),
    role,
    // Absent rather than undefined, so a stored session holds no empty keys.
    ...(email ? { email } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  };

  return { token, user: authUser };
}

export class ApiAuthService extends BaseApiService implements AuthService {
  constructor() {
    super('/auth');
  }

  /* Customer ------------------------------------------------------------- */

  async requestCustomerOtp(phone: string): Promise<OtpChallenge> {
    const data = await this.post<unknown>('/customer/otp/request', {
      phone: normalisePhone(phone),
    });
    return toChallenge(data);
  }

  async verifyCustomerOtp(phone: string, code: string): Promise<SessionPayload> {
    const data = await this.post<unknown>('/customer/otp/verify', {
      phone: normalisePhone(phone),
      code: code.trim(),
    });
    return toSession(data, 'customer');
  }

  /* Vendor onboarding ---------------------------------------------------- */

  async registerVendor(details: VendorRegistrationDetails): Promise<VendorRegistration> {
    const email = details.email?.trim();
    const data = await this.post<unknown>('/vendor/register', {
      businessName: details.businessName,
      ownerFirstName: details.ownerFirstName,
      ownerLastName: details.ownerLastName,
      phone: normalisePhone(details.phone),
      // Absent, never "": the backend validates an email that is present.
      ...(email ? { email } : {}),
      serviceCategoryIds: [...details.serviceCategoryIds],
    });

    const record = requireRecord(data, 'registration');
    return {
      registrationId: requireString(record, 'registrationId', 'registration'),
      challenge: toChallenge(record.challenge, 'registration.challenge'),
    };
  }

  async requestVendorOtp(registrationId: string): Promise<OtpChallenge> {
    const data = await this.post<unknown>('/vendor/otp/request', { registrationId });
    return toChallenge(data);
  }

  /** Creates the vendor and signs them in (contract section 1.2). */
  async verifyVendorOtp(registrationId: string, code: string): Promise<SessionPayload> {
    const data = await this.post<unknown>('/vendor/otp/verify', {
      registrationId,
      code: code.trim(),
    });
    return toSession(data, 'vendor');
  }

  /* Vendor sign in ------------------------------------------------------- */

  async requestVendorSignInOtp(phone: string): Promise<OtpChallenge> {
    const data = await this.post<unknown>('/vendor/signin/otp/request', {
      phone: normalisePhone(phone),
    });
    return toChallenge(data);
  }

  async verifyVendorSignInOtp(phone: string, code: string): Promise<SessionPayload> {
    const data = await this.post<unknown>('/vendor/signin/otp/verify', {
      phone: normalisePhone(phone),
      code: code.trim(),
    });
    return toSession(data, 'vendor');
  }

  /* Common --------------------------------------------------------------- */

  async signOut(): Promise<void> {
    await this.post<unknown>('/logout', {}, { skipUnauthorizedHandler: true });
  }
}
