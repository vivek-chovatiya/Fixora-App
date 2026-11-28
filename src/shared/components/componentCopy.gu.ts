/**
 * Shared component copy — Gujarati. Translates `COMPONENT_COPY_EN` in
 * `componentCopy.ts`; a key left out reads in English. `{name}` stays as it is.
 */

import type { LocaleTable } from '@/core/i18n';
import type { COMPONENT_COPY_EN } from '@/shared/components/componentCopy';

const TRY_AGAIN = 'ફરી પ્રયાસ કરો';
const SOMETHING_WENT_WRONG = 'કંઈક ખોટું થયું';

export const COMPONENT_COPY_GU: LocaleTable<typeof COMPONENT_COPY_EN> = {
  errorBoundary: {
    message:
      'માફ કરશો — ઍપમાં કોઈ સમસ્યા આવી. ફરી પ્રયાસ કરો, અને જો આવું વારંવાર થાય, તો ઍપ બંધ કરીને ફરી ખોલો.',
    retry: TRY_AGAIN,
  },
  offlineBanner: {
    title: 'તમે ઑફલાઇન છો.',
    message: 'ફરી કનેક્ટ ન થાઓ ત્યાં સુધી કેટલીક વસ્તુઓ લોડ ન પણ થાય.',
  },
  errorTitles: {
    network: 'કનેક્શન નથી',
    timeout: 'બહુ વાર લાગી રહી છે',
    unauthorized: 'સેશન પૂરું થઈ ગયું',
    forbidden: 'પરવાનગી નથી',
    notFound: 'મળ્યું નહીં',
    validation: 'તમારી વિગતો તપાસો',
    conflict: 'પહેલેથી બદલાઈ ગયું છે',
    permission: 'પરવાનગી જોઈએ',
    server: SOMETHING_WENT_WRONG,
    cancelled: 'રદ થયું',
    unknown: SOMETHING_WENT_WRONG,
  },
  backButton: {
    label: 'પાછા',
    hint: 'પાછલી સ્ક્રીન પર પાછા લઈ જાય છે',
  },
  errorState: {
    retry: TRY_AGAIN,
  },
  passwordInput: {
    reveal: 'બતાવો',
    hide: 'છુપાવો',
  },
  loader: {
    label: 'લોડ થઈ રહ્યું છે',
  },
  toast: {
    dismissHint: 'આ સંદેશ દૂર કરે છે',
  },
  avatar: {
    named: '{name} નો પ્રોફાઇલ ફોટો',
    unnamed: 'પ્રોફાઇલ ફોટો',
  },
};
