/**
 * Authentication copy
 *
 * Every user-facing string in the auth screens, in one place.
 *
 * Screens read from here rather than inlining text so that copy can be revised
 * without touching component logic, and so that introducing multi-language
 * support later means translating this file rather than hunting through JSX
 * (PROJECT_BIBLE.md section 18, future compatibility).
 *
 * Validation messages are deliberately absent — they live with their schemas in
 * `../validation`, next to the rule that produces them. Failure messages from
 * the service are absent too: those come from `AppError.userMessage`, which is
 * the only copy the backend is allowed to influence.
 *
 * Nothing here is a secret. No one-time code or phone number is stored in this
 * file.
 *
 * Every code screen has two ways to say where the code went: `sentTo`, and
 * `sentToWhatsApp` for a challenge whose `deliveryChannel` is `WHATSAPP`
 * (phase5-contract.md section 2). The channel is the backend's answer, never
 * the app's assumption, which is why the plain sentence names none.
 *
 * In English, Hindi and Gujarati since Phase 5 (28/11/2026, phase5-contract.md
 * section 7): `AUTH_COPY_EN` is the source, `authCopy.hi.ts` and `authCopy.gu.ts`
 * translate it, and `AUTH_COPY` answers in the current language, falling back to
 * English key by key (`core/i18n`). Read it in render, never at module scope.
 */

import { localized } from '@/core/i18n';
import { AUTH_COPY_GU } from '@/features/auth/constants/authCopy.gu';
import { AUTH_COPY_HI } from '@/features/auth/constants/authCopy.hi';

