/**
 * Fixtures returned while `USE_MOCK` is true. Field names mirror the shapes
 * documented in TEAM_API_DOCUMENTATION.md — `auth/login` is the only list-free
 * response with a documented payload, and `/leads/filter` is the only list with
 * documented keys, so the rest are plausible stand-ins that exercise the
 * defensive row readers.
 */

export const EMPLOYEE_FIXTURE = {
  emp_id: 5,
  firstname: 'Sumeet',
  lastname: 'Khan',
  name: 'Sumeet Khan',
  email: 'employee@franchisepk.com',
  contact: '03171919170',
  image: 'Sumeet.jpeg',
  position: 'Sales Manager',
  emp_special: '0',
};

export const DASHBOARD_FIXTURE = {
  tasks: 14,
  meetings: 6,
  requests: 23,
  companies: 12,
  properties: 9,
};

/* -------------------------------------------------------------------------- */
/*  Leads filter                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `GET /leads/filter/dropdowns` — already in `Option` shape, since that is what
 * the screen's pickers consume and the normaliser produces the same thing.
 * Values are the numeric ids the filter query expects, not slugs.
 */
export const LEAD_FILTER_DROPDOWNS_FIXTURE = {
  cities: [
    { label: 'Lahore', value: '47961' },
    { label: 'Karachi', value: '47962' },
    { label: 'Islamabad', value: '47963' },
    { label: 'Faisalabad', value: '47964' },
  ],
  companies: [
    { label: 'Mr.COD', value: '1115' },
    { label: 'Al-Barka Foods Pvt Ltd', value: '1116' },
    { label: 'Metro Cash & Carry', value: '1117' },
    { label: 'Pakola Beverages', value: '1118' },
  ],
  pipelineStatuses: [
    { id: '1', name: 'New Lead' },
    { id: '2', name: 'Contacted' },
    { id: '3', name: 'Qualified' },
    { id: '4', name: 'Negotiation' },
    { id: '5', name: 'Closed' },
  ],
};

/** `GET /leads/filter` rows, in the documented `e_*` shape. */
export const LEAD_FILTER_ROWS_FIXTURE = [
  {
    e_id: '1421',
    e_firstname: 'Ali',
    e_lastname: 'Khan',
    e_phonenumber: '03001234567',
    e_city: '47961',
    e_co_id: '1115',
    e_date: '12-Oct-2026',
    employee_id: '5',
    deal_done: '0',
    meeting_type: '1',
    pipeline: '2',
    req_comment: 'Called, will follow up',
    co_name: 'Mr.COD',
    city_name: 'Lahore',
  },
  {
    e_id: '1422',
    e_firstname: 'Ayesha',
    e_lastname: 'Malik',
    e_phonenumber: '03215556677',
    e_city: '47962',
    e_co_id: '1117',
    e_date: '09-Oct-2026',
    employee_id: '5',
    deal_done: '1',
    meeting_type: '2',
    pipeline: '4',
    req_comment: 'Agreed to send the fee breakdown',
    co_name: 'Metro Cash & Carry',
    city_name: 'Karachi',
  },
  {
    e_id: '1423',
    e_firstname: 'Bilal',
    e_lastname: 'Ahmed',
    e_phonenumber: '03339998888',
    e_city: '47961',
    e_co_id: '1118',
    e_date: '02-Oct-2026',
    employee_id: '5',
    deal_done: '0',
    meeting_type: '3',
    pipeline: '1',
    // A lead whose company and city rows were deleted — both names arrive null.
    req_comment: 'New enquiry from the website',
    co_name: null,
    city_name: null,
  },
];

export const LEAD_FILTER_META_FIXTURE = {
  total: 87,
  page: 1,
  per_page: 20,
  pages: 5,
};

/* -------------------------------------------------------------------------- */
/*  Follow-ups                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * `GET /followups` rows. The API documents this list as an empty array, so
 * these keys are a stand-in chosen to match the web controller's naming.
 */
export const FOLLOWUPS_FIXTURE = [
  {
    followup_id: '88',
    lead_id: '1421',
    investor: 'Ali Khan',
    phone: '03001234567',
    company: 'Mr.COD',
    city: 'Lahore',
    followup_date: '2026-10-20',
    followup_time: '14:30',
    comment: 'Call back about pricing',
    status: 'active',
    created: '01-Oct-2026',
  },
  {
    followup_id: '89',
    lead_id: '1422',
    investor: 'Ayesha Malik',
    phone: '03215556677',
    company: 'Metro Cash & Carry',
    city: 'Karachi',
    followup_date: '2026-10-22',
    followup_time: '10:00',
    comment: 'Send the franchise agreement',
    status: 'active',
    created: '03-Oct-2026',
  },
  {
    followup_id: '90',
    lead_id: '1423',
    investor: 'Bilal Ahmed',
    phone: '03339998888',
    company: '—',
    city: '—',
    followup_date: '2026-09-28',
    followup_time: '09:15',
    comment: 'First contact attempt, no answer',
    status: 'done',
    created: '20-Sep-2026',
  },
];

