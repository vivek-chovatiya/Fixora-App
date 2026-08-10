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
    changeNumber: 'Change phone number',
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
