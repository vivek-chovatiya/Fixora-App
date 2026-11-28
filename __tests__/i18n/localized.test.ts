/**
 * `localized` — one copy object that answers in the current language.
 *
 * Guards the rules every translated table relies on (`core/i18n/localized.ts`):
 * - a key a translation does not have reads in English — never `undefined`;
 * - a function value is a function in every locale, with the English one as
 *   the fallback, and is called with the caller's arguments;
 * - nested sections and positional arrays fall back key by key;
 * - a value of the wrong kind in a translation is ignored, not shown;
 * - a section held at module scope keeps answering in the current language
 *   (the sanctioned alias, `const COPY = X_COPY.section`), while the object
 *   stays frozen and serialisable.
 */

import {
  getLocale,
  localized,
  resetLocaleState,
  unknownTranslationKeys,
  updateLocaleState,
  type LocaleTable,
} from '@/core/i18n';

interface Page {
  id: 'one' | 'two';
  title: string;
}

const EN = Object.freeze({
  title: 'Sign in',
  untranslated: 'Only in English',
  nested: Object.freeze({
    hint: 'Opens it',
    copyReference: (reference: string) => `Copy reference ${reference}`,
    stepLabel: (current: number, total: number) => `Step ${current} of ${total}`,
  }),
  pages: Object.freeze([
    Object.freeze({ id: 'one', title: 'First' }),
    Object.freeze({ id: 'two', title: 'Second' }),
  ] as readonly Page[]),
});

const HI: LocaleTable<typeof EN> = {
  title: 'साइन इन',
  nested: {
    copyReference: reference => `रेफ़रेंस ${reference} कॉपी करें`,
  },
  pages: [{ title: 'पहला' }],
};

const GU: LocaleTable<typeof EN> = {
  title: 'સાઇન ઇન',
  nested: {
    hint: 'તે ખોલે છે',
    copyReference: reference => `રેફરન્સ ${reference} કૉપિ કરો`,
    stepLabel: (current, total) => `${total} માંથી પગલું ${current}`,
  },
};

const COPY = localized({ en: EN, hi: HI, gu: GU });

/** Held at module scope, as every screen holds its section. */
const NESTED = COPY.nested;

afterEach(() => {
  resetLocaleState();
});

describe('localized', () => {
  it('reads English by default', () => {
    expect(getLocale()).toBe('en');
    expect(COPY.title).toBe('Sign in');
    expect(COPY.nested.copyReference('REQ-1')).toBe('Copy reference REQ-1');
  });

  it('answers in the current locale, read at the moment of reading', () => {
    updateLocaleState({ locale: 'hi' });
    expect(COPY.title).toBe('साइन इन');

    updateLocaleState({ locale: 'gu' });
    expect(COPY.title).toBe('સાઇન ઇન');

    updateLocaleState({ locale: 'en' });
    expect(COPY.title).toBe('Sign in');
  });

  it('falls back to English for a key the translation does not have — never undefined', () => {
    for (const locale of ['hi', 'gu'] as const) {
      updateLocaleState({ locale });
      expect(COPY.untranslated).toBe('Only in English');
    }

    updateLocaleState({ locale: 'hi' });
    // Hindi translates nothing of `hint` or `stepLabel`.
    expect(COPY.nested.hint).toBe('Opens it');
    expect(COPY.nested.stepLabel(2, 3)).toBe('Step 2 of 3');
  });

  it('calls a function value in every locale, with the caller’s arguments', () => {
    const said = (['en', 'hi', 'gu'] as const).map(locale => {
      updateLocaleState({ locale });
      return [COPY.nested.copyReference('REQ-42'), COPY.nested.stepLabel(1, 3)];
    });

    expect(said).toEqual([
      ['Copy reference REQ-42', 'Step 1 of 3'],
      ['रेफ़रेंस REQ-42 कॉपी करें', 'Step 1 of 3'],
      ['રેફરન્સ REQ-42 કૉપિ કરો', '3 માંથી પગલું 1'],
    ]);
  });

  it('translates an array position by position, falling back item by item and key by key', () => {
    updateLocaleState({ locale: 'hi' });

    expect(COPY.pages.map(page => page.title)).toEqual(['पहला', 'Second']);
    // An id is not translated, so it is always the English one.
    expect(COPY.pages.map(page => page.id)).toEqual(['one', 'two']);
    expect(COPY.pages).toHaveLength(2);
  });

  it('ignores a translated value of the wrong kind rather than showing it', () => {
    const odd = localized({
      en: Object.freeze({ greet: (name: string) => `Hello ${name}`, label: 'Label' }),
      // A table that slipped past the types: a string where a function belongs.
      hi: { greet: 'नमस्ते', label: 42 } as unknown as LocaleTable<{
        greet: (name: string) => string;
        label: string;
      }>,
    });
    updateLocaleState({ locale: 'hi' });

    expect(odd.greet('Asha')).toBe('Hello Asha');
    expect(odd.label).toBe('Label');
  });

  it('keeps a section held at module scope answering in the current language', () => {
    updateLocaleState({ locale: 'gu' });

    expect(NESTED.hint).toBe('તે ખોલે છે');
    expect(NESTED).toBe(COPY.nested);
  });

  it('stays frozen, enumerable and serialisable in the current language', () => {
    updateLocaleState({ locale: 'hi' });

    expect(Object.isFrozen(COPY)).toBe(true);
    expect(Object.isFrozen(COPY.nested)).toBe(true);
    expect(Object.keys(COPY)).toEqual(['title', 'untranslated', 'nested', 'pages']);
    expect(JSON.parse(JSON.stringify(COPY)).title).toBe('साइन इन');
    // Refused: silently outside strict mode, with a TypeError inside it.
    try {
      (COPY as { title: string }).title = 'changed';
    } catch {
      // Strict mode's refusal; the value below is what matters.
    }
    expect(COPY.title).toBe('साइन इन');
  });

  it('refuses a locale the app does not speak', () => {
    updateLocaleState({ locale: 'fr' as never });

    expect(getLocale()).toBe('en');
  });
});

describe('unknownTranslationKeys', () => {
  it('names a key English does not have, at any depth', () => {
    expect(
      unknownTranslationKeys(EN, { titel: 'x', nested: { hnt: 'y' }, pages: [{ title: 'a' }, {}, {}] }),
    ).toEqual(['titel', 'nested.hnt', 'pages.2']);
  });

  it('names a value of the wrong kind', () => {
    expect(unknownTranslationKeys(EN, { nested: { copyReference: 'not a function' } })).toEqual([
      'nested.copyReference (a string where English has a function)',
    ]);
  });

  it('finds nothing wrong with a correct table', () => {
    expect(unknownTranslationKeys(EN, HI)).toEqual([]);
    expect(unknownTranslationKeys(EN, GU)).toEqual([]);
  });
});
