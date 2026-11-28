/**
 * localized — one copy object that speaks the current language
 *
 * `localized({ en, hi, gu })` returns an object of exactly `en`'s type whose
 * every property is resolved when it is read: the current locale's word if
 * that table has it, English if it does not. So a screen that reads
 * `AUTH_COPY.customerLogin.title` during render gets Hindi in Hindi, and a key
 * nobody has translated yet shows English — never `undefined`, never a blank.
 *
 * Why read-time getters, and not a `Proxy` over the English object. Every copy
 * table is `Object.freeze`d, and a Proxy over a frozen target is bound by the
 * language's invariants to report the target's own values — it could not return
 * Hindi for a frozen English property at all. A Proxy over an empty stand-in
 * avoids that but breaks `Object.isFrozen`, and makes `Object.keys`,
 * `JSON.stringify` and Jest's equality depend on five traps being right.
 * Accessor properties on a frozen object need none of it: the object is frozen,
 * enumerable, serialisable, and the value is chosen on each read.
 *
 * What it builds, from `en`'s shape:
 * - a plain object or an array becomes a nested localized object, built once —
 *   so `const COPY = AUTH_COPY.authEntry` at module scope is safe: the section
 *   object never changes, only what its properties return;
 * - anything else (a string, a number, a function such as `copyReference(ref)`)
 *   becomes a getter that returns the current locale's value when that value
 *   exists and is of the same kind as the English one, and the English value
 *   otherwise. A translated function keeps the English signature — the types
 *   insist on it — and is called by the caller exactly as before.
 *
 * Arrays are positional: `pages[1]` in Hindi translates `pages[1]` in English.
 * An item the translation leaves out falls back item by item, key by key.
 *
 * ⚠️ Read copy when you render, never when a module loads. A string read at
 * module scope — `const LABEL = COPY.title`, `Object.freeze([{ label:
 * COPY.filterAll }])`, a zod schema built with `.min(1, COPY.required)`, a
 * template like `` `${COPY.a} ${COPY.b}` `` — is frozen in whatever language was
 * current when that module was first evaluated. With Metro's inline requires
 * that is not even reliably English: a module first loaded after the saved
 * language was restored would freeze Hindi into a table meant to be English.
 * Read inside the component or function, or pass a function
 * (`{ error: () => COPY.required }` for zod).
 *
 * ⚠️ For the same reason, an English table must never be filled from another
 * localized object (`ratingLabel: RATING_COPY.label`). Fill it from that
 * object's raw English table instead (`RATING_COPY_EN.label`), and the
 * Hindi table from its Hindi one.
 *
 * The how-to for adding or converting a table is in `./index.ts`.
 */

import { APP_LOCALES, DEFAULT_LOCALE, getLocale, type AppLocale } from '@/core/i18n/locale';

type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;

type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

/**
 * A single string literal — which `Object.freeze` infers for every English
 * sentence — widens to `string`, so a translation can say anything. A union of
 * literals (an icon name, a page id, a permission kind) is a choice from a fixed
 * set and stays one, so a translation cannot invent a new icon.
 */
type TranslatedString<T> = IsUnion<T> extends true ? T : string;

/**
 * What a translation of a value of type `T` may be. The checks are wrapped in
 * tuples so a union is judged whole rather than one member at a time.
 */
export type Translation<T> = [T] extends [(...args: never[]) => unknown]
  ? T
  : [T] extends [string]
    ? TranslatedString<T>
    : [T] extends [readonly (infer E)[]]
      ? ReadonlyArray<Translation<E>>
      : [T] extends [object]
        ? LocaleTable<T>
        : T;

/**
 * A translation of the English table `T`: any subset of its keys, nested, with
 * the same kinds of value. Annotating a translation with it is what lets `tsc`
 * refuse a key English does not have — keep the translation one object literal,
 * with no `Object.freeze` inside it, or the excess-key check is lost.
 */
export type LocaleTable<T> = { readonly [K in keyof T]?: Translation<T[K]> };

/** The locales a table may be translated into: every one but English, the source. */
export type TranslatedLocale = Exclude<AppLocale, 'en'>;

export type LocaleTables<T> = { readonly en: T } & {
  readonly [L in TranslatedLocale]?: NoInfer<LocaleTable<T>>;
};

type Branch = Readonly<Record<string, unknown>> | readonly unknown[];

/** A plain object or an array — what becomes a nested section rather than a value. */
function isBranch(value: unknown): value is Branch {
  if (Array.isArray(value)) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const hasOwn = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key);

/** Each translated locale's value at `key`, where that locale's table has one. */
type Translations = Partial<Record<TranslatedLocale, unknown>>;

function translationsAt(translations: Translations, key: string): Translations {
  const found: Translations = {};
  for (const locale of APP_LOCALES) {
    if (locale === DEFAULT_LOCALE) {
      continue;
    }
    const table = translations[locale];
    if (isBranch(table) && hasOwn(table, key)) {
      found[locale] = (table as Readonly<Record<string, unknown>>)[key];
    }
  }
  return found;
}

/** The current locale's value, or English when it has none of the same kind. */
function resolve(english: unknown, translations: Translations): unknown {
  const locale = getLocale();
  if (locale === DEFAULT_LOCALE) {
    return english;
  }
  const translated = translations[locale];
  return translated !== undefined && typeof translated === typeof english ? translated : english;
}

function build(english: Branch, translations: Translations): object {
  const target: object = Array.isArray(english) ? [] : {};

  for (const key of Object.keys(english)) {
    const value: unknown = (english as Readonly<Record<string, unknown>>)[key];
    const below = translationsAt(translations, key);

    if (isBranch(value)) {
      Object.defineProperty(target, key, { value: build(value, below), enumerable: true });
    } else {
      Object.defineProperty(target, key, { get: () => resolve(value, below), enumerable: true });
    }
  }

  return Object.freeze(target);
}

/**
 * The English table, speaking whichever language is current when it is read.
 * See the docblock above for what it does with each kind of value.
 */
export function localized<T extends object>(tables: LocaleTables<T>): T {
  const { en, ...others } = tables;
  return build(en as unknown as Branch, others as Translations) as T;
}

/**
 * The paths in `translation` that the English table does not have — a key
 * misspelt, or left behind when the English was renamed. `tsc` already refuses
 * these in a typed literal; this is the same check at run time, for a test.
 */
export function unknownTranslationKeys(english: unknown, translation: unknown, path = ''): string[] {
  if (!isBranch(translation)) {
    return [];
  }
  if (!isBranch(english)) {
    return [path || '(root)'];
  }

  return Object.keys(translation).flatMap(key => {
    const at = path ? `${path}.${key}` : key;
    if (!hasOwn(english, key)) {
      return [at];
    }
    const englishValue = (english as Readonly<Record<string, unknown>>)[key];
    const translated = (translation as Readonly<Record<string, unknown>>)[key];
    if (translated !== undefined && !isBranch(englishValue) && typeof translated !== typeof englishValue) {
      return [`${at} (a ${typeof translated} where English has a ${typeof englishValue})`];
    }
    return unknownTranslationKeys(englishValue, translated, at);
  });
}
