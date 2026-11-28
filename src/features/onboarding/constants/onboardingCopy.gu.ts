/**
 * Onboarding copy — Gujarati
 *
 * Translates `ONBOARDING_COPY_EN` in `onboardingCopy.ts` (phase5-contract.md
 * section 7); a key left out reads in English. `pages` is positional — the
 * first entry here is the first page — and each page leaves out its `id`, and
 * its permission its `kind` and `icon`, which are not words.
 *
 * ⚠️ The same promise as the English: no live tracking, no chat (Phase 2).
 * The `\n` in a title is where the line breaks; keep one.
 */

import type { LocaleTable } from '@/core/i18n';
import type { ONBOARDING_COPY_EN } from '@/features/onboarding/constants/onboardingCopy';

const ALLOW = 'પરવાનગી આપો';
const NOT_NOW = 'હમણાં નહીં';

export const ONBOARDING_COPY_GU: LocaleTable<typeof ONBOARDING_COPY_EN> = {
  skip: 'છોડો',
  skipHint: 'પરિચય છોડીને સાઇન ઇન પર લઈ જાય છે',
  back: 'પાછા',
  backHint: 'પાછલા પગલા પર પાછા લઈ જાય છે',
  continueAction: 'આગળ વધો',
  continueHint: 'આગલા પગલા પર લઈ જાય છે',
  openSettings: 'સેટિંગ્સ ખોલો',
  openSettingsHint: 'સિસ્ટમ સેટિંગ્સમાં આ ઍપ ખોલે છે, જ્યાં પરવાનગી બદલી શકાય છે',

  stepLabel: (current: number, total: number) => `${total} માંથી પગલું ${current}`,

  pages: [
    {
      title: 'ભરોસાપાત્ર ઘરેલુ સેવાઓ\nહવે તમારી આંગળીના ટેરવે',
      body: 'ઘરના દરેક કામ માટે ભરોસાપાત્ર પ્રોફેશનલ બસ થોડા ટૅપમાં બુક કરો.',
      permission: {
        title: 'લોકેશનની પરવાનગી આપશો?',
        body: 'તમારી નજીકના પ્રોફેશનલ શોધવા માટે અમે તમારા લોકેશનનો ઉપયોગ કરીએ છીએ.',
        allow: ALLOW,
        allowHint: 'સિસ્ટમ પાસે તમારું લોકેશન વાપરવાની પરવાનગી માંગે છે, પછી આગળ વધે છે',
        decline: NOT_NOW,
        declineHint: 'લોકેશન વગર આગળ વધે છે. તમે પછીથી પરવાનગી આપી શકો છો',
        denied: 'કોઈ વાંધો નહીં — તમે તેના બદલે સરનામું લખી શકો છો.',
        blocked: 'Fixora માટે લોકેશન બંધ છે. તમે તેને સેટિંગ્સમાં બદલી શકો છો.',
        granted: 'આભાર. હવે અમે તમારી નજીકના પ્રોફેશનલ શોધી શકીએ છીએ.',
      },
    },
    {
      title: 'પસંદ કરો અને સરખામણી કરો',
      body: 'પ્રોફાઇલ, રેટિંગ અને રિવ્યૂ જુઓ, અને તમને અનુકૂળ પ્રોફેશનલ પસંદ કરો.',
      permission: {
        title: 'કૅમેરાની પરવાનગી આપશો?',
        body: 'સમસ્યાના ફોટા લો, જેથી પ્રોફેશનલને પહેલેથી ખબર પડે કે શું કરવાનું છે.',
        allow: ALLOW,
        allowHint: 'સિસ્ટમ પાસે કૅમેરા વાપરવાની પરવાનગી માંગે છે, પછી આગળ વધે છે',
        decline: NOT_NOW,
        declineHint: 'કૅમેરા વગર આગળ વધે છે. તમે પછીથી પરવાનગી આપી શકો છો',
        denied: 'કોઈ વાંધો નહીં — તમે સમસ્યા શબ્દોમાં જણાવી શકો છો.',
        blocked: 'Fixora માટે કૅમેરા બંધ છે. તમે તેને સેટિંગ્સમાં બદલી શકો છો.',
        granted: 'આભાર. હવે તમે રિક્વેસ્ટમાં ફોટા ઉમેરી શકો છો.',
      },
    },
    {
      title: 'શરૂઆતથી પૂરું થાય ત્યાં સુધી\nનજર રાખો',
      body: 'દરેક રિક્વેસ્ટને સ્વીકારાય ત્યાંથી પૂરી થાય ત્યાં સુધી જુઓ, પછી કહો કે કામ કેવું રહ્યું.',
      permission: {
        title: 'નોટિફિકેશન ચાલુ કરશો?',
        body: 'તમારી રિક્વેસ્ટ સ્વીકારાય, કામ શરૂ થાય અને પૂરું થાય ત્યારે અપડેટ મેળવો.',
        allow: ALLOW,
        allowHint: 'સિસ્ટમ પાસે નોટિફિકેશન મોકલવાની પરવાનગી માંગે છે, પછી આગળ વધે છે',
        decline: NOT_NOW,
        declineHint: 'નોટિફિકેશન વગર આગળ વધે છે. તમે પછીથી પરવાનગી આપી શકો છો',
        denied: 'કોઈ વાંધો નહીં — તમે ઍપમાં કામની પ્રગતિ જોઈ શકો છો.',
        blocked: 'Fixora માટે નોટિફિકેશન બંધ છે. તમે તેને સેટિંગ્સમાં બદલી શકો છો.',
        granted: 'આભાર. જેમ કંઈ થશે તેમ અમે તમને જણાવીશું.',
      },
    },
  ],
};
