/**
 * Every Hindi and Gujarati table, checked against its English source.
 *
 * `tsc` already refuses a key English does not have in a typed literal; this is
 * the same rule at run time, plus three a type cannot state:
 * - every `{placeholder}` in an English sentence is still in its translation
 *   (a lost `{wait}` would show a sentence with the number missing);
 * - a translated function takes as many arguments as the English one;
 * - "Fixora" is never translated.
 *
 * ⚠️ A table converted later is added to `TABLES` below — that is step 5 of
 * the how-to in `core/i18n/index.ts`. None of these checks asks for every key:
 * a key a translation leaves out reads in English by design, so a table still
 * being written passes as long as what it has is right.
 */

import { unknownTranslationKeys } from '@/core/i18n';
import { AUTH_COPY_EN } from '@/features/auth/constants/authCopy';
import { AUTH_COPY_GU } from '@/features/auth/constants/authCopy.gu';
import { AUTH_COPY_HI } from '@/features/auth/constants/authCopy.hi';
import { AUTH_VALIDATION_COPY_EN } from '@/features/auth/validation/authSchemas';
import { AUTH_VALIDATION_COPY_GU } from '@/features/auth/validation/authSchemas.gu';
import { AUTH_VALIDATION_COPY_HI } from '@/features/auth/validation/authSchemas.hi';
import { CUSTOMER_COPY_EN } from '@/features/customer/constants/customerCopy';
import { CUSTOMER_COPY_GU } from '@/features/customer/constants/customerCopy.gu';
import { CUSTOMER_COPY_HI } from '@/features/customer/constants/customerCopy.hi';
import { LANGUAGE_COPY_EN } from '@/features/language/constants/languageCopy';
import { LANGUAGE_COPY_GU } from '@/features/language/constants/languageCopy.gu';
import { LANGUAGE_COPY_HI } from '@/features/language/constants/languageCopy.hi';
import { ONBOARDING_COPY_EN } from '@/features/onboarding/constants/onboardingCopy';
import { ONBOARDING_COPY_GU } from '@/features/onboarding/constants/onboardingCopy.gu';
import { NOTIFICATIONS_COPY_EN } from '@/features/notifications/constants/notificationsCopy';
import { NOTIFICATIONS_COPY_GU } from '@/features/notifications/constants/notificationsCopy.gu';
import { NOTIFICATIONS_COPY_HI } from '@/features/notifications/constants/notificationsCopy.hi';
import { ONBOARDING_COPY_HI } from '@/features/onboarding/constants/onboardingCopy.hi';
import { VENDOR_COPY_EN } from '@/features/vendor/constants/vendorCopy';
import { VENDOR_COPY_GU } from '@/features/vendor/constants/vendorCopy.gu';
import { VENDOR_COPY_HI } from '@/features/vendor/constants/vendorCopy.hi';
import { NAVIGATION_COPY_EN } from '@/navigation/navigationCopy';
import { NAVIGATION_COPY_GU } from '@/navigation/navigationCopy.gu';
import { NAVIGATION_COPY_HI } from '@/navigation/navigationCopy.hi';
import { COMPONENT_COPY_EN } from '@/shared/components/componentCopy';
import { COMPONENT_COPY_GU } from '@/shared/components/componentCopy.gu';
import { COMPONENT_COPY_HI } from '@/shared/components/componentCopy.hi';
import { PAYMENT_COPY_EN } from '@/shared/presentation/payment';
import { PAYMENT_COPY_GU } from '@/shared/presentation/payment.gu';
import { PAYMENT_COPY_HI } from '@/shared/presentation/payment.hi';
import { RATING_COPY_EN } from '@/shared/presentation/rating';
import { RATING_COPY_GU } from '@/shared/presentation/rating.gu';
import { RATING_COPY_HI } from '@/shared/presentation/rating.hi';
import { PRIORITY_COPY_EN, RELATIVE_TIME_COPY_EN } from '@/shared/presentation/requestTokens';
import {
  PRIORITY_COPY_GU,
  RELATIVE_TIME_COPY_GU,
} from '@/shared/presentation/requestTokens.gu';
import {
  PRIORITY_COPY_HI,
  RELATIVE_TIME_COPY_HI,
} from '@/shared/presentation/requestTokens.hi';
import { ERROR_COPY_EN } from '@/shared/types/error';
import { ERROR_COPY_GU } from '@/shared/types/error.gu';
import { ERROR_COPY_HI } from '@/shared/types/error.hi';
import { VALIDATION_COPY_EN } from '@/shared/validation/validationCopy';
import { VALIDATION_COPY_GU } from '@/shared/validation/validationCopy.gu';
import { VALIDATION_COPY_HI } from '@/shared/validation/validationCopy.hi';

type Table = { en: unknown; hi: unknown; gu: unknown };

