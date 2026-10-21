/**
 * MockVendorTeamService
 *
 * Stands in for the vendor team endpoints until they exist (PROJECT_BIBLE.md
 * section 39, Phase 3E-7). It behaves like a backend rather than like a
 * convenience:
 *
 * - it re-checks what it is sent — a name and a role, within their ceilings,
 *   a phone that is a phone, a photo that is an uploaded http(s) URL — because
 *   a real server does, and a form that has never met a refusal will not
 *   handle one;
 * - it normalises (trims; a phone becomes digits; a blank phone or photo is
 *   none) and answers with the team as it stored it, so the device adopts the
 *   server's version;
 * - it refuses when no vendor is signed in, and a customer is not a vendor;
 * - it answers `notFound` for a member that is not on this vendor's team —
 *   including one on somebody else's — so it can neither change another
 *   vendor's team nor confirm who is on it.
 *
 * ⚠️ One change at a time. Mutations are applied in the order they arrive,
 * each reading the team the one before it wrote, as a backend's transactions
 * would be — so two adds in flight both land rather than the second writing
 * over the first.
 *
 * ⚠️ A change that could not be stored did not happen. If storage refuses the
 * write the call fails (`unknown`) and the team is as it was — the vendor
 * profile's rule (3E-1), not the address book's: saying "added" for somebody
 * who is gone on the next launch would be the worse lie.
 *
 * ⚠️ Not connected to anything else. A member is not assigned to requests
 * (section 40), cannot sign in (section 7A.3) and changes nothing on the
 * dashboard or the request list.
 *
 * ⚠️ A status is set by `setMemberStatus` and nothing else (section 39's
 * "Disable Team Member"). A new member is `ACTIVE`; an edit keeps the status
 * the member had, whatever the input holds; and a status outside the two the
 * app knows is refused (`validation`), as a server would refuse a value it
 * does not accept. It is a change like any other: in line with the rest,
 * stored or not done, and the whole team in answer. Disabling somebody
 * changes nothing else — not their place, not their details, not who can be
 * removed.
 *
 * Replacing this with an ApiVendorTeamService requires no change to any screen.
 */

import { createLogger } from '@/core/logger/Logger';
import type { AuthUser } from '@/features/auth/types';
import type { MockVendorTeamStorage } from '@/shared/services/mock/MockVendorTeamStorage';
import { mockStartingTeamFor } from '@/shared/services/mock/mockVendorTeamData';
import { NO_LATENCY, simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import {
  TEAM_MEMBER_NAME_MAX_LENGTH,
  TEAM_MEMBER_ROLE_MAX_LENGTH,
  TEAM_MEMBER_STATUS,
  type SettableTeamMemberStatus,
  type TeamMember,
  type TeamMemberInput,
  type VendorTeamService,
} from '@/shared/services/types/VendorTeamService';
import { AppError } from '@/shared/types/error';
import { normalisePhone, phoneSchema } from '@/shared/validation/phone';

const log = createLogger('MockVendorTeamService');

export interface MockVendorTeamServiceOptions {
  /** Simulated latency. Pass `NO_LATENCY` in tests. */
  latency?: MockLatency;

  /** Where teams are kept between launches. Without it, memory only. */
  storage?: MockVendorTeamStorage;

  /** The signed-in account, or null. Asked on every call. */
  currentUser?: () => Promise<AuthUser | null>;

  /** The team a vendor starts with. Defaults to the table beside the fixtures. */
  startingTeamFor?: (vendorId: string) => TeamMember[];

  /** Injectable clock, for new members' ids. */
  now?: () => number;
}

function refuse(message: string): never {
  throw new AppError({ kind: 'validation', message: `Mock vendor team refused: ${message}` });
}

/**
 * An uploaded picture's address: http or https, and nothing after the scheme
 * that is blank. The business picture's rule (`MockVendorProfileService`).
 */
const UPLOADED_PHOTO_URL = /^https?:\/\/\S+$/i;

/**
 * The photo as it would be stored: absent, or a trimmed uploaded URL.
 *
 * Absent and blank are both "no photo", as a blank phone is. Anything else
 * that is not an http(s) URL — a file on the device, which would show nothing
 * on any other one, or a value that is not text at all — is refused rather
 * than dropped: quietly storing no photo for one the vendor chose would leave
 * the form saying it was saved.
 */
function normalisePhoto(photoUrl: unknown): string | undefined {
  if (photoUrl === undefined) {
    return undefined;
  }
  if (typeof photoUrl !== 'string') {
    refuse('the photo is not a URL');
  }
  const trimmed = photoUrl.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!UPLOADED_PHOTO_URL.test(trimmed)) {
    refuse('the photo must be an uploaded URL');
  }
  return trimmed;
}

/** The input as it would be stored, or a refusal. */
function normalise(input: TeamMemberInput): TeamMemberInput {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const role = typeof input.role === 'string' ? input.role.trim() : '';
  const typedPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const photoUrl = normalisePhoto(input.photoUrl);

  if (!name) {
    refuse('a name is required');
  }
  if (name.length > TEAM_MEMBER_NAME_MAX_LENGTH) {
    refuse('the name is too long');
  }
  if (!role) {
    refuse('a role is required');
  }
  if (role.length > TEAM_MEMBER_ROLE_MAX_LENGTH) {
    refuse('the role is too long');
  }
  // The app's one phone rule, checked again here rather than trusted.
  if (typedPhone && !phoneSchema.safeParse(typedPhone).success) {
    refuse('the phone is not a phone number');
  }

  return {
    name,
    role,
    ...(typedPhone ? { phone: normalisePhone(typedPhone) } : {}),
    ...(photoUrl ? { photoUrl } : {}),
  };
}