export const AUTH_COPY_EN = Object.freeze({
  brand: Object.freeze({
    /**
     * The product name as it is written in the interface. Kept here rather than
     * read from AppConfig.app.name, which is the bundle's identity and not
     * necessarily what a user should be shown.
     */
    wordmark: 'Fixora',
    /** Temporary product copy. Replace when marketing copy is agreed. */
    tagline: 'Local services, requested in a few taps.',
  }),

  /** Shared by more than one auth screen, so it is not owned by any of them. */
  common: Object.freeze({
    back: 'Back',
    backHint: 'Returns to the previous screen',
    /**
     * Reassurance, not a claim about security controls.
     *
     * Deliberately says nothing about encryption, storage or compliance: the
     * app has no way to know what the backend does, and a promise made in the
     * interface is one the product then has to keep.
     *
     * Shared rather than repeated: role selection and sign in both say it, and
     * two copies of a sentence are two sentences to keep in step.
     */
    safetyNote: 'Your information is safe with us.',

    /**
     * A count of seconds, written short.
     *
     * Its own fragment because the countdown is drawn in two inks — the value in
     * the accent, the sentence around it in the quiet colour — and a unit left
     * in the sentence would be the one character of the number rendered in the
     * wrong one. Keeping it here rather than in the component also keeps it
     * translatable, for a language that abbreviates seconds differently.
     */
    secondsShort: '{seconds}s',
  }),

  authEntry: Object.freeze({
    /**
     * The heading is written as two parts because the second is the brand.
     *
     * `brand.wordmark` supplies "Fixora", which is not a word to be translated
     * and is the one string on the screen that must never change. Splitting it
     * out also lets the product name carry the accent colour without slicing a
     * translated sentence at a fixed index.
     */
    title: 'Welcome to',
    /**
     * Whatever follows the product name. Empty in English; a language that
     * puts the name first ("Fixora में आपका स्वागत है") leaves `title` empty and
     * says the rest here.
     */
    titleAfter: '',
    tagline: 'Connect. Book. Get things done.',
    subtitle: 'Choose how you want to continue.',

    customerTitle: 'Customer',
    customerDescription: 'Find trusted local services and request help easily.',
    /** The outcome, not the action — the card title already names the role. */
    customerBadge: 'Get things done',
    customerHint: 'Continue as a customer',

    vendorTitle: 'Vendor',
    vendorDescription: 'Manage your service business and grow with Fixora.',
    vendorBadge: 'Grow your business',
    vendorHint: 'Continue as a vendor',

    /** Paired with `common.safetyNote`, which sign in also shows. */
    trustTitle: 'Safe. Reliable. Local.',

    /**
     * Points a new vendor at the one path to registration rather than adding a
     * second entry point to this screen. Registration is still reachable only
     * from vendor sign in; what is tappable here goes to sign in itself, which
     * the vendor card above already offers.
     */
    registerNote: 'New vendors can register from',
    registerLink: 'vendor sign in',
    registerLinkHint: 'Opens vendor sign in, where you can register a business',
  }),

  customerLogin: Object.freeze({
    title: 'Sign in',
    subtitle: 'Enter your phone number and we will send you a verification code.',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'Your phone number',
    submit: 'Send code',
    submitHint: 'Sends a verification code to the number you entered',
  }),

  customerOtp: Object.freeze({
    title: 'Verify your number',
    /**
     * `{destination}` is replaced with the masked number the backend reports.
     *
     * "Verify your number" on its own never said which number, on a screen
     * reached by typing one — so a typo could only be found by giving up and
     * going back. The value has always been in the challenge; nothing rendered
     * it.
     */
    sentTo: 'We sent a code to {destination}',
    /** The same line when the backend says the code went by WhatsApp. */
    sentToWhatsApp: 'We sent a code on WhatsApp to {destination}',
    codeLabel: 'Verification code',
    /**
     * Says what the missing button used to say by existing. Sighted users infer
     * it from the code completing and the animation starting; this is the same
     * information for anyone who cannot see either.
     */
    codeHint: 'Signs you in automatically once you have entered every digit',
    resend: 'Resend code',
    /** `{seconds}` is replaced with `common.secondsShort`, which carries the unit. */
    resendIn: 'Resend code in {seconds}',
    changeAction: 'Change phone number',
  }),

  /**
   * Returning vendors: phone, then a one-time code, as customers (owner decision
   * 28/11/2026, phase5-contract.md section 1.1 — the permanent auth code is gone).
   */
  vendorLogin: Object.freeze({
    title: 'Vendor sign in',
    subtitle: 'Enter your phone number and we will send you a verification code.',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'Your registered phone number',
    submit: 'Send code',
    submitHint: 'Sends a verification code to the number you entered',
    registerPrompt: 'New to Fixora?',
    registerAction: 'Register your business',

    /**
     * A returning vendor on the device they last signed in on: the number is
     * remembered, so the code can be asked for in one tap.
     */
    welcomeTitle: 'Welcome back',
    welcomeSubtitle: 'We will send a verification code to this number to sign you in.',
    /**
     * Spoken in place of the masked number. `{digits}` is the last four, spelt
     * one at a time — the bullets mean nothing read aloud, and "zero zero zero
     * one" is recognisable where "one" is not.
     */
    rememberedPhoneSpoken: 'Phone number ending {digits}',
    useDifferentNumber: 'Use a different number',
    useDifferentNumberHint: 'Forgets this number on this device so you can enter another',
  }),

  /** The code step of vendor sign in. Same shape as `customerOtp`. */
  vendorSignInOtp: Object.freeze({
    title: 'Verify your number',
    /** `{destination}` is replaced with the masked number the backend reports. */
    sentTo: 'We sent a code to {destination}',
    sentToWhatsApp: 'We sent a code on WhatsApp to {destination}',
    codeLabel: 'Verification code',
    codeHint: 'Signs you in automatically once you have entered every digit',
    resend: 'Resend code',
    /** `{seconds}` is replaced with `common.secondsShort`, which carries the unit. */
    resendIn: 'Resend code in {seconds}',
    changeAction: 'Change phone number',
    /**
     * The way out for a number with no vendor account. The backend never says
     * so — its code is refused as a wrong one (phase5-contract.md section 1.1)
     * — so the way to register is offered to everyone here, worded so it reads
     * as an option rather than as a diagnosis.
     */
    registerPrompt: 'New vendor?',
    registerAction: 'Register your business',
  }),

  vendorRegistration: Object.freeze({
    title: 'Register your business',
    subtitle: 'Tell us about your business. We will send a code to verify your number.',

    businessSection: 'Business',
    businessNameLabel: 'Business name',
    businessNamePlaceholder: 'Your business name',

    contactSection: 'Contact',
    firstNameLabel: 'First name',
    firstNamePlaceholder: 'Owner first name',
    lastNameLabel: 'Last name',
    lastNamePlaceholder: 'Owner last name',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'Business phone number',
    phoneHelper: 'We will send your verification code to this number.',
    emailLabel: 'Email',
    emailPlaceholder: 'Business email',
    emailHelper: 'Optional.',

    servicesSection: 'Services',
    categoriesLabel: 'Services you offer',

    submit: 'Continue',
    submitHint: 'Registers your business and sends a verification code',

  }),

  vendorOtp: Object.freeze({
    title: 'Verify your business number',
    /** `{destination}` is replaced with the masked number the backend reports. */
    sentTo: 'We sent a code to {destination}',
    sentToWhatsApp: 'We sent a code on WhatsApp to {destination}',
    codeLabel: 'Verification code',
    /**
     * Verifying the number creates the business and signs the vendor in, in one
     * step (phase5-contract.md section 1.2) — so this promises the sign in, as
     * the customer's does.
     */
    codeHint: 'Signs you in automatically once you have entered every digit',
    resend: 'Resend code',
    /** `{seconds}` is replaced with `common.secondsShort`, which carries the unit. */
    resendIn: 'Resend code in {seconds}',
    changeAction: 'Change registration details',
  }),
});

export const AUTH_COPY = localized({ en: AUTH_COPY_EN, hi: AUTH_COPY_HI, gu: AUTH_COPY_GU });

/**
 * Fills `{name}` placeholders in a copy string.
 *
 * A deliberately small helper rather than a formatting library: it exists so
 * that a sentence stays one translatable unit instead of being concatenated in
 * a component, which is what makes it translatable later.
 */
export function formatCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
