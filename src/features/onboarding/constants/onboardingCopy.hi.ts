/**
 * Onboarding copy — Hindi
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

const ALLOW = 'अनुमति दें';
const NOT_NOW = 'अभी नहीं';

export const ONBOARDING_COPY_HI: LocaleTable<typeof ONBOARDING_COPY_EN> = {
  skip: 'छोड़ें',
  skipHint: 'परिचय छोड़कर साइन इन पर ले जाता है',
  back: 'वापस',
  backHint: 'पिछले चरण पर वापस ले जाता है',
  continueAction: 'आगे बढ़ें',
  continueHint: 'अगले चरण पर ले जाता है',
  openSettings: 'सेटिंग्स खोलें',
  openSettingsHint: 'सिस्टम सेटिंग्स में यह ऐप खोलता है, जहाँ अनुमति बदली जा सकती है',

  stepLabel: (current: number, total: number) => `${total} में से चरण ${current}`,

  pages: [
    {
      title: 'भरोसेमंद घरेलू सेवाएँ\nअब आपकी उँगलियों पर',
      body: 'घर के हर काम के लिए भरोसेमंद प्रोफ़ेशनल बस कुछ टैप में बुक करें।',
      permission: {
        title: 'लोकेशन की अनुमति दें?',
        body: 'आपके पास के प्रोफ़ेशनल ढूँढने के लिए हम आपकी लोकेशन का इस्तेमाल करते हैं।',
        allow: ALLOW,
        allowHint: 'सिस्टम से आपकी लोकेशन इस्तेमाल करने की अनुमति माँगता है, फिर आगे बढ़ता है',
        decline: NOT_NOW,
        declineHint: 'लोकेशन के बिना आगे बढ़ता है। आप बाद में अनुमति दे सकते हैं',
        denied: 'कोई बात नहीं — आप इसकी जगह पता लिख सकते हैं।',
        blocked: 'Fixora के लिए लोकेशन बंद है। आप इसे सेटिंग्स में बदल सकते हैं।',
        granted: 'धन्यवाद। अब हम आपके पास के प्रोफ़ेशनल ढूँढ सकते हैं।',
      },
    },
    {
      title: 'चुनें और तुलना करें',
      body: 'प्रोफ़ाइल, रेटिंग और रिव्यू देखें, और अपने हिसाब से प्रोफ़ेशनल चुनें।',
      permission: {
        title: 'कैमरे की अनुमति दें?',
        body: 'समस्या की फ़ोटो लें, ताकि प्रोफ़ेशनल को पहले से पता रहे कि क्या करना है।',
        allow: ALLOW,
        allowHint: 'सिस्टम से कैमरा इस्तेमाल करने की अनुमति माँगता है, फिर आगे बढ़ता है',
        decline: NOT_NOW,
        declineHint: 'कैमरे के बिना आगे बढ़ता है। आप बाद में अनुमति दे सकते हैं',
        denied: 'कोई बात नहीं — आप समस्या को शब्दों में बता सकते हैं।',
        blocked: 'Fixora के लिए कैमरा बंद है। आप इसे सेटिंग्स में बदल सकते हैं।',
        granted: 'धन्यवाद। अब आप रिक्वेस्ट में फ़ोटो जोड़ सकते हैं।',
      },
    },
    {
      title: 'शुरू से पूरा होने तक\nनज़र रखें',
      body: 'हर रिक्वेस्ट को स्वीकार होने से पूरा होने तक देखें, फिर बताएँ कि काम कैसा रहा।',
      permission: {
        title: 'नोटिफ़िकेशन चालू करें?',
        body: 'आपकी रिक्वेस्ट स्वीकार होने, काम शुरू होने और पूरा होने पर अपडेट पाएँ।',
        allow: ALLOW,
        allowHint: 'सिस्टम से नोटिफ़िकेशन भेजने की अनुमति माँगता है, फिर आगे बढ़ता है',
        decline: NOT_NOW,
        declineHint: 'नोटिफ़िकेशन के बिना आगे बढ़ता है। आप बाद में अनुमति दे सकते हैं',
        denied: 'कोई बात नहीं — आप ऐप में काम की प्रगति देख सकते हैं।',
        blocked: 'Fixora के लिए नोटिफ़िकेशन बंद हैं। आप इसे सेटिंग्स में बदल सकते हैं।',
        granted: 'धन्यवाद। जैसे ही कुछ होगा, हम आपको बताएँगे।',
      },
    },
  ],
};
