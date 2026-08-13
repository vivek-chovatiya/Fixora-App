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
    /**
     * The product name as it is written in the interface. Kept here rather than
     * read from AppConfig.app.name, which is the bundle's identity and not
     * necessarily what a user should be shown.
     */
    wordmark: 'Fixora',
    /** Temporary product copy. Replace when marketing copy is agreed. */
    tagline: 'Local services, requested in a few taps.',
  }),

  authEntry: Object.freeze({
    /** The wordmark carries the product name, so the heading does not repeat it. */
    title: 'Welcome',
    subtitle: 'Choose how you want to continue.',
    customerTitle: 'Customer',
    customerDescription: 'Find and request local services.',
    customerHint: 'Continue as a customer',
    vendorTitle: 'Vendor',
    vendorDescription: 'Manage your service business and jobs.',
    vendorHint: 'Continue as a vendor',
    /**
     * Points a new vendor at the one path to registration rather than adding a
     * second entry point to this screen.
     */
    registerNote: 'New vendors can register from vendor sign in.',
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

  vendorLogin: Object.freeze({
    title: 'Vendor sign in',
    subtitle: 'Sign in with your phone number and your authentication code.',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'Your registered phone number',
    codeLabel: 'Authentication code',
    codePlaceholder: 'Your authentication code',
    /**
     * States where the code came from without hinting at what it looks like or
     * offering a recovery route the backend does not yet support.
     */
    codeHelper: 'The code you saved when you registered your business.',
    submit: 'Sign in',
    submitHint: 'Signs you in to your vendor account',
    registerPrompt: 'New to Fixora?',
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

  }),

  /**
   * The auth code steps.
   *
   * The wording avoids "approved" throughout. Nothing was reviewed and nobody
   * approved anything — the number was verified and the business activated
   * automatically (PROJECT_BIBLE.md section 7A.2). It also avoids implying the
   * vendor is signed in, because they are not until the code is confirmed.
   */
  vendorAuthCode: Object.freeze({
    displayTitle: 'Phone verified',
    displayBody:
      'Your business is active. This is your authentication code — you will need it every time you sign in.',
    displayWarning: 'Save it somewhere safe. It is shown here once, and it does not expire.',
    codeLabel: 'Your authentication code',
    copy: 'Copy code',
    copied: 'Copied',
    copyHint: 'Copies your authentication code to the clipboard',
    copyFailed: 'We could not copy the code. Please write it down instead.',
    continueAction: 'I have saved it',
    continueHint: 'Continues to confirm the code you just saved',

    confirmTitle: 'Confirm your code',
    confirmBody: 'Enter the authentication code you just saved.',
    confirmLabel: 'Authentication code',
    confirmPlaceholder: 'Enter your code',
    confirmAction: 'Continue',
    confirmHint: 'Confirms your code and signs you in',
    regenerate: 'Regenerate code',
    regenerateHint: 'Replaces your code with a new one. The current code stops working.',
    back: 'Show my code again',
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
