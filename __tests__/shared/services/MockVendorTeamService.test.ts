/**
 * The mock vendor team service stands in for the endpoints section 39's team
 * will live on (Phase 3E-7), so it is held to what a backend would do,
 * independently of any screen:
 *
 * - it answers for the signed-in vendor only — nobody, and a customer, are
 *   refused on every call; no call takes a vendor id
 * - one vendor never sees or changes another's team: a member id that is not
 *   on this team is `notFound`, even when it is on somebody else's
 * - it re-checks what it is sent (a name and a role within their ceilings, a
 *   phone that is a phone) and stores it normalised; a refusal changes nothing
 * - every mutation answers with the whole team, in the order members were added
 * - the team survives a restart; "nobody" stays nobody; a removed member's id
 *   is never handed to somebody new; a change that could not be stored did not
 *   happen
 * - two changes in flight both land
 * - section 39's status: a new member is active; an edit keeps the status;
 *   `setMemberStatus` disables and enables, changes nothing else, succeeds
 *   unchanged when the member already has that status, refuses a status it
 *   does not know (`validation`) and a member not on the team (`notFound`),
 *   is stored or did not happen, and queues behind the other changes
 * - section 39's Profile Image (2026-10-21): an uploaded http(s) URL or none,
 *   trimmed, refused otherwise; set, replaced, and removed by an edit that
 *   leaves it out; kept through a status change and a restart
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthUser } from '@/features/auth/types';
import { MockVendorTeamService } from '@/shared/services/mock/MockVendorTeamService';
import {
  AsyncStorageMockVendorTeam,
  type MockVendorTeamStorage,
} from '@/shared/services/mock/MockVendorTeamStorage';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type {
  SettableTeamMemberStatus,
  TeamMember,
  TeamMemberInput,
} from '@/shared/services/types/VendorTeamService';
import { AppError } from '@/shared/types/error';

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const MEENA: AuthUser = {
  id: 'usr_vendor_2',
  firstName: 'Meena',
  lastName: 'Iyer',
  phone: '9000000002',
  role: 'vendor',
};

const ASHA: AuthUser = {
  id: 'usr_1',
  firstName: 'Asha',
  lastName: 'Patel',
  phone: '9876543210',
  role: 'customer',
};

/** Ravi's starting team, as the fixtures write it. */
const RAVI_TEAM: TeamMember[] = [
  { id: 'tm_1', name: 'Suresh Naik', role: 'Senior technician', phone: '9000000101', status: 'ACTIVE' },
  {
    id: 'tm_2',
    name: 'Venkata Subrahmanya Lakshmi Narasimhamurthy-Ramachandran',
    role: 'Installation and wiring specialist, weekend shifts',
    phone: '9000000102',
    status: 'ACTIVE',
  },
  { id: 'tm_3', name: 'Farhan Ali', role: 'Helper', status: 'ACTIVE' },
];

let current: AuthUser | null;
let clock: number;

function service(options: { storage?: MockVendorTeamStorage } = {}) {
  return new MockVendorTeamService({
    latency: NO_LATENCY,
    currentUser: async () => current,
    now: () => clock,
    ...options,
  });
}

/** What the service rejected with, as an AppError. */
async function refusal(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    return AppError.from(caught);
  }
  throw new Error('Expected the call to be refused');
}

const names = (members: TeamMember[]) => members.map(member => member.name);

beforeEach(async () => {
  current = RAVI;
  clock = Date.parse('2026-10-08T12:00:00.000Z');
  await AsyncStorage.clear();
});

describe('MockVendorTeamService — reading the team', () => {
  it('gives Ravi his starting team, in order', async () => {
    expect(await service().listMembers()).toEqual(RAVI_TEAM);
  });

  it('gives a vendor who has just set up nobody', async () => {
    current = MEENA;

    expect(await service().listMembers()).toEqual([]);
  });

  it('gives a vendor registered in the app nobody', async () => {
    current = { ...MEENA, id: 'usr_vendor_registered_9' };

    expect(await service().listMembers()).toEqual([]);
  });

  it('carries exactly a member’s fields — and no phone key for a member without one', async () => {
    const [withPhone, , withoutPhone] = await service().listMembers();

    expect(Object.keys(withPhone).sort()).toEqual(['id', 'name', 'phone', 'role', 'status']);
    expect(Object.keys(withoutPhone).sort()).toEqual(['id', 'name', 'role', 'status']);
  });

  it('hands out fresh objects, so a caller cannot change the next answer', async () => {
    const team = service();
    const first = await team.listMembers();
    first[0].name = 'Changed';
    first.pop();

    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });
});

