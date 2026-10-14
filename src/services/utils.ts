import { MOCK_DELAY_MS } from '../config';

export const delay = (ms: number = MOCK_DELAY_MS) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

export interface Option {
  label: string;
  value: string;
}

/* -------------------------------------------------------------------------- */
/*  Row readers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The Team API documents response *envelopes* but shows every list as an empty
 * array, so the row field names are not specified. These readers take the first
 * populated value from a list of candidate keys, which keeps each guessed key
 * confined to one place until the server confirms it.
 */

export function pickString(
  row: Record<string, unknown>,
  keys: string[],
  fallback = '',
): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }
  return fallback;
}

export function pickNumber(
  row: Record<string, unknown>,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const raw = row[key];
    if (raw === undefined || raw === null || raw === '') {
      continue;
    }
    const value = Number(raw);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

/* -------------------------------------------------------------------------- */
/*  Values                                                                     */
/* -------------------------------------------------------------------------- */

/** Case-insensitive "contains", treating an empty needle as a match. */
export const contains = (value: string | undefined, needle?: string) => {
  const term = (needle ?? '').trim().toLowerCase();
  return term === '' || (value ?? '').toLowerCase().includes(term);
};

/** Case-insensitive equality, treating an empty expected value as a match. */
export const equals = (value: string | undefined, expected?: string) => {
  const term = (expected ?? '').trim().toLowerCase();
  return term === '' || (value ?? '').trim().toLowerCase() === term;
};

/**
 * Converts the date picker's `mm/dd/yyyy` display value into the `YYYY-MM-DD`
 * the API's `strtotime()` reads unambiguously. Values already in ISO form pass
 * through, and anything unreadable returns undefined so the field is simply
 * left out of the query instead of becoming a filter that matches nothing.
 */
export function toApiDate(value?: string): string | undefined {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!parts) {
    return undefined;
  }

  const [, month, day, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Absolute URL for a server-stored relative path such as `uploads/...`. */
export function resolveAssetPath(path: string, origin: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${origin.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
}
