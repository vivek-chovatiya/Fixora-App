/**
 * Money, made readable
 *
 * How an amount of money is written — to whoever is looking. Written for the
 * offline payment record (PROJECT_BIBLE.md sections 36 and 37): the vendor
 * records what a job came to and the customer reads it back, and an amount
 * must not read "₹1,250" to one of them and something else to the other. One
 * formatter, both sides.
 *
 * ⚠️ Amounts are whole minor units — paise — and never rupees with a
 * fraction. `0.1 + 0.2` is not `0.3` in floating point, and a record of money
 * that is a paisa out is a wrong record. Nothing here multiplies or divides a
 * decimal: the digits are split as a string.
 *
 * ⚠️ By hand, not `Intl.NumberFormat` or `toLocaleString`. Hermes' locale
 * support has varied between releases and builds, and Indian digit grouping —
 * 1,25,000 rather than 125,000 — is exactly the part that goes missing when it
 * does. A formatter whose output depends on the engine is one whose tests pass
 * on the laptop and whose figures are wrong on the phone.
 *
 * ⚠️ The currency's symbol lives in the table below and nowhere else. Screens
 * never write "₹"; they ask for an amount, or for `currencySymbol`, with the
 * currency the record carries (or `AppConfig.money.currency` for one being
 * typed). A currency the table does not know is written as its code ahead of
 * a plain figure — "USD 1250.50" — because a symbol or a grouping guessed for a
 * currency nobody described would be a claim the app cannot back. More than
 * one currency is multi-country (section 76, Phase 2); this table is the seam
 * it widens.
 *
 * Pure, and refuses to guess: an amount that is not a whole number of minor
 * units is formatted as nothing at all (an empty string), so a screen can
 * leave the line out rather than print "₹NaN" or round somebody's money.
 */

/** How one currency is written. */
interface CurrencyFormat {
  symbol: string;
}

/**
 * The currencies the app knows how to write. Indian grouping and a symbol
 * written straight against the figure, as amounts are written in India.
 */
const CURRENCIES: Readonly<Record<string, CurrencyFormat>> = Object.freeze({
  INR: Object.freeze({ symbol: '₹' }),
});

/**
 * Minor units per major unit, as a number of digits: paise per rupee.
 *
 * ⚠️ Two for every currency formatted here, including an unknown one. A
 * currency with no minor unit, or three, would need its own entry above — which
 * is the multi-country work, not something to infer from a code.
 */
const MINOR_DIGITS = 2;

function normaliseCode(currency: string): string {
  return typeof currency === 'string' ? currency.trim().toUpperCase() : '';
}

/**
 * The symbol a field shows ahead of an amount being typed: "₹" for rupees, and
 * the currency's code for one the app does not know.
 */
export function currencySymbol(currency: string): string {
  const code = normaliseCode(currency);
  return CURRENCIES[code]?.symbol ?? code;
}

/**
 * Indian grouping: the last three digits, then pairs — 1,25,000 and
 * 10,00,000, never 125,000.
 */
function groupIndian(whole: string): string {
  if (whole.length <= 3) {
    return whole;
  }
  const head = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${head},${whole.slice(-3)}`;
}

/**
 * An amount, written for a person: `formatMoney(12500050, 'INR')` is
 * "₹1,25,000.50", and a whole number of rupees has no decimals — 125000 paise
 * is "₹1,250", not "₹1,250.00".
 *
 * A currency the app does not know keeps both decimals and no grouping, behind
 * its code: "USD 1250.00". A negative amount — which no record in the app
 * carries — keeps its sign ahead of the symbol, "-₹1,250", rather than being
 * silently made positive. Anything that is not a safe whole number of minor
 * units comes back as an empty string.
 */
export function formatMoney(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor)) {
    return '';
  }

  const sign = amountMinor < 0 ? '-' : '';
  // Padded so 5 paise is "0.05", not ".5"; split as text so nothing is divided.
  const digits = String(Math.abs(amountMinor)).padStart(MINOR_DIGITS + 1, '0');
  const whole = digits.slice(0, -MINOR_DIGITS);
  const minor = digits.slice(-MINOR_DIGITS);

  const code = normaliseCode(currency);
  const known = CURRENCIES[code];
  if (!known) {
    return `${code ? `${code} ` : ''}${sign}${whole}.${minor}`;
  }

  const fraction = /^0+$/.test(minor) ? '' : `.${minor}`;
  return `${sign}${known.symbol}${groupIndian(whole)}${fraction}`;
}