describe('MockVendorTeamService — adding', () => {
  it('adds a member at the end and answers with the whole team', async () => {
    const team = service();

    const answer = await team.addMember({ name: 'Kiran Rao', role: 'Apprentice', phone: '9000000104' });

    expect(names(answer)).toEqual([...names(RAVI_TEAM), 'Kiran Rao']);
    expect(answer[3]).toEqual({
      id: expect.stringMatching(/^tm_/),
      name: 'Kiran Rao',
      role: 'Apprentice',
      phone: '9000000104',
      status: 'ACTIVE',
    });
    expect(await team.listMembers()).toEqual(answer);
  });

  it('adds every new member active, whatever the input holds', async () => {
    const team = service();
    const sneaked = { name: 'Kiran Rao', role: 'Apprentice', status: 'DISABLED' };

    const answer = await team.addMember(sneaked);

    expect(answer[3].status).toBe('ACTIVE');
  });

  it('stores what it was sent tidied: trimmed, the phone as digits', async () => {
    const answer = await service().addMember({
      name: '  Kiran Rao ',
      role: ' Apprentice  ',
      phone: '+91 90000-00104',
    });

    expect(answer[3]).toMatchObject({ name: 'Kiran Rao', role: 'Apprentice', phone: '919000000104' });
  });

  it('stores a blank phone as no phone at all', async () => {
    for (const phone of [undefined, '', '   ']) {
      current = { ...MEENA, id: `usr_vendor_blank_${String(phone).length}` };
      const [added] = await service().addMember({ name: 'Kiran Rao', role: 'Apprentice', phone });

      expect('phone' in added).toBe(false);
    }
  });

  it('refuses a missing name or role, one too long, or a phone that is not a phone — and adds nobody', async () => {
    const team = service();
    const refused = [
      { name: '', role: 'Helper' },
      { name: '   ', role: 'Helper' },
      { name: 'Kiran Rao', role: '' },
      { name: 'Kiran Rao', role: '  ' },
      { name: 'K'.repeat(81), role: 'Helper' },
      { name: 'Kiran Rao', role: 'R'.repeat(61) },
      { name: 'Kiran Rao', role: 'Helper', phone: '12345' },
      { name: 'Kiran Rao', role: 'Helper', phone: 'call me' },
      { name: 'Kiran Rao', role: 'Helper', phone: '1'.repeat(16) },
    ];

    for (const input of refused) {
      expect((await refusal(team.addMember(input))).kind).toBe('validation');
    }
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });

  it('accepts a name and a role at exactly their ceilings', async () => {
    const answer = await service().addMember({ name: 'K'.repeat(80), role: 'R'.repeat(60) });

    expect(answer).toHaveLength(4);
  });

  it('lets two adds in flight both land', async () => {
    const team = service();

    await Promise.all([
      team.addMember({ name: 'Kiran Rao', role: 'Apprentice' }),
      team.addMember({ name: 'Leela Das', role: 'Helper' }),
    ]);

    const after = await team.listMembers();
    expect(names(after)).toEqual([...names(RAVI_TEAM), 'Kiran Rao', 'Leela Das']);
    expect(new Set(after.map(member => member.id)).size).toBe(5);
  });

  it('never gives a new member the id of one who was removed', async () => {
    const team = service();
    const added = await team.addMember({ name: 'Kiran Rao', role: 'Apprentice' });
    const kiran = added[3].id;

    await team.removeMember(kiran);
    clock += 1;
    const again = await team.addMember({ name: 'Leela Das', role: 'Helper' });

    expect(again[3].id).not.toBe(kiran);
  });
});

