/**
 * These are the two functions that decide what reaches the backend when a
 * customer expresses a preference, so what is pinned here is the value, not the
 * wording — the labels are locale output and change with the device.
 *
 * The timezone case is the reason this file exists. `toISOString` converts to
 * UTC before it formats, so anywhere east of Greenwich a customer tapping
 * "Tomorrow" late in the evening would have been recorded as asking for today.
 */

import {
  buildDateOptions,
  buildTimeOptions,
  NO_PREFERENCE,
  toOptionalValue,
} from '@/features/customer/constants/requestScheduling';

const COPY = {
  anyDate: 'No preference',
  anyTime: 'No preference',
  today: 'Today',
  tomorrow: 'Tomorrow',
};

describe('buildDateOptions', () => {
  it('offers no preference first, so having none is a choice', () => {
    const [first] = buildDateOptions(COPY, new Date(2026, 8, 1, 10, 0));

    expect(first).toEqual({ value: NO_PREFERENCE, label: COPY.anyDate });
  });

  it('names the next two days rather than dating them', () => {
    const options = buildDateOptions(COPY, new Date(2026, 8, 1, 10, 0));

    expect(options[1].label).toBe(COPY.today);
    expect(options[2].label).toBe(COPY.tomorrow);
  });

  it('produces the local calendar date, whatever the hour', () => {
    // Half past eleven at night. In any timezone ahead of UTC this is already
    // the following day in Greenwich, which is exactly the trap.
    const options = buildDateOptions(COPY, new Date(2026, 8, 1, 23, 30));

    expect(options[1].value).toBe('2026-09-01');
    expect(options[2].value).toBe('2026-09-02');
  });

  it('rolls the month and the year over correctly', () => {
    const options = buildDateOptions(COPY, new Date(2026, 11, 31, 9, 0));

    expect(options[1].value).toBe('2026-12-31');
    expect(options[2].value).toBe('2027-01-01');
  });

  it('offers a fortnight and stops', () => {
    const options = buildDateOptions(COPY, new Date(2026, 8, 1, 10, 0));

    // Fourteen days plus the opening "no preference".
    expect(options).toHaveLength(15);
    expect(options[14].value).toBe('2026-09-14');
  });

  it('formats every value as the calendar date the contract defines', () => {
    const options = buildDateOptions(COPY, new Date(2026, 8, 1, 10, 0));

    for (const option of options.slice(1)) {
      expect(option.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('buildTimeOptions', () => {
  it('offers no preference first, then whole hours in 24-hour form', () => {
    const options = buildTimeOptions(COPY);

    expect(options[0]).toEqual({ value: NO_PREFERENCE, label: COPY.anyTime });
    expect(options[1].value).toBe('07:00');
    expect(options[options.length - 1].value).toBe('20:00');

    for (const option of options.slice(1)) {
      expect(option.value).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
  });

  it('labels an afternoon hour for the reader, not for the wire', () => {
    const afternoon = buildTimeOptions(COPY).find(option => option.value === '13:00');

    expect(afternoon).toBeDefined();
    expect(afternoon?.label).not.toBe('13:00');
  });
});

describe('toOptionalValue', () => {
  it('turns "no preference" into an absent field rather than an empty one', () => {
    expect(toOptionalValue(NO_PREFERENCE)).toBeUndefined();
  });

  it('passes a real answer through untouched', () => {
    expect(toOptionalValue('2026-09-09')).toBe('2026-09-09');
    expect(toOptionalValue('14:00')).toBe('14:00');
  });
});
