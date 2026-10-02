import { API_BASE_URL, USE_MOCK } from '../config';
import { delay } from './utils';

export interface CompanyMediaFilters {
  company: string;
  mediaType?: string;
}

export interface CompanyMediaRow {
  id: string;
  title: string;
  type: 'image' | 'video' | 'pdf' | 'location';
  url: string;
}

/**
 * Fetch media items for a company (optionally filtered by type).
 * Mock returns [] — swap USE_MOCK to false to hit the real endpoint.
 */
export async function fetchCompanyMedia(
  filters: CompanyMediaFilters,
): Promise<CompanyMediaRow[]> {
  if (USE_MOCK) {
    await delay();
    return [];
  }

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  ).toString();

  const res = await fetch(`${API_BASE_URL}/company-media?${query}`);
  if (!res.ok) {
    throw new Error('Something went wrong. Please try again.');
  }
  return res.json();
}