describe('MockVendorTeamService — editing', () => {
  it('replaces a member’s details and keeps their id and place', async () => {
    const answer = await service().updateMember('tm_2', {
      name: 'Venkat Rao',
      role: 'Supervisor',
      phone: '9000000202',
    });

    expect(answer[1]).toEqual({
      id: 'tm_2',
      name: 'Venkat Rao',
      role: 'Supervisor',
      phone: '9000000202',
      status: 'ACTIVE',
    });
    expect(answer.map(member => member.id)).toEqual(['tm_1', 'tm_2', 'tm_3']);
  });

  it('clears a phone the vendor emptied', async () => {
    const answer = await service().updateMember('tm_1', { name: 'Suresh Naik', role: 'Senior technician', phone: '' });

    expect(answer[0]).toEqual({ id: 'tm_1', name: 'Suresh Naik', role: 'Senior technician', status: 'ACTIVE' });
  });

  it('keeps a disabled member disabled when their details change, whatever the input holds', async () => {
    const team = service();
    await team.setMemberStatus('tm_3', 'DISABLED');
    const sneaked = { name: 'Farhan Ali', role: 'Senior helper', status: 'ACTIVE' };

    const answer = await team.updateMember('tm_3', sneaked);

    expect(answer[2]).toEqual({ id: 'tm_3', name: 'Farhan Ali', role: 'Senior helper', status: 'DISABLED' });
  });

  it('refuses invalid details and changes nobody', async () => {
    const team = service();

    expect((await refusal(team.updateMember('tm_1', { name: '', role: 'Helper' }))).kind).toBe(
      'validation',
    );
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });

  it('answers not found for an id that is not on the team', async () => {
    const team = service();

    expect((await refusal(team.updateMember('tm_404', { name: 'X', role: 'Y' }))).kind).toBe('notFound');
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });
});

describe('MockVendorTeamService — removing', () => {
  it('takes the member off and answers with who remains', async () => {
    const answer = await service().removeMember('tm_2');

    expect(answer.map(member => member.id)).toEqual(['tm_1', 'tm_3']);
  });

  it('answers not found for an id that is not on the team, and removes nobody', async () => {
    const team = service();

    expect((await refusal(team.removeMember('tm_404'))).kind).toBe('notFound');
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });

  it('can empty the team', async () => {
    const team = service();
    for (const { id } of RAVI_TEAM) {
      await team.removeMember(id);
    }

    expect(await team.listMembers()).toEqual([]);
  });
});

describe('MockVendorTeamService — whose team', () => {
  it('never shows one vendor another’s team', async () => {
    const team = service();
    await team.addMember({ name: 'Kiran Rao', role: 'Apprentice' });

    current = MEENA;
    expect(await team.listMembers()).toEqual([]);
    await team.addMember({ name: 'Leela Das', role: 'Helper' });
    expect(names(await team.listMembers())).toEqual(['Leela Das']);

    current = RAVI;
    expect(names(await team.listMembers())).toEqual([...names(RAVI_TEAM), 'Kiran Rao']);
  });

  it('will not let one vendor change or remove another’s member — not found, not forbidden', async () => {
    const team = service();

    current = MEENA;
    expect((await refusal(team.updateMember('tm_1', { name: 'Taken', role: 'Over' }))).kind).toBe(
      'notFound',
    );
    expect((await refusal(team.removeMember('tm_1'))).kind).toBe('notFound');
    expect((await refusal(team.setMemberStatus('tm_1', 'DISABLED'))).kind).toBe('notFound');

    current = RAVI;
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });

  it('refuses every call when nobody is signed in, and for a customer', async () => {
    const team = service();

    for (const user of [null, ASHA]) {
      current = user;
      const calls = [
        team.listMembers(),
        team.addMember({ name: 'Kiran Rao', role: 'Apprentice' }),
        team.updateMember('tm_1', { name: 'Kiran Rao', role: 'Apprentice' }),
        team.removeMember('tm_1'),
        team.setMemberStatus('tm_1', 'DISABLED'),
      ];
      for (const call of calls) {
        expect((await refusal(call)).kind).toBe('unauthorized');
      }
    }

    current = RAVI;
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });

  it('refuses when it was never told who is signed in', async () => {
    const team = new MockVendorTeamService({ latency: NO_LATENCY });

    expect((await refusal(team.listMembers())).kind).toBe('unauthorized');
  });

  it('takes no vendor id on any call: whose team it is, is the session’s alone', () => {
    const team = service();

    expect(team.listMembers.length).toBe(0);
    expect(team.addMember.length).toBe(1);
    expect(team.updateMember.length).toBe(2);
    expect(team.removeMember.length).toBe(1);
    expect(team.setMemberStatus.length).toBe(2);
  });
});

