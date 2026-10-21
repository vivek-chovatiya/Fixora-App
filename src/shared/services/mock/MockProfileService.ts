/**
 * MockProfileService
 *
 * Stands in for the profile endpoints until they exist (PROJECT_BIBLE.md
 * section 25). It behaves like a backend rather than like a convenience:
 *
 * - it re-checks what it is sent instead of trusting the form that sent it,
 *   because a real server does and a client that has never met a rejected
 *   update will not handle one;
 * - it normalises — trims the names, lower-cases the address — and returns what
 *   it stored, so the device adopts the server's answer rather than its own;
 * - it refuses when nobody is signed in, which is what an authenticated
 *   endpoint does to an unauthenticated call.
 *
 * ⚠️ It reads the signed-in customer and returns a changed copy; it stores
 * nothing itself. There is no separate mock profile table — the session is
 * where this application keeps the signed-in user, and a second store would be
 * a second answer that can disagree with the first — and persisting the result
 * is the caller's job. That is the split the auth thunks already use: the
 * service produces a payload, the thunk decides when it is written and when the
 * application is told.
 *
 * ⚠️ Not a substitute for the real contract. Nothing here is negotiated with a
 * backend, so every rule below is this file's guess at a reasonable one and is
 * written down in docs/WORKING_NOTES.md as such.
 */

import { getSessionStorage } from '@/core/storage/SessionStorage';
import type { AuthUser } from '@/features/auth/types';
import { NO_LATENCY, simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import {
  PROFILE_NAME_MAX_LENGTH,
  type CustomerProfileUpdate,
  type ProfileService,
} from '@/shared/services/types/ProfileService';
import { AppError } from '@/shared/types/error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface MockProfileServiceOptions {
  /** Simulated latency. Pass `NO_LATENCY` in tests. */
  latency?: MockLatency;

  /**
   * How the signed-in customer is found.
   *
   * Defaults to the stored session, which is what the application uses — and
   * which the caller has already written by the time the next call reads it.
   * Tests pass their own so they never touch the device.
   */
  readUser?: () => Promise<AuthUser | null>;
}

async function readSessionUser(): Promise<AuthUser | null> {
  const session = await getSessionStorage().read();

  return session?.user ?? null;
}

export class MockProfileService implements ProfileService {
  private readonly latency: MockLatency;
  private readonly readUser: () => Promise<AuthUser | null>;

  constructor(options: MockProfileServiceOptions = {}) {
    this.latency = options.latency ?? NO_LATENCY;
    this.readUser = options.readUser ?? readSessionUser;
  }

  async updateProfile(input: CustomerProfileUpdate): Promise<AuthUser> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();

      const firstName = input.firstName.trim();
      const lastName = input.lastName.trim();
      const email = input.email?.trim().toLowerCase();

      /*
        Checked again here, after the form has already checked it.

        The form's validation is for the person typing; this is for the record.
        A backend that trusted its client would be one bad build away from a
        blank name, and the screen has to be able to survive a refusal anyway.
      */
      if (!firstName) {
        throw new AppError({ kind: 'validation', message: 'Mock profile refused: no first name' });
      }
      if (firstName.length > PROFILE_NAME_MAX_LENGTH || lastName.length > PROFILE_NAME_MAX_LENGTH) {
        throw new AppError({ kind: 'validation', message: 'Mock profile refused: name too long' });
      }
      if (email && !EMAIL_PATTERN.test(email)) {
        throw new AppError({ kind: 'validation', message: 'Mock profile refused: bad email' });
      }

      // Spread first, then delete: an absent email means the customer cleared
      // it, and `email: undefined` would survive a round trip through JSON as a
      // missing key anyway. Being explicit keeps the two the same thing.
      const updated: AuthUser = { ...user, firstName, lastName };
      if (email) {
        updated.email = email;
      } else {
        delete updated.email;
      }

      return updated;
    }, this.latency);
  }

  async setProfileImage(remoteUrl: string): Promise<AuthUser> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();

      if (!remoteUrl.trim()) {
        throw new AppError({ kind: 'validation', message: 'Mock profile refused: no image url' });
      }

      return { ...user, avatarUrl: remoteUrl };
    }, this.latency);
  }

  async removeProfileImage(): Promise<AuthUser> {
    return simulateNetwork(async () => {
      const user = await this.requireUser();

      const updated: AuthUser = { ...user };
      delete updated.avatarUrl;

      return updated;
    }, this.latency);
  }

  /** What an authenticated endpoint does when the caller is not. */
  private async requireUser(): Promise<AuthUser> {
    const user = await this.readUser();
    if (!user) {
      throw new AppError({ kind: 'unauthorized', message: 'Mock profile refused: no session' });
    }

    return user;
  }
}
