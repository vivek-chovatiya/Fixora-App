/**
 * AppError copy — Hindi
 *
 * The Hindi of every sentence in `error.ts` (phase5-contract.md section 7).
 * Typed against the English table, so a code that English does not have fails
 * `tsc`; a code left out here reads in English.
 *
 * Everyday wording, the way a customer or a shop owner would say it — common
 * English loanwords (कोड, अकाउंट, फ़ोटो, रिक्वेस्ट, प्रोफ़ेशनल) where they are
 * what people actually use. `{wait}`, `{minutes}` and `{hours}` stay exactly as
 * they are; only the words around them move.
 *
 * ⚠️ Keep `FILE_TYPE_NOT_ALLOWED` identical to the device check's sentence in
 * `shared/validation/validationCopy.hi.ts`, as the English pair is: both
 * refusals must read the same. Same for `REQUEST_NOT_CANCELLABLE` and the
 * customer copy's `cancelRequest.refused`.
 */

import type { LocaleTable } from '@/core/i18n';
import type { ERROR_COPY_EN } from '@/shared/types/error';

const USER_MESSAGE = {
  network: 'इंटरनेट कनेक्शन नहीं है। अपना नेटवर्क जाँचें और फिर से कोशिश करें।',
  timeout: 'इसमें उम्मीद से ज़्यादा समय लग रहा है। कृपया फिर से कोशिश करें।',
  unauthorized: 'आपका सेशन खत्म हो गया है। कृपया फिर से साइन इन करें।',
  forbidden: 'आपको इसकी अनुमति नहीं है।',
  notFound: 'आप जो ढूँढ रहे थे, वह हमें नहीं मिला।',
  validation: 'कृपया आपके भरे हुए विवरण जाँचें।',
  conflict: 'यह काम हाल के किसी बदलाव से मेल नहीं खाता। कृपया रीफ़्रेश करें।',
  permission: 'आगे बढ़ने के लिए अनुमति ज़रूरी है।',
  server: 'हमारी तरफ़ से कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।',
  cancelled: 'यह काम रद्द कर दिया गया।',
  unknown: 'कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।',
} as const;

export const ERROR_COPY_HI: LocaleTable<typeof ERROR_COPY_EN> = {
  userMessage: USER_MESSAGE,
  backendCode: {
    VALIDATION_FAILED: USER_MESSAGE.validation,
    UNAUTHORIZED: USER_MESSAGE.unauthorized,
    OTP_INVALID: 'यह कोड सही नहीं है। कृपया जाँचें और फिर से कोशिश करें।',
    OTP_EXPIRED: 'इस कोड का समय खत्म हो गया है। नया कोड मँगवाएँ।',
    OTP_TOO_MANY_ATTEMPTS: 'कई बार गलत कोड डाला गया। फिर से कोशिश करने के लिए नया कोड मँगवाएँ।',
    OTP_RESEND_TOO_SOON: 'दूसरा कोड मँगवाने से पहले कृपया थोड़ा रुकें।',
    OTP_DELIVERY_FAILED: 'अभी हम आपका कोड नहीं भेज पाए। कृपया फिर से कोशिश करें।',
    PHONE_ALREADY_REGISTERED: 'इस नंबर से पहले से एक अकाउंट बना है। इसकी जगह साइन इन करके देखें।',
    ACCOUNT_SUSPENDED: 'यह अकाउंट अभी चालू नहीं है, इसलिए आप इससे साइन इन नहीं कर सकते।',
    REGISTRATION_NOT_FOUND: 'यह रजिस्ट्रेशन अब उपलब्ध नहीं है। कृपया फिर से शुरू करें।',
    NOT_SUPPORTED: 'यह सुविधा अभी ऐप में उपलब्ध नहीं है।',
    CAMERA_UNAVAILABLE:
      'अभी कैमरा इस्तेमाल नहीं हो सकता। आप इसकी जगह गैलरी से फ़ोटो चुन सकते हैं।',
    EMAIL_REQUIRED_FOR_SIGN_IN:
      'आपका ईमेल पता हटाया नहीं जा सकता, क्योंकि इसी से आप इस अकाउंट में साइन इन करते हैं।',
    FILE_TOO_LARGE: 'यह फ़ोटो अपलोड करने के लिए बहुत बड़ी है। कृपया छोटी फ़ोटो चुनें।',
    FILE_TYPE_NOT_ALLOWED: 'सिर्फ़ JPG, PNG और WebP फ़ोटो ही लगाई जा सकती हैं।',
    TOO_MANY_FILES: 'एक साथ बहुत ज़्यादा फ़ोटो भेजी गईं। कृपया कम फ़ोटो के साथ फिर से कोशिश करें।',
    REQUEST_NOT_FOUND: 'हमें वह रिक्वेस्ट नहीं मिली।',
    REQUEST_NOT_CANCELLABLE:
      'एक प्रोफ़ेशनल यह रिक्वेस्ट पहले ही स्वीकार कर चुके हैं, इसलिए इसे यहाँ रद्द नहीं किया जा सकता।',
    PAYMENT_ALREADY_RECORDED: 'इस काम का भुगतान पहले ही दर्ज हो चुका है।',
    NOTIFICATION_NOT_FOUND: 'यह नोटिफ़िकेशन अब उपलब्ध नहीं है।',
    REQUEST_ALREADY_TAKEN:
      'यह रिक्वेस्ट अब उपलब्ध नहीं है। किसी दूसरे प्रोफ़ेशनल ने इसे पहले स्वीकार कर लिया।',
    REQUEST_NOT_PENDING: 'यह रिक्वेस्ट अब जवाब का इंतज़ार नहीं कर रही है।',
    INVALID_TRANSITION: 'इस काम में पहले ही बदलाव हो चुका है। इसकी ताज़ा स्थिति दिखाई जा रही है।',
    RATE_LIMITED: 'बहुत ज़्यादा कोशिशें हो गईं। कृपया थोड़ा रुककर फिर से कोशिश करें।',
    REVIEW_NOT_FOUND: 'इस रिक्वेस्ट का कोई रिव्यू नहीं मिला।',
  },
  backendCodeWait: {
    RATE_LIMITED: 'बहुत ज़्यादा कोशिशें हो गईं। {wait} बाद फिर से कोशिश करें।',
  },
  wait: {
    oneMinute: '1 मिनट',
    minutes: '{minutes} मिनट',
    oneHour: '1 घंटे',
    hours: '{hours} घंटे',
  },
};
