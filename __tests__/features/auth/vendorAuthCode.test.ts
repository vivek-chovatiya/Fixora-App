/**
 * The vendor auth code became six digits (owner's decision, 21/10/2026). These
 * pin the rules that decision rests on, apart from any screen:
 *
 * - what a person may type or paste and still be accepted — separators are
 *   removed, nothing else is forgiven, and a leading zero is part of the code;
 * - what is refused, and that the message names the problem the person can see;
 * - how the code is drawn and spoken, and that neither changes the value;
 * - that the mock's stand-in codes have the same shape, from a source a test can
 *   pin.
 */

import { AppConfig } from '@/core/config/AppConfig';
import {
  groupVendorAuthCode,
  maskPhone,
  phoneEnding,
  spellOut,
} from '@/features/auth/constants/vendorAuthPresentation';
import {
  VENDOR_AUTH_CODE_INPUT_MAX_LENGTH,
  normaliseVendorAuthCode,
  vendorAuthCodeSchema,
  vendorLoginSchema,
} from '@/features/auth/validation/authSchemas';
import {
  MOCK_ACCOUNTS,
  generateMockVendorAuthCode,
  nextMockVendorAuthCode,
} from '@/shared/services/mock/mockAuthData';

/** The message the field would show: the first issue, as the resolver takes it. */
function refusalOf(authCode: string): string | null {
  const result = vendorAuthCodeSchema.safeParse({ authCode });
  return result.success ? null : result.error.issues[0].message;
}

const NUMBERS_ONLY = 'Your authentication code is numbers only.';
const SIX_DIGITS = 'Your authentication code is 6 digits.';

describe('vendor auth code — the length', () => {
  it('is six, from one place', () => {
    expect(AppConfig.vendorAuthCode.length).toBe(6);
  });
});

describe('vendor auth code — accepted', () => {
  it.each([
    ['six digits', '482913'],
    ['a leading zero', '048213'],
    ['all zeros', '000000'],
    ['grouped with a space, as it is displayed', '482 913'],
    ['grouped with a hyphen', '482-913'],
    ['spaced digit by digit', '4 8 2 9 1 3'],
    ['padded by a paste', '  482913 '],
    ['a trailing newline from a paste', '482913\n'],
    ['the no-break space the display uses', '482 913'],
    ['an en dash a notes app substituted', '482–913'],
    ['a minus sign', '482−913'],
  ])('%s', (_label, typed) => {
    expect(refusalOf(typed)).toBeNull();
  });

  it('normalises every accepted form to the bare digits, leading zero kept', () => {
    expect(normaliseVendorAuthCode('482 913')).toBe('482913');
    expect(normaliseVendorAuthCode('482-913')).toBe('482913');
    expect(normaliseVendorAuthCode(' 0 4 8-2 1 3 ')).toBe('048213');
    expect(normaliseVendorAuthCode('482 913')).toBe('482913');
  });

  it('removes separators and nothing else', () => {
    // A letter or a seventh digit is left for the schema to refuse, not
    // quietly corrected into something that looks like a code.
    expect(normaliseVendorAuthCode('48291a')).toBe('48291a');
    expect(normaliseVendorAuthCode('4829134')).toBe('4829134');
  });
});

/**
 * Characters nobody can see, which a paste brings with it — a messaging app
 * wraps a number in direction isolates, a web page leaves a zero-width space.
 * Written as escapes: the point is that they are invisible.
 */
describe('vendor auth code — invisible characters from a paste', () => {
  const INVISIBLE: [string, string][] = [
    ['zero-width space U+200B', '\u200B'],
    ['zero-width non-joiner U+200C', '\u200C'],
    ['zero-width joiner U+200D', '\u200D'],
    ['left-to-right mark U+200E', '\u200E'],
    ['right-to-left mark U+200F', '\u200F'],
    ['left-to-right embedding U+202A', '\u202A'],
    ['right-to-left embedding U+202B', '\u202B'],
    ['pop directional formatting U+202C', '\u202C'],
    ['left-to-right override U+202D', '\u202D'],
    ['right-to-left override U+202E', '\u202E'],
    ['word joiner U+2060', '\u2060'],
    ['invisible times U+2062', '\u2062'],
    ['left-to-right isolate U+2066', '\u2066'],
    ['right-to-left isolate U+2067', '\u2067'],
    ['first strong isolate U+2068', '\u2068'],
    ['pop directional isolate U+2069', '\u2069'],
    ['byte-order mark U+FEFF', '\uFEFF'],
  ];

  it.each(INVISIBLE)('accepts a code carrying a %s', (_label, invisible) => {
    const pasted = `${invisible}482${invisible}913${invisible}`;

    expect(normaliseVendorAuthCode(pasted)).toBe('482913');
    expect(refusalOf(pasted)).toBeNull();
  });

  it('accepts a code wrapped the way a messaging app wraps it, grouped as it was shown', () => {
    expect(normaliseVendorAuthCode('\u2068482 913\u2069')).toBe('482913');
    expect(normaliseVendorAuthCode('\u202A0 4 8-2 1 3\u202C')).toBe('048213');
  });

  it('asks for the code when only invisible characters were pasted', () => {
    expect(refusalOf('\u200B\u2066\u2069\uFEFF')).toBe('Enter your authentication code.');
  });

  it('still refuses what is visible: a letter is not hidden by an invisible neighbour', () => {
    expect(refusalOf('\u200B48291a\u200B')).toBe(NUMBERS_ONLY);
  });

  it('removes nothing just past the ranges that is not already a space or a dash', () => {
    // The other neighbours are taken anyway — U+200A, U+2029, U+202F and
    // U+205F are whitespace, U+2010 a hyphen — so the edges that test the
    // ranges themselves are these two.
    expect(normaliseVendorAuthCode('482\u206A913')).toBe('482\u206A913');
    expect(normaliseVendorAuthCode('482\uFEFE913')).toBe('482\uFEFE913');
  });
});

