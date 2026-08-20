/**
 * Phone validation is the one piece of the sign-in screen that makes a decision,
 * so it is tested directly rather than through the UI.
 *
 * The rules that matter: a number is normalised to digits before it reaches a
 * service, formatting a user types is accepted, and an incomplete entry is
 * stopped here instead of costing a network round trip.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { customerPhoneSchema } from '@/features/auth/validation/authSchemas';
import { capPhoneInput, normalisePhone, phoneSchema } from '@/shared/validation/phone';

/** First error message, or undefined when the value passed. */
function messageFor(value: string): string | undefined {
  const result = phoneSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('normalisePhone', () => {
  it('reduces a formatted number to digits', () => {
    expect(normalisePhone('+91 98765-43210')).toBe('919876543210');
    expect(normalisePhone('(987) 654 3210')).toBe('9876543210');
  });

  it('leaves an already-normalised number alone', () => {
    expect(normalisePhone('9876543210')).toBe('9876543210');
  });
});

describe('capPhoneInput', () => {
  const limit = AppConfig.phone.maxDigits;

  it('leaves anything within the limit exactly as typed', () => {
    expect(capPhoneInput('9876543210')).toBe('9876543210');
    expect(capPhoneInput('+91 98765-43210')).toBe('+91 98765-43210');
    expect(capPhoneInput('')).toBe('');
  });

  it('counts digits rather than characters', () => {
    // Seventeen characters, twelve digits. A plain maxLength would have cut
    // this valid number short.
    const formatted = '+91 (98765) 43210';
    expect(formatted.length).toBeGreaterThan(limit);
    expect(normalisePhone(formatted).length).toBeLessThanOrEqual(limit);
    expect(capPhoneInput(formatted)).toBe(formatted);
  });

  it('stops accepting once the number is as long as one can be', () => {
    const tooMany = '1'.repeat(limit + 10);

    expect(normalisePhone(capPhoneInput(tooMany))).toHaveLength(limit);
  });

  it('keeps the capped value valid, which is the point of capping', () => {
    expect(messageFor(capPhoneInput('9'.repeat(40)))).toBeUndefined();
  });

  it('does not delete characters it merely disapproves of', () => {
    // Letters survive so that phoneSchema can still say what is wrong. A field
    // that silently ate them would leave the user with no idea why.
    expect(capPhoneInput('98765abcde')).toBe('98765abcde');
  });
});

describe('phoneSchema', () => {
  it('accepts a plain number', () => {
    expect(messageFor('9876543210')).toBeUndefined();
  });

  it('accepts the formatting a person actually types', () => {
    expect(messageFor('+91 98765-43210')).toBeUndefined();
    expect(messageFor('(987) 654 3210')).toBeUndefined();
  });

  it('asks for a number when the field is empty or only spaces', () => {
    expect(messageFor('')).toBe('Enter your phone number.');
    expect(messageFor('   ')).toBe('Enter your phone number.');
  });

  it('rejects letters without hinting at a format', () => {
    expect(messageFor('98765abcde')).toBe('Enter a phone number using digits only.');
  });

  it('rejects a number below the configured minimum', () => {
    const tooShort = '9'.repeat(AppConfig.phone.minDigits - 1);

    expect(messageFor(tooShort)).toBe('That number looks too short. Please check it.');
  });

  it('rejects a number above the E.164 ceiling', () => {
    const tooLong = '9'.repeat(AppConfig.phone.maxDigits + 1);

    expect(messageFor(tooLong)).toBe('That number looks too long. Please check it.');
  });

  it('counts digits rather than characters, so separators do not consume the limit', () => {
    // Same digits as a valid number, well past maxDigits in raw length.
    expect(messageFor('+91 (987) 654 - 3210')).toBeUndefined();
  });
});

describe('customerPhoneSchema', () => {
  it('trims the submitted value so a stray space never reaches the service', () => {
    const result = customerPhoneSchema.safeParse({ phone: '  9876543210  ' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.phone).toBe('9876543210');
  });

  it('reports the failure against the phone field', () => {
    const result = customerPhoneSchema.safeParse({ phone: '123' });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0].path).toEqual(['phone']);
  });
});
