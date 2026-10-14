import { describeForm } from '../src/services/apiLogger';
import { logMock } from '../src/services/mockLogger';

describe('logMock', () => {
  it('stays silent by default, so nothing leaks without opting in', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    logMock('followups', [{ id: '88' }]);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not throw when given nothing to print', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => logMock('followups/bell')).not.toThrow();

    spy.mockRestore();
  });
});

describe('describeForm', () => {
  /**
   * React Native's FormData polyfill exposes `getParts()` and no `forEach`;
   * Jest's WHATWG FormData is the reverse. Neither shape exists in both
   * environments, so both are pinned here — the `getParts` one is what a real
   * device produces, and it is the one a device-only bug would hide.
   */
  it("reads React Native's getParts() shape", () => {
    const form = {
      getParts: () => [
        { string: '1115' },
        {
          uri: 'file:///tmp/brochure.pdf',
          name: 'brochure.pdf',
          headers: { 'Content-Type': 'application/pdf' },
        },
      ],
    } as unknown as FormData;

    expect(describeForm(form)).toEqual({
      '1115': '1115',
      'brochure.pdf': 'file:brochure.pdf (application/pdf)',
    });
  });

  it('reads the iterable FormData shape, including file size', () => {
    const form = {
      forEach: (cb: (value: unknown, key: string) => void) => {
        cb('1115', 'company_id');
        cb(
          {
            uri: 'file:///tmp/clip.mp4',
            name: 'clip.mp4',
            size: 2_048_000,
            type: 'video/mp4',
          },
          'media_files[]',
        );
      },
    } as unknown as FormData;

    expect(describeForm(form)).toEqual({
      company_id: '1115',
      'media_files[]': 'file:clip.mp4 2000 KB',
    });
  });

  it('returns an empty record when the shape is neither', () => {
    expect(describeForm({} as FormData)).toEqual({});
  });
});