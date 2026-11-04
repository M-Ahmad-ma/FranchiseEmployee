import { USE_MOCK } from '../config';
import { get, onSessionCleared, postForm } from './httpClient';
import { delay, pickString } from './utils';
import type { Option } from './utils';

/**
 * Generic read/write helpers for the Team API modules that only expose a list
 * plus optional create/update/delete endpoints.
 *
 * The documentation shows most list responses as `[]`, so the row shapes are
 * not guaranteed. `buildRow` keeps every screen useful even when a field moves:
 * it reads the best-known keys first and then falls back to the row's own
 * primitive fields for display.
 */

export interface ModuleRow {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  raw: Record<string, unknown>;
  /**
   * Computed lazily. A 1,500-row list must not build card details and edit
   * values for every row up front — only the rows actually painted or opened.
   */
  readonly details: Array<{ label: string; value: string }>;
  /** Values used to pre-fill the edit form, keyed by API field name. */
  readonly values: Record<string, string>;
}

interface ModuleRowInternal extends ModuleRow {
  valueKeys: Record<string, string[]>;
}

export interface RowSpec {
  idKeys: string[];
  titleKeys: string[];
  subtitleKeys?: string[];
  /** Fields already represented by the title/subtitle, so they are not repeated. */
  excludeKeys?: string[];
}

const HUMAN_LABELS: Record<string, string> = {
  co_id: 'Company ID',
  company_id: 'Company ID',
  brand_id: 'Brand ID',
  category_id: 'Category',
  city_id: 'City',
  country_id: 'Country',
  option_id: 'Media type',
  option_name: 'Media type',
  u_firstname: 'First name',
  u_lastname: 'Last name',
  u_email: 'Email',
  u_contact: 'Contact',
  u_company: 'Company',
  e_firstname: 'First name',
  e_lastname: 'Last name',
  e_phonenumber: 'Phone',
  e_emailaddress: 'Email',
  e_co_id: 'Company ID',
  e_date: 'Date',
  req_comment: 'Comment',
  request_id: 'Lead ID',
  lead_id: 'Lead ID',
  meeting_date: 'Date',
  meeting_time: 'Time',
  meeting_type: 'Type',
  meeting_status: 'Status',
  meeting_venue: 'Venue',
  meetiing_desc: 'Description',
  j_brandName: 'Brand',
  j_jobTitle: 'Job title',
  j_salary: 'Salary',
  j_qualification: 'Qualification',
  file_path: 'File',
  file_name: 'File name',
  created_at: 'Created',
};

