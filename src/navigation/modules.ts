import React from 'react';
import {
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  Filter,
  Images,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Mail,
  MapPin,
  Megaphone,
  PhoneCall,
  Store,
  Tag,
  Users,
} from 'lucide-react-native';
import { P } from '../services/permissions';
import {
  createBrand,
  createCompany,
  createEvent,
  createJob,
  createProperty,
  createReport,
  deleteJob,
  fetchAdvertisements,
  fetchAssignedRequests,
  fetchBrands,
  fetchCompanies,
  fetchCompanyEdit,
  fetchDownloads,
  fetchEvents,
  fetchFranchise,
  fetchInvestorRequests,
  fetchJobs,
  fetchProperties,
  fetchReports,
  fetchShows,
  fetchSubscribers,
  fetchUsers,
  updateBrand,
  updateCompany,
  updateJob,
  updateUser,
} from '../services/moduleService';
import type {
  ModuleConfig,
  ModuleGroup,
  ModuleRoute,
} from './types';

export type SidebarIcon = React.ComponentType<{
  size?: number;
  color?: string;
}>;

export interface SidebarEntry {
  key: string;
  screen: ModuleRoute | 'Home' | 'Requests' | 'FollowUps' | 'CompanyMedia' | 'Tasks' | 'Meetings';
  label: string;
  hint: string;
  group: ModuleGroup;
  Icon: SidebarIcon;
  /** Shown when the employee has any of these permissions. */
  view: string[];
}

