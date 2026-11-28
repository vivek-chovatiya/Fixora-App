/**
 * Authentication copy — Hindi
 *
 * Translates `AUTH_COPY_EN` in `authCopy.ts` (phase5-contract.md section 7); a
 * key left out reads in English. `brand.wordmark` is deliberately absent: the
 * product name is never translated.
 *
 * `{destination}`, `{seconds}` and `{digits}` stay exactly as written. The
 * welcome heading is split around the product name, so Hindi puts it first:
 * `title` is empty and `titleAfter` follows "Fixora".
 */

import type { LocaleTable } from '@/core/i18n';
import type { AUTH_COPY_EN } from '@/features/auth/constants/authCopy';

const SENT_TO = 'हमने {destination} पर कोड भेजा है';
const SENT_TO_WHATSAPP = 'हमने WhatsApp पर {destination} को कोड भेजा है';
const CODE_LABEL = 'वेरिफ़िकेशन कोड';
const CODE_HINT = 'सारे अंक डालते ही आपको अपने-आप साइन इन कर देता है';
const RESEND = 'कोड दोबारा भेजें';
const RESEND_IN = '{seconds} बाद कोड दोबारा भेजें';
const SEND_CODE_SUBTITLE = 'अपना फ़ोन नंबर डालें, हम आपको एक वेरिफ़िकेशन कोड भेजेंगे।';
const SEND_CODE_HINT = 'आपके डाले गए नंबर पर वेरिफ़िकेशन कोड भेजता है';
const REGISTER_BUSINESS = 'अपना बिज़नेस रजिस्टर करें';

export const AUTH_COPY_HI: LocaleTable<typeof AUTH_COPY_EN> = {
  brand: {
    tagline: 'आस-पास की सेवाएँ, बस कुछ टैप में।',
  },

  common: {
    back: 'वापस',
    backHint: 'पिछली स्क्रीन पर वापस ले जाता है',
    safetyNote: 'आपकी जानकारी हमारे पास सुरक्षित है।',
    secondsShort: '{seconds} सेकंड',
  },

  authEntry: {
    title: '',
    titleAfter: 'में आपका स्वागत है',
    tagline: 'जुड़ें। बुक करें। काम करवाएँ।',
    subtitle: 'चुनें कि आप कैसे आगे बढ़ना चाहते हैं।',

    customerTitle: 'ग्राहक',
    customerDescription: 'भरोसेमंद आस-पास की सेवाएँ ढूँढें और आसानी से मदद माँगें।',
    customerBadge: 'काम करवाएँ',
    customerHint: 'ग्राहक के रूप में आगे बढ़ें',

    vendorTitle: 'वेंडर',
    vendorDescription: 'अपना सर्विस बिज़नेस संभालें और Fixora के साथ आगे बढ़ें।',
    vendorBadge: 'अपना बिज़नेस बढ़ाएँ',
    vendorHint: 'वेंडर के रूप में आगे बढ़ें',

    trustTitle: 'सुरक्षित। भरोसेमंद। आस-पास।',

    registerNote: 'नए वेंडर यहाँ से रजिस्टर कर सकते हैं:',
    registerLink: 'वेंडर साइन इन',
    registerLinkHint: 'वेंडर साइन इन खोलता है, जहाँ आप बिज़नेस रजिस्टर कर सकते हैं',
  },

  customerLogin: {
    title: 'साइन इन करें',
    subtitle: SEND_CODE_SUBTITLE,
    phoneLabel: 'फ़ोन नंबर',
    phonePlaceholder: 'आपका फ़ोन नंबर',
    submit: 'कोड भेजें',
    submitHint: SEND_CODE_HINT,
  },

  customerOtp: {
    title: 'अपना नंबर वेरिफ़ाई करें',
    sentTo: SENT_TO,
    sentToWhatsApp: SENT_TO_WHATSAPP,
    codeLabel: CODE_LABEL,
    codeHint: CODE_HINT,
    resend: RESEND,
    resendIn: RESEND_IN,
    changeAction: 'फ़ोन नंबर बदलें',
  },

  vendorLogin: {
    title: 'वेंडर साइन इन',
    subtitle: SEND_CODE_SUBTITLE,
    phoneLabel: 'फ़ोन नंबर',
    phonePlaceholder: 'आपका रजिस्टर्ड फ़ोन नंबर',
    submit: 'कोड भेजें',
    submitHint: SEND_CODE_HINT,
    registerPrompt: 'Fixora पर नए हैं?',
    registerAction: REGISTER_BUSINESS,

    welcomeTitle: 'फिर से स्वागत है',
    welcomeSubtitle: 'साइन इन करने के लिए हम इस नंबर पर वेरिफ़िकेशन कोड भेजेंगे।',
    rememberedPhoneSpoken: 'फ़ोन नंबर, जिसके आख़िरी अंक {digits} हैं',
    useDifferentNumber: 'दूसरा नंबर इस्तेमाल करें',
    useDifferentNumberHint: 'इस डिवाइस से यह नंबर हटा देता है, ताकि आप दूसरा नंबर डाल सकें',
  },

  vendorSignInOtp: {
    title: 'अपना नंबर वेरिफ़ाई करें',
    sentTo: SENT_TO,
    sentToWhatsApp: SENT_TO_WHATSAPP,
    codeLabel: CODE_LABEL,
    codeHint: CODE_HINT,
    resend: RESEND,
    resendIn: RESEND_IN,
    changeAction: 'फ़ोन नंबर बदलें',
    registerPrompt: 'नए वेंडर हैं?',
    registerAction: REGISTER_BUSINESS,
  },

  vendorRegistration: {
    title: REGISTER_BUSINESS,
    subtitle: 'अपने बिज़नेस के बारे में बताएँ। आपका नंबर वेरिफ़ाई करने के लिए हम एक कोड भेजेंगे।',

    businessSection: 'बिज़नेस',
    businessNameLabel: 'बिज़नेस का नाम',
    businessNamePlaceholder: 'आपके बिज़नेस का नाम',

    contactSection: 'संपर्क',
    firstNameLabel: 'पहला नाम',
    firstNamePlaceholder: 'मालिक का पहला नाम',
    lastNameLabel: 'सरनेम',
    lastNamePlaceholder: 'मालिक का सरनेम',
    phoneLabel: 'फ़ोन नंबर',
    phonePlaceholder: 'बिज़नेस का फ़ोन नंबर',
    phoneHelper: 'हम इसी नंबर पर आपका वेरिफ़िकेशन कोड भेजेंगे।',
    emailLabel: 'ईमेल',
    emailPlaceholder: 'बिज़नेस ईमेल',
    emailHelper: 'वैकल्पिक।',

    servicesSection: 'सेवाएँ',
    categoriesLabel: 'आप कौन-सी सेवाएँ देते हैं',

    submit: 'आगे बढ़ें',
    submitHint: 'आपका बिज़नेस रजिस्टर करता है और वेरिफ़िकेशन कोड भेजता है',
  },

  vendorOtp: {
    title: 'अपने बिज़नेस का नंबर वेरिफ़ाई करें',
    sentTo: SENT_TO,
    sentToWhatsApp: SENT_TO_WHATSAPP,
    codeLabel: CODE_LABEL,
    codeHint: CODE_HINT,
    resend: RESEND,
    resendIn: RESEND_IN,
    changeAction: 'रजिस्ट्रेशन की जानकारी बदलें',
  },
};
