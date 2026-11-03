import {
  ALL_SIDEBAR_ENTRIES,
  CORE_SIDEBAR_ENTRIES,
  MODULE_CONFIGS,
} from '../src/navigation/modules';

/**
 * The drawer is generated from this registry, so a missing `view` key would
 * silently make a whole module unreachable — or worse, visible to everyone.
 */
describe('module registry', () => {
  it('gives every sidebar entry at least one view permission', () => {
    for (const entry of ALL_SIDEBAR_ENTRIES) {
      expect(entry.view.length).toBeGreaterThan(0);
    }
  });

  it('maps the documented read endpoints to their guard keys', () => {
    expect(MODULE_CONFIGS.Brands.view).toContain('brands.view');
    expect(MODULE_CONFIGS.Companies.view).toContain('companies.view');
    expect(MODULE_CONFIGS.Users.view).toContain('users.view');
    expect(MODULE_CONFIGS.Jobs.view).toContain('jobs.view');
    expect(MODULE_CONFIGS.Downloads.view).toContain('downloads.view');
    expect(MODULE_CONFIGS.Franchise.view).toContain('resale.view');
    expect(MODULE_CONFIGS.Advertisements.view).toContain('ads.view');
    expect(MODULE_CONFIGS.Subscribers.view).toContain('subscribers.view');
    expect(MODULE_CONFIGS.AssignedRequests.view).toContain('leads.list');
    expect(MODULE_CONFIGS.InvestorRequests.view).toContain('leads.list');
    expect(MODULE_CONFIGS.Shows.view).toContain('shows.view');
  });

  it('only offers writes where an endpoint exists', () => {
    // Brands has no delete route.
    expect(MODULE_CONFIGS.Brands.delete).toBeUndefined();
    // Properties, reports, events and meetings are create-only.
    expect(MODULE_CONFIGS.Properties.create).toContain('properties.add');
    expect(MODULE_CONFIGS.Properties.updateFn).toBeUndefined();
    expect(MODULE_CONFIGS.Reports.create).toContain('reports.add');
    expect(MODULE_CONFIGS.Reports.updateFn).toBeUndefined();
    expect(MODULE_CONFIGS.Events.create).toContain('events.add');
    expect(MODULE_CONFIGS.Events.updateFn).toBeUndefined();
    // Meetings are handled by the dedicated screen, not this registry.
    expect(MODULE_CONFIGS.Jobs.delete).toContain('jobs.delete');
  });

  it('keeps the existing sections in the drawer registry', () => {
    const screens = CORE_SIDEBAR_ENTRIES.map(entry => entry.screen);
    expect(screens).toEqual(
      expect.arrayContaining([
        'Home',
        'Requests',
        'FollowUps',
        'Meetings',
        'Tasks',
        'CompanyMedia',
      ]),
    );
  });
});
