/**
 * The vendor auth code was retired on 28/11/2026 (phase5-contract.md section 1):
 * a returning vendor signs in with their phone and a one-time code, as a
 * customer does. What is left of the old auth-code rules, apart from any screen:
 *
 * - the vendor sign-in form holds a phone number and nothing else — no code
 *   field survives to be filled, validated or sent;
 * - the remembered phone is drawn masked and spoken digit by digit, and neither
 *   changes the value;
 * - the mock's seeded vendors carry no standing code to sign in with.
 *
 * Replaces `vendorAuthCode.test.ts`, whose separator, grouping, length and
 * generator rules guarded a credential that no longer exists.
 */

import {
  maskPhone,
  phoneEnding,
  spellOut,
} from '@/features/auth/constants/vendorAuthPresentation';
import * as authSchemas from '@/features/auth/validation/authSchemas';
import { otpSchema, vendorLoginSchema } from '@/features/auth/validation/authSchemas';
import { MOCK_ACCOUNTS } from '@/shared/services/mock/mockAuthData';

describe('vendor sign-in form — the phone and nothing else', () => {
  it('accepts a phone number on its own', () => {
    const result = vendorLoginSchema.safeParse({ phone: '9000000001' });

    expect(result.success).toBe(true);
  });

  it('keeps only the phone, so a stray auth code can never ride along', () => {
    const result = vendorLoginSchema.safeParse({ phone: '9000000001', authCode: '482913' });

    expect(result.success).toBe(true);
    expect(Object.keys(result.data ?? {}).sort()).toEqual(['phone']);
  });

  it('refuses a number the shared phone rule refuses, on the phone field', () => {
    const result = vendorLoginSchema.safeParse({ phone: '123' });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map(issue => issue.path.join('.'))).toEqual(['phone']);
  });

  it('leaves the code to the one-time-code rule every flow shares', () => {
    expect(otpSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(otpSchema.safeParse({ code: '12345' }).success).toBe(false);
  });

  it('exports nothing for the retired auth code', () => {
    const names = Object.keys(authSchemas);

    expect(names.filter(name => /authcode/i.test(name))).toEqual([]);
  });
});

describe('remembered phone — how it is shown and spoken', () => {
  it('masks all but the last four digits', () => {
    expect(maskPhone('9000000001')).toBe('••••••0001');
    expect(phoneEnding('9000000001')).toBe('0001');
  });

  it('never shows the hidden digits', () => {
    expect(maskPhone('9876543210')).not.toContain('987654');
  });

  it('spells the ending one digit at a time for a screen reader', () => {
    expect(spellOut(phoneEnding('9000000001'))).toBe('0 0 0 1');
  });
});

describe('mock vendors', () => {
  it('seed no standing code: signing in is by one-time code only', () => {
    const vendors = MOCK_ACCOUNTS.filter(account => account.user.role === 'vendor');

    expect(vendors.map(account => account.user.id)).toEqual(['usr_vendor_1', 'usr_vendor_2']);
    for (const account of vendors) {
      expect(Object.keys(account).sort()).toEqual(['phone', 'user']);
    }
  });
});
