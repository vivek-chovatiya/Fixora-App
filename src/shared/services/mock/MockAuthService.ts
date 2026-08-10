/**
 * MockAuthService
 *
 * Simulates the approved authentication flows so the UI can be built before the
 * backend exists. It stands in for backend judgement, never for security: when
 * the real service lands, every decision here moves server side and this file is
 * deleted.
 *
 * The vendor auth code is treated as a standing credential throughout. It is
 * never logged, never echoed into an error, and never stored anywhere but this
 * in-memory simulation.
 *
 * Vendor onboarding follows the approved sequence, and the ordering matters:
 *
 *   register → verify one-time code → vendor activated + auth code issued
 *            → vendor confirms auth code → session
 *
 * Verifying the one-time code proves the phone number. It does not sign the
 * vendor in. Only `verifyVendorAuthCode` produces a session.
 */

import { createLogger } from '@/core/logger/Logger';
import type { AuthUser, SessionPayload } from '@/features/auth/types';
import {
  MOCK_MIN_PHONE_DIGITS,
  MOCK_OTP_CODE,
  MOCK_OTP_RESEND_AFTER_SECONDS,
  MOCK_OTP_TTL_SECONDS,
  findMockAccount,
  generateMockVendorAuthCode,
  maskPhone,
  normalisePhone,
} from '@/shared/services/mock/mockAuthData';
import { mockId, simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import type {
  AuthService,
  OtpChallenge,
  VendorAuthCode,
  VendorRegistration,
  VendorRegistrationDetails,
} from '@/shared/services/types/AuthService';
import { AppError } from '@/shared/types/error';

const log = createLogger('MockAuthService');

interface IssuedChallenge {
  expiresAtMs: number;
}

interface VendorOnboarding {
  phone: string;
  user: AuthUser;
  challenge: IssuedChallenge;
  otpVerified: boolean;
  /** Current code. Regeneration replaces it, which is what revokes the old one. */
  authCode: string | null;
}

/** A vendor who finished onboarding during this app process. */
interface ActiveVendor {
  user: AuthUser;
  authCode: string;
}

/**
 * Both fields exist so tests can remove the two things that make a mock slow to
 * assert against: waiting for a clock, and waiting for a network.
 *
 * Neither is set by the running app, which keeps real-feeling latency.
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
}

export class MockAuthService implements AuthService {
  /** Customer one-time codes, by normalised phone. */
  private readonly customerChallenges = new Map<string, IssuedChallenge>();

  /** In-progress vendor onboardings, by registration id. */
  private readonly onboardings = new Map<string, VendorOnboarding>();

  /** Vendors activated this process, by normalised phone. */
  private readonly activeVendors = new Map<string, ActiveVendor>();

  private readonly now: () => number;

  private readonly latency: MockLatency | undefined;

  constructor(options: MockAuthServiceOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.latency = options.latency;
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
          message: 'Mock vendor already registered',
          userMessage: 'An account already exists for this number. Try signing in instead.',
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
        otpVerified: false,
        authCode: null,
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

  async verifyVendorOtp(registrationId: string, code: string): Promise<VendorAuthCode> {
    return this.simulate(() => {
      const onboarding = this.requireOnboarding(registrationId);

      this.assertChallengeUsable(onboarding.challenge, () => {
        onboarding.challenge = { expiresAtMs: 0 };
      });
      this.assertOtpMatches(code);

      // Verification activates the vendor. There is no administrator approval
      // step in the approved flow.
      onboarding.otpVerified = true;
      onboarding.authCode = generateMockVendorAuthCode();

      // The code itself is never logged.
      log.info('Mock vendor activated and auth code issued', {
        phone: maskPhone(onboarding.phone),
      });

      return { code: onboarding.authCode, issuedAt: new Date(this.now()).toISOString() };
    });
  }

  async regenerateVendorAuthCode(registrationId: string): Promise<VendorAuthCode> {
    return this.simulate(() => {
      const onboarding = this.requireOnboarding(registrationId);
      this.assertPhoneVerified(onboarding);

      // Replacing the value is what revokes the previous one: every check
      // compares against the current code only.
      onboarding.authCode = generateMockVendorAuthCode();
      log.info('Mock vendor auth code regenerated', { phone: maskPhone(onboarding.phone) });

      return { code: onboarding.authCode, issuedAt: new Date(this.now()).toISOString() };
    });
  }

  async verifyVendorAuthCode(registrationId: string, authCode: string): Promise<SessionPayload> {
    return this.simulate(() => {
      const onboarding = this.requireOnboarding(registrationId);
      this.assertPhoneVerified(onboarding);

      if (!onboarding.authCode || authCode.trim() !== onboarding.authCode) {
        // Says nothing about the expected value, and never echoes the attempt.
        throw new AppError({
          kind: 'validation',
          message: 'Mock vendor auth code mismatch',
          userMessage: 'That code is not correct. Please check and try again.',
        });
      }

      this.activeVendors.set(onboarding.phone, {
        user: onboarding.user,
        authCode: onboarding.authCode,
      });
      this.onboardings.delete(registrationId);

      log.info('Mock vendor session issued', { phone: maskPhone(onboarding.phone) });

      return this.createSession(onboarding.user);
    });
  }

  /* Vendor sign in ------------------------------------------------------- */

  async signInVendor(phone: string, authCode: string): Promise<SessionPayload> {
    return this.simulate(() => {
      const digits = normalisePhone(phone);
      const vendor = this.findActiveVendor(digits);

      // An unknown number and a wrong code fail identically, so neither reveals
      // which vendors exist.
      if (!vendor || authCode.trim() !== vendor.authCode) {
        throw new AppError({
          kind: 'unauthorized',
          message: 'Mock vendor sign in rejected',
          userMessage: 'Those sign-in details were not recognised.',
        });
      }

      log.info('Mock vendor session issued', { phone: maskPhone(digits) });

      return this.createSession(vendor.user);
    });
  }

  /* Common --------------------------------------------------------------- */

  async signOut(): Promise<void> {
    return this.simulate(() => {
      // Outstanding challenges die with the session. Activated vendors do not:
      // signing out is not the same as losing an account.
      this.customerChallenges.clear();
      log.info('Mock session invalidated');
    });
  }

  /* Internals ------------------------------------------------------------ */

  private requirePlausiblePhone(phone: string): string {
    const digits = normalisePhone(phone);
    if (digits.length < MOCK_MIN_PHONE_DIGITS) {
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
        message: 'No mock vendor registration for this id',
        userMessage: 'That registration is no longer available. Please start again.',
      });
    }
    return onboarding;
  }

  private assertPhoneVerified(onboarding: VendorOnboarding): void {
    if (!onboarding.otpVerified) {
      throw new AppError({
        kind: 'forbidden',
        message: 'Mock vendor phone not verified',
        userMessage: 'Verify your phone number before continuing.',
      });
    }
  }

  private assertChallengeUsable(
    challenge: IssuedChallenge | undefined,
    expire: () => void,
  ): asserts challenge is IssuedChallenge {
    if (!challenge) {
      throw new AppError({
        kind: 'validation',
        message: 'No mock challenge issued',
        userMessage: 'Request a code before verifying.',
      });
    }

    if (this.now() > challenge.expiresAtMs) {
      expire();
      throw new AppError({
        kind: 'unauthorized',
        message: 'Mock challenge expired',
        userMessage: 'That code has expired. Request a new one.',
      });
    }
  }

  /**
   * A wrong code does not consume the challenge, so a mistyped digit does not
   * force the user to request a fresh one.
   */
  private assertOtpMatches(code: string): void {
    if (code.trim() !== MOCK_OTP_CODE) {
      throw new AppError({
        kind: 'validation',
        message: 'Mock code mismatch',
        userMessage: 'That code is not correct. Please check and try again.',
      });
    }
  }

  /** Seeded vendors and vendors activated this process resolve the same way. */
  private findActiveVendor(digits: string): ActiveVendor | undefined {
    const activated = this.activeVendors.get(digits);
    if (activated) {
      return activated;
    }

    const seeded = findMockAccount(digits);
    if (seeded?.user.role === 'vendor' && seeded.vendorAuthCode) {
      return { user: seeded.user, authCode: seeded.vendorAuthCode };
    }

    return undefined;
  }

  private expiryFromNow(): number {
    return this.now() + MOCK_OTP_TTL_SECONDS * 1000;
  }

  private buildChallenge(digits: string): OtpChallenge {
    return {
      maskedDestination: maskPhone(digits),
      expiresAt: new Date(this.expiryFromNow()).toISOString(),
      resendAfterSeconds: MOCK_OTP_RESEND_AFTER_SECONDS,
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
