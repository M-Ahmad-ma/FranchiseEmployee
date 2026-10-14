import {
  ALLOWED_MEDIA_EXTENSIONS,
  BRAND_LOCATION_OPTION,
  MAX_MEDIA_BYTES,
  formatBytes,
  mediaKind,
  validateFile,
} from '../src/services/mediaService';

describe('validateFile', () => {
  it('accepts every extension the server allows', () => {
    for (const extension of ALLOWED_MEDIA_EXTENSIONS) {
      expect(validateFile(`clip.${extension}`, 1000, MAX_MEDIA_BYTES, ALLOWED_MEDIA_EXTENSIONS).ok).toBe(
        true,
      );
    }
  });

  it('is case-insensitive about the extension', () => {
    expect(
      validateFile('BROCHURE.PDF', 1000, MAX_MEDIA_BYTES, ALLOWED_MEDIA_EXTENSIONS).ok,
    ).toBe(true);
  });

  it('rejects a type the server would refuse', () => {
    const check = validateFile('notes.exe', 1000, MAX_MEDIA_BYTES, ALLOWED_MEDIA_EXTENSIONS);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('notes.exe');
  });

  it('rejects a file over the cap — the server limit is 0, so this is the only gate', () => {
    const check = validateFile('huge.mp4', MAX_MEDIA_BYTES + 1, MAX_MEDIA_BYTES, ALLOWED_MEDIA_EXTENSIONS);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('limit');
  });

  it('skips the size check when the picker reports no size', () => {
    expect(validateFile('clip.mp4', null, MAX_MEDIA_BYTES, ALLOWED_MEDIA_EXTENSIONS).ok).toBe(
      true,
    );
  });

  it('rejects a file with no extension at all', () => {
    expect(validateFile('README', 100, MAX_MEDIA_BYTES, ALLOWED_MEDIA_EXTENSIONS).ok).toBe(
      false,
    );
  });
});

describe('mediaKind', () => {
  it('classifies by extension', () => {
    expect(mediaKind('uploads/company_media/1.jpg')).toBe('image');
    expect(mediaKind('uploads/company_media/2.PNG')).toBe('image');
    expect(mediaKind('uploads/company_media/3.mp4')).toBe('video');
    expect(mediaKind('uploads/company_media/4.pdf')).toBe('pdf');
    expect(mediaKind('uploads/company_media/5.txt')).toBe('file');
  });

  it('treats any absolute http(s) path as a location link', () => {
    expect(mediaKind('https://maps.app.goo.gl/abc')).toBe('location');
  });

  it('treats the Brand Location option name as a location, whatever the path', () => {
    expect(mediaKind('uploads/company_media/6.jpg', BRAND_LOCATION_OPTION)).toBe(
      'location',
    );
  });
});

describe('formatBytes', () => {
  it('scales from bytes to megabytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});