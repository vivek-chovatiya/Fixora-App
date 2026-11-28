/**
 * Authentication copy — Gujarati
 *
 * Translates `AUTH_COPY_EN` in `authCopy.ts` (phase5-contract.md section 7); a
 * key left out reads in English. `brand.wordmark` is deliberately absent: the
 * product name is never translated.
 *
 * `{destination}`, `{seconds}` and `{digits}` stay exactly as written. The
 * welcome heading is split around the product name, so Gujarati puts it first:
 * `title` is empty and `titleAfter` follows "Fixora".
 */

import type { LocaleTable } from '@/core/i18n';
import type { AUTH_COPY_EN } from '@/features/auth/constants/authCopy';

const SENT_TO = 'અમે {destination} પર કોડ મોકલ્યો છે';
const SENT_TO_WHATSAPP = 'અમે WhatsApp પર {destination} ને કોડ મોકલ્યો છે';
const CODE_LABEL = 'વેરિફિકેશન કોડ';
const CODE_HINT = 'બધા અંક નાખતાં જ તમને આપમેળે સાઇન ઇન કરી દે છે';
const RESEND = 'કોડ ફરી મોકલો';
const RESEND_IN = '{seconds} પછી કોડ ફરી મોકલો';
const SEND_CODE_SUBTITLE = 'તમારો ફોન નંબર નાખો, અમે તમને એક વેરિફિકેશન કોડ મોકલીશું.';
const SEND_CODE_HINT = 'તમે નાખેલા નંબર પર વેરિફિકેશન કોડ મોકલે છે';
const REGISTER_BUSINESS = 'તમારો બિઝનેસ રજિસ્ટર કરો';