export function humanizeKey(key: string): string {
  if (HUMAN_LABELS[key]) {
    return HUMAN_LABELS[key];
  }
  const words = key
    .replace(/^[a-z]_/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return words
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function printable(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    return '';
  }
  return String(value).trim();
}

function firstPrinted(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = printable(row[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

/** Builds a card row while preserving the raw record for edit pre-fill. */
export function buildRow(
  raw: Record<string, unknown>,
  spec: RowSpec,
): ModuleRow {
  const excluded = new Set([
    ...spec.idKeys,
    ...spec.titleKeys,
    ...(spec.subtitleKeys ?? []),
    ...(spec.excludeKeys ?? []),
  ]);
  const id = firstPrinted(raw, [...spec.idKeys, 'id']);
  let title = firstPrinted(raw, spec.titleKeys);
  let subtitle = spec.subtitleKeys
    ? firstPrinted(raw, spec.subtitleKeys)
    : undefined;

  if (!title) {
    // A field rename should still produce a readable card rather than a blank
    // one. Pick the first useful short string that is not an id.
    title =
      Object.entries(raw)
        .filter(([key, value]) => {
          if (excluded.has(key)) {
            return false;
          }
          const text = printable(value);
          return text.length > 0 && text.length <= 80;
        })
        .map(([, value]) => printable(value))[0] ?? 'Record';
  }

  if (!subtitle) {
    subtitle = firstPrinted(raw, ['email', 'u_email', 'co_name', 'city_name']);
  }

  let computedDetails: Array<{ label: string; value: string }> | null = null;
  const valueKeys: Record<string, string[]> = {};

  const row = {
    id,
    title,
    subtitle: subtitle || undefined,
    raw,
    valueKeys,
    get details() {
      if (computedDetails) {
        return computedDetails;
      }
      computedDetails = Object.entries(raw)
        .filter(([key, value]) => {
          if (excluded.has(key)) {
            return false;
          }
          const text = printable(value);
          return text.length > 0 && text !== title && text !== subtitle;
        })
        .slice(0, 6)
        .map(([key, value]) => ({
          label: humanizeKey(key),
          value: printable(value),
        }));
      return computedDetails;
    },
    get values() {
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        const text = printable(value);
        if (text) {
          values[key] = text;
        }
      }
      for (const [field, keys] of Object.entries(valueKeys)) {
        const value = pickString(raw, keys);
        if (value) {
          values[field] = value;
        }
      }
      return values;
    },
  };

  return row as ModuleRowInternal;
}

function rowsFrom(
  data: Record<string, unknown> | null | undefined,
  key: string,
  spec: RowSpec,
): ModuleRow[] {
  const value = data?.[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === 'object' && !Array.isArray(row),
    )
    .map(row => buildRow(row, spec));
}

/**
 * A list response can take seconds and contain 1,500+ rows. Keep the built
 * rows for a short window so drawer switches do not refetch the exact same
 * payload. Pull-to-refresh calls the service with `force` and bypasses this.
 */
export const MODULE_LIST_CACHE_MS = 60_000;

const listCache = new Map<string, { rows: ModuleRow[]; at: number }>();
const listInFlight = new Map<string, Promise<ModuleRow[]>>();

export function clearModuleListCache() {
  listCache.clear();
  listInFlight.clear();
  companiesCache = null;
  companiesInFlight = null;
}

onSessionCleared(clearModuleListCache);

async function readList(
  path: string,
  key: string,
  spec: RowSpec,
  force = false,
): Promise<ModuleRow[]> {
  if (USE_MOCK) {
    await delay();
    return [];
  }

  const cacheKey = `${path}|${key}`;
  const cached = listCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.at < MODULE_LIST_CACHE_MS) {
    return cached.rows;
  }
  if (!force) {
    const pending = listInFlight.get(cacheKey);
    if (pending) {
      return pending;
    }
  }

  const promise = get<Record<string, unknown>>(path)
    .then(data => {
      const rows = rowsFrom(data, key, spec);
      listCache.set(cacheKey, { rows, at: Date.now() });
      listInFlight.delete(cacheKey);
      return rows;
    })
    .catch(error => {
      listInFlight.delete(cacheKey);
      throw error;
    });

  listInFlight.set(cacheKey, promise);
  return promise;
}

function withValues(
  row: ModuleRow,
  overrides: Record<string, string[]>,
): ModuleRow {
  const internal = row as ModuleRowInternal;
  // Mutate the existing object: the `values` getter closes over this exact map,
  // so replacing the property would leave the getter reading the empty original.
  Object.assign(internal.valueKeys, overrides);
  return internal;
}

/* -------------------------------------------------------------------------- */
/*  Brands                                                                     */
/* -------------------------------------------------------------------------- */

const BRAND_SPEC: RowSpec = {
  idKeys: ['brand_id', 'b_id', 'id'],
  titleKeys: ['name', 'brand_name', 'b_name'],
  subtitleKeys: ['category_name', 'city_name'],
  excludeKeys: ['type'],
};

export async function fetchBrands(force = false): Promise<ModuleRow[]> {
  const rows = await readList('brands', 'brands', BRAND_SPEC, force);
  return rows.map(row =>
    withValues(row, {
      name: ['name', 'brand_name', 'b_name'],
      category_id: ['category_id', 'cat_id', 'p_category'],
      city_id: ['city_id', 'c_id', 'e_city'],
    }),
  );
}

export const createBrand = (values: Record<string, string>) =>
  postForm<boolean>('brands/create', values);

export const updateBrand = (id: string, values: Record<string, string>) =>
  postForm<boolean>(`brands/${encodeURIComponent(id)}/update`, values);

/* -------------------------------------------------------------------------- */
/*  Properties                                                                 */
/* -------------------------------------------------------------------------- */

const PROPERTY_SPEC: RowSpec = {
  idKeys: ['property_id', 'prop_id', 'p_id', 'id'],
  titleKeys: ['pName', 'p_name', 'name', 'property_name'],
  subtitleKeys: ['Pcity', 'p_city', 'city_name'],
  excludeKeys: ['categories'],
};

export async function fetchProperties(force = false): Promise<ModuleRow[]> {
  const rows = await readList('properties', 'property', PROPERTY_SPEC, force);
  return rows.map(row =>
    withValues(row, {
      pName: ['pName', 'p_name', 'name', 'property_name'],
      pEmail: ['pEmail', 'p_email', 'email'],
      pPhone: ['pPhone', 'p_phone', 'phone', 'contact'],
      Pcity: ['Pcity', 'p_city', 'city', 'city_name'],
    }),
  );
}

export const createProperty = (values: Record<string, string>) =>
  postForm<boolean>('properties/create', values);

/* -------------------------------------------------------------------------- */
/*  Reports                                                                    */
/* -------------------------------------------------------------------------- */

const REPORT_SPEC: RowSpec = {
  idKeys: ['report_id', 'r_id', 'id'],
  titleKeys: ['title', 'report_title', 'name'],
  subtitleKeys: ['description', 'report_description'],
  excludeKeys: ['type'],
};

export async function fetchReports(force = false): Promise<ModuleRow[]> {
  return readList('reports', 'reports', REPORT_SPEC, force);
}

export const createReport = (values: Record<string, string>) =>
  postForm<boolean>('reports/create', values);

/* -------------------------------------------------------------------------- */
/*  Jobs                                                                       */
/* -------------------------------------------------------------------------- */

const JOB_SPEC: RowSpec = {
  idKeys: ['job_id', 'j_id', 'id'],
  titleKeys: ['j_jobTitle', 'job_title', 'title'],
  subtitleKeys: ['j_brandName', 'brand_name', 'company'],
  excludeKeys: ['categories'],
};

export async function fetchJobs(force = false): Promise<ModuleRow[]> {
  const rows = await readList('jobs', 'jobs', JOB_SPEC, force);
  return rows.map(row =>
    withValues(row, {
      j_brandName: ['j_brandName', 'j_brand_name', 'brand_name', 'company'],
      j_jobTitle: ['j_jobTitle', 'j_job_title', 'job_title', 'title'],
      j_salary: ['j_salary', 'salary'],
      j_qualification: ['j_qualification', 'qualification'],
    }),
  );
}

export const createJob = (values: Record<string, string>) =>
  postForm<boolean>('jobs/create', values);

export const updateJob = (id: string, values: Record<string, string>) =>
  postForm<boolean>(`jobs/${encodeURIComponent(id)}/update`, values);

export const deleteJob = (id: string) =>
  postForm<boolean>(`jobs/${encodeURIComponent(id)}/delete`, {});

/* -------------------------------------------------------------------------- */
/*  Events                                                                     */
/* -------------------------------------------------------------------------- */

const EVENT_SPEC: RowSpec = {
  idKeys: ['event_id', 'e_id', 'id'],
  titleKeys: ['title', 'event_title', 'name'],
  subtitleKeys: ['venue', 'event_venue'],
  excludeKeys: ['categories'],
};

export async function fetchEvents(force = false): Promise<ModuleRow[]> {
  const rows = await readList('events', 'events', EVENT_SPEC, force);
  return rows.map(row =>
    withValues(row, {
      title: ['title', 'event_title', 'name'],
      date: ['date', 'event_date'],
      venue: ['venue', 'event_venue'],
    }),
  );
}

export const createEvent = (values: Record<string, string>) =>
  postForm<boolean>('events/create', values);

/* -------------------------------------------------------------------------- */
/*  Companies                                                                  */
/* -------------------------------------------------------------------------- */

export interface CompanyOptions {
  countries: Option[];
  categories: Option[];
}

export interface CompaniesResult {
  rows: ModuleRow[];
  options: CompanyOptions;
}

function optionsFrom(
  rows: unknown,
  idKeys: string[],
  labelKeys: string[],
): Option[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === 'object',
    )
    .map(row => ({
      value: pickString(row, idKeys),
      label: pickString(row, labelKeys),
    }))
    .filter(option => option.value !== '' && option.label !== '');
}

const COMPANY_SPEC: RowSpec = {
  idKeys: ['co_id', 'company_id', 'id'],
  titleKeys: ['co_name', 'company_name', 'name'],
  subtitleKeys: ['city_name', 'country_name'],
  excludeKeys: ['countries', 'categories', 'type'],
};

let companiesCache: { result: CompaniesResult; at: number } | null = null;
let companiesInFlight: Promise<CompaniesResult> | null = null;

export async function fetchCompanies(force = false): Promise<CompaniesResult> {
  if (USE_MOCK) {
    await delay();
    return { rows: [], options: { countries: [], categories: [] } };
  }

  if (
    !force &&
    companiesCache &&
    Date.now() - companiesCache.at < MODULE_LIST_CACHE_MS
  ) {
    return companiesCache.result;
  }
  if (!force && companiesInFlight) {
    return companiesInFlight;
  }

  companiesInFlight = get<Record<string, unknown>>('companies')
    .then(data => {
      const result: CompaniesResult = {
        rows: rowsFrom(data, 'companies', COMPANY_SPEC).map(row =>
          withValues(row, {
            name: ['name', 'co_name', 'company_name'],
            category_id: ['category_id', 'cat_id'],
            country_id: ['country_id', 'c_id'],
            city_id: ['city_id', 'city'],
          }),
        ),
        options: {
          countries: optionsFrom(data?.countries, ['id', 'country_id'], [
            'name',
            'country_name',
          ]),
          categories: optionsFrom(data?.categories, ['id', 'category_id'], [
            'name',
            'category_name',
          ]),
        },
      };
      companiesCache = { result, at: Date.now() };
      companiesInFlight = null;
      return result;
    })
    .catch(error => {
      companiesInFlight = null;
      throw error;
    });

  return companiesInFlight;
}

/** `GET /companies/:id/edit` also returns the dropdown sources. */
export async function fetchCompanyEdit(id: string): Promise<{
  values: Record<string, string>;
  options: CompanyOptions;
}> {
  if (USE_MOCK) {
    await delay();
    return { values: {}, options: { countries: [], categories: [] } };
  }
  const data = await get<Record<string, unknown>>(
    `companies/${encodeURIComponent(id)}/edit`,
  );
  const company =
    data?.company && typeof data.company === 'object'
      ? (data.company as Record<string, unknown>)
      : {};
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(company)) {
    if (value === null || value === undefined || typeof value === 'object') {
      continue;
    }
    values[key] = String(value);
  }
  values.name =
    pickString(company, ['name', 'co_name', 'company_name']) || values.name || '';
  values.category_id =
    pickString(company, ['category_id', 'cat_id']) || values.category_id || '';
  values.country_id =
    pickString(company, ['country_id', 'c_id']) || values.country_id || '';
  values.city_id =
    pickString(company, ['city_id', 'city']) || values.city_id || '';
  return {
    values,
    options: {
      countries: optionsFrom(data?.countries, ['id', 'country_id'], [
        'name',
        'country_name',
      ]),
      categories: optionsFrom(data?.categories, ['id', 'category_id'], [
        'name',
        'category_name',
      ]),
    },
  };
}