/** `GET /followups/bell` — badge count plus the most recent active rows. */
export const FOLLOWUPS_BELL_FIXTURE = {
  followups: FOLLOWUPS_FIXTURE.filter(row => row.status === 'active').slice(0, 2),
  count: 4,
};

/* -------------------------------------------------------------------------- */
/*  Media                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `GET /media` — `all_companies` and `all_media_options`. `option_id` is what
 * the upload endpoint requires, so the option list carries ids as well as names.
 */
export const MEDIA_DROPDOWNS_FIXTURE = {
  all_companies: [
    { co_id: '1115', co_name: 'Mr.COD' },
    { co_id: '1116', co_name: 'Al-Barka Foods Pvt Ltd' },
    { co_id: '1117', co_name: 'Metro Cash & Carry' },
  ],
  all_media_options: [
    { option_id: '1', option_name: 'Brand Logo' },
    { option_id: '2', option_name: 'Store Front' },
    { option_id: '3', option_name: 'Menu' },
    { option_id: '4', option_name: 'Brochure' },
    { option_id: '5', option_name: 'Videos' },
    { option_id: '6', option_name: 'Team Photos' },
    { option_id: '9', option_name: 'Brand Location' },
  ],
};

/** `GET /media/company/:id` — one row per stored file, plus a location row. */
export const COMPANY_MEDIA_FIXTURE = {
  company_id: 1115,
  media_files: [
    {
      media_id: '501',
      company_id: '1115',
      option_id: '1',
      option_name: 'Brand Logo',
      file_name: 'storefront.jpg',
      file_path: 'uploads/company_media/17600000001234567.jpg',
      created: '01-Oct-2026',
    },
    {
      media_id: '502',
      company_id: '1115',
      option_id: '4',
      option_name: 'Brochure',
      file_name: 'franchise-guide.pdf',
      file_path: 'uploads/company_media/17600000009988765.pdf',
      created: '04-Oct-2026',
    },
    {
      media_id: '503',
      company_id: '1115',
      option_id: '9',
      option_name: 'Brand Location',
      file_name: 'Brand Location',
      file_path: 'https://maps.app.goo.gl/mrCODxxxxx',
      created: '06-Oct-2026',
    },
  ],
};

/** `GET /requests/:id` — the lead detail block. */
export const LEAD_DETAIL_FIXTURE = {
  lead_id: 1421,
  requests: {
    e_id: '1421',
    e_firstname: 'Ali',
    e_lastname: 'Khan',
    e_phonenumber: '03001234567',
    e_date: '12-Oct-2026',
    e_city: '47961',
    e_co_id: '1115',
    deal_done: '0',
    meeting_type: '1',
    pipeline: '2',
    req_comment: 'Called, will follow up',
  },
  leads_detail: {
    e_id: '1421',
    investor_budget: '4500000',
    investment_range: '40L - 50L',
    business_type: 'Food & Beverage',
    preferred_city: 'Lahore',
    notes: 'Wants three outlets within two years.',
  },
  comments: [
    {
      comment_id: '201',
      comment: 'Spoke about the royalty structure.',
      created: '12-Oct-2026',
      emp_name: 'Sumeet Khan',
    },
    {
      comment_id: '202',
      comment: 'Send the brochure by email.',
      created: '13-Oct-2026',
      emp_name: 'Sumeet Khan',
    },
  ],
  company: {
    co_id: '1115',
    co_name: 'Mr.COD',
    co_address: 'Main Boulevard, Gulberg, Lahore',
    co_contact: '03001234567',
    co_website: 'https://mrcod.example.com',
  },
  login: {
    emp_id: '5',
    emp_name: 'Sumeet Khan',
    emp_contact: '03171919170',
    emp_email: 'employee@franchisepk.com',
  },
  /** Rows already attached to the lead via `POST /leads/info`. */
  lead_media: [
    {
      img_id: '71',
      title: 'Storefront',
      img_path: 'public/admin/leads/a1b2c3d4e5.jpg',
      created: '12-Oct-2026',
    },
  ],
};