import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  P,
} from '../src/services/permissions';
import {
  mergeAuthUser,
  normalizeAuthPayload,
  type AuthUser,
} from '../src/services/authService';

/**
 * Permission gating has one subtle requirement: a missing `permission_keys`
 * field is not the same as an empty array. The first means the server did not
 * supply the data (keep the legacy behaviour); the second means the role has no
 * access. These tests pin that distinction.
 */

describe('permission helpers', () => {
  it('allows everything when the server did not supply permission data', () => {
    expect(hasPermission(null, P.brandsView)).toBe(true);
    expect(hasAnyPermission(null, [P.brandsView])).toBe(true);
    expect(hasAllPermissions(null, [P.brandsView, P.brandsEdit])).toBe(true);
  });

  it('treats an empty array as no access', () => {
    expect(hasPermission([], P.brandsView)).toBe(false);
    expect(hasAnyPermission([], [P.brandsView])).toBe(false);
    expect(hasAllPermissions([], [])).toBe(true);
  });

  it('checks any/all membership', () => {
    const keys = [P.leadsView, P.leadsList];
    expect(hasAnyPermission(keys, [P.leadsList, P.brandsView])).toBe(true);
    expect(hasAllPermissions(keys, [P.leadsView, P.leadsList])).toBe(true);
    expect(hasAllPermissions(keys, [P.leadsView, P.leadsEdit])).toBe(false);
  });
});

describe('normalizeAuthPayload', () => {
  it('reads the login shape with permission_keys beside employee', () => {
    const user = normalizeAuthPayload({
      employee: {
        emp_id: '250',
        firstname: 'Mian Dawood',
        lastname: 'Shah',
        name: 'Mian Dawood Shah',
        email: 'daud@franchisepk.com',
        contact: '03109707275',
        position: 'Web Developer',
        emp_special: '250',
      },
      permissions: { company: '1' },
      permission_keys: ['dashboard.view', 'leads.view', 'brands.view'],
      roles: ['Manager', 'Team: Brands'],
    });

    expect(user.empId).toBe(250);
    expect(user.name).toBe('Mian Dawood Shah');
    expect(user.permissionKeys).toEqual([
      'dashboard.view',
      'leads.view',
      'brands.view',
    ]);
    expect(user.roles).toEqual(['Manager', 'Team: Brands']);
  });

  it('reads a flat /auth/me payload', () => {
    const user = normalizeAuthPayload({
      emp_id: 5,
      u_firstname: 'Sumeet',
      u_lastname: 'Khan',
      u_email: 'employee@franchisepk.com',
      permission_keys: ['dashboard.view'],
      roles: ['Employee (Basic)'],
    });

    expect(user.name).toBe('Sumeet Khan');
    expect(user.permissionKeys).toEqual(['dashboard.view']);
  });

  it('returns null permissionKeys when the field is absent', () => {
    const user = normalizeAuthPayload({
      emp_id: 5,
      u_firstname: 'Sumeet',
      u_lastname: 'Khan',
    });
    expect(user.permissionKeys).toBeNull();
    expect(user.roles).toEqual([]);
  });

  it('accepts a JSON-encoded permission array defensively', () => {
    const user = normalizeAuthPayload({
      emp_id: 5,
      permission_keys: '["dashboard.view","leads.view"]',
    });
    expect(user.permissionKeys).toEqual(['dashboard.view', 'leads.view']);
  });
});

describe('mergeAuthUser', () => {
  const previous: AuthUser = {
    empId: 5,
    name: 'Sumeet Khan',
    email: 'employee@franchisepk.com',
    contact: '0317',
    position: 'Sales Manager',
    permissionKeys: ['dashboard.view', 'leads.view'],
    roles: ['Employee (Basic)'],
  };

  it('keeps login permissions when /auth/me omits them', () => {
    const merged = mergeAuthUser(previous, {
      ...previous,
      name: 'Updated Name',
      permissionKeys: null,
      roles: [],
    });
    expect(merged.name).toBe('Updated Name');
    expect(merged.permissionKeys).toEqual(['dashboard.view', 'leads.view']);
    expect(merged.roles).toEqual(['Employee (Basic)']);
  });

  it('uses an explicit empty permission list from /auth/me', () => {
    const merged = mergeAuthUser(previous, {
      ...previous,
      permissionKeys: [],
    });
    expect(merged.permissionKeys).toEqual([]);
  });
});