export const createCompany = (values: Record<string, string>) =>
  postForm<{ company_id?: number }>('companies/create', values);

export const updateCompany = (id: string, values: Record<string, string>) =>
  postForm<boolean>(`companies/${encodeURIComponent(id)}/update`, values);

/* -------------------------------------------------------------------------- */
/*  Users                                                                      */
/* -------------------------------------------------------------------------- */

const USER_SPEC: RowSpec = {
  idKeys: ['u_id', 'user_id', 'id'],
  titleKeys: ['u_firstname', 'firstname', 'name'],
  subtitleKeys: ['u_email', 'email'],
  excludeKeys: ['categories', 'password'],
};

export async function fetchUsers(force = false): Promise<ModuleRow[]> {
  const rows = await readList('users', 'users', USER_SPEC, force);
  return rows.map(row =>
    withValues(row, {
      fname: ['u_firstname', 'firstname', 'fname'],
      lname: ['u_lastname', 'lastname', 'lname'],
      User_email: ['u_email', 'email', 'User_email'],
      contact: ['u_contact', 'contact'],
      company: ['u_company', 'company'],
      bio: ['u_bio', 'bio'],
      image: ['u_image']
    }),
  );
}

export const updateUser = (id: string, values: Record<string, string>) =>
  postForm<boolean>(`users/${encodeURIComponent(id)}/update`, {
    ...values,
    User_email: values.User_email ?? values.email,
  });

