import type { Option } from './utils';
import {
  DEAL_DONE_LABELS,
  MEETING_TYPE_LABELS,
} from './leadsFilterService';

/**
 * Reference data for dropdowns.
 *
 * City, company and pipeline pickers are NOT listed here: they come from
 * `GET /leads/filter/dropdowns` and the filter query needs their real ids, so
 * a guessed list would send a value the server cannot match. The screens keep
 * those pickers disabled until the dropdowns resolve.
 *
 * The lists below are static because the API documents the codes it accepts.
 * Their labels are read from the maps in `leadsFilterService` rather than
 * repeated here — the two copies drifted once already, which is how the app came
 * to call code 2 "Video Call" when the server calls it "Conference Call".
 */

/** Order mirrors the web dashboard's own filter markup. */
export const DEALS_DONE_OPTIONS: Option[] = [
  { label: DEAL_DONE_LABELS['1'], value: '1' },
  { label: DEAL_DONE_LABELS['0'], value: '0' },
];

/**
 * An empty value means "All": `buildUrl` drops empty params, so no `meeting_type`
 * is sent and the server applies no filter at all.
 *
 * `none` is not a fourth meeting type — the controller turns it into an
 * `IS NULL` match, so it selects leads with no meeting type recorded.
 */
export const MEETING_TYPE_OPTIONS: Option[] = [
  { label: 'All', value: '' },
  { label: MEETING_TYPE_LABELS.none, value: 'none' },
  { label: MEETING_TYPE_LABELS['1'], value: '1' },
  { label: MEETING_TYPE_LABELS['2'], value: '2' },
  { label: MEETING_TYPE_LABELS['3'], value: '3' },
];

export const RECORDS_PER_PAGE_OPTIONS: Option[] = [
  { label: '10', value: '10' },
  { label: '25', value: '25' },
  { label: '50', value: '50' },
  { label: '100', value: '100' },
];
