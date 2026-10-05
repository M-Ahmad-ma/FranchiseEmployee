import { USE_MOCK } from '../config';
import { delay, pickString } from './utils';
import { get } from './httpClient';
import { COMPANIES_FIXTURE } from './mockFixtures';

export interface CompanyRow {
  id: string;
  name: string;
  category: string;
  city: string;
}

function normalizeCompany(row: Record<string, unknown>): CompanyRow {
  return {
    id: pickString(row, ['id', 'company_id', 'u_id']),
    name: pickString(row, ['name', 'company_name', 'company']),
    category: pickString(row, ['category', 'category_name']),
    city: pickString(row, ['city', 'city_name']),
  };
}

/**
 * GET /api/team/companies — the company list plus dropdown sources.
 *
 * Note: this is the only company-related endpoint in use. The create/update/
 * edit routes exist on the API but have no screen, so they are not wired.
 *
 * Set USE_MOCK to false to hit the real endpoint.
 */
export async function fetchCompanies(): Promise<CompanyRow[]> {
  if (USE_MOCK) {
    await delay();
    return COMPANIES_FIXTURE.map(row =>
      normalizeCompany(row as Record<string, unknown>),
    );
  }

  const data = await get<{ companies?: Record<string, unknown>[] }>(
    'companies',
  );

  return (data?.companies ?? []).map(normalizeCompany);
}
