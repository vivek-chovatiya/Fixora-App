/**
 * A stored `YYYY-MM-DD`, read back for a person — the customer's preferred
 * date, which the vendor's request details now read too (21/10/2026).
 *
 * Pinned: the day words are the caller's, today and tomorrow are called by
 * name, any other day — before or after — by its date in the reader's own
 * locale, the value is read in local time (never as UTC midnight), and a value
 * that is not a date is shown as it came. The customer's module still answers
 * with the same function.
 */

import { formatDateValue as customerFormatDateValue } from '@/features/customer/constants/requestScheduling';
import { formatDateValue } from '@/shared/presentation/calendarDate';

const WORDS = { today: 'Today', tomorrow: 'Tomorrow' };
const NOW = new Date(2026, 9, 21, 23, 30);

/** The reader's own way of writing a day — never a literal "Fri 23 Oct". */
const written = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

describe('formatDateValue', () => {
  it('calls today and tomorrow by name, in the caller’s words', () => {
    expect(formatDateValue('2026-10-21', WORDS, NOW)).toBe('Today');
    expect(formatDateValue('2026-10-22', WORDS, NOW)).toBe('Tomorrow');
    expect(formatDateValue('2026-10-22', { today: 'Aaj', tomorrow: 'Kal' }, NOW)).toBe('Kal');
  });

  it('writes any other day as a date — a day already gone too', () => {
    expect(formatDateValue('2026-10-23', WORDS, NOW)).toBe(written(new Date(2026, 9, 23)));
    expect(formatDateValue('2026-10-20', WORDS, NOW)).toBe(written(new Date(2026, 9, 20)));
  });

  it('reads the date in local time, so late in the evening is still the same day', () => {
    // Half past eleven at night: a UTC reading would make "today" yesterday east of Greenwich.
    expect(formatDateValue('2026-10-21', WORDS, NOW)).toBe('Today');
  });

  it('shows a value it cannot read as it came, never dropped', () => {
    expect(formatDateValue('soon', WORDS, NOW)).toBe('soon');
    expect(formatDateValue('', WORDS, NOW)).toBe('');
  });

  it('is the very function the customer’s scheduling module answers with', () => {
    expect(customerFormatDateValue).toBe(formatDateValue);
  });
});