describe('vendor auth code — refused, with a reason', () => {
  it('asks for the code when nothing was entered', () => {
    expect(refusalOf('')).toBe('Enter your authentication code.');
    expect(refusalOf('   ')).toBe('Enter your authentication code.');
    expect(refusalOf(' - ')).toBe('Enter your authentication code.');
  });

  it.each([
    ['five digits', '48291'],
    ['seven digits', '4829134'],
    ['a phone number', '9000000001'],
    ['five digits in groups', '482 91'],
  ])('says it is six digits for %s', (_label, typed) => {
    expect(refusalOf(typed)).toBe(SIX_DIGITS);
  });

  it.each([
    ['a letter', '48291a'],
    ['the old code format', 'FX-ABCD-2345'],
    ['a full stop', '482.913'],
    ['a slash', '482/913'],
    ['an underscore', '482_913'],
  ])('says it is numbers only for %s', (_label, typed) => {
    // About the character the person can see, not about the length — which
    // is also wrong for some of these, and is the second thing to fix.
    expect(refusalOf(typed)).toBe(NUMBERS_ONLY);
  });

  it('refuses digits from another script rather than guessing at them', () => {
    // Devanagari ४८२९१३. The backend expects ASCII digits; the number pad
    // only produces those, so this can only arrive by paste.
    expect(refusalOf('४८२९१३')).toBe(NUMBERS_ONLY);
  });

  it('applies the same rule on the sign-in form, beside the phone rule', () => {
    const result = vendorLoginSchema.safeParse({ phone: '9000000001', authCode: '48291' });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map(issue => issue.path.join('.'))).toEqual(['authCode']);
    expect(result.error?.issues[0].message).toBe(SIX_DIGITS);
    expect(
      vendorLoginSchema.safeParse({ phone: '9000000001', authCode: '482 913' }).success,
    ).toBe(true);
  });

  it('never repeats the entry in the message', () => {
    for (const typed of ['48291', '4829134', '48291a']) {
      expect(refusalOf(typed)).not.toContain(typed);
    }
  });
});

describe('vendor auth code — the field ceiling', () => {
  it('leaves room for a code pasted digit by digit', () => {
    expect('4 8 2 9 1 3'.length).toBeLessThanOrEqual(VENDOR_AUTH_CODE_INPUT_MAX_LENGTH);
    expect('4-8-2-9-1-3'.length).toBeLessThanOrEqual(VENDOR_AUTH_CODE_INPUT_MAX_LENGTH);
  });

  it('still stops a pasted paragraph', () => {
    expect(VENDOR_AUTH_CODE_INPUT_MAX_LENGTH).toBeLessThan(20);
  });
});

describe('vendor auth code — how it is shown and spoken', () => {
  it('groups six digits in threes, held together by a no-break space', () => {
    expect(groupVendorAuthCode('482913')).toBe('482 913');
    expect(groupVendorAuthCode('048213')).toBe('048 213');
  });

  it('shows a code that is not all digits exactly as issued', () => {
    expect(groupVendorAuthCode('FX-ABCD-2345')).toBe('FX-ABCD-2345');
  });

  it('round-trips: what is shown, typed back, is the code', () => {
    expect(normaliseVendorAuthCode(groupVendorAuthCode('048213'))).toBe('048213');
  });

  it('spells the code one digit at a time for a screen reader', () => {
    expect(spellOut('482913')).toBe('4 8 2 9 1 3');
    expect(spellOut('048213')).toBe('0 4 8 2 1 3');
  });
});

describe('remembered phone — how it is shown', () => {
  it('masks all but the last four digits', () => {
    expect(maskPhone('9000000001')).toBe('••••••0001');
    expect(phoneEnding('9000000001')).toBe('0001');
  });

  it('never shows the hidden digits', () => {
    expect(maskPhone('9876543210')).not.toContain('987654');
  });
});

describe('mock vendor auth codes', () => {
  it('seeds both vendors with six-digit codes of their own', () => {
    const codes = MOCK_ACCOUNTS.filter(account => account.user.role === 'vendor').map(
      account => [account.user.id, account.vendorAuthCode],
    );

    expect(codes).toEqual([
      ['usr_vendor_1', '482913'],
      ['usr_vendor_2', '573014'],
    ]);
  });

  it('generates six digits from the source it is given', () => {
    const draws = [0.05, 0.45, 0.85, 0.25, 0.15, 0.35];
    let index = 0;

    expect(generateMockVendorAuthCode(() => draws[index++])).toBe('048213');
  });

  it('keeps a leading zero, as a string', () => {
    const code = generateMockVendorAuthCode(() => 0);

    expect(code).toBe('000000');
    expect(typeof code).toBe('string');
  });

  it('still yields a digit from a source that returns exactly 1', () => {
    expect(generateMockVendorAuthCode(() => 1)).toBe('999999');
  });

  it('steps to the next code, wrapping at the top and keeping its width', () => {
    expect(nextMockVendorAuthCode('482913')).toBe('482914');
    expect(nextMockVendorAuthCode('000999')).toBe('001000');
    expect(nextMockVendorAuthCode('999999')).toBe('000000');
  });
});
