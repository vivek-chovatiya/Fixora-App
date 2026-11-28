/**
 * MockAuthService
 *
 * Simulates the approved authentication flows so the UI can be built before the
 * backend exists. It stands in for backend judgement, never for security: when
 * the real service lands, every decision here moves server side and this file is
 * deleted.
 *
 * Both roles prove the phone with a one-time code on every sign in (owner
 * decision 28/11/2026, phase5-contract.md section 1). There is no permanent
 * vendor auth code any more, so nothing here issues, stores or compares one.
 *
 *   customer:      request code (phone)          → verify code → session
 *   vendor:        request code (phone)          → verify code → session
 *   new vendor:    register → verify code (registrationId) → vendor created
 *                                                            + session
 *
 * ⚠️ A returning vendor's code request answers alike for every well-formed
 * number, and is held alike for every number, as the backend holds it — only
 * delivery is for real vendors. So verifying fails the same way for a number
 * with no vendor account as for a wrong code (`OTP_INVALID`), and the same way
 * for any number that asked for no code (`OTP_EXPIRED`). That sameness is the
 * contract (section 1.1), not an accident to tidy away.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import type { AuthUser, SessionPayload } from '@/features/auth/types';
import {
  MOCK_OTP_CODE,
  MOCK_OTP_RESEND_AFTER_SECONDS,
  MOCK_OTP_TTL_SECONDS,
  findMockAccount,
  maskPhone,
} from '@/shared/services/mock/mockAuthData';
import { mockId, simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import type {
  AuthService,
  OtpChallenge,
  OtpDeliveryChannel,
  VendorRegistration,
  VendorRegistrationDetails,
} from '@/shared/services/types/AuthService';
import { AppError } from '@/shared/types/error';
import { normalisePhone } from '@/shared/validation/phone';

const log = createLogger('MockAuthService');

interface IssuedChallenge {
  expiresAtMs: number;
}

interface VendorOnboarding {
  phone: string;
  user: AuthUser;
  challenge: IssuedChallenge;
}

/**
 * The clock and the latency exist so tests can remove the two things that make
 * a mock slow to assert against: waiting for a clock, and waiting for a network.
 * The delivery channel exists so a test can reach the wording of a code sent on
 * WhatsApp without a backend.
 *
 * None is set by the running app, which keeps real-feeling latency.
 */
export interface MockAuthServiceOptions {
  /**
   * Injectable clock. Expiry is time-dependent behaviour, and a test that had to
   * wait five real minutes to prove a code expires would never be written.
   */
  now?: () => number;
  /**
   * Simulated latency. Defaults to `AppConfig.mock`; pass `NO_LATENCY` in tests
   * so a suite is not billed hundreds of milliseconds per call.
   */
  latency?: MockLatency;
  /**
   * What every challenge reports as its channel. Defaults to `NONE`, which is
   * the truth: the mock delivers nothing, the code is `MOCK_OTP_CODE`.
   */
  deliveryChannel?: OtpDeliveryChannel;
}

export class MockAuthService implements AuthService {
  /** Customer one-time codes, by normalised phone. */
  private readonly customerChallenges = new Map<string, IssuedChallenge>();

  /**
   * Returning vendors' one-time codes, by normalised phone — held for every
   * number that asked, vendor or not, so the answers cannot tell them apart.
   */
  private readonly vendorSignInChallenges = new Map<string, IssuedChallenge>();

  /** In-progress vendor onboardings, by registration id. */
  private readonly onboardings = new Map<string, VendorOnboarding>();

  /** Vendors created this process, by normalised phone. */
  private readonly activeVendors = new Map<string, AuthUser>();

  private readonly now: () => number;

  private readonly latency: MockLatency | undefined;

  private readonly deliveryChannel: OtpDeliveryChannel;

  constructor(options: MockAuthServiceOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.latency = options.latency;
    this.deliveryChannel = options.deliveryChannel ?? 'NONE';
  }

  /**
   * Every public method goes through here rather than calling `simulateNetwork`
   * directly, so a method added later cannot quietly ignore the override.
   */
  private simulate<T>(produce: () => T): Promise<T> {
    return this.latency ? simulateNetwork(produce, this.latency) : simulateNetwork(produce);
  }