const TABLES: Record<string, Table> = {
  authCopy: { en: AUTH_COPY_EN, hi: AUTH_COPY_HI, gu: AUTH_COPY_GU },
  authSchemas: { en: AUTH_VALIDATION_COPY_EN, hi: AUTH_VALIDATION_COPY_HI, gu: AUTH_VALIDATION_COPY_GU },
  customerCopy: { en: CUSTOMER_COPY_EN, hi: CUSTOMER_COPY_HI, gu: CUSTOMER_COPY_GU },
  languageCopy: { en: LANGUAGE_COPY_EN, hi: LANGUAGE_COPY_HI, gu: LANGUAGE_COPY_GU },
  onboardingCopy: { en: ONBOARDING_COPY_EN, hi: ONBOARDING_COPY_HI, gu: ONBOARDING_COPY_GU },
  vendorCopy: { en: VENDOR_COPY_EN, hi: VENDOR_COPY_HI, gu: VENDOR_COPY_GU },
  notificationsCopy: {
    en: NOTIFICATIONS_COPY_EN,
    hi: NOTIFICATIONS_COPY_HI,
    gu: NOTIFICATIONS_COPY_GU,
  },
  navigationCopy: { en: NAVIGATION_COPY_EN, hi: NAVIGATION_COPY_HI, gu: NAVIGATION_COPY_GU },
  componentCopy: { en: COMPONENT_COPY_EN, hi: COMPONENT_COPY_HI, gu: COMPONENT_COPY_GU },
  payment: { en: PAYMENT_COPY_EN, hi: PAYMENT_COPY_HI, gu: PAYMENT_COPY_GU },
  rating: { en: RATING_COPY_EN, hi: RATING_COPY_HI, gu: RATING_COPY_GU },
  relativeTime: { en: RELATIVE_TIME_COPY_EN, hi: RELATIVE_TIME_COPY_HI, gu: RELATIVE_TIME_COPY_GU },
  priority: { en: PRIORITY_COPY_EN, hi: PRIORITY_COPY_HI, gu: PRIORITY_COPY_GU },
  error: { en: ERROR_COPY_EN, hi: ERROR_COPY_HI, gu: ERROR_COPY_GU },
  validationCopy: { en: VALIDATION_COPY_EN, hi: VALIDATION_COPY_HI, gu: VALIDATION_COPY_GU },
};

type Visit = (path: string, english: unknown, translated: unknown) => void;

/** Calls `visit` for every leaf a translation provides, beside its English. */
function eachTranslatedLeaf(english: unknown, translated: unknown, visit: Visit, path = ''): void {
  if (translated === undefined || english === undefined) {
    return;
  }
  if (typeof translated === 'object' && translated !== null && typeof english === 'object' && english !== null) {
    for (const key of Object.keys(translated)) {
      eachTranslatedLeaf(
        (english as Record<string, unknown>)[key],
        (translated as Record<string, unknown>)[key],
        visit,
        path ? `${path}.${key}` : key,
      );
    }
    return;
  }
  visit(path, english, translated);
}

/** Every `{name}` in a sentence, sorted. */
function placeholders(text: string): string[] {
  return (text.match(/\{\w+\}/g) ?? []).sort();
}

/** A function value's output for sample arguments, so its placeholders can be read too. */
function sample(fn: (...args: never[]) => unknown): string {
  return String((fn as (...args: unknown[]) => unknown)('ARG1', 'ARG2', 'ARG3'));
}

const LOCALES = ['hi', 'gu'] as const;

describe.each(Object.entries(TABLES))('%s', (_name, table) => {
  it.each(LOCALES)('%s has no key that English lacks', locale => {
    expect(unknownTranslationKeys(table.en, table[locale])).toEqual([]);
  });

  it.each(LOCALES)('%s keeps every placeholder English has', locale => {
    const lost: string[] = [];
    eachTranslatedLeaf(table.en, table[locale], (path, english, translated) => {
      if (typeof english === 'string' && typeof translated === 'string') {
        if (placeholders(english).join() !== placeholders(translated).join()) {
          lost.push(`${path}: ${placeholders(english).join()} → ${placeholders(translated).join()}`);
        }
      }
    });
    expect(lost).toEqual([]);
  });

  it.each(LOCALES)('%s keeps each function’s arguments, and says them', locale => {
    const wrong: string[] = [];
    eachTranslatedLeaf(table.en, table[locale], (path, english, translated) => {
      if (typeof english === 'function' && typeof translated === 'function') {
        const fn = translated as (...args: never[]) => unknown;
        const englishSays = sample(english as (...args: never[]) => unknown);
        const used = ['ARG1', 'ARG2', 'ARG3'].filter(arg => englishSays.includes(arg));
        const missing = used.filter(arg => !sample(fn).includes(arg));
        if (fn.length !== (english as () => unknown).length || missing.length > 0) {
          wrong.push(path);
        }
      }
    });
    expect(wrong).toEqual([]);
  });

  it.each(LOCALES)('%s never translates "Fixora"', locale => {
    const renamed: string[] = [];
    eachTranslatedLeaf(table.en, table[locale], (path, english, translated) => {
      if (typeof english === 'string' && english.includes('Fixora') && typeof translated === 'string') {
        if (!translated.includes('Fixora')) {
          renamed.push(path);
        }
      }
    });
    expect(renamed).toEqual([]);
  });
});
