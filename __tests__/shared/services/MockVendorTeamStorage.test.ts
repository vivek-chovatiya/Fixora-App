/**
 * The vendor team's device storage (Phase 3E-7), held to the same terms as the
 * other mock stores: per vendor, versioned, strict, and never throwing.
 *
 * Pinned here: "never saved" (null) is not "saved empty" ([]); another schema,
 * bad JSON and an unreadable device all read as never saved; a member that does
 * not decode is dropped and a repeated id keeps the first; a failed write says
 * so rather than throwing.
 *
 * And section 39's status: written as version 2 with every member's status; a
 * version 1 team — saved before there was a status — still read, everybody on
 * it active; in version 2 a member whose status is missing, blank or not a
 * string dropped like any other broken member, and one the app does not know
 * kept as written.
 *
 * And section 39's Profile Image: an optional photo read back, old records
 * read unchanged, a photo that is not an http(s) URL dropping its member.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { AsyncStorageMockVendorTeam } from '@/shared/services/mock/MockVendorTeamStorage';
import type { TeamMember } from '@/shared/services/types/VendorTeamService';

const KEY = `${AppConfig.storage.mockVendorTeamKey}/usr_vendor_1`;

const SURESH: TeamMember = {
  id: 'tm_1',
  name: 'Suresh Naik',
  role: 'Senior technician',
  phone: '9000000101',
  status: 'ACTIVE',
};
const FARHAN: TeamMember = { id: 'tm_3', name: 'Farhan Ali', role: 'Helper', status: 'DISABLED' };

/** A member as Phase 3E-7 saved one: no status at all. */
function statusless(member: TeamMember): Omit<TeamMember, 'status'> {
  const old: Partial<TeamMember> = { ...member };
  delete old.status;
  return old as Omit<TeamMember, 'status'>;
}

const stored = (value: unknown) => AsyncStorage.setItem(KEY, JSON.stringify(value));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('AsyncStorageMockVendorTeam', () => {
  const storage = new AsyncStorageMockVendorTeam();

  it('reads what it wrote, member for member', async () => {
    expect(await storage.write('usr_vendor_1', [SURESH, FARHAN])).toBe(true);

    expect(await storage.read('usr_vendor_1')).toEqual([SURESH, FARHAN]);
  });

  it('tells "never saved" from "saved empty"', async () => {
    expect(await storage.read('usr_vendor_1')).toBeNull();

    await storage.write('usr_vendor_1', []);
    expect(await storage.read('usr_vendor_1')).toEqual([]);
  });

  it('keeps each vendor under their own key', async () => {
    await storage.write('usr_vendor_1', [SURESH]);

    expect(await storage.read('usr_vendor_2')).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toContain('Suresh Naik');
    expect(await AsyncStorage.getItem(`${AppConfig.storage.mockVendorTeamKey}/usr_vendor_2`)).toBeNull();
  });

  it('reads another schema, bad JSON or a wrong shape as never saved', async () => {
    for (const raw of [
      JSON.stringify({ version: 3, members: [SURESH] }),
      JSON.stringify({ version: 0, members: [SURESH] }),
      JSON.stringify({ version: '2', members: [SURESH] }),
      JSON.stringify({ members: [SURESH] }),
      JSON.stringify({ version: 2, members: 'Suresh' }),
      JSON.stringify({ version: 1, members: 'Suresh' }),
      JSON.stringify([SURESH]),
      '{not json',
    ]) {
      await AsyncStorage.setItem(KEY, raw);
      expect(await storage.read('usr_vendor_1')).toBeNull();
    }
  });

  it('drops a member that does not decode, keeping the rest', async () => {
    await stored({
      version: 2,
      members: [
        SURESH,
        { id: 'tm_9', name: '', role: 'Helper', status: 'ACTIVE' },
        // A role is optional (T137), but one that is there is never blank.
        { id: 'tm_10', name: 'Blank Role', role: '   ', status: 'ACTIVE' },
        { id: 'tm_11', name: 'Bad Phone', role: 'Helper', phone: '+91 90000', status: 'ACTIVE' },
        { id: 'tm_12', name: 'N'.repeat(81), role: 'Helper', status: 'ACTIVE' },
        { id: '', name: 'No Id', role: 'Helper', status: 'ACTIVE' },
        'Farhan',
        FARHAN,
      ],
    });

    expect(await storage.read('usr_vendor_1')).toEqual([SURESH, FARHAN]);
  });

  it('reads a member saved without a role, with no role key at all (T137)', async () => {
    const leela: TeamMember = { id: 'tm_7', name: 'Leela Das', status: 'ACTIVE' };
    await storage.write('usr_vendor_1', [SURESH, leela]);

    const read = await storage.read('usr_vendor_1');
    expect(read).toEqual([SURESH, leela]);
    expect(Object.keys(read?.[1] ?? {}).sort()).toEqual(['id', 'name', 'status']);
  });

  it('keeps the first of two members with one id', async () => {
    await stored({ version: 2, members: [SURESH, { ...FARHAN, id: 'tm_1' }] });

    expect(await storage.read('usr_vendor_1')).toEqual([SURESH]);
  });
});