/** The statuses this service accepts — exactly the app's two, as written. */
const SETTABLE_STATUSES: ReadonlySet<string> = new Set(Object.values(TEAM_MEMBER_STATUS));

/**
 * A new member's id, from the clock — so it is never one a removed member had.
 *
 * ⚠️ Not "the next number": after the highest-numbered member was removed, that
 * would hand their id to the next person added, and an edit form still open on
 * the removed member would then save over somebody else. A clock only moves
 * forward; the suffix covers two adds in one millisecond.
 */
function newId(members: readonly TeamMember[], nowMs: number): string {
  const base = `tm_${nowMs.toString(36)}`;
  const taken = new Set(members.map(member => member.id));

  let id = base;
  for (let suffix = 2; taken.has(id); suffix += 1) {
    id = `${base}_${suffix}`;
  }
  return id;
}

function copied(members: readonly TeamMember[]): TeamMember[] {
  return members.map(member => ({ ...member }));
}

export class MockVendorTeamService implements VendorTeamService {
  private readonly latency: MockLatency;
  private readonly storage?: MockVendorTeamStorage;
  private readonly currentUser?: () => Promise<AuthUser | null>;
  private readonly startingTeamFor: (vendorId: string) => TeamMember[];
  private readonly now: () => number;

  /** Teams per vendor, for when there is no storage to hold them. */
  private readonly memory = new Map<string, TeamMember[]>();

  /** The last change in line; the next one waits for it. */
  private changes: Promise<unknown> = Promise.resolve();

  constructor(options: MockVendorTeamServiceOptions = {}) {
    this.latency = options.latency ?? NO_LATENCY;
    this.storage = options.storage;
    this.currentUser = options.currentUser;
    this.startingTeamFor = options.startingTeamFor ?? mockStartingTeamFor;
    this.now = options.now ?? (() => Date.now());
  }

  async listMembers(): Promise<TeamMember[]> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();
      const members = await this.load(vendor.id);

      // How many, never who.
      log.info('Mock team listed', { count: members.length });
      return copied(members);
    }, this.latency);
  }

  async addMember(input: TeamMemberInput): Promise<TeamMember[]> {
    return this.change(async vendorId => {
      const stored = normalise(input);
      const members = await this.load(vendorId);

      return [
        ...members,
        { id: newId(members, this.now()), ...stored, status: TEAM_MEMBER_STATUS.active },
      ];
    });
  }

  async updateMember(memberId: string, input: TeamMemberInput): Promise<TeamMember[]> {
    return this.change(async vendorId => {
      const stored = normalise(input);
      const members = await this.load(vendorId);
      this.requireMember(members, memberId);

      // The id, the status and the place in the list stay; every detail is replaced.
      return members.map(member =>
        member.id === memberId ? { id: memberId, ...stored, status: member.status } : member,
      );
    });
  }

  async setMemberStatus(memberId: string, status: SettableTeamMemberStatus): Promise<TeamMember[]> {
    return this.change(async vendorId => {
      if (!SETTABLE_STATUSES.has(status)) {
        refuse('the status is not one a member can be given');
      }
      const members = await this.load(vendorId);
      this.requireMember(members, memberId);

      // Only the status moves. The status a member already has is set again,
      // and the team answered is the team as it was.
      return members.map(member => (member.id === memberId ? { ...member, status } : member));
    });
  }

  async removeMember(memberId: string): Promise<TeamMember[]> {
    return this.change(async vendorId => {
      const members = await this.load(vendorId);
      this.requireMember(members, memberId);

      return members.filter(member => member.id !== memberId);
    });
  }

  /**
   * One mutation: who is asking, then what the team becomes, then storing it —
   * in line behind any change already running, so each reads what the last one
   * wrote.
   */
  private change(next: (vendorId: string) => Promise<TeamMember[]>): Promise<TeamMember[]> {
    const run = this.changes.then(() =>
      simulateNetwork(async () => {
        const vendor = await this.requireVendor();
        const members = await next(vendor.id);

        await this.store(vendor.id, members);
        log.info('Mock team changed', { count: members.length });
        return copied(members);
      }, this.latency),
    );

    // A failed change must not stop the next one.
    this.changes = run.catch(() => undefined);
    return run;
  }

  /** What an authenticated vendor endpoint does to anybody else. */
  private async requireVendor(): Promise<AuthUser> {
    const user = (await this.currentUser?.()) ?? null;
    if (!user || user.role !== 'vendor') {
      throw new AppError({ kind: 'unauthorized', message: 'Mock vendor team: no vendor session' });
    }

    return user;
  }

  /**
   * Not on this team is not found — whether it never existed or is on another
   * vendor's, which is not this vendor's to know.
   */
  private requireMember(members: readonly TeamMember[], memberId: string): void {
    if (!members.some(member => member.id === memberId)) {
      throw new AppError({ kind: 'notFound', message: 'Mock vendor team: no such member' });
    }
  }

  /** The saved team, or the starting one when nothing has been saved yet. */
  private async load(vendorId: string): Promise<TeamMember[]> {
    const saved = this.storage
      ? await this.storage.read(vendorId)
      : this.memory.get(vendorId) ?? null;

    return saved ?? this.startingTeamFor(vendorId);
  }

  private async store(vendorId: string, members: TeamMember[]): Promise<void> {
    if (this.storage) {
      if (!(await this.storage.write(vendorId, copied(members)))) {
        throw new AppError({ kind: 'unknown', message: 'Mock vendor team could not be stored' });
      }
      return;
    }

    this.memory.set(vendorId, copied(members));
  }
}
