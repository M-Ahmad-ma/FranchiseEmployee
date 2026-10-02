import { API_BASE_URL, USE_MOCK } from '../config';
import { delay } from './utils';

export interface LeadRequestFilters {
  city?: string;
  brand?: string;
  investor?: string;
  comments?: string;
  dealsDone?: string;
  meetingType?: string;
  pipelineStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface LeadRequestRow {
  id: string;
  investor: string;
  phone: string;
  city: string;
  brand: string;
  meetingType: string;
  pipelineStatus: string;
  date: string;
  comments: string;
}

/**
 * Fetch filtered lead requests.
 * Mock returns [] — swap USE_MOCK to false to hit the real endpoint.
 */
export async function fetchRequests(
  filters: LeadRequestFilters,
): Promise<LeadRequestRow[]> {
  if (USE_MOCK) {
    await delay();
    return [];
  }

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  ).toString();

  const res = await fetch(`${API_BASE_URL}/requests?${query}`);
  if (!res.ok) {
    throw new Error('Something went wrong. Please try again.');
  }
  return res.json();
}
