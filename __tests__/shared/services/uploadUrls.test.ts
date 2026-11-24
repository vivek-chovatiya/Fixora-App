/**
 * `toImageUrl` is the one place a picture the backend names becomes an address
 * this phone can load (Phase 4B contract §1, 24/11/2026). The backend stores and
 * returns a host-free `/uploads/...` path on purpose — the emulator, a phone on
 * the LAN and the web views reach it by different hosts — so the rules pinned
 * here are the ones a broken avatar would come from:
 *
 * - a path gets the API's own origin, never a host written anywhere else, with
 *   `/api/v1` (and a trailing slash) taken off;
 * - a full http(s) URL — seeded data, the web views' — passes untouched;
 * - anything else is no picture at all (`undefined`), so a screen shows its
 *   placeholder instead of an image that can never load.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { toImageUrl } from '@/shared/services/api/uploadUrls';

/** The origin the app's own API is on, derived the way a reader would expect. */
const ORIGIN = AppConfig.api.baseUrl.replace(/\/api\/v1\/?$/, '');

describe('a stored upload path', () => {
  it('is put on the API’s own origin, without /api/v1', () => {
    expect(toImageUrl('/uploads/request/9f3c00e1.jpg')).toBe(`${ORIGIN}/uploads/request/9f3c00e1.jpg`);
    expect(toImageUrl('/uploads/request/9f3c00e1.jpg')).not.toContain('/api/v1');
  });

  it('is read whatever spaces surround it', () => {
    expect(toImageUrl('  /uploads/team/a1.webp ')).toBe(`${ORIGIN}/uploads/team/a1.webp`);
  });

  it('takes the origin from the configuration, a trailing slash included', () => {
    jest.isolateModules(() => {
      jest.doMock('@/core/config/AppConfig', () => ({
        AppConfig: { api: { baseUrl: 'http://10.0.2.2:5000/api/v1/' } },
      }));
      const { toImageUrl: isolated } = jest.requireActual<typeof import('@/shared/services/api/uploadUrls')>(
        '@/shared/services/api/uploadUrls',
      );

      expect(isolated('/uploads/shop/b2.png')).toBe('http://10.0.2.2:5000/uploads/shop/b2.png');
    });
    jest.dontMock('@/core/config/AppConfig');
  });
});

describe('a full URL', () => {
  it.each([
    ['http', 'http://localhost:5000/uploads/profile/c3.jpg'],
    ['https', 'https://cdn.example.com/seed/vendor.jpg'],
    ['upper-case scheme', 'HTTPS://cdn.example.com/seed/vendor.jpg'],
  ])('passes untouched (%s)', (_case, url) => {
    expect(toImageUrl(url)).toBe(url);
  });
});

describe('anything else', () => {
  it.each([
    ['null (no picture)', null],
    ['undefined', undefined],
    ['blank', '   '],
    ['a number', 42],
    ['an object', { path: '/uploads/request/a.jpg' }],
    ['a relative path with no leading slash', 'uploads/request/a.jpg'],
    ['a path outside /uploads', '/api/v1/requests'],
    ['a file on some device', 'file:///data/user/0/com.fixora/cache/a.jpg'],
    ['another scheme', 'data:image/png;base64,iVBORw0KGgo='],
  ])('is no picture: %s', (_case, value) => {
    expect(toImageUrl(value)).toBeUndefined();
  });
});