/* -------------------------------------------------------------------------- */
/*  Read-only modules                                                          */
/* -------------------------------------------------------------------------- */

const DOWNLOAD_SPEC: RowSpec = {
  idKeys: ['download_id', 'd_id', 'id'],
  titleKeys: ['title', 'name', 'file_name'],
  subtitleKeys: ['category_name', 'description'],
  excludeKeys: ['categories'],
};

export async function fetchDownloads(force = false): Promise<ModuleRow[]> {
  return readList('downloads', 'download', DOWNLOAD_SPEC, force);
}

const FRANCHISE_SPEC: RowSpec = {
  idKeys: ['franchise_id', 'f_id', 'id'],
  titleKeys: ['name', 'title', 'franchise_name'],
  subtitleKeys: ['city_name', 'category_name'],
  excludeKeys: ['categories'],
};

export async function fetchFranchise(force = false): Promise<ModuleRow[]> {
  return readList('franchise', 'franchise', FRANCHISE_SPEC, force);
}

const ADVERT_SPEC: RowSpec = {
  idKeys: ['ads_id', 'ad_id', 'advert_id', 'id'],
  titleKeys: ['title', 'name', 'ad_title'],
  subtitleKeys: ['company_name', 'category_name'],
  excludeKeys: ['categories'],
};