  /* Customer ------------------------------------------------------------- */

  async requestCustomerOtp(phone: string): Promise<OtpChallenge> {
    return this.simulate(() => {
      const digits = this.requirePlausiblePhone(phone);

      // Succeeds whether or not the number is registered. Answering that would
      // let anyone enumerate customers, and it is the backend's call anyway.
      this.customerChallenges.set(digits, { expiresAtMs: this.expiryFromNow() });
      log.info('Mock customer code issued', { phone: maskPhone(digits) });

      return this.buildChallenge(digits);
    });
  }

  async verifyCustomerOtp(phone: string, code: string): Promise<SessionPayload> {
    return this.simulate(() => {
      const digits = normalisePhone(phone);
      const challenge = this.customerChallenges.get(digits);

      if (!challenge) {
        throw new AppError({
          kind: 'validation',
          message: 'No mock challenge issued',
          userMessage: 'Request a code before verifying.',
        });
      }
      this.assertChallengeUsable(challenge, () => this.customerChallenges.delete(digits));
      this.assertOtpMatches(code);

      const account = findMockAccount(digits);
      if (!account || account.user.role !== 'customer') {
        throw new AppError({
          kind: 'notFound',
          message: 'No mock customer account for this number',
          userMessage: 'We could not find an account for this number.',
        });
      }

      this.customerChallenges.delete(digits);
      log.info('Mock customer session issued', { phone: maskPhone(digits) });

      return this.createSession(account.user);
    });
  }

  /* Vendor onboarding ---------------------------------------------------- */

  async registerVendor(details: VendorRegistrationDetails): Promise<VendorRegistration> {
    return this.simulate(() => {
      const digits = this.requirePlausiblePhone(details.phone);

      if (this.findActiveVendor(digits)) {
        throw new AppError({
          kind: 'conflict',
          code: 'PHONE_ALREADY_REGISTERED',
          message: 'Mock vendor already registered',
        });
      }

      const registrationId = mockId('reg');

      this.onboardings.set(registrationId, {
        phone: digits,
        user: {
          id: mockId('usr_vendor'),
          firstName: details.ownerFirstName,
          lastName: details.ownerLastName,
          email: details.email,
          phone: digits,
          role: 'vendor',
        },
        challenge: { expiresAtMs: this.expiryFromNow() },
      });

      log.info('Mock vendor registration started', { phone: maskPhone(digits) });

      return { registrationId, challenge: this.buildChallenge(digits) };
    });
  }

  async requestVendorOtp(registrationId: string): Promise<OtpChallenge> {
    return this.simulate(() => {
      const onboarding = this.requireOnboarding(registrationId);

      onboarding.challenge = { expiresAtMs: this.expiryFromNow() };
      log.info('Mock vendor code re-issued', { phone: maskPhone(onboarding.phone) });

      return this.buildChallenge(onboarding.phone);
    });
  }

  async verifyVendorOtp(registrationId: string, code: string): Promise<SessionPayload> {
    return this.simulate(() => {
      const onboarding = this.requireOnboarding(registrationId);

      this.assertChallengeUsable(onboarding.challenge, () => {
        onboarding.challenge = { expiresAtMs: 0 };
      });
      this.assertOtpMatches(code);

      // Verification creates the vendor, active at once — there is no
      // administrator approval step — and signs them in (contract section 1.2).
      this.activeVendors.set(onboarding.phone, onboarding.user);
      this.onboardings.delete(registrationId);

      log.info('Mock vendor created and session issued', { phone: maskPhone(onboarding.phone) });

      return this.createSession(onboarding.user);
    });
  }

  /* Vendor sign in ------------------------------------------------------- */

  async requestVendorSignInOtp(phone: string): Promise<OtpChallenge> {
    return this.simulate(() => {
      const digits = this.requirePlausiblePhone(phone);

      // Held for every number, as the backend holds it: the response, and every
      // later answer about this code, must never say whether the number has an
      // account. (A real backend only delivers to a vendor; the mock delivers
      // nothing to anyone.)
      this.vendorSignInChallenges.set(digits, { expiresAtMs: this.expiryFromNow() });
      log.info('Mock vendor sign-in code requested', { phone: maskPhone(digits) });

      return this.buildChallenge(digits);
    });
  }