describe('AsyncStorageMockVendorTeam — status', () => {
  const storage = new AsyncStorageMockVendorTeam();

  it('writes the current version, with every member’s status', async () => {
    await storage.write('usr_vendor_1', [SURESH, FARHAN]);

    const raw = JSON.parse(String(await AsyncStorage.getItem(KEY)));
    expect(raw.version).toBe(2);
    expect(raw.members.map((member: TeamMember) => member.status)).toEqual(['ACTIVE', 'DISABLED']);
  });

  it('keeps a disabled member disabled across a write and a read', async () => {
    await storage.write('usr_vendor_1', [FARHAN]);

    expect(await storage.read('usr_vendor_1')).toEqual([FARHAN]);
  });

  it('reads a team saved before members had a status, everybody on it active', async () => {
    await stored({ version: 1, members: [statusless(SURESH), statusless(FARHAN)] });

    const read = await storage.read('usr_vendor_1');
    expect(read).toEqual([
      { ...statusless(SURESH), status: 'ACTIVE' },
      { ...statusless(FARHAN), status: 'ACTIVE' },
    ]);
    expect(Object.keys(read?.[1] ?? {}).sort()).toEqual(['id', 'name', 'role', 'status']);
  });

  it('reads an emptied team from before statuses as emptied, not as never saved', async () => {
    await stored({ version: 1, members: [] });

    expect(await storage.read('usr_vendor_1')).toEqual([]);
  });

  it('reads every old member as active, whatever stray status the record holds', async () => {
    // Version 1 never wrote one; nobody could be disabled then.
    await stored({ version: 1, members: [{ ...statusless(FARHAN), status: 'DISABLED' }] });

    expect(await storage.read('usr_vendor_1')).toEqual([{ ...statusless(FARHAN), status: 'ACTIVE' }]);
  });

  it('still drops an old member that does not decode', async () => {
    await stored({
      version: 1,
      // Not a missing role, which is no longer a fault (T137): a missing name.
      members: [statusless(SURESH), { id: 'tm_10', name: '', role: 'Helper' }, statusless(FARHAN)],
    });

    expect((await storage.read('usr_vendor_1'))?.map(member => member.id)).toEqual(['tm_1', 'tm_3']);
  });

  it('drops a current member whose status is missing, blank or not a string', async () => {
    await stored({
      version: 2,
      members: [
        SURESH,
        statusless({ ...FARHAN, id: 'tm_20' }),
        { ...FARHAN, id: 'tm_21', status: '' },
        { ...FARHAN, id: 'tm_22', status: '   ' },
        { ...FARHAN, id: 'tm_23', status: 1 },
        { ...FARHAN, id: 'tm_24', status: null },
        { ...FARHAN, id: 'tm_25', status: { value: 'DISABLED' } },
        FARHAN,
      ],
    });

    expect(await storage.read('usr_vendor_1')).toEqual([SURESH, FARHAN]);
  });

  it('keeps a well-formed status it does not know, as written — wording it is not its job', async () => {
    await stored({ version: 2, members: [{ ...FARHAN, status: 'ON_LEAVE' }] });

    expect(await storage.read('usr_vendor_1')).toEqual([{ ...FARHAN, status: 'ON_LEAVE' }]);
  });
});

describe('AsyncStorageMockVendorTeam — failures', () => {
  const storage = new AsyncStorageMockVendorTeam();

  it('reads an unreadable device as never saved, and does not throw', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    expect(await storage.read('usr_vendor_1')).toBeNull();
  });

  it('says a write failed rather than throwing', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    expect(await storage.write('usr_vendor_1', [SURESH])).toBe(false);
  });
});

/**
 * Section 39's Profile Image (2026-10-21): an optional `photoUrl` that every
 * record already saved satisfies by not having — so no new version, and old
 * records read exactly as before — and that, when present, must be what the
 * service stores: an http(s) URL.
 */
describe('AsyncStorageMockVendorTeam — photo', () => {
  const storage = new AsyncStorageMockVendorTeam();
  const PHOTO = 'https://cdn.example.com/team/suresh.jpg';

  it('reads a member’s photo back, and still writes version 2', async () => {
    await storage.write('usr_vendor_1', [{ ...SURESH, photoUrl: PHOTO }, FARHAN]);

    expect(await storage.read('usr_vendor_1')).toEqual([{ ...SURESH, photoUrl: PHOTO }, FARHAN]);
    expect(JSON.parse(String(await AsyncStorage.getItem(KEY))).version).toBe(2);
  });

  it('reads a team saved before photos exactly as it was — no photo key on anybody', async () => {
    // As 3E-11 wrote it: version 2, no member with a photo.
    await AsyncStorage.setItem(KEY, JSON.stringify({ version: 2, members: [SURESH, FARHAN] }));

    const read = await storage.read('usr_vendor_1');
    expect(read).toEqual([SURESH, FARHAN]);
    expect(Object.keys(read?.[0] ?? {}).sort()).toEqual(['id', 'name', 'phone', 'role', 'status']);
    expect(Object.keys(read?.[1] ?? {}).sort()).toEqual(['id', 'name', 'role', 'status']);
  });

  it('still reads a version 1 team, with no photo key on anybody', async () => {
    await stored({ version: 1, members: [statusless(SURESH), statusless(FARHAN)] });

    const read = await storage.read('usr_vendor_1');
    expect(read?.every(member => !('photoUrl' in member))).toBe(true);
  });

  it('drops a member whose photo is not an http(s) URL, keeping the rest', async () => {
    await stored({
      version: 2,
      members: [
        { ...SURESH, photoUrl: PHOTO },
        { ...FARHAN, id: 'tm_30', photoUrl: 'file:///cache/farhan.jpg' },
        { ...FARHAN, id: 'tm_31', photoUrl: '' },
        { ...FARHAN, id: 'tm_32', photoUrl: 'https://' },
        { ...FARHAN, id: 'tm_33', photoUrl: ' https://cdn.example.com/padded.jpg' },
        { ...FARHAN, id: 'tm_34', photoUrl: 42 },
        { ...FARHAN, id: 'tm_35', photoUrl: null },
        FARHAN,
      ],
    });

    expect(await storage.read('usr_vendor_1')).toEqual([{ ...SURESH, photoUrl: PHOTO }, FARHAN]);
  });
});