export const MODULE_CONFIGS: Record<ModuleRoute, ModuleConfig> = {
  Brands: {
    route: 'Brands',
    label: 'Brands',
    hint: 'Browse, add and edit brands',
    group: 'Directory',
    view: [P.brandsView],
    create: [P.brandsAdd],
    edit: [P.brandsEdit],
    load: fetchBrands,
    createFn: createBrand,
    updateFn: updateBrand,
    emptyMessage: 'No brands found.',
    detailTitle: 'Brand',
    fields: [
      { key: 'name', label: 'Brand name', required: true },
      { key: 'category_id', label: 'Category ID', type: 'number' },
      { key: 'city_id', label: 'City ID', type: 'number' },
    ],
  },

  Properties: {
    route: 'Properties',
    label: 'Properties',
    hint: 'Property enquiries and listings',
    group: 'Directory',
    view: [P.propertiesView],
    create: [P.propertiesAdd],
    load: fetchProperties,
    createFn: createProperty,
    emptyMessage: 'No properties found.',
    presentation: {
      summary: [
        { label: 'Email', keys: ['pEmail', 'p_email', 'email'] },
        { label: 'Phone', keys: ['pPhone', 'p_phone', 'phone', 'contact'] },
        { label: 'City', keys: ['Pcity', 'p_city', 'city', 'city_name'] },
      ],
      searchKeys: [
        'pName',
        'p_name',
        'name',
        'pEmail',
        'email',
        'pPhone',
        'phone',
        'Pcity',
        'city',
      ],
    },
    fields: [
      { key: 'pName', label: 'Property name', required: true },
      { key: 'pEmail', label: 'Email', type: 'text' },
      { key: 'pPhone', label: 'Phone', type: 'text' },
      { key: 'Pcity', label: 'City', type: 'text' },
    ],
  },

  Reports: {
    route: 'Reports',
    label: 'Reports',
    hint: 'Team reports and summaries',
    group: 'Work',
    view: [P.reportsView],
    create: [P.reportsAdd],
    load: fetchReports,
    createFn: createReport,
    emptyMessage: 'No reports found.',
    presentation: {
      descriptionKeys: ['description', 'report_description'],
      searchKeys: ['title', 'report_title', 'name', 'description'],
    },
    fields: [
      { key: 'title', label: 'Report title', required: true },
      { key: 'description', label: 'Description', type: 'multiline' },
    ],
  },

  Jobs: {
    route: 'Jobs',
    label: 'Jobs',
    hint: 'Job openings and hiring',
    group: 'Work',
    view: [P.jobsView],
    create: [P.jobsAdd],
    edit: [P.jobsEdit],
    delete: [P.jobsDelete],
    load: fetchJobs,
    createFn: createJob,
    updateFn: updateJob,
    deleteFn: deleteJob,
    emptyMessage: 'No jobs found.',
    presentation: {
      summary: [
        {
          label: 'Brand',
          keys: ['j_brandName', 'j_brand_name', 'brand_name', 'company'],
        },
        { label: 'Salary', keys: ['j_salary', 'salary'] },
        {
          label: 'Qualification',
          keys: ['j_qualification', 'qualification'],
        },
      ],
      searchKeys: [
        'j_jobTitle',
        'job_title',
        'title',
        'j_brandName',
        'brand_name',
        'j_qualification',
      ],
    },
    fields: [
      { key: 'j_brandName', label: 'Brand name', required: true },
      { key: 'j_jobTitle', label: 'Job title', required: true },
      { key: 'j_salary', label: 'Salary', type: 'number' },
      { key: 'j_qualification', label: 'Qualification', type: 'text' },
    ],
  },

  Events: {
    route: 'Events',
    label: 'Events',
    hint: 'Events and expos',
    group: 'Content',
    view: [P.eventsView],
    create: [P.eventsAdd],
    load: fetchEvents,
    createFn: createEvent,
    emptyMessage: 'No events found.',
    presentation: {
      summary: [
        { label: 'Date', keys: ['date', 'event_date'] },
        { label: 'Venue', keys: ['venue', 'event_venue'] },
      ],
      searchKeys: ['title', 'event_title', 'name', 'venue', 'date'],
    },
    fields: [
      { key: 'title', label: 'Event title', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'venue', label: 'Venue', required: true },
    ],
  },

  Companies: {
    route: 'Companies',
    label: 'Companies',
    hint: 'Company directory',
    group: 'Directory',
    view: [P.companiesView],
    create: [P.companiesAdd],
    edit: [P.companiesEdit],
    load: async (force?: boolean) => (await fetchCompanies(force)).rows,
    loadOptions: async () => {
      const { options } = await fetchCompanies();
      return { countries: options.countries, categories: options.categories };
    },
    loadEdit: async id => {
      const { values, options } = await fetchCompanyEdit(id);
      return { values, options: { countries: options.countries, categories: options.categories } };
    },
    createFn: createCompany,
    updateFn: updateCompany,
    emptyMessage: 'No companies found.',
    fields: [
      { key: 'name', label: 'Company name', required: true },
      {
        key: 'category_id',
        label: 'Category',
        type: 'select',
        optionsKey: 'categories',
      },
      {
        key: 'country_id',
        label: 'Country',
        type: 'select',
        optionsKey: 'countries',
      },
      { key: 'city_id', label: 'City ID', type: 'number' },
    ],
  },

  Users: {
    route: 'Users',
    label: 'Users',
    hint: 'Site users and accounts',
    group: 'Directory',
    view: [P.usersView],
    edit: [P.usersEdit],
    load: fetchUsers,
    updateFn: updateUser,
    emptyMessage: 'No users found.',
    fields: [
      { key: 'fname', label: 'First name', required: true },
      { key: 'lname', label: 'Last name', required: true },
      { key: 'User_email', label: 'Email', required: true },
      { key: 'contact', label: 'Contact', required: true },
      { key: 'company', label: 'Company' },
      { key: 'bio', label: 'Bio', type: 'multiline' },
      { key: 'password', label: 'New password', type: 'text' },
    ],
  },

  Downloads: {
    route: 'Downloads',
    label: 'Downloads',
    hint: 'Downloadable resources',
    group: 'Content',
    view: [P.downloadsView],
    load: fetchDownloads,
    emptyMessage: 'No downloads found.',
    presentation: {
      summary: [{ label: 'Category', keys: ['category_name', 'category'] }],
      descriptionKeys: ['description', 'desc'],
      searchKeys: ['title', 'name', 'file_name', 'category_name'],
    },
  },

  Franchise: {
    route: 'Franchise',
    label: 'Franchise',
    hint: 'Franchise listings',
    group: 'Content',
    view: [P.resaleView],
    load: fetchFranchise,
    emptyMessage: 'No franchise listings found.',
    presentation: {
      summary: [
        { label: 'City', keys: ['city_name', 'city'] },
        { label: 'Category', keys: ['category_name', 'category'] },
      ],
      descriptionKeys: ['description', 'desc'],
      searchKeys: ['name', 'title', 'franchise_name', 'city_name', 'category_name'],
    },
  },

  Advertisements: {
    route: 'Advertisements',
    label: 'Advertisements',
    hint: 'Published adverts',
    group: 'Content',
    view: [P.adsView],
    load: fetchAdvertisements,
    emptyMessage: 'No advertisements found.',
    presentation: {
      summary: [
        { label: 'Company', keys: ['company_name', 'company'] },
        { label: 'Category', keys: ['category_name', 'category'] },
      ],
      descriptionKeys: ['description', 'desc'],
      searchKeys: ['title', 'name', 'ad_title', 'company_name', 'category_name'],
    },
  },

  Subscribers: {
    route: 'Subscribers',
    label: 'Subscribers',
    hint: 'Newsletter subscribers',
    group: 'Content',
    view: [P.subscribersView],
    load: fetchSubscribers,
    emptyMessage: 'No subscribers found.',
    presentation: {
      summary: [
        { label: 'Name', keys: ['name', 'sub_name'] },
        { label: 'Subscribed', keys: ['created', 'created_at', 'date'] },
      ],
      searchKeys: ['email', 'sub_email', 'name', 'created'],
    },
  },

  AssignedRequests: {
    route: 'AssignedRequests',
    label: 'Assigned Leads',
    hint: 'Leads assigned to you',
    group: 'CRM',
    view: [P.leadsList],
    load: fetchAssignedRequests,
    emptyMessage: 'No assigned leads found.',
    opensLead: true,
    presentation: {
      summary: [
        { label: 'Phone', keys: ['e_phonenumber', 'phone', 'contact'] },
        { label: 'Company', keys: ['co_name', 'brand', 'company_name'] },
        { label: 'Date', keys: ['e_date', 'date'] },
        { label: 'Stage', keys: ['pipeline', 'pipeline_name'] },
      ],
      descriptionKeys: ['req_comment', 'comment'],
      searchKeys: [
        'e_firstname',
        'e_lastname',
        'e_phonenumber',
        'co_name',
        'e_emailaddress',
      ],
    },
  },

  InvestorRequests: {
    route: 'InvestorRequests',
    label: 'Investor Requests',
    hint: 'Investor enquiries',
    group: 'CRM',
    view: [P.leadsList],
    load: fetchInvestorRequests,
    emptyMessage: 'No investor requests found.',
    opensLead: true,
    presentation: {
      summary: [
        { label: 'Phone', keys: ['e_phonenumber', 'phone', 'contact'] },
        { label: 'Company', keys: ['co_name', 'brand', 'company_name'] },
        { label: 'Date', keys: ['e_date', 'date'] },
        { label: 'Stage', keys: ['pipeline', 'pipeline_name'] },
      ],
      descriptionKeys: ['req_comment', 'comment', 'e_message', 'message'],
      searchKeys: [
        'e_firstname',
        'e_lastname',
        'e_phonenumber',
        'co_name',
        'e_emailaddress',
      ],
    },
  },

  Shows: {
    route: 'Shows',
    label: 'Shows',
    hint: 'Shows by city',
    group: 'Content',
    view: [P.showsView],
    load: () => Promise.resolve([]),
    emptyMessage: 'Enter a city to load its shows.',
    requiresCity: true,
    presentation: {
      summary: [
        { label: 'Venue', keys: ['venue', 'show_venue'] },
        { label: 'City', keys: ['city_name', 'city'] },
        { label: 'Date', keys: ['date', 'show_date'] },
      ],
      searchKeys: ['title', 'name', 'show_name', 'venue', 'city_name'],
    },
  },
};