describe('MockVendorTeamService — kept on the device', () => {
  it('still has the team after a restart', async () => {
    await service({ storage: new AsyncStorageMockVendorTeam() }).addMember({
      name: 'Kiran Rao',
      role: 'Apprentice',
    });

    const restarted = service({ storage: new AsyncStorageMockVendorTeam() });
    expect(names(await restarted.listMembers())).toEqual([...names(RAVI_TEAM), 'Kiran Rao']);
  });

  it('keeps an emptied team empty, rather than handing the starting team back', async () => {
    const before = service({ storage: new AsyncStorageMockVendorTeam() });
    for (const { id } of RAVI_TEAM) {
      await before.removeMember(id);
    }

    const restarted = service({ storage: new AsyncStorageMockVendorTeam() });
    expect(await restarted.listMembers()).toEqual([]);
  });

  it('keeps each vendor’s team under their own key', async () => {
    await service({ storage: new AsyncStorageMockVendorTeam() }).addMember({
      name: 'Kiran Rao',
      role: 'Apprentice',
    });

    current = MEENA;
    expect(await service({ storage: new AsyncStorageMockVendorTeam() }).listMembers()).toEqual([]);
  });

  it('fails a change it could not store, and the team is as it was', async () => {
    const storage: MockVendorTeamStorage = {
      read: jest.fn(async () => null),
      write: jest.fn(async () => false),
    };
    const team = service({ storage });

    expect((await refusal(team.addMember({ name: 'Kiran Rao', role: 'Apprentice' }))).kind).toBe(
      'unknown',
    );
    expect((await refusal(team.removeMember('tm_1'))).kind).toBe('unknown');
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });

  it('carries on with the next change after one failed', async () => {
    const team = service();

    await refusal(team.addMember({ name: '', role: 'Helper' }));
    const answer = await team.addMember({ name: 'Kiran Rao', role: 'Apprentice' });

    expect(answer).toHaveLength(4);
  });
});

