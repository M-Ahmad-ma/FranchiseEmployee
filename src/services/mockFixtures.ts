/**
 * Fixtures returned while `USE_MOCK` is true. Field names mirror the shapes
 * documented in TEAM_API_DOCUMENTATION.md — `auth/login` is the only list-free
 * response with a documented payload, so the rest are plausible stand-ins that
 * exercise the defensive row readers.
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

/** `GET /tasks` rows — the API's `status` is 0 open / 1 completed. */
export const TASKS_FIXTURE = [
  {
    id: '12',
    title: 'Follow up Lahore leads',
    status: '0',
    emp_name: 'Sumeet Khan',
    comment: 'Called, no answer',
    date: '01-Oct-2026',
  },
  {
    id: '13',
    title: 'Send revised proposal to Metro Cash',
    status: '0',
    emp_name: 'Sumeet Khan',
    comment: 'Waiting on pricing sign-off',
    date: '03-Oct-2026',
  },
  {
    id: '14',
    title: 'Collect documents from Dreamworld',
    status: '0',
    emp_name: 'Ayesha Siddiqui',
    comment: 'Reception closes at 5pm',
    date: '05-Oct-2026',
  },
  {
    id: '8',
    title: 'Upload brand assets for Pakola',
    status: '1',
    emp_name: 'Sumeet Khan',
    comment: 'Uploaded 6 images',
    date: '28-Sep-2026',
  },
];

export const REQUESTS_FIXTURE = [
  {
    id: '31',
    u_firstname: 'Hamza',
    u_lastname: 'Yousaf',
    investor: 'Hamza Yousaf',
    u_contact: '03001234567',
    city: 'Lahore',
    brand: 'KFC',
    meeting_type: 'In Person',
    pipeline_status: 'New Lead',
    date: '2026-10-01',
    comments: 'Looking to open three outlets',
  },
  {
    id: '32',
    u_firstname: 'Ayesha',
    u_lastname: 'Malik',
    investor: 'Ayesha Malik',
    u_contact: '03215556677',
    city: 'Karachi',
    brand: 'Pizza Hut',
    meeting_type: 'Video Call',
    pipeline_status: 'Contacted',
    date: '2026-10-02',
    comments: 'Follow up after the weekend',
  },
  {
    id: '33',
    u_firstname: 'Bilal',
    u_lastname: 'Ahmed',
    investor: 'Bilal Ahmed',
    u_contact: '03339998888',
    city: 'Lahore',
    brand: 'Subway',
    meeting_type: 'Phone Call',
    pipeline_status: 'Qualified',
    date: '2026-10-04',
    comments: 'Comparing against local brands',
  },
];

export const COMPANIES_FIXTURE = [
  {
    id: '42',
    name: 'Al-Barka Foods Pvt Ltd',
    category: 'Restaurant',
    city: 'Lahore',
  },
  { id: '43', name: 'Metro Cash & Carry', category: 'Retail', city: 'Karachi' },
  {
    id: '44',
    name: 'Dreamworld Resorts',
    category: 'Hospitality',
    city: 'Islamabad',
  },
  { id: '45', name: 'Pakola Beverages', category: 'FMCG', city: 'Lahore' },
];