/**
 * `Shows` is a special case: it needs a city path segment before it can load.
 * The screen handles that by calling `fetchShows(city)` itself.
 */
export const SHOWS_LOADER = fetchShows;

export const CORE_SIDEBAR_ENTRIES: SidebarEntry[] = [
  {
    key: 'home',
    screen: 'Home',
    label: 'Dashboard',
    hint: 'Overview & priorities',
    group: 'Overview',
    Icon: LayoutDashboard,
    view: [P.dashboardView],
  },
  {
    key: 'leads-filter',
    screen: 'Requests',
    label: 'Leads Filter',
    hint: 'Filter & qualify leads',
    group: 'CRM',
    Icon: Filter,
    view: [P.leadsView],
  },
  {
    key: 'followups',
    screen: 'FollowUps',
    label: 'Lead Follow-ups',
    hint: 'Leads to chase',
    group: 'CRM',
    Icon: PhoneCall,
    view: [P.followupsView],
  },
  {
    key: 'meetings',
    screen: 'Meetings',
    label: 'Meetings',
    hint: 'Team and brand meetings',
    group: 'CRM',
    Icon: CalendarClock,
    view: [P.meetingsView, P.brandsView],
  },
  {
    key: 'tasks',
    screen: 'Tasks',
    label: 'Tasks',
    hint: 'Assigned work items',
    group: 'Work',
    Icon: ListTodo,
    view: [P.tasksView],
  },
  {
    key: 'company-media',
    screen: 'CompanyMedia',
    label: 'Company Media',
    hint: 'Images, videos & PDFs',
    group: 'Content',
    Icon: Images,
    view: [P.companyMediaView],
  },
];

export const MODULE_SIDEBAR_ENTRIES: SidebarEntry[] = Object.values(
  MODULE_CONFIGS,
).map(config => ({
  key: config.route,
  screen: config.route,
  label: config.label,
  hint: config.hint,
  group: config.group,
  Icon: moduleIcon(config.route),
  view: config.view,
}));

function moduleIcon(route: ModuleRoute): SidebarIcon {
  switch (route) {
    case 'Brands':
      return Tag;
    case 'Properties':
      return MapPin;
    case 'Reports':
      return ClipboardList;
    case 'Jobs':
      return Briefcase;
    case 'Events':
      return CalendarDays;
    case 'Companies':
      return Building2;
    case 'Users':
      return Users;
    case 'Downloads':
      return Download;
    case 'Franchise':
      return Store;
    case 'Advertisements':
      return Megaphone;
    case 'Subscribers':
      return Mail;
    case 'AssignedRequests':
      return Inbox;
    case 'InvestorRequests':
      return FileText;
    case 'Shows':
      return CalendarDays;
    default:
      return FileText;
  }
}

export const GROUP_ORDER: ModuleGroup[] = [
  'Overview',
  'CRM',
  'Directory',
  'Work',
  'Content',
];

export const ALL_SIDEBAR_ENTRIES: SidebarEntry[] = [
  ...CORE_SIDEBAR_ENTRIES,
  ...MODULE_SIDEBAR_ENTRIES,
];
