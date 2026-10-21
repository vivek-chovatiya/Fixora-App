/**
 * How a stored phone number is written (owner decision, 21/10/2026). Pinned
 * here:
 *
 * - ten digits read "+91 98765 43210"
 * - the same number with its country code in front, in any spacing, reads the
 *   same
 * - a number that does not fit — short, long, another country's code, a value
 *   with letters — comes back as it was stored, trimmed, never regrouped
 * - nothing, blank or not a string writes nothing
 * - it never changes what is sent: the formatted value is not digits only
 */

import { formatPhone } from '@/shared/presentation/phone';
import { normalisePhone } from '@/shared/validation/phone';

describe('formatPhone', () => {
  it.each([
    ['9876543210', '+91 98765 43210'],
    ['9000000001', '+91 90000 00001'],
    ['919876543210', '+91 98765 43210'],
    ['+919876543210', '+91 98765 43210'],
    ['+91 98765-43210', '+91 98765 43210'],
    ['  9876543210  ', '+91 98765 43210'],
    ['(98765) 43210', '+91 98765 43210'],
  ])('writes %p as %p', (stored, written) => {
    expect(formatPhone(stored)).toBe(written);
  });

  it.each([
    ['98765', 'too short'],
    ['98765432101', 'eleven digits'],
    ['4412345678901', 'another country'],
    ['929876543210', 'twelve digits that do not start with 91'],
    ['98765abc10', 'letters'],
    ['+44 20 7946 0958', 'a foreign number with its own spacing'],
  ])('leaves %p (%s) as stored', stored => {
    expect(formatPhone(stored)).toBe(stored);
  });

  it('trims a value it does not regroup', () => {
    expect(formatPhone('  98765  ')).toBe('98765');
  });

  it.each([[''], ['   '], [undefined], [null]])('writes nothing for %p', value => {
    expect(formatPhone(value)).toBe('');
  });

  it('does not survive normalising as the same text — display only', () => {
    const written = formatPhone('9876543210');

    expect(written).not.toBe('9876543210');
    expect(normalisePhone(written)).toBe('919876543210');
  });
});
