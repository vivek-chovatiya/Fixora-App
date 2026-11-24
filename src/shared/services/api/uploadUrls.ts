/**
 * Where an image the backend names can be loaded from
 *
 * The backend stores and returns every uploaded image as a host-free path,
 * `/uploads/<type>/<name>.<ext>` (Phase 4B contract §1, 24/11/2026). It is
 * host-free on purpose: the emulator, a phone on the LAN and the web views each
 * reach the same server by a different host, so only the app knows which one to
 * put in front. This is the one place that does it, from the API's own address
 * (`AppConfig.api.baseUrl` without its `/api/v1`), so a photo always loads from
 * the server the rest of the app is talking to.
 *
 * What it refuses: anything that is neither such a path nor an `http(s)` URL
 * answers `undefined` — a screen then shows its placeholder rather than an
 * image that can never load. Seeded and web-view records may already hold a
 * full URL; those are passed through untouched.
 *
 * ⚠️ Read side only. What the app sends back may be the full URL it holds: the
 * backend normalises an absolute `/uploads/...` URL to its path (contract §2),
 * so the app never has to strip the host again before saving.
 */

import { AppConfig } from '@/core/config/AppConfig';

const UPLOADS_PREFIX = '/uploads/';

/** The API's origin: its base URL with the trailing `/api/v1` (and any `/`) removed. */
function apiOrigin(): string {
  return AppConfig.api.baseUrl.replace(/\/api\/v\d+\/?$/, '').replace(/\/+$/, '');
}

export function toImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith(UPLOADS_PREFIX)) {
    return `${apiOrigin()}${trimmed}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}
