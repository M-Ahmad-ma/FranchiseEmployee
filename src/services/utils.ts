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

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

/**
 * Best-effort date parsing. The API's date format is unspecified — the docs
 * show `01-Oct-2026` — so ISO, slashed and `DD-Mon-YYYY` are all accepted.
 * Returns null when the value can't be read, and callers skip that filter
 * rather than hiding every row.
 */
export function toTimestamp(value: string): number | null {
  const trimmed = value.trim();
  // A bare number like "5" would otherwise parse as a year-2001 date.
  if (!/\d{4}/.test(trimmed)) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  const dmy = trimmed.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})$/);
  if (dmy) {
    const month = MONTHS.indexOf(dmy[2].slice(0, 3).toLowerCase());
    if (month >= 0) {
      return Date.UTC(Number(dmy[3]), month, Number(dmy[1]));
    }
  }

  return null;
}
