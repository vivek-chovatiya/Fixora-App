/**
 * How an amount of money is written (PROJECT_BIBLE.md sections 36 and 37: the
 * offline payment record), and how a recorded payment is said. Pinned here:
 *
 * - amounts are whole minor units: 1 paisa is "₹0.01", 100 is "₹1"
 * - whole rupees have no decimals ("₹1,250"); paise always two ("₹1,250.50")
 * - Indian grouping: 1,000 · 1,00,000 · 10,00,000 · 1,25,000.50, and on up
 *   to the largest safe integer, exactly
 * - a currency the app does not know is its code ahead of a plain figure with
 *   both decimals; a blank one is the figure alone; case and padding forgiven
 * - a negative amount keeps its sign (no record carries one; documented, not
 *   hidden); anything that is not a whole number of minor units writes nothing
 * - the symbol for a field is the table's, or the code
 * - a payment reads "Paid · UPI" or "Not paid yet"; a method is said only beside
 *   "Paid"; a status nobody worded reads "Payment status unavailable"
 */

import { currencySymbol, formatMoney } from '@/shared/presentation/money';
import {
  describePayment,
  isPaidStatus,
  PAYMENT_COPY,
  presentPaymentStatus,
} from '@/shared/presentation/payment';

describe('formatMoney — rupees', () => {
  it.each([
    [1, '₹0.01'],
    [5, '₹0.05'],
    [50, '₹0.50'],
    [100, '₹1'],
    [99_900, '₹999'],
    [100_000, '₹1,000'],
    [125_000, '₹1,250'],
    [125_050, '₹1,250.50'],
    [125_005, '₹1,250.05'],
    [10_000_000, '₹1,00,000'],
    [12_500_050, '₹1,25,000.50'],
    [100_000_000, '₹10,00,000'],
    [1_234_567_890, '₹1,23,45,678.90'],
    [0, '₹0'],
  ])('writes %i paise as %s', (amountMinor, written) => {
    expect(formatMoney(amountMinor, 'INR')).toBe(written);
  });

  it('writes the largest safe amount exactly, with no rounding', () => {
    // 9007199254740991 paise.
    expect(formatMoney(Number.MAX_SAFE_INTEGER, 'INR')).toBe('₹9,00,71,99,25,47,409.91');
  });

  it('forgives case and padding in the code', () => {
    expect(formatMoney(125_050, ' inr ')).toBe('₹1,250.50');
  });

  it('keeps a negative amount’s sign ahead of the symbol, rather than hiding it', () => {
    // No record carries one; if one ever arrives it must not read as money owed the other way.
    expect(formatMoney(-125_000, 'INR')).toBe('-₹1,250');
    expect(formatMoney(-1, 'INR')).toBe('-₹0.01');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 12.5, Number.MAX_SAFE_INTEGER + 2])(
    'writes nothing for %p, which is not a whole number of minor units',
    amountMinor => {
      expect(formatMoney(amountMinor, 'INR')).toBe('');
    },
  );
});

describe('formatMoney — a currency the app does not know', () => {
  it('writes the code ahead of a plain figure with both decimals, and guesses no symbol or grouping', () => {
    expect(formatMoney(125_050, 'USD')).toBe('USD 1250.50');
    expect(formatMoney(125_000, 'usd')).toBe('USD 1250.00');
    expect(formatMoney(100_000_000, 'EUR')).toBe('EUR 1000000.00');
  });

  it('writes the figure alone when there is no code at all', () => {
    expect(formatMoney(125_050, '')).toBe('1250.50');
  });
});

describe('currencySymbol', () => {
  it('is the table’s symbol for rupees, and the code for anything else', () => {
    expect(currencySymbol('INR')).toBe('₹');
    expect(currencySymbol(' inr')).toBe('₹');
    expect(currencySymbol('USD')).toBe('USD');
  });
});

describe('Payment words', () => {
  it('says paid and not paid in the shared words', () => {
    expect(presentPaymentStatus('PAID')).toBe(PAYMENT_COPY.paid);
    expect(presentPaymentStatus('UNPAID')).toBe(PAYMENT_COPY.unpaid);
    expect(PAYMENT_COPY.paid).toBe('Paid');
    expect(PAYMENT_COPY.unpaid).toBe('Not paid yet');
  });

  it('forgives case and padding, as the request statuses do', () => {
    expect(presentPaymentStatus(' paid ')).toBe(PAYMENT_COPY.paid);
    expect(isPaidStatus(' Paid')).toBe(true);
    expect(isPaidStatus('UNPAID')).toBe(false);
  });

  it('says a status nobody worded cannot be shown, and never shows the backend’s constant', () => {
    expect(presentPaymentStatus('PARTLY_PAID')).toBe(PAYMENT_COPY.unavailable);
    expect(presentPaymentStatus('')).toBe(PAYMENT_COPY.unavailable);
    expect(describePayment('PARTLY_PAID', 'UPI')).toBe(PAYMENT_COPY.unavailable);
    expect(describePayment('PARTLY_PAID', 'UPI')).not.toContain('PARTLY');
  });

  it('says how it was paid beside "Paid", and only there', () => {
    expect(describePayment('PAID', 'UPI')).toBe('Paid · UPI');
    expect(describePayment('PAID', ' Bank transfer ')).toBe('Paid · Bank transfer');
    expect(describePayment('PAID')).toBe('Paid');
    expect(describePayment('PAID', '   ')).toBe('Paid');
    // A method against an unpaid job is a contradiction; the status is the part to trust.
    expect(describePayment('UNPAID', 'Cash')).toBe('Not paid yet');
  });

  it('never says a payment was processed', () => {
    const everything = JSON.stringify(PAYMENT_COPY).toLowerCase();
    expect(everything).not.toContain('processed');
    expect(everything).not.toContain('fixora');
  });
});