describe('MockVendorTeamService — status', () => {
  const statuses = (members: TeamMember[]) => members.map(member => member.status);

  it('disables a member and answers with the whole team, everything else unchanged', async () => {
    const team = service();

    const answer = await team.setMemberStatus('tm_2', 'DISABLED');

    expect(answer).toEqual([
      RAVI_TEAM[0],
      { ...RAVI_TEAM[1], status: 'DISABLED' },
      RAVI_TEAM[2],
    ]);
    expect(await team.listMembers()).toEqual(answer);
  });

  it('enables a disabled member again', async () => {
    const team = service();
    await team.setMemberStatus('tm_3', 'DISABLED');

    const answer = await team.setMemberStatus('tm_3', 'ACTIVE');

    expect(answer).toEqual(RAVI_TEAM);
  });

  it('succeeds unchanged when the member already has that status', async () => {
    const team = service();

    expect(await team.setMemberStatus('tm_1', 'ACTIVE')).toEqual(RAVI_TEAM);

    await team.setMemberStatus('tm_1', 'DISABLED');
    const again = await team.setMemberStatus('tm_1', 'DISABLED');
    expect(statuses(again)).toEqual(['DISABLED', 'ACTIVE', 'ACTIVE']);
  });

  it('keeps a disabled member where they were in the list', async () => {
    const team = service();

    const answer = await team.setMemberStatus('tm_1', 'DISABLED');

    expect(answer.map(member => member.id)).toEqual(['tm_1', 'tm_2', 'tm_3']);
  });

  it('refuses a status it does not know, and changes nobody', async () => {
    const team = service();

    for (const status of ['SUSPENDED', 'disabled', 'Active', '', ' DISABLED ', undefined, null, 1]) {
      expect(
        (await refusal(team.setMemberStatus('tm_1', status as unknown as SettableTeamMemberStatus))).kind,
      ).toBe('validation');
    }
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });

  it('answers not found for an id that is not on the team, and changes nobody', async () => {
    const team = service();

    expect((await refusal(team.setMemberStatus('tm_404', 'DISABLED'))).kind).toBe('notFound');
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });

  it('can still remove a disabled member', async () => {
    const team = service();
    await team.setMemberStatus('tm_3', 'DISABLED');

    const answer = await team.removeMember('tm_3');

    expect(answer.map(member => member.id)).toEqual(['tm_1', 'tm_2']);
  });

  it('fails a status change it could not store, and the member is as they were', async () => {
    const write = jest.fn(async () => false);
    const team = service({ storage: { read: jest.fn(async () => null), write } });

    expect((await refusal(team.setMemberStatus('tm_1', 'DISABLED'))).kind).toBe('unknown');
    expect(write).toHaveBeenCalledTimes(1);
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });

  it('keeps a disabled member disabled after a restart', async () => {
    await service({ storage: new AsyncStorageMockVendorTeam() }).setMemberStatus('tm_3', 'DISABLED');

    const restarted = service({ storage: new AsyncStorageMockVendorTeam() });
    expect(statuses(await restarted.listMembers())).toEqual(['ACTIVE', 'ACTIVE', 'DISABLED']);
  });

  it('queues behind the other changes, each reading what the last one wrote', async () => {
    const team = service();

    await Promise.all([
      team.setMemberStatus('tm_1', 'DISABLED'),
      team.updateMember('tm_1', { name: 'Suresh Naik', role: 'Supervisor' }),
      team.addMember({ name: 'Kiran Rao', role: 'Apprentice' }),
      team.setMemberStatus('tm_3', 'DISABLED'),
    ]);

    const after = await team.listMembers();
    // The edit came after the disable and kept it; the add and the second disable both landed.
    expect(after[0]).toEqual({ id: 'tm_1', name: 'Suresh Naik', role: 'Supervisor', status: 'DISABLED' });
    expect(names(after)).toEqual([...names(RAVI_TEAM), 'Kiran Rao']);
    expect(statuses(after)).toEqual(['DISABLED', 'ACTIVE', 'DISABLED', 'ACTIVE']);
  });

  it('carries on with the next change after a refused status', async () => {
    const team = service();

    await refusal(team.setMemberStatus('tm_404', 'DISABLED'));
    const answer = await team.setMemberStatus('tm_1', 'DISABLED');

    expect(answer[0].status).toBe('DISABLED');
  });

  it('never lets one vendor’s disable reach another vendor', async () => {
    const team = service();
    await team.setMemberStatus('tm_1', 'DISABLED');

    current = MEENA;
    const [leela] = await team.addMember({ name: 'Leela Das', role: 'Helper' });
    expect(leela.status).toBe('ACTIVE');

    current = RAVI;
    expect(statuses(await team.listMembers())).toEqual(['DISABLED', 'ACTIVE', 'ACTIVE']);
  });
});

/**
 * Section 39's Profile Image (2026-10-21): `photoUrl` is an uploaded picture's
 * http(s) URL or absent, re-checked as a server would, and — because
 * `updateMember` replaces every detail — absent on an edit removes it.
 */
