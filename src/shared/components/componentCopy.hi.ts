/**
 * Shared component copy — Hindi. Translates `COMPONENT_COPY_EN` in
 * `componentCopy.ts`; a key left out reads in English. `{name}` stays as it is.
 */

import type { LocaleTable } from '@/core/i18n';
import type { COMPONENT_COPY_EN } from '@/shared/components/componentCopy';

const TRY_AGAIN = 'फिर से कोशिश करें';
const SOMETHING_WENT_WRONG = 'कुछ गड़बड़ हो गई';

export const COMPONENT_COPY_HI: LocaleTable<typeof COMPONENT_COPY_EN> = {
  errorBoundary: {
    message:
      'माफ़ कीजिए — ऐप में कोई दिक्कत आ गई। फिर से कोशिश करें, और अगर ऐसा बार-बार हो, तो ऐप बंद करके फिर से खोलें।',
    retry: TRY_AGAIN,
  },
  offlineBanner: {
    title: 'आप ऑफ़लाइन हैं।',
    message: 'दोबारा कनेक्ट होने तक कुछ चीज़ें लोड नहीं हो सकतीं।',
  },
  errorTitles: {
    network: 'कनेक्शन नहीं है',
    timeout: 'बहुत देर लग रही है',
    unauthorized: 'सेशन खत्म हो गया',
    forbidden: 'अनुमति नहीं है',
    notFound: 'नहीं मिला',
    validation: 'अपने विवरण जाँचें',
    conflict: 'पहले ही बदल चुका है',
    permission: 'अनुमति चाहिए',
    server: SOMETHING_WENT_WRONG,
    cancelled: 'रद्द हो गया',
    unknown: SOMETHING_WENT_WRONG,
  },
  backButton: {
    label: 'वापस',
    hint: 'पिछली स्क्रीन पर वापस ले जाता है',
  },
  errorState: {
    retry: TRY_AGAIN,
  },
  passwordInput: {
    reveal: 'दिखाएँ',
    hide: 'छिपाएँ',
  },
  loader: {
    label: 'लोड हो रहा है',
  },
  toast: {
    dismissHint: 'यह संदेश हटा देता है',
  },
  avatar: {
    named: '{name} की प्रोफ़ाइल फ़ोटो',
    unnamed: 'प्रोफ़ाइल फ़ोटो',
  },
};
