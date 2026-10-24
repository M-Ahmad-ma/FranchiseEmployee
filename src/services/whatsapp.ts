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

interface Comment {
  message: string;
  date: string;
}


// whatsapp interface
export interface Message {
  name: string;
  callNow: string;
  brand: string;
  city: string;
  comments?: Comment[];
  email: string;
  date: string;
}

/**
 * Renders a lead as the plain-text block that is sent to WhatsApp.
 *
 * Field labels are left-aligned and separated from their values by a tab,
 * which is what the ops team asked for. WhatsApp renders tabs as a small gap
 * rather than aligning columns — see the note below — but the layout is still
 * readable and it is what the spreadsheet they copy from looks like.
 */
export function formatLeadForWhatsApp(lead: Message): string {
  const lines: string[] = [
    `Name :\t${lead.name || '-'}`,
    `Call Now:\t${lead.callNow || '-'}`,
    `Brand :\t${lead.brand || '-'}`,
    `City :\t${lead.city || '-'}`,
    `View Comment :`,
    '',
  ];

  if (lead.comments?.length) {
    // Newest first, matching the app's own comment thread.
    for (const comment of lead.comments) {
      lines.push(comment.message);
      lines.push(comment.date);
    }
  } else {
    lines.push('No comments');
  }

  lines.push('');
  lines.push(`Send email :\t${lead.email || '-'}`);
  lines.push(`Date :\t${lead.date || '-'}`);

  return lines.join('\n');
}


/**
 * A `wa.me` link that opens WhatsApp's contact picker with the lead prefilled.
 *
 * The phone is deliberately absent from the path — `https://wa.me/?text=…`
 * is WhatsApp's share form, which asks the sender to pick a recipient. The
 * https form is used rather than `whatsapp://send` so it opens the app when
 * installed and falls back to the Play Store when it is not.
 *
 * Always returns a non-empty string: there is no "no phone number" case
 * here, because the number is never part of the URL.
 */
export function whatsappShareUrl(lead: Message): string {
  const text = formatLeadForWhatsApp(lead);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