describe('MockVendorTeamService — photo', () => {
  const PHOTO = 'https://cdn.example.com/team/kiran.jpg';
  const SURESH_DETAILS = { name: 'Suresh Naik', role: 'Senior technician', phone: '9000000101' };

  it('adds a member with their photo, stored trimmed, as exactly one more field', async () => {
    const answer = await service().addMember({ name: 'Kiran Rao', role: 'Apprentice', photoUrl: `  ${PHOTO} ` });

    expect(answer[3]).toEqual({
      id: expect.stringMatching(/^tm_/),
      name: 'Kiran Rao',
      role: 'Apprentice',
      photoUrl: PHOTO,
      status: 'ACTIVE',
    });
  });

  it('accepts http as well as https, in any case', async () => {
    const team = service();

    await team.addMember({ name: 'Kiran Rao', role: 'Apprentice', photoUrl: 'http://cdn.example.com/a.jpg' });
    const answer = await team.addMember({ name: 'Leela Das', role: 'Helper', photoUrl: 'HTTPS://CDN.EXAMPLE.COM/B.JPG' });

    expect(answer.map(member => member.photoUrl)).toEqual([
      undefined,
      undefined,
      undefined,
      'http://cdn.example.com/a.jpg',
      'HTTPS://CDN.EXAMPLE.COM/B.JPG',
    ]);
  });

  it('stores no photo at all for an absent or blank one — never an empty string', async () => {
    for (const photoUrl of [undefined, '', '   ']) {
      current = { ...MEENA, id: `usr_vendor_photo_${String(photoUrl).length}` };
      const [added] = await service().addMember({ name: 'Kiran Rao', role: 'Apprentice', photoUrl });

      expect('photoUrl' in added).toBe(false);
    }
  });

  it('refuses a photo that is not an uploaded http(s) URL — and adds nobody', async () => {
    const team = service();
    const refused: unknown[] = [
      'file:///data/user/0/com.fixora/cache/kiran.jpg',
      'content://media/external/images/media/42',
      'cdn.example.com/kiran.jpg',
      'https://',
      'https:// cdn.example.com/kiran.jpg',
      'ftp://cdn.example.com/kiran.jpg',
      42,
      null,
      { uri: PHOTO },
    ];

    for (const photoUrl of refused) {
      const input = { name: 'Kiran Rao', role: 'Apprentice', photoUrl } as unknown as TeamMemberInput;
      expect((await refusal(team.addMember(input))).kind).toBe('validation');
    }
    expect(await team.listMembers()).toEqual(RAVI_TEAM);
  });

  it('sets a photo on an edit, and replaces it with another', async () => {
    const team = service();

    const first = await team.updateMember('tm_1', { ...SURESH_DETAILS, photoUrl: PHOTO });
    expect(first[0]).toEqual({ id: 'tm_1', ...SURESH_DETAILS, photoUrl: PHOTO, status: 'ACTIVE' });

    const second = await team.updateMember('tm_1', { ...SURESH_DETAILS, photoUrl: 'https://cdn.example.com/b.jpg' });
    expect(second[0].photoUrl).toBe('https://cdn.example.com/b.jpg');
  });

  it('removes the photo when an edit leaves it out — every detail is replaced', async () => {
    const team = service();
    await team.updateMember('tm_1', { ...SURESH_DETAILS, photoUrl: PHOTO });

    const answer = await team.updateMember('tm_1', SURESH_DETAILS);

    expect(answer[0]).toEqual({ id: 'tm_1', ...SURESH_DETAILS, status: 'ACTIVE' });
    expect('photoUrl' in answer[0]).toBe(false);
  });

  it('refuses an edit with a bad photo and keeps the one the member had', async () => {
    const team = service();
    await team.updateMember('tm_1', { ...SURESH_DETAILS, photoUrl: PHOTO });

    const bad = { ...SURESH_DETAILS, photoUrl: 'file:///cache/b.jpg' };
    expect((await refusal(team.updateMember('tm_1', bad))).kind).toBe('validation');
    expect((await team.listMembers())[0].photoUrl).toBe(PHOTO);
  });

  it('keeps the photo through a status change, and after a restart', async () => {
    await service({ storage: new AsyncStorageMockVendorTeam() }).updateMember('tm_1', {
      ...SURESH_DETAILS,
      photoUrl: PHOTO,
    });
    await service({ storage: new AsyncStorageMockVendorTeam() }).setMemberStatus('tm_1', 'DISABLED');

    const [suresh] = await service({ storage: new AsyncStorageMockVendorTeam() }).listMembers();
    expect(suresh).toEqual({ id: 'tm_1', ...SURESH_DETAILS, photoUrl: PHOTO, status: 'DISABLED' });
  });

  it('never shows one vendor another vendor’s member photo', async () => {
    const team = service();
    await team.updateMember('tm_1', { ...SURESH_DETAILS, photoUrl: PHOTO });

    current = MEENA;
    expect(JSON.stringify(await team.listMembers())).not.toContain(PHOTO);
  });
});
