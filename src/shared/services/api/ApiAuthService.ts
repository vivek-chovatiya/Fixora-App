/**
 * ApiAuthService
 *
 * AuthService against the real backend, built to the shared sign-in contract of
 * 17/11/2026 (`/auth/customer/*`, `/auth/vendor/*`, `/auth/logout`;
 * PROJECT_BIBLE.md sections 7, 7A, 28 and 29). `MockAuthService` is the
 * behaviour it matches: the screens were built against that, and nothing above
 * the service may notice which one is registered.
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
 *   backend's `code` (`AppError.messageForCode`). One exception, documented on
 *   `verifyVendorAuthCode`.
 * - Signing out asks HttpClient not to treat its own 401 as a dead session:
 *   it is already ending the session, and the thunk clears it either way.
 *
 * ⚠️ The vendor auth code is a standing credential (PROJECT_BIBLE.md section
 * 7A.2). It is sent in a request body and returned exactly once, for display.
 * Nothing here logs it, keeps it, or puts it in an error: a malformed one is
 * refused by naming the field, never the value, and HttpClient keeps request
 * bodies out of every error it builds.
 */

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser, SessionPayload, UserRole } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import {
  malformedResponse,
  optionalString,
  requireNumber,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import type {
  AuthService,
  OtpChallenge,
  VendorAuthCode,
  VendorRegistration,
  VendorRegistrationDetails,
} from '@/shared/services/types/AuthService';
import { AppError } from '@/shared/types/error';
import { normalisePhone } from '@/shared/validation/phone';

/** A code shaped as the contract promises: exactly the configured number of digits. */
const AUTH_CODE_SHAPE = new RegExp(`^\\d{${AppConfig.vendorAuthCode.length}}$`);

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
  };
}

/**
 * ⚠️ Refuses a code of the wrong shape rather than showing it. A code read as a
 * number would have lost a leading zero, and a vendor who saved that would be
 * locked out by the very code they were told to keep.
 */
function toAuthCode(raw: unknown): VendorAuthCode {
  const record = requireRecord(raw, 'authCode');
  const code = record.code;
  if (typeof code !== 'string' || !AUTH_CODE_SHAPE.test(code)) {
    throw malformedResponse('authCode.code');
  }

  return { code, issuedAt: requireString(record, 'issuedAt', 'authCode') };
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
  const avatarUrl = optionalString(user, 'avatarUrl');
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

  async verifyVendorOtp(registrationId: string, code: string): Promise<VendorAuthCode> {
    const data = await this.post<unknown>('/vendor/otp/verify', {
      registrationId,
      code: code.trim(),
    });
    return toAuthCode(data);
  }

  /**
   * The vendor types back the code they were just shown.
   *
   * ⚠️ The contract does not say which code a wrong entry here answers with.
   * If it is `AUTH_CODE_INVALID`, the sign-in refusal's sentence ("not
   * recognised") would be wrong on a screen where nothing was signed in to and
   * the vendor has only mistyped — so it reads as the mock's wrong-code sentence
   * instead. The kind, status and code are kept; only the copy changes.
   */
  async verifyVendorAuthCode(registrationId: string, authCode: string): Promise<SessionPayload> {
    let data: unknown;
    try {
      data = await this.post<unknown>('/vendor/auth-code/confirm', {
        registrationId,
        authCode: authCode.trim(),
      });
    } catch (caught) {
      const error = AppError.from(caught);
      if (error.code !== 'AUTH_CODE_INVALID') {
        throw error;
      }
      throw new AppError({
        kind: error.kind,
        message: error.message,
        userMessage: AppError.messageForCode('OTP_INVALID'),
        code: error.code,
        statusCode: error.statusCode,
        cause: error.cause,
      });
    }
    return toSession(data, 'vendor');
  }

  async regenerateVendorAuthCode(registrationId: string): Promise<VendorAuthCode> {
    const data = await this.post<unknown>('/vendor/auth-code/regenerate', { registrationId });
    return toAuthCode(data);
  }

  /* Vendor sign in ------------------------------------------------------- */

  async signInVendor(phone: string, authCode: string): Promise<SessionPayload> {
    const data = await this.post<unknown>('/vendor/signin', {
      phone: normalisePhone(phone),
      authCode: authCode.trim(),
    });
    return toSession(data, 'vendor');
  }

  /* Common --------------------------------------------------------------- */

  async signOut(): Promise<void> {
    await this.post<unknown>('/logout', {}, { skipUnauthorizedHandler: true });
  }
}
