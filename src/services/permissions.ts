/**
 * Permission keys returned by `POST /auth/login` and `GET /auth/me`.
 *
 * The server is still the authority — every endpoint enforces these. The keys
 * here exist so the app can avoid offering a screen or button the employee
 * cannot use, and so a `403` is the exception rather than the normal path.
 *
 * A role can carry keys this app has no UI for. Keeping the type as `string`
 * means an unknown key is harmless.
 */
export type PermissionKey = string;

export const P = {
  dashboardView: 'dashboard.view',

  leadsView: 'leads.view',
  leadsList: 'leads.list',
  leadsEdit: 'leads.edit',

  followupsView: 'followups.view',
  followupsAdd: 'followups.add',
  followupsEdit: 'followups.edit',

  meetingsView: 'meetings.view',

  tasksView: 'tasks.view',
  tasksEdit: 'tasks.edit',

  reportsView: 'reports.view',
  reportsAdd: 'reports.add',

  brandsView: 'brands.view',
  brandsAdd: 'brands.add',
  brandsEdit: 'brands.edit',

  propertiesView: 'properties.view',
  propertiesAdd: 'properties.add',

  showsView: 'shows.view',

  companiesView: 'companies.view',
  companiesAdd: 'companies.add',
  companiesEdit: 'companies.edit',

  usersView: 'users.view',
  usersEdit: 'users.edit',

  jobsView: 'jobs.view',
  jobsAdd: 'jobs.add',
  jobsEdit: 'jobs.edit',
  jobsDelete: 'jobs.delete',

  eventsView: 'events.view',
  eventsAdd: 'events.add',

  downloadsView: 'downloads.view',
  resaleView: 'resale.view',
  adsView: 'ads.view',
  subscribersView: 'subscribers.view',

  companyMediaView: 'company_media.view',
  companyMediaAdd: 'company_media.add',
  companyMediaDelete: 'company_media.delete',
} as const;

/** Permission keys this app knows how to use in its UI. */
export const APP_PERMISSION_KEYS: PermissionKey[] = Object.values(P);

/**
 * `permission_keys` is authoritative when present.
 *
 * `null` means the server did not send the field at all — for example an older
 * deployment, or `/auth/me` returning only the profile. In that case the app
 * keeps behaving like it did before permissions existed instead of hiding every
 * screen. An empty array is different: it means the server said "no access".
 */
export type PermissionSet = readonly string[] | null;

export function hasPermission(
  permissions: PermissionSet,
  key: PermissionKey,
): boolean {
  if (permissions === null) {
    return true;
  }
  return permissions.includes(key);
}

export function hasAnyPermission(
  permissions: PermissionSet,
  keys: readonly PermissionKey[],
): boolean {
  if (keys.length === 0) {
    return true;
  }
  return keys.some(key => hasPermission(permissions, key));
}

export function hasAllPermissions(
  permissions: PermissionSet,
  keys: readonly PermissionKey[],
): boolean {
  return keys.every(key => hasPermission(permissions, key));
}

/** Case-insensitive search used by the drawer's section filter. */
export function matchesPermissionSearch(
  keys: readonly PermissionKey[],
  query: string,
): boolean {
  const term = query.trim().toLowerCase();
  if (!term) {
    return true;
  }
  return keys.some(key => key.toLowerCase().includes(term));
}
