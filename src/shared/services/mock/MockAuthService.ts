/**
 * MockAuthService
 *
 * Simulates the approved authentication UX so the UI can be built before the
 * backend exists. It is a stand-in for backend judgement, never a security
 * boundary: when the real service lands, every decision made here moves server
 * side and this file is deleted.
 *
 * The vendor code is treated as a standing credential throughout. It is never
 * logged, never echoed into an error, and never stored beyond the call.
 */

import { createLogger } from '@/core/logger/Logger';
import type { SessionPayload } from '@/features/auth/types';
import {
  MOCK_MIN_PHONE_DIGITS,
  MOCK_OTP_CODE,
  MOCK_OTP_RESEND_AFTER_SECONDS,
  MOCK_OTP_TTL_SECONDS,
  findMockAccount,
  maskPhone,
  normalisePhone,
} from '@/shared/services/mock/mockAuthData';
import { simulateNetwork } from '@/shared/services/mock/mockUtils';
import type { AuthService, OtpChallenge } from '@/shared/services/types/AuthService';
import { AppError } from '@/shared/types/error';

const log = createLogger('MockAuthService');

interface IssuedChallenge {
  expiresAtMs: number;
}

export class MockAuthService implements AuthService {
  /**
   * Codes issued this session, by normalised phone. In memory only — a restart
   * clears them, which matches a real service expiring them.
   */
  private readonly challenges = new Map<string, IssuedChallenge>();

  /**
   * Injectable clock. Expiry is time-dependent behaviour, and a test that had to
   * wait five real minutes to prove a code expires would never be written.
   */
  constructor(private readonly now: () => number = () => Date.now()) {}

  async requestCustomerOtp(phone: string): Promise<OtpChallenge> {
    return simulateNetwork(() => {
      const digits = normalisePhone(phone);

      if (digits.length < MOCK_MIN_PHONE_DIGITS) {
        throw new AppError({
          kind: 'validation',
          message: 'Phone number too short for a mock challenge',
          userMessage: 'Enter a valid phone number.',
        });
      }

      // Succeeds whether or not the number is registered. Answering that
      // question here would let anyone enumerate customers, and it is the
      // backend's to answer regardless.
      this.challenges.set(digits, {
        expiresAtMs: this.now() + MOCK_OTP_TTL_SECONDS * 1000,
      });

      log.info('Mock OTP issued', { phone: maskPhone(digits) });

      return {
        maskedDestination: maskPhone(digits),
        expiresAt: new Date(this.now() + MOCK_OTP_TTL_SECONDS * 1000).toISOString(),
        resendAfterSeconds: MOCK_OTP_RESEND_AFTER_SECONDS,
      };
    });
  }

  async verifyCustomerOtp(phone: string, code: string): Promise<SessionPayload> {
    return simulateNetwork(() => {
      const digits = normalisePhone(phone);
      const challenge = this.challenges.get(digits);

      if (!challenge) {
        throw new AppError({
          kind: 'validation',
          message: 'No mock challenge issued for this number',
          userMessage: 'Request a code before verifying.',
        });
      }

      if (this.now() > challenge.expiresAtMs) {
        this.challenges.delete(digits);
        throw new AppError({
          kind: 'unauthorized',
          message: 'Mock challenge expired',
          userMessage: 'That code has expired. Request a new one.',
        });
      }

      if (code !== MOCK_OTP_CODE) {
        // The attempt is not consumed, so a mistyped digit does not force the
        // user to request a fresh code.
        throw new AppError({
          kind: 'validation',
          message: 'Mock code mismatch',
          userMessage: 'That code is not correct. Please check and try again.',
        });
      }

      const account = findMockAccount(digits);

      if (!account || account.user.role !== 'customer') {
        throw new AppError({
          kind: 'notFound',
          message: 'No mock customer account for this number',
          userMessage: 'We could not find an account for this number.',
        });
      }

      this.challenges.delete(digits);
      log.info('Mock customer session issued', { phone: maskPhone(digits) });

      return this.createSession(account.user.id, account.user);
    });
  }

  async signInVendor(phone: string, vendorCode: string): Promise<SessionPayload> {
    return simulateNetwork(() => {
      const account = findMockAccount(phone);

      // Generic failure for an unknown number: telling the caller which vendors
      // exist is information they have not earned.
      if (!account || account.user.role !== 'vendor') {
        throw new AppError({
          kind: 'unauthorized',
          message: 'No mock vendor account for this number',
          userMessage: 'Those sign-in details were not recognised.',
        });
      }

      // Approval is checked before the code because an unapproved vendor has
      // never been issued one, and "your account is under verification" is far
      // more useful to them than "invalid code". The backend will make the final
      // call on this trade-off.
      if (account.user.vendorApproval !== 'approved') {
        throw new AppError({
          kind: 'forbidden',
          message: 'Mock vendor is not approved',
          userMessage:
            account.user.vendorApproval === 'rejected'
              ? 'Your vendor application was not approved. Please contact support.'
              : 'Your account is still under verification. You will be able to sign in once it is approved.',
        });
      }

      if (!account.vendorCode || vendorCode !== account.vendorCode) {
        // Deliberately says nothing about the code itself, and the attempted
        // value is never included.
        throw new AppError({
          kind: 'unauthorized',
          message: 'Mock vendor code mismatch',
          userMessage: 'Those sign-in details were not recognised.',
        });
      }

      log.info('Mock vendor session issued', { phone: maskPhone(account.phone) });

      return this.createSession(account.user.id, account.user);
    });
  }

  async signOut(): Promise<void> {
    return simulateNetwork(() => {
      this.challenges.clear();
      log.info('Mock session invalidated');
    });
  }

  /**
   * Opaque token. Its only contract is that it is a string the client stores and
   * replays; nothing in the app may parse it.
   */
  private createSession(userId: string, user: SessionPayload['user']): SessionPayload {
    return {
      token: `mock_token_${userId}_${this.now()}`,
      user,
    };
  }
}
