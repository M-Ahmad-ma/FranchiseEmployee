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

/**
 * The meeting types a new meeting can be logged with.
 *
 * Unlike `MEETING_TYPE_OPTIONS` — which is a *filter* and so offers "All" and
 * "No Meeting" — this is the set the create endpoint accepts. It rejects
 * anything that is not 1, 2 or 3 with "Invalid meeting_type", so the number
 * is what goes on the wire and the label is only ever shown. There is no "All"
 * here: a meeting has one type or none, and "none" is expressed by leaving
 * the field empty rather than by picking a row.
 */
export const MEETING_TYPE_CREATE_OPTIONS: Option[] = [
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

/**
 * Document types for `POST /api/team/leads/info`.
 *
 * **The `title` field is not a caption.** The web modal's dropdown is
 * mislabelled "Select a Lead:" but its field name is `title`, and what it
 * actually picks is the kind of document being attached. The lead comes from the
 * screen the employee is already on.
 *
 * There is no endpoint that returns this list, so it is hardcoded here.
 *
 * **Do not spellcheck these values.** `Invester`, `Employe` and lowercase
 * `whatsapp` are the strings the server stores verbatim. "Fixing" them writes a
 * different value than the web writes, which splits the data into two buckets
 * the moment anyone filters by it.
 */
export const LEAD_INFO_OPTIONS: Option[] = [
  {
    value: 'Call with Investor',
    label: 'Upload Screen shot of Employee Call with investor',
  },
  {
    value: 'Conference Call',
    label: 'Upload Screen shot of Employee Conference Call with investor',
  },
  {
    value: 'Zoom Call',
    label: 'Upload Screen shot of Employee Zoom Call with investor',
  },
  {
    value: 'Physical Meeting With Invester',
    label: 'Upload Screen shot of Physical meeting of brand with investor',
  },
  {
    value: 'Franchise Model Share via Whatsapp',
    label: 'Upload Screen Shot of Brand Franchise Model to share via whatsapp',
  },
  {
    value: 'Location Picture',
    label: 'Upload location picture if investor has',
  },
  { value: 'Invoice', label: 'Upload Invoice' },
  { value: 'Receipt', label: 'Upload Receipt' },
  { value: 'Success Story', label: 'Upload Success story' },
  { value: 'Commission', label: 'Employe commission' },
  { value: 'V Card', label: 'Employe V.card' },
  { value: 'Email', label: 'Upload Email' },
];
