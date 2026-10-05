import { Option } from './utils';

/**
 * Reference data for dropdowns.
 *
 * These are fallbacks: the screens derive their filter options from the rows
 * the API actually returned, and only fall back to these lists while loading
 * or when a result set is empty.
 *
 * Companies are no longer listed here — they come from
 * `GET /api/team/companies`. Media types stay static because the Team API
 * exposes no media endpoint.
 */
export const CITY_OPTIONS: Option[] = [
  { label: 'Lahore', value: 'lahore' },
  { label: 'Karachi', value: 'karachi' },
  { label: 'Islamabad', value: 'islamabad' },
  { label: 'Faisalabad', value: 'faisalabad' },
  { label: 'Multan', value: 'multan' },
  { label: 'Peshawar', value: 'peshawar' },
];

export const BRAND_OPTIONS: Option[] = [
  { label: 'McDonald’s', value: 'mcdonalds' },
  { label: 'KFC', value: 'kfc' },
  { label: 'Pizza Hut', value: 'pizza-hut' },
  { label: 'Subway', value: 'subway' },
  { label: 'Hardee’s', value: 'hardees' },
];

export const DEALS_DONE_OPTIONS: Option[] = [
  { label: 'None', value: 'none' },
  { label: '1 – 2', value: '1-2' },
  { label: '3 – 5', value: '3-5' },
  { label: '5+', value: '5-plus' },
];

export const MEETING_TYPE_OPTIONS: Option[] = [
  { label: 'All', value: 'all' },
  { label: 'In Person', value: 'in-person' },
  { label: 'Video Call', value: 'video-call' },
  { label: 'Phone Call', value: 'phone-call' },
];

export const PIPELINE_STATUS_OPTIONS: Option[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'New Lead', value: 'new-lead' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Negotiation', value: 'negotiation' },
  { label: 'Closed', value: 'closed' },
];

export const MEDIA_TYPE_OPTIONS: Option[] = [
  { label: 'Images', value: 'image' },
  { label: 'Videos', value: 'video' },
  { label: 'PDFs', value: 'pdf' },
  { label: 'Locations', value: 'location' },
];

export const RECORDS_PER_PAGE_OPTIONS: Option[] = [
  { label: '10', value: '10' },
  { label: '25', value: '25' },
  { label: '50', value: '50' },
  { label: '100', value: '100' },
];