  async verifyVendorSignInOtp(phone: string, code: string): Promise<SessionPayload> {
    return this.simulate(() => {
      const digits = normalisePhone(phone);
      const challenge = this.vendorSignInChallenges.get(digits);

      // No code asked for reads as one that has run out — for every number.
      if (!challenge) {
        throw this.expiredCode();
      }
      this.assertChallengeUsable(challenge, () => this.vendorSignInChallenges.delete(digits));
      this.assertOtpMatches(code);

      // The right digits for a number with no vendor account are still a wrong
      // code: none was ever sent to it (contract section 1.1).
      const vendor = this.findActiveVendor(digits);
      if (!vendor) {
        throw this.wrongCode();
      }

      this.vendorSignInChallenges.delete(digits);
      log.info('Mock vendor session issued', { phone: maskPhone(digits) });

      return this.createSession(vendor);
    });
  }

  /* Common --------------------------------------------------------------- */

  async signOut(): Promise<void> {
    return this.simulate(() => {
      // Outstanding challenges die with the session. Created vendors do not:
      // signing out is not the same as losing an account.
      this.customerChallenges.clear();
      this.vendorSignInChallenges.clear();
      log.info('Mock session invalidated');
    });
  }

  /* Internals ------------------------------------------------------------ */

  private requirePlausiblePhone(phone: string): string {
    const digits = normalisePhone(phone);
    if (digits.length < AppConfig.phone.minDigits) {
      throw new AppError({
        kind: 'validation',
        message: 'Phone number too short for a mock challenge',
        userMessage: 'Enter a valid phone number.',
      });
    }
    return digits;
  }

  private requireOnboarding(registrationId: string): VendorOnboarding {
    const onboarding = this.onboardings.get(registrationId);
    if (!onboarding) {
      throw new AppError({
        kind: 'notFound',
        code: 'REGISTRATION_NOT_FOUND',
        message: 'No mock vendor registration for this id',
      });
    }
    return onboarding;
  }

  private assertChallengeUsable(challenge: IssuedChallenge, expire: () => void): void {
    if (this.now() > challenge.expiresAtMs) {
      expire();
      throw this.expiredCode();
    }
  }

  /**
   * The backend's `OTP_EXPIRED`. `unauthorized` as it always was here, so the
   * customer screens built against it read the same; the code is what chooses
   * the sentence.
   */
  private expiredCode(): AppError {
    return new AppError({
      kind: 'unauthorized',
      code: 'OTP_EXPIRED',
      message: 'Mock challenge expired',
    });
  }

  /**
   * A wrong code does not consume the challenge, so a mistyped digit does not
   * force the user to request a fresh one.
   */
  private assertOtpMatches(code: string): void {
    if (code.trim() !== MOCK_OTP_CODE) {
      throw this.wrongCode();
    }
  }

  /** The backend's `OTP_INVALID`: says nothing about the expected value, never echoes the attempt. */
  private wrongCode(): AppError {
    return new AppError({
      kind: 'validation',
      code: 'OTP_INVALID',
      message: 'Mock code mismatch',
    });
  }

  /** Seeded vendors and vendors created this process resolve the same way. */
  private findActiveVendor(digits: string): AuthUser | undefined {
    const created = this.activeVendors.get(digits);
    if (created) {
      return created;
    }

    const seeded = findMockAccount(digits);
    return seeded?.user.role === 'vendor' ? seeded.user : undefined;
  }

  private expiryFromNow(): number {
    return this.now() + MOCK_OTP_TTL_SECONDS * 1000;
  }

  private buildChallenge(digits: string): OtpChallenge {
    return {
      maskedDestination: maskPhone(digits),
      expiresAt: new Date(this.expiryFromNow()).toISOString(),
      resendAfterSeconds: MOCK_OTP_RESEND_AFTER_SECONDS,
      deliveryChannel: this.deliveryChannel,
    };
  }

  /**
   * Opaque token. Its only contract is that it is a string the client stores and
   * replays; nothing in the app may parse it.
   */
  private createSession(user: AuthUser): SessionPayload {
    return { token: `mock_token_${user.id}_${this.now()}`, user };
  }
}
