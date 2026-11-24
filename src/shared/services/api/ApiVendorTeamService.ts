/**
 * ApiVendorTeamService
 *
 * VendorTeamService against the real backend (Phase 4A, 17/11/2026;
 * PROJECT_BIBLE.md section 39). Replaces `MockVendorTeamService` with no change
 * to the Team tab or the member form.
 *
 * Endpoints (`Fixora-Backend/src/routes/index.js`), all scoped by the token:
 * `GET /team` (the list), `POST /team` (add),
 * `POST /team/update { id, … }` (details and status), `DELETE /team/delete`
 * with `{ id }` in the body.
 *
 * Decisions:
 * - **Field by field.** `designation` is the app's `role`, `profileImage` its
 *   `photoUrl`, `phone` its `phone`; the backend's `vendorId` and timestamps
 *   never pass. Every mutation answers with the whole team read again, as the
 *   contract says, in the order members were added — the backend lists newest
 *   first, so the list is put in `createdAt` order here.
 * - **Status, one table both ways**: `ACTIVE` ↔ `ACTIVE`, `INACTIVE` ↔ the
 *   app's `DISABLED`. Any other value the backend sends (`ON_LEAVE`) passes
 *   through as the plain string it is, for the presentation table to show.
 * - **The phone is optional** (section 39; the request contract's §7): a
 *   member is added without one, and because an edit replaces every detail,
 *   an edit without one sends `phone: null`, which the contract says clears it
 *   (an absent `phone` would leave the old one in place).
 * - **Photos** (Phase 4B, 24/11/2026): a new photo is the URL `ImageService`
 *   uploaded as a `team` photo, sent as it is — the backend takes its own
 *   `/uploads/...` path back in the full-URL form, and keeps a photo sent back
 *   unchanged (contract §2). A removed one is cleared (`profileImage: null`).
 *   Read back through `toImageUrl`, so a stored path becomes an address this
 *   phone loads. ⚠️ A stored value that is neither a path nor an http(s) URL
 *   reads as no photo, so an edit that follows clears it: the form can only
 *   send back the photo it was able to show.
 * - A member id that is not one of the backend's ids cannot be on the team:
 *   `notFound` without asking, as the backend's own 404 answers one that is
 *   somebody else's.
 */

