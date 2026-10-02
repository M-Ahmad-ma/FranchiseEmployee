import { API_BASE_URL, USE_MOCK } from '../config';
import { delay } from './utils';

export type FollowUpTab = 'active' | 'upcoming' | 'done' | 'all';

export interface FollowUpRow {
  id: string;
  date: string;
  time: string;
  lead: string;
  phone: string;
  comment: string;
  status: 'Due' | 'Overdue' | 'Upcoming' | 'Done';
}

/**
 * Fetch follow-ups for the selected tab.
 * Mock returns [] — swap USE_MOCK to false to hit the real endpoint.
 */
export async function fetchFollowUps(
  tab: FollowUpTab,
): Promise<FollowUpRow[]> {
  if (USE_MOCK) {
    await delay();
    return [];
  }

  const res = await fetch(`${API_BASE_URL}/follow-ups?status=${tab}`);
  if (!res.ok) {
    throw new Error('Something went wrong. Please try again.');
  }
  return res.json();
}
