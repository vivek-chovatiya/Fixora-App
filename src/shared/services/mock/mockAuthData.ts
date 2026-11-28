/**
 * MOCK AUTHENTICATION DATA — DEVELOPMENT ONLY
 *
 * ⚠️ These are fixtures, not credentials. Nothing here is a secret, nothing here
 * grants access to anything real, and none of it may survive into a production
 * build. `auth` in `AppConfig.services.live` is the switch that retires it.
 *
 * Every mock account and the mock code live here rather than in a screen. A
 * screen containing `if (code === '123456')` would have to be edited when the
 * backend arrives, which is exactly the migration the service layer exists to
 * avoid.
 */

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser } from '@/features/auth/types';
import { normalisePhone } from '@/shared/validation/phone';

/** The one-time code MockAuthService accepts, for customers and vendors alike. */
export const MOCK_OTP_CODE = '123456';

/** How long a mock one-time code stays valid. */
export const MOCK_OTP_TTL_SECONDS = 300;

/** Cooldown before the UI may offer "resend". */
export const MOCK_OTP_RESEND_AFTER_SECONDS = 30;

export interface MockAccount {
  /** Digits only. Compared after normalisation, so formatting does not matter. */
  phone: string;
  user: AuthUser;
}

/**
 * Accounts that already exist before any registration happens.
 *
 * Customer  9876543210                         → one-time code 123456
 * Customer  9876543211  (long name, email)     → one-time code 123456
 * Customer  9876543212  (no name, no email)    → one-time code 123456
 * Vendor    9000000001                         → one-time code 123456 (already onboarded)
 * Vendor    9000000002  (email on the account) → one-time code 123456
 *
 * The second and third customers exist so the profile screen's edges are
 * reachable by signing in rather than by editing a mock: a name long enough to
 * wrap at 360dp beside an email, and an account the backend has no name for —
 * which is how an account created on first verification (section 7A) arrives.
 * They are also the "another customer" that proves one customer's unsent draft
 * never reaches the next one on the same device.
 *
 * The second vendor exists for the same reason the second customer does: to
 * prove one vendor's business profile never reaches the next one on the same
 * device (Phase 3E-1), without registering — registered vendors do not survive
 * a restart.
 *
 * Vendors created through the registration flow are held in memory by
 * MockAuthService for the life of the app process.
 */
export const MOCK_ACCOUNTS: readonly MockAccount[] = Object.freeze([
  {
    phone: '9876543210',
    user: {
      id: 'usr_customer_1',
      firstName: 'Asha',
      lastName: 'Patel',
      phone: '9876543210',
      role: 'customer',
    },
  },
  {
    phone: '9876543211',
    user: {
      id: 'usr_customer_2',
      firstName: 'Venkata Subrahmanya Lakshmi',
      lastName: 'Narasimhamurthy-Ramachandran',
      email: 'venkata.narasimhamurthy.ramachandran@example.com',
      phone: '9876543211',
      role: 'customer',
    },
  },
  {
    phone: '9876543212',
    user: {
      id: 'usr_customer_3',
      firstName: '',
      lastName: '',
      phone: '9876543212',
      role: 'customer',
    },
  },
  {
    phone: '9000000001',
    user: {
      id: 'usr_vendor_1',
      firstName: 'Ravi',
      lastName: 'Kumar',
      phone: '9000000001',
      role: 'vendor',
    },
  },
  {
    phone: '9000000002',
    user: {
      id: 'usr_vendor_2',
      firstName: 'Meena',
      lastName: 'Iyer',
      email: 'meena.iyer@example.com',
      phone: '9000000002',
      role: 'vendor',
    },
  },
]);

/**
 * Finds a seeded account by phone. Matches on trailing digits so a number
 * entered with a country code still resolves.
 */
export function findMockAccount(phone: string): MockAccount | undefined {
  const digits = normalisePhone(phone);
  if (digits.length < AppConfig.phone.minDigits) {
    return undefined;
  }
  return MOCK_ACCOUNTS.find(account => digits.endsWith(account.phone));
}

/**
 * Masks a number for display, mirroring what a real backend returns so the app
 * never has to mask anything itself.
 */
export function maskPhone(phone: string): string {
  const digits = normalisePhone(phone);
  if (digits.length <= 4) {
    return digits;
  }
  return `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}
