import { Option } from './utils';

/**
 * Reference data for dropdowns.
 *
 * City, company and pipeline pickers are NOT listed here: they come from
 * `GET /leads/filter/dropdowns` and the filter query needs their real ids, so
 * a guessed list would send a value the server cannot match. The screens keep
 * those pickers disabled until the dropdowns resolve.
 *
 * The lists below are static because the API documents the codes it accepts.
 */

export const DEALS_DONE_OPTIONS: Option[] = [
  { label: 'Yes', value: '1' },
  { label: 'No', value: '0' },
];

/**
 * `none` is not a fourth meeting type — the controller turns it into an
 * `IS NULL` match, so it labels a lead with no meeting type recorded.
 */
export const MEETING_TYPE_OPTIONS: Option[] = [
  { label: 'In Person', value: '1' },
  { label: 'Video Call', value: '2' },
  { label: 'Phone Call', value: '3' },
  { label: 'Not Set', value: 'none' },
];

export const RECORDS_PER_PAGE_OPTIONS: Option[] = [
  { label: '10', value: '10' },
  { label: '25', value: '25' },
  { label: '50', value: '50' },
  { label: '100', value: '100' },
];