export async function fetchAdvertisements(force = false): Promise<ModuleRow[]> {
  return readList('advertisements', 'adverts', ADVERT_SPEC, force);
}

const SUBSCRIBER_SPEC: RowSpec = {
  idKeys: ['sub_id', 'subscriber_id', 'id'],
  titleKeys: ['email', 'sub_email', 'name'],
  subtitleKeys: ['name', 'created'],
  excludeKeys: ['categories'],
};

export async function fetchSubscribers(force = false): Promise<ModuleRow[]> {
  return readList('subscribers', 'subs', SUBSCRIBER_SPEC, force);
}

const SHOW_SPEC: RowSpec = {
  idKeys: ['show_id', 's_id', 'id'],
  titleKeys: ['title', 'name', 'show_name', 'brand_name'],
  subtitleKeys: ['venue', 'city_name'],
};

export async function fetchShows(
  city: string,
  force = false,
): Promise<ModuleRow[]> {
  return readList(
    `shows/${encodeURIComponent(city)}`,
    'show',
    SHOW_SPEC,
    force,
  );
}

/* -------------------------------------------------------------------------- */
/*  Requests                                                                   */
/* -------------------------------------------------------------------------- */

const LEAD_SPEC: RowSpec = {
  idKeys: ['e_id', 'lead_id', 'id'],
  titleKeys: ['e_firstname', 'investor', 'name'],
  subtitleKeys: ['e_emailaddress', 'e_phonenumber', 'co_name'],
  excludeKeys: ['categories', 'req_comment'],
};

function addLeadValues(row: ModuleRow): ModuleRow {
  const first = pickString(row.raw, ['e_firstname', 'firstname']);
  const last = pickString(row.raw, ['e_lastname', 'lastname']);
  const internal = row as ModuleRowInternal;
  internal.title = [first, last].filter(Boolean).join(' ') || row.title;
  internal.subtitle =
    pickString(row.raw, ['co_name', 'e_emailaddress']) || row.subtitle;
  Object.assign(internal.valueKeys, {
    e_id: ['e_id', 'lead_id', 'id'],
    e_co_id: ['e_co_id', 'co_id'],
  });
  return internal;
}

export async function fetchAssignedRequests(
  force = false,
): Promise<ModuleRow[]> {
  const rows = await readList(
    'requests',
    'requests',
    LEAD_SPEC,
    force,
  );
  return rows.map(addLeadValues);
}

export async function fetchInvestorRequests(
  force = false,
): Promise<ModuleRow[]> {
  const rows = await readList(
    'investor-requests',
    'investrequests',
    LEAD_SPEC,
    force,
  );
  return rows.map(addLeadValues);
}
