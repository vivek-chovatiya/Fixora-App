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
 * Nothing here is a secret. No one-time code, auth code or phone number is
 * stored in this file.
 */

export const AUTH_COPY = Object.freeze({
  brand: Object.freeze({
    /** Temporary product copy. Replace when marketing copy is agreed. */
    tagline: 'Local services, requested in a few taps.',
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
    /** `{destination}` is replaced with the masked value the backend supplied. */
    subtitle: 'Enter the code we sent to {destination}.',
    codeLabel: 'Verification code',
    codePlaceholder: 'Enter the code',
    submit: 'Verify',
    submitHint: 'Checks the code and signs you in',
    resend: 'Resend code',
    /** `{seconds}` is replaced with the remaining cooldown. */
    resendIn: 'Resend code in {seconds}s',
    changeAction: 'Change phone number',
    /**
     * Replaces ErrorState's default title for `unauthorized`, which reads
     * "Session expired" — accurate everywhere else in the app, but wrong here
     * where no session exists yet and the only thing that can have expired is
     * the code.
     */
    expiredTitle: 'Code expired',
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
    /** `{destination}` is replaced with the masked value the backend supplied. */
    subtitle: 'Enter the code we sent to {destination}.',
    codeLabel: 'Verification code',
    codePlaceholder: 'Enter the code',
    submit: 'Verify',
    /**
     * Deliberately does not promise a sign in. Verifying the number activates
     * the business and issues an auth code; the session comes later, once that
     * code is confirmed (PROJECT_BIBLE.md section 7A.2).
     */
    submitHint: 'Checks the code and activates your business',
    resend: 'Resend code',
    /** `{seconds}` is replaced with the remaining cooldown. */
    resendIn: 'Resend code in {seconds}s',
    changeAction: 'Change registration details',
    expiredTitle: 'Code expired',

    verifiedTitle: 'Business verified',
    /**
     * Says nothing about the auth code itself. The code exists at this point but
     * is not shown until the display step, which owns how it is presented.
     */
    verifiedBody: 'Your number is verified and your business is active.',
  }),
});

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
