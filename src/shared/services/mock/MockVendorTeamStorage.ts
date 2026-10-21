/**
 * MockVendorTeamStorage
 *
 * Keeps a vendor's team on this device, so it is still there after the app is
 * closed and opened again (Phase 3E-7).
 *
 * ⚠️ Local, and a mock's — the same terms as `MockVendorProfileStorage`. There
 * is no server and no sync; it goes when a real `VendorTeamService` arrives.
 *
 * Per vendor, keyed by the session's vendor id, so a second vendor on the same
 * device never sees the first one's team. Not cleared at logout: it is the
 * vendor's own record.
 *
 * ⚠️ "Nothing saved" and "an empty team" are different answers. `read` resolves
 * `null` when this vendor has never had a team written — the mock then offers
 * its fixture — and `[]` when one was written and is empty, so a vendor who
 * removes everybody is not handed the fixture back on the next launch.
 *
 * Versioned and strict: another schema, bad JSON or an unreadable device reads
 * as nothing saved; a member that does not decode is dropped; a repeated id
 * keeps the first. Nothing here throws.
 *
 * ⚠️ Version 2 added each member's `status` (section 39). Version 1 — every
 * team saved in Phase 3E-7, before a member could be disabled — is still read,
 * its members as `ACTIVE`, because that is what every one of them was; reading
 * it as nothing saved would hand those vendors the starting team back over
 * their own. It is written as version 2 on the vendor's next change. In a
 * version 2 record a member's status must be a non-blank string, or the member
 * does not decode and is dropped like any other broken member. A well-formed
 * status the app does not know is kept: the contract's status is a string,
 * and wording it is the presentation table's job, not this file's.
 *
 * ⚠️ A member's `photoUrl` (section 39's Profile Image, 2026-10-21) is optional
 * and is not a new version: every record already saved satisfies it by not
 * having one, and decodes exactly as before. When one is there it must be an
 * http(s) URL, or the member does not decode — the phone's rule: a value the
 * service would never have stored means the record is not one this app wrote.
 *
 * The device is reached through `core/storage`'s `KeyValueStorage`, never
 * AsyncStorage directly (CLAUDE.md section 4) — the same keys and JSON as
 * before. The class keeps its name: AsyncStorage is still what lies underneath.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { getKeyValueStorage } from '@/core/storage/KeyValueStorage';
import {
  TEAM_MEMBER_NAME_MAX_LENGTH,
  TEAM_MEMBER_ROLE_MAX_LENGTH,
  TEAM_MEMBER_STATUS,
  type TeamMember,
} from '@/shared/services/types/VendorTeamService';

const log = createLogger('MockVendorTeamStorage');

/**
 * Bumped whenever `TeamMember` changes in a way an old record cannot satisfy.
 * 2: members carry a `status`.
 */
const SCHEMA_VERSION = 2;

/**
 * The one older schema still read: Phase 3E-7's, from before members had a
 * status. Nobody could be disabled then, so its members are read as active.
 */
const STATUSLESS_VERSION = 1;

export interface MockVendorTeamStorage {
  /** The vendor's saved team; null when none was ever saved or it cannot be read. Never throws. */
  read(vendorId: string): Promise<TeamMember[] | null>;

  /** Replaces the team. Resolves `false` when it could not be written. Never throws. */
  write(vendorId: string, members: TeamMember[]): Promise<boolean>;
}

function keyFor(vendorId: string): string {
  return `${AppConfig.storage.mockVendorTeamKey}/${encodeURIComponent(vendorId)}`;
}

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFilled(value: unknown, max = Infinity): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

/** What the service stores for a photo: an uploaded http(s) URL, trimmed. */
function isPhotoUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value);
}

/** One saved member, or null when it is not one. All or nothing. */
function decodeMember(value: unknown, version: number): TeamMember | null {
  if (!isFields(value)) {
    return null;
  }

  const { id, name, role, phone, photoUrl } = value;
  // A version 1 member never had a status, and was active: there was no other way to be.
  const status = version === STATUSLESS_VERSION ? TEAM_MEMBER_STATUS.active : value.status;

  if (
    !isFilled(id) ||
    !isFilled(name, TEAM_MEMBER_NAME_MAX_LENGTH) ||
    !isFilled(role, TEAM_MEMBER_ROLE_MAX_LENGTH) ||
    !(phone === undefined || (typeof phone === 'string' && /^\d+$/.test(phone))) ||
    !(photoUrl === undefined || isPhotoUrl(photoUrl)) ||
    !isFilled(status)
  ) {
    return null;
  }

  // Exactly the member's keys: none present-but-undefined, none the record carried besides.
  return {
    id,
    name,
    role,
    ...(phone === undefined ? {} : { phone }),
    ...(photoUrl === undefined ? {} : { photoUrl }),
    status,
  };
}

/** The saved team, or null when nothing usable was saved. Never throws. */
function decode(raw: string | null): TeamMember[] | null {
  if (raw === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not logged with the parser's message: it can quote a name.
    log.warn('Saved team is not valid JSON; ignoring it');
    return null;
  }

  if (
    !isFields(parsed) ||
    (parsed.version !== SCHEMA_VERSION && parsed.version !== STATUSLESS_VERSION) ||
    !Array.isArray(parsed.members)
  ) {
    log.info('Ignoring a team written for another schema', {
      version: isFields(parsed) && typeof parsed.version === 'number' ? parsed.version : 'unknown',
    });
    return null;
  }

  const version = parsed.version === STATUSLESS_VERSION ? STATUSLESS_VERSION : SCHEMA_VERSION;
  const members: TeamMember[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const entry of parsed.members) {
    const member = decodeMember(entry, version);
    // A repeated id keeps the first: two records answering to one id cannot both be edited.
    if (member && !seen.has(member.id)) {
      seen.add(member.id);
      members.push(member);
    } else {
      dropped += 1;
    }
  }

  if (dropped > 0) {
    log.warn('Dropped saved team members that did not decode', { dropped });
  }

  return members;
}

export class AsyncStorageMockVendorTeam implements MockVendorTeamStorage {
  async read(vendorId: string): Promise<TeamMember[] | null> {
    try {
      return decode(await getKeyValueStorage().getItem(keyFor(vendorId)));
    } catch (error) {
      // A warning, not an error: the logger turns an error into a red screen in a debug build.
      log.warn('Failed to read the saved team', { error: String(error) });
      return null;
    }
  }

  async write(vendorId: string, members: TeamMember[]): Promise<boolean> {
    try {
      await getKeyValueStorage().setItem(
        keyFor(vendorId),
        JSON.stringify({ version: SCHEMA_VERSION, members }),
      );
      return true;
    } catch (error) {
      log.warn('Failed to save the team', { error: String(error) });
      return false;
    }
  }
}
