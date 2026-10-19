import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { RequestsScreen } from '../src/features/requests/RequestsScreen';
import { fetchFilteredLeads } from '../src/services/leadsFilterService';
import { Pagination } from '../src/shared/components/Pagination';

/**
 * Regression cover for the double-tap bug.
 *
 * Every handler below changes React state and then immediately calls `load`.
 * State setters do not apply until the next render, so `load` used to read the
 * previous `page` out of its closure and refetch the rows already on screen —
 * the page number needed a second tap to take effect.
 */

const fetchFilteredLeadsMock = fetchFilteredLeads as jest.MockedFunction<
  typeof fetchFilteredLeads
>;

jest.mock('../src/services/leadsFilterService', () => {
  const actual = jest.requireActual('../src/services/leadsFilterService');
  return {
    ...actual,
    fetchFilteredLeads: jest.fn(),
    fetchLeadFilterDropdowns: jest.fn(async () => ({
      cities: [],
      companies: [],
      pipelineStatuses: [],
    })),
  };
});

jest.mock('../src/services/meetingService', () => ({
  fetchAllMeetingsCached: jest.fn(async () => ({ meetings: [], complete: true })),
  clearMeetingsCache: jest.fn(),
}));

jest.mock('../src/navigation/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

const page = (number: number) => ({
  data: { leads: [], total: 100 },
  meta: { total: 100, page: number, per_page: 10, pages: 10 },
});

/** Pulls the page number each request was sent with, in call order. */
const requestedPages = () =>
  fetchFilteredLeadsMock.mock.calls.map(call => call[0]?.page);

const render = () =>
  ReactTestRenderer.create(<RequestsScreen />);

/** Finds the Pagination row's onChange and drives it the way a tap would. */
async function clickPage(instance: ReactTestRenderer.ReactTestRenderer, n: number) {
  let onChange: ((page: number) => void) | undefined;
  instance.root.findAllByType(Pagination).forEach(node => {
    onChange = node.props.onChange;
  });
  await ReactTestRenderer.act(async () => {
    onChange?.(n);
  });
}

describe('RequestsScreen pagination', () => {
  beforeEach(() => {
    fetchFilteredLeadsMock.mockReset();
    fetchFilteredLeadsMock.mockResolvedValue(page(1));
  });

  it('fetches the page that was tapped, on the first tap', async () => {
    const instance = render();
    await ReactTestRenderer.act(async () => {});

    fetchFilteredLeadsMock.mockClear();
    await clickPage(instance, 3);

    // A stale closure would send page 1 again.
    expect(requestedPages()).toEqual([3]);
  });

  it('sends a fresh page for each consecutive tap', async () => {
    const instance = render();
    await ReactTestRenderer.act(async () => {});

    fetchFilteredLeadsMock.mockClear();
    await clickPage(instance, 2);
    await clickPage(instance, 5);

    expect(requestedPages()).toEqual([2, 5]);
  });

  it('ignores a tap on the page already shown', async () => {
    const instance = render();
    await ReactTestRenderer.act(async () => {});

    fetchFilteredLeadsMock.mockClear();
    // meta.page is 1 from the initial mock response.
    await clickPage(instance, 1);

    expect(requestedPages()).toEqual([]);
  });

  it('does not request a page above the returned page count', async () => {
    // Pagination clamps to the last page before calling up.
    const instance = render();
    await ReactTestRenderer.act(async () => {});

    let meta: { total: number; page: number; per_page: number; pages: number } | undefined;
    instance.root.findAllByType(Pagination).forEach(node => {
      meta = node.props.meta;
    });

    expect(meta?.pages).toBe(10);
    expect(meta?.total).toBe(100);
  });
});
