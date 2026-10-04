/**
 * Shape check for the address field on the login and sign-up forms.
 *
 * Deliberately permissive: it only rejects what no real address can look like,
 * leaving deliverability to the confirmation email.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}
