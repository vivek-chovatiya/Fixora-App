/**
 * Working hours presentation
 *
 * How a working week (PROJECT_BIBLE.md section 38, "Working Hours") is written
 * down: a day's name, a day's hours, and the Profile tab's summary of the whole
 * week ("Mon–Sat 9:00 AM – 7:00 PM", "Sun Closed").
 *
 * ⚠️ It words, it never decides. A day is the backend's plain string; this
 * table names the seven the app knows and shows any other tidied
 * (`humaniseToken`), never dropped and never guessed at — the rule every
 * backend string in the app follows. Nothing here checks a week: a week the
 * backend sends is shown as it came, whatever it says.
 *
 * ⚠️ Only neighbouring days with the same hours are joined. "Mon–Wed" claims
 * Tuesday, so Monday and Wednesday alike with a different Tuesday stay three
 * lines — longer, and never untrue.
 *
 * Times are the shared clock (`formatTimeValue`), so a vendor reads their hours
 * in their own locale's format, as a customer reads a preferred time. Every
 * line has a spoken form with the days in full and "to" for each dash —
 * "Monday to Saturday, 9:00 AM to 7:00 PM" — because "Mon dash Sat" is what a
 * screen reader makes of the drawn one.
 */

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { formatTimeValue } from '@/shared/presentation/clockTime';
import { humaniseToken } from '@/shared/presentation/requestTokens';
import type { VendorWorkingDay } from '@/shared/services/types/VendorProfileService';

const COPY = VENDOR_COPY.workingHours;

export interface DayName {
  /** "Mon" — the summary's. */
  short: string;
  /** "Monday" — every row's and everything spoken. */
  long: string;
}

const DAY_NAMES: Readonly<Record<string, DayName>> = COPY.days;

/** A day's names, by the backend's code. A code the table does not know is shown tidied. */
export function presentDay(code: string): DayName {
  // Not a string at all is a broken answer, and is still drawn rather than thrown.
  const raw = typeof code === 'string' ? code : '';
  const known = DAY_NAMES[raw.trim().toUpperCase()];
  if (known) {
    return known;
  }

  const tidied = humaniseToken(raw) || COPY.unknownDay;
  return { short: tidied, long: tidied };
}

export interface HoursPresentation {
  /** "9:00 AM – 7:00 PM", or "Closed". */
  text: string;
  /** "9:00 AM to 7:00 PM", or "closed". */
  spoken: string;
}

/** One day's hours, as drawn and as spoken. */
export function presentHours(day: VendorWorkingDay): HoursPresentation {
  if (day.isOpen !== true) {
    return { text: COPY.closed, spoken: COPY.closedSpoken };
  }
  // Open with no times breaks the contract; "open" is still true, a time would be invented.
  if (typeof day.opensAt !== 'string' || typeof day.closesAt !== 'string') {
    return { text: COPY.open, spoken: COPY.openSpoken };
  }

  const opens = formatTimeValue(day.opensAt);
  const closes = formatTimeValue(day.closesAt);
  return { text: COPY.hours(opens, closes), spoken: COPY.hoursSpoken(opens, closes) };
}

/** Whether two neighbouring days read the same and may share a line. */
function sameHours(first: VendorWorkingDay, second: VendorWorkingDay): boolean {
  return presentHours(first).text === presentHours(second).text;
}

export interface WorkingHoursLine {
  /** Stable for a week as given, for a React key. */
  key: string;
  /** "Mon–Sat", or "Sun" for a day on its own. */
  days: string;
  /** "9:00 AM – 7:00 PM", or "Closed". */
  hours: string;
  /** The whole line as one phrase: "Monday to Saturday, 9:00 AM to 7:00 PM". */
  spoken: string;
}

/**
 * The week as the Profile tab summarises it: runs of neighbouring days with
 * the same hours, one line each, in the order given. Nothing for something
 * that is not a list — the caller says the hours are not added yet.
 */
export function summariseWorkingHours(
  week: readonly VendorWorkingDay[] | undefined,
): WorkingHoursLine[] {
  if (!Array.isArray(week)) {
    return [];
  }

  const runs: VendorWorkingDay[][] = [];
  for (const day of week) {
    // A hole in the list is skipped, not drawn as a day.
    if (typeof day !== 'object' || day === null) {
      continue;
    }
    const run = runs[runs.length - 1];
    if (run && sameHours(run[0], day)) {
      run.push(day);
    } else {
      runs.push([day]);
    }
  }

  return runs.map((run, index) => {
    const first = presentDay(run[0].day);
    const last = presentDay(run[run.length - 1].day);
    const hours = presentHours(run[0]);
    const daysSpoken = run.length === 1 ? first.long : COPY.dayRangeSpoken(first.long, last.long);

    return {
      key: `${index}-${String(run[0].day)}`,
      days: run.length === 1 ? first.short : COPY.dayRange(first.short, last.short),
      hours: hours.text,
      spoken: COPY.summarySpoken(daysSpoken, hours.spoken),
    };
  });
}
