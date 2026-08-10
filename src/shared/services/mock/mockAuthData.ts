/**
 * MOCK AUTHENTICATION DATA — DEVELOPMENT ONLY
 *
 * ⚠️ These are fixtures, not credentials. Nothing here is a secret, nothing here
 * grants access to anything real, and none of it may survive into a production
 * build. `AppConfig.features.useMockServices` is the switch that retires it.
 *
 * Every mock account and the mock code live here rather than in a screen. A
 * screen that contained `if (code === '123456')` would have to be edited when
 * the backend arrives, which is exactly the migration the service layer exists
 * to avoid.
 */

import type { AuthUser } from '@/features/auth/types';

/** The code MockAuthService accepts for every customer. */
export const MOCK_OTP_CODE = '123456';

/** How long a mock code stays valid. */
export const MOCK_OTP_TTL_SECONDS = 300;

/** Cooldown before the UI may offer "resend". */
export const MOCK_OTP_RESEND_AFTER_SECONDS = 30;

/** Shortest input the mock treats as a plausible phone number. */
export const MOCK_MIN_PHONE_DIGITS = 10;

export interface MockAccount {
  /** Digits only. Compared after normalisation, so formatting does not matter. */
  phone: string;
  user: AuthUser;
  /**
   * Vendors only, and only once approved. An administrator issues this after
   * approval, so pending and rejected vendors deliberately have none.
   */
  vendorCode?: string;
}

/**
 * The universe of accounts the mock knows about.
 *
 * Customer  9876543210                        → code 123456
 * Vendor    9000000001 + FX-VENDOR-APPROVED   → approved, signs in
 * Vendor    9000000002                        → pending, cannot sign in
 * Vendor    9000000003                        → rejected, cannot sign in
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
    phone: '9000000001',
    vendorCode: 'FX-VENDOR-APPROVED',
    user: {
      id: 'usr_vendor_1',
      firstName: 'Ravi',
      lastName: 'Kumar',
      phone: '9000000001',
      role: 'vendor',
      vendorApproval: 'approved',
    },
  },
  {
    phone: '9000000002',
    user: {
      id: 'usr_vendor_2',
      firstName: 'Meera',
      lastName: 'Shah',
      phone: '9000000002',
      role: 'vendor',
      vendorApproval: 'pending',
    },
  },
  {
    phone: '9000000003',
    user: {
      id: 'usr_vendor_3',
      firstName: 'Sunil',
      lastName: 'Verma',
      phone: '9000000003',
      role: 'vendor',
      vendorApproval: 'rejected',
    },
  },
]);

/** Strips formatting so '+91 98765-43210' and '9876543210' are the same number. */
export function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Finds an account by phone. Matches on the trailing digits so a number entered
 * with a country code still resolves.
 */
export function findMockAccount(phone: string): MockAccount | undefined {
  const digits = normalisePhone(phone);
  if (digits.length < MOCK_MIN_PHONE_DIGITS) {
    return undefined;
  }
  return MOCK_ACCOUNTS.find(account => digits.endsWith(account.phone));
}

/**
 * Masks a number for display, mirroring what a real backend would return so the
 * app never has to mask anything itself.
 */
export function maskPhone(phone: string): string {
  const digits = normalisePhone(phone);
  if (digits.length <= 4) {
    return digits;
  }
  return `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}
