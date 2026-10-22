/**
 * WhatsApp deep links for a lead's phone number.
 *
 * `wa.me` wants the number in international form and digits only — no "+", no
 * spaces, no dashes. The API stores Pakistani numbers in their local form
 * ("0300…"), so the leading zero is swapped for the country code before the
 * link is built.
 */

/**
 * The number in the international, digits-only form WhatsApp expects.
 *
 * "03001234567" becomes "923001234567". "0092…" loses its international
 * prefix, and a number that already carries a country code is left alone —
 * guessing one here would send the chat to a stranger.
 */
export function whatsappNumber(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  // "0092…" is the international prefix written out; "92…" is the same number.
  const trimmed = digits.startsWith('00') ? digits.slice(2) : digits;

  // A local number starting with "0" is missing its country code.
  return trimmed.startsWith('0') ? `92${trimmed.slice(1)}` : trimmed;
}

/**
 * A `wa.me` link for the number, with an optional prefilled message.
 *
 * The https form is used rather than `whatsapp://send?phone=…`: it opens
 * WhatsApp directly when the app is installed and falls back to the Play
 * Store when it is not, so the link never dead-ends. An empty result means
 * the number had no digits to work with.
 */
export function whatsappUrl(phone: string, message?: string): string {
  const number = whatsappNumber(phone);
  if (!number) {
    return '';
  }

  const base = `https://wa.me/${number}`;
  const text = (message ?? '').trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
