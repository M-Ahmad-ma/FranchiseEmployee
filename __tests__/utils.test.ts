import { toApiDate, resolveAssetPath } from '../src/services/utils';

describe('toApiDate', () => {
  it('converts the date picker format the server cannot read unambiguously', () => {
    expect(toApiDate('10/13/2026')).toBe('2026-10-13');
    expect(toApiDate('01/02/2026')).toBe('2026-01-02');
  });

  it('accepts single-digit months and days', () => {
    expect(toApiDate('1/2/2026')).toBe('2026-01-02');
  });

  it('passes ISO through untouched', () => {
    expect(toApiDate('2026-10-13')).toBe('2026-10-13');
  });

  it('drops unreadable values so the filter is left out, not sent as junk', () => {
    expect(toApiDate('')).toBeUndefined();
    expect(toApiDate(undefined)).toBeUndefined();
    expect(toApiDate('next tuesday')).toBeUndefined();
  });
});

describe('resolveAssetPath', () => {
  const origin = 'https://example.com';

  it('resolves a server-relative path against the API origin', () => {
    expect(resolveAssetPath('uploads/company_media/123.jpg', origin)).toBe(
      'https://example.com/uploads/company_media/123.jpg',
    );
  });

  it('leaves an absolute URL alone — Brand Location rows are already absolute', () => {
    const url = 'https://maps.app.goo.gl/abc';
    expect(resolveAssetPath(url, origin)).toBe(url);
  });

  it('normalises slashes so a leading or trailing one cannot double up', () => {
    expect(resolveAssetPath('/public/admin/leads/a.jpg', `${origin}/`)).toBe(
      'https://example.com/public/admin/leads/a.jpg',
    );
  });

  it('returns an empty string for a missing path', () => {
    expect(resolveAssetPath('', origin)).toBe('');
  });
});