export const AUTH_COPY_GU: LocaleTable<typeof AUTH_COPY_EN> = {
  brand: {
    tagline: 'આસપાસની સેવાઓ, બસ થોડા ટૅપમાં.',
  },

  common: {
    back: 'પાછા',
    backHint: 'પાછલી સ્ક્રીન પર પાછા લઈ જાય છે',
    safetyNote: 'તમારી માહિતી અમારી પાસે સુરક્ષિત છે.',
    secondsShort: '{seconds} સેકન્ડ',
  },

  authEntry: {
    title: '',
    titleAfter: 'માં તમારું સ્વાગત છે',
    tagline: 'જોડાઓ. બુક કરો. કામ કરાવો.',
    subtitle: 'તમે કેવી રીતે આગળ વધવા માંગો છો તે પસંદ કરો.',

    customerTitle: 'ગ્રાહક',
    customerDescription: 'ભરોસાપાત્ર આસપાસની સેવાઓ શોધો અને સરળતાથી મદદ માંગો.',
    customerBadge: 'કામ કરાવો',
    customerHint: 'ગ્રાહક તરીકે આગળ વધો',

    vendorTitle: 'વેન્ડર',
    vendorDescription: 'તમારો સર્વિસ બિઝનેસ સંભાળો અને Fixora સાથે આગળ વધો.',
    vendorBadge: 'તમારો બિઝનેસ વધારો',
    vendorHint: 'વેન્ડર તરીકે આગળ વધો',

    trustTitle: 'સુરક્ષિત. ભરોસાપાત્ર. આસપાસ.',

    registerNote: 'નવા વેન્ડર અહીંથી રજિસ્ટર કરી શકે છે:',
    registerLink: 'વેન્ડર સાઇન ઇન',
    registerLinkHint: 'વેન્ડર સાઇન ઇન ખોલે છે, જ્યાં તમે બિઝનેસ રજિસ્ટર કરી શકો છો',
  },

  customerLogin: {
    title: 'સાઇન ઇન કરો',
    subtitle: SEND_CODE_SUBTITLE,
    phoneLabel: 'ફોન નંબર',
    phonePlaceholder: 'તમારો ફોન નંબર',
    submit: 'કોડ મોકલો',
    submitHint: SEND_CODE_HINT,
  },

  customerOtp: {
    title: 'તમારો નંબર વેરિફાય કરો',
    sentTo: SENT_TO,
    sentToWhatsApp: SENT_TO_WHATSAPP,
    codeLabel: CODE_LABEL,
    codeHint: CODE_HINT,
    resend: RESEND,
    resendIn: RESEND_IN,
    changeAction: 'ફોન નંબર બદલો',
  },

  vendorLogin: {
    title: 'વેન્ડર સાઇન ઇન',
    subtitle: SEND_CODE_SUBTITLE,
    phoneLabel: 'ફોન નંબર',
    phonePlaceholder: 'તમારો રજિસ્ટર્ડ ફોન નંબર',
    submit: 'કોડ મોકલો',
    submitHint: SEND_CODE_HINT,
    registerPrompt: 'Fixora પર નવા છો?',
    registerAction: REGISTER_BUSINESS,

    welcomeTitle: 'ફરી સ્વાગત છે',
    welcomeSubtitle: 'સાઇન ઇન કરવા માટે અમે આ નંબર પર વેરિફિકેશન કોડ મોકલીશું.',
    rememberedPhoneSpoken: 'ફોન નંબર, જેના છેલ્લા અંક {digits} છે',
    useDifferentNumber: 'બીજો નંબર વાપરો',
    useDifferentNumberHint: 'આ ડિવાઇસમાંથી આ નંબર ભૂલી જાય છે, જેથી તમે બીજો નંબર નાખી શકો',
  },

  vendorSignInOtp: {
    title: 'તમારો નંબર વેરિફાય કરો',
    sentTo: SENT_TO,
    sentToWhatsApp: SENT_TO_WHATSAPP,
    codeLabel: CODE_LABEL,
    codeHint: CODE_HINT,
    resend: RESEND,
    resendIn: RESEND_IN,
    changeAction: 'ફોન નંબર બદલો',
    registerPrompt: 'નવા વેન્ડર છો?',
    registerAction: REGISTER_BUSINESS,
  },

  vendorRegistration: {
    title: REGISTER_BUSINESS,
    subtitle: 'તમારા બિઝનેસ વિશે જણાવો. તમારો નંબર વેરિફાય કરવા માટે અમે એક કોડ મોકલીશું.',

    businessSection: 'બિઝનેસ',
    businessNameLabel: 'બિઝનેસનું નામ',
    businessNamePlaceholder: 'તમારા બિઝનેસનું નામ',

    contactSection: 'સંપર્ક',
    firstNameLabel: 'પહેલું નામ',
    firstNamePlaceholder: 'માલિકનું પહેલું નામ',
    lastNameLabel: 'અટક',
    lastNamePlaceholder: 'માલિકની અટક',
    phoneLabel: 'ફોન નંબર',
    phonePlaceholder: 'બિઝનેસનો ફોન નંબર',
    phoneHelper: 'અમે આ જ નંબર પર તમારો વેરિફિકેશન કોડ મોકલીશું.',
    emailLabel: 'ઇમેઇલ',
    emailPlaceholder: 'બિઝનેસ ઇમેઇલ',
    emailHelper: 'વૈકલ્પિક.',

    servicesSection: 'સેવાઓ',
    categoriesLabel: 'તમે કઈ સેવાઓ આપો છો',

    submit: 'આગળ વધો',
    submitHint: 'તમારો બિઝનેસ રજિસ્ટર કરે છે અને વેરિફિકેશન કોડ મોકલે છે',
  },

  vendorOtp: {
    title: 'તમારા બિઝનેસનો નંબર વેરિફાય કરો',
    sentTo: SENT_TO,
    sentToWhatsApp: SENT_TO_WHATSAPP,
    codeLabel: CODE_LABEL,
    codeHint: CODE_HINT,
    resend: RESEND,
    resendIn: RESEND_IN,
    changeAction: 'રજિસ્ટ્રેશનની વિગતો બદલો',
  },
};