import type { AuthUser } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import {
  isRecord,
  malformedResponse,
  optionalString,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import { toImageUrl } from '@/shared/services/api/uploadUrls';
import { isBackendId } from '@/shared/services/api/vendorWork';
import {
  TEAM_MEMBER_STATUS,
  type SettableTeamMemberStatus,
  type TeamMember,
  type TeamMemberInput,
  type VendorTeamService,
} from '@/shared/services/types/VendorTeamService';
import { AppError } from '@/shared/types/error';
import { normalisePhone } from '@/shared/validation/phone';

/** Backend team status → the app's (section 39's Status). */
const STATUS_FROM_BACKEND: Readonly<Record<string, string>> = Object.freeze({
  ACTIVE: TEAM_MEMBER_STATUS.active,
  INACTIVE: TEAM_MEMBER_STATUS.disabled,
});

/** The app's settable status → the backend's: the same pairs, the other way. */
const STATUS_TO_BACKEND: Readonly<Record<SettableTeamMemberStatus, string>> = Object.freeze({
  [TEAM_MEMBER_STATUS.active]: 'ACTIVE',
  [TEAM_MEMBER_STATUS.disabled]: 'INACTIVE',
});

export interface ApiVendorTeamServiceOptions {
  /** The signed-in account, or null. Asked on every call. */
  currentUser: () => Promise<AuthUser | null>;
}

function toAppStatus(backend: string): string {
  return Object.prototype.hasOwnProperty.call(STATUS_FROM_BACKEND, backend)
    ? STATUS_FROM_BACKEND[backend]
    : backend;
}

function toMember(row: unknown): TeamMember {
  const record = requireRecord(row, 'teamMember');
  const phone = optionalString(record, 'phone');
  const photoUrl = toImageUrl(record.profileImage);

  return {
    id: requireString(record, 'id', 'teamMember'),
    name: requireString(record, 'name', 'teamMember'),
    role: requireString(record, 'designation', 'teamMember'),
    // Absent rather than undefined or "", as the mock's members are.
    ...(phone ? { phone } : {}),
    ...(photoUrl ? { photoUrl } : {}),
    status: toAppStatus(requireString(record, 'status', 'teamMember')),
  };
}

/** When a row was added, for ordering; a row without a readable time keeps its place last. */
function createdAtOf(row: unknown): number {
  const value = isRecord(row) ? row.createdAt : undefined;
  const ms = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/** The photo an input carries, or undefined — blank is no photo. */
function photoOf(input: TeamMemberInput): string | undefined {
  return typeof input.photoUrl === 'string' && input.photoUrl.trim() !== '' ? input.photoUrl : undefined;
}

function notFound(): AppError {
  return new AppError({ kind: 'notFound', message: 'Vendor team: no such member' });
}

/** The phone an input carries, as digits, or undefined — blank is no phone. */
function phoneOf(input: TeamMemberInput): string | undefined {
  const phone = typeof input.phone === 'string' ? normalisePhone(input.phone) : '';
  return phone === '' ? undefined : phone;
}

export class ApiVendorTeamService extends BaseApiService implements VendorTeamService {
  private readonly currentUser: () => Promise<AuthUser | null>;

  constructor(options: ApiVendorTeamServiceOptions) {
    super('/team');
    this.currentUser = options.currentUser;
  }

  async listMembers(): Promise<TeamMember[]> {
    await this.requireVendor();
    return this.readTeam();
  }

  async addMember(input: TeamMemberInput): Promise<TeamMember[]> {
    await this.requireVendor();
    const phone = phoneOf(input);
    const photoUrl = photoOf(input);

    await this.post<unknown>('', {
      name: input.name,
      // Absent, never "": a member without a phone or photo has none.
      ...(phone ? { phone } : {}),
      designation: input.role,
      ...(photoUrl ? { profileImage: photoUrl } : {}),
    });
    return this.readTeam();
  }

  async updateMember(memberId: string, input: TeamMemberInput): Promise<TeamMember[]> {
    await this.requireVendor();
    const id = this.backendId(memberId);
    const phone = phoneOf(input);
    const photoUrl = photoOf(input);

    await this.post<unknown>('/update', {
      id,
      name: input.name,
      // Every detail is replaced: no phone in the input clears the one they had.
      phone: phone ?? null,
      designation: input.role,
      // Every detail is replaced: no photo in the input removes the one they had.
      profileImage: photoUrl ?? null,
    });
    return this.readTeam();
  }

  async setMemberStatus(memberId: string, status: SettableTeamMemberStatus): Promise<TeamMember[]> {
    await this.requireVendor();
    if (!Object.prototype.hasOwnProperty.call(STATUS_TO_BACKEND, status)) {
      throw new AppError({ kind: 'validation', message: 'Vendor team: not a status the app sets' });
    }
    const id = this.backendId(memberId);

    await this.post<unknown>('/update', { id, status: STATUS_TO_BACKEND[status] });
    return this.readTeam();
  }

  async removeMember(memberId: string): Promise<TeamMember[]> {
    await this.requireVendor();
    const id = this.backendId(memberId);

    // The backend's DELETE reads the id from the body.
    await this.delete<unknown>('/delete', { data: { id } });
    return this.readTeam();
  }

  /** The whole team, in the order members were added. */
  private async readTeam(): Promise<TeamMember[]> {
    const data = await this.get<unknown>();
    if (!Array.isArray(data)) {
      throw malformedResponse('team');
    }

    return data
      .map((row, index) => ({ row, index, at: createdAtOf(row) }))
      .sort((a, b) => a.at - b.at || a.index - b.index)
      .map(({ row }) => toMember(row));
  }

  private backendId(memberId: string): string {
    const id = memberId.trim();
    if (!isBackendId(id)) {
      throw notFound();
    }
    return id;
  }

  /** What an authenticated vendor endpoint does to anybody else. */
  private async requireVendor(): Promise<void> {
    const user = await this.currentUser();
    if (!user || user.role !== 'vendor') {
      throw new AppError({ kind: 'unauthorized', message: 'Vendor team: no vendor session' });
    }
  }
}
