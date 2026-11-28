/**
 * ApiVendorTeamService keeps the vendor's team on the backend's `/team` routes
 * (Phase 4A, 17/11/2026; PROJECT_BIBLE.md section 39). Pinned here:
 *
 * - each call's route, method and exact body, and the whole team read again
 *   after every change, in the order members were added;
 * - the status table both ways (`INACTIVE` is the app's `DISABLED`), and an
 *   unknown status passed through;
 * - the phone optional (the request contract's §7): a member added without
 *   one sends none, and an edit without one sends `phone: null`, which clears
 *   it (absent would leave it unchanged);
 * - the role optional (phase5-contract.md section 4, T137, 28/11/2026): none is
 *   always sent as `designation: ""` — on an add, and on an edit, where it
 *   clears it — and a stored `""`, or none at all, reads as no role;
 * - a new photo sent as the URL `ImageService` uploaded it to, and every photo
 *   read back through `toImageUrl` (Phase 4B, 24/11/2026);
 * - `_id`, `vendorId` and timestamps never leaving the service.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import type { AuthUser } from '@/features/auth/types';
import { ApiVendorTeamService } from '@/shared/services/api/ApiVendorTeamService';
import { TEAM_MEMBER_STATUS, type TeamMemberInput } from '@/shared/services/types/VendorTeamService';
import { AppError } from '@/shared/types/error';

type Reply = { status: number; body: unknown } | 'network';
type Route = (body: Record<string, unknown> | undefined) => Reply;

const sent: { method: string; url: string; body: Record<string, unknown> | undefined }[] = [];
const unrouted: string[] = [];
const originalAdapter = httpClient.defaults.adapter;

function backend(routes: Record<string, Route>): void {
  const adapter: AxiosAdapter = async config => {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : undefined;
    const method = (config.method ?? 'get').toUpperCase();
    sent.push({ method, url: config.url ?? '', body });
    const route = routes[`${method} ${config.url}`];
    if (!route) {
      unrouted.push(`${method} ${config.url}`);
      throw new AxiosError('No route in the fake backend', AxiosError.ERR_NETWORK, config);
    }
    const answer = route(body);
    if (answer === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response: AxiosResponse = { data: answer.body, status: answer.status, statusText: '', headers: {}, config };
    if (answer.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

const ok = (data: unknown): Reply => ({
  status: 200,
  body: { success: true, message: 'Done.', data, meta: {}, errors: null },
});
const fail = (status: number, message: string, code?: string): Reply => ({
  status,
  body: { success: false, message, code, errors: null, data: null },
});

const VENDOR_ID = '6afc3ce87d5e8db042251443';
const ANITA = '6afc3d0a7d5e8db042251501';
const SURESH = '6afc3d0a7d5e8db042251502';
const PHOTO = 'https://cdn.example.com/team/anita.jpg';
/** A photo the backend stored, and the address this phone loads it from. */
const STORED_PATH = '/uploads/team/aa11bb22cc33dd44ee55ff6677889900.jpg';
const STORED_URL = `${AppConfig.api.baseUrl.replace(/\/api\/v1\/?$/, '')}${STORED_PATH}`;

/** A member as `teamMapper` answers. */
function memberRow(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    vendorId: VENDOR_ID,
    name: 'Anita Rao',
    phone: '9000011111',
    designation: 'Electrician',
    profileImage: null,
    status: 'ACTIVE',
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-10T09:00:00.000Z',
    ...extra,
  };
}

/** The backend lists newest first. */
const TEAM = () => [
  memberRow(SURESH, {
    name: 'Suresh Iyer',
    phone: '9000022222',
    designation: 'Helper',
    status: 'INACTIVE',
    createdAt: '2026-11-12T09:00:00.000Z',
  }),
  memberRow(ANITA, { profileImage: PHOTO }),
];

const vendor: AuthUser = { id: VENDOR_ID, firstName: 'Ravi', lastName: 'Kumar', phone: '9000000001', role: 'vendor' };
let session: AuthUser | null;
let service: ApiVendorTeamService;

const input = (extra: Partial<TeamMemberInput> = {}): TeamMemberInput => ({
  name: 'Anita Rao',
  role: 'Senior electrician',
  phone: '9000011111',
  ...extra,
});

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

beforeEach(() => {
  sent.length = 0;
  unrouted.length = 0;
  session = vendor;
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  service = new ApiVendorTeamService({ currentUser: async () => session });
});

afterEach(() => {
  expect(unrouted).toEqual([]);
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

describe('listMembers', () => {
  it('reads the team route, in the order members were added', async () => {
    backend({ 'GET /team': () => ok(TEAM()) });

    const team = await service.listMembers();

    expect(sent).toEqual([{ method: 'GET', url: '/team', body: undefined }]);
    expect(team.map(member => member.id)).toEqual([ANITA, SURESH]);
  });

  it('reads each member field by field: designation is the role, the status through the table', async () => {
    backend({ 'GET /team': () => ok(TEAM()) });

    const team = await service.listMembers();

    expect(team).toEqual([
      { id: ANITA, name: 'Anita Rao', role: 'Electrician', phone: '9000011111', photoUrl: PHOTO, status: 'ACTIVE' },
      { id: SURESH, name: 'Suresh Iyer', role: 'Helper', phone: '9000022222', status: TEAM_MEMBER_STATUS.disabled },
    ]);
    expect(JSON.stringify(team)).not.toMatch(/_id|vendorId|createdAt|updatedAt|designation|profileImage/);
  });

  it.each([
    ['an empty designation', ''],
    ['a blank one', '   '],
    ['none at all', undefined],
    ['null', null],
  ])('reads %s as no role — the key absent, never an empty string (T137)', async (_name, designation) => {
    const row: Record<string, unknown> = memberRow(ANITA, { designation });
    if (designation === undefined) {
      delete row.designation;
    }
    backend({ 'GET /team': () => ok([row]) });

    const [member] = await service.listMembers();

    expect(member).toEqual({ id: ANITA, name: 'Anita Rao', phone: '9000011111', status: 'ACTIVE' });
    expect('role' in member).toBe(false);
  });

  it('reads a stored photo path as an address this phone can load, and anything else as none', async () => {
    backend({
      'GET /team': () =>
        ok([
          memberRow(ANITA, { profileImage: STORED_PATH }),
          memberRow(SURESH, { profileImage: 'anita.jpg', createdAt: '2026-11-12T09:00:00.000Z' }),
        ]),
    });

    const [anita, suresh] = await service.listMembers();

    expect(anita.photoUrl).toBe(STORED_URL);
    expect(suresh).not.toHaveProperty('photoUrl');
  });

  it('passes a status the app does not know through as the backend sent it', async () => {
    backend({ 'GET /team': () => ok([memberRow(ANITA, { status: 'ON_LEAVE' })]) });

    expect((await service.listMembers())[0].status).toBe('ON_LEAVE');
  });

  it('answers a vendor with nobody with an empty team', async () => {
    backend({ 'GET /team': () => ok([]) });

    await expect(service.listMembers()).resolves.toEqual([]);
  });

  it.each([
    ['not a list', ok({ members: [] })],
    ['a member without a name', ok([memberRow(ANITA, { name: '' })])],
  ])('refuses an answer that is %s as a server fault', async (_name, reply) => {
    backend({ 'GET /team': () => reply });

    expect((await rejectionOf(service.listMembers())).kind).toBe('server');
  });
});

describe('addMember', () => {
  it('adds the member with exactly the backend’s fields, then answers with the whole team', async () => {
    backend({ 'POST /team': () => ok(memberRow(ANITA)), 'GET /team': () => ok(TEAM()) });

    const team = await service.addMember(input({ phone: '90000 11111' }));

    expect(sent[0]).toEqual({
      method: 'POST',
      url: '/team',
      // The phone as digits, the role as the backend's designation.
      body: { name: 'Anita Rao', phone: '9000011111', designation: 'Senior electrician' },
    });
    expect(sent[1].url).toBe('/team');
    expect(team).toHaveLength(2);
  });

  it.each([
    ['no phone', input({ phone: undefined })],
    ['a blank phone', input({ phone: '   ' })],
  ])('adds a member with %s, sending no phone at all — never an empty one', async (_name, member) => {
    backend({ 'POST /team': () => ok(memberRow(ANITA, { phone: null })), 'GET /team': () => ok(TEAM()) });

    await service.addMember(member);

    expect(sent[0].body).toEqual({ name: 'Anita Rao', designation: 'Senior electrician' });
  });

  it.each([
    ['no role', input({ role: undefined })],
    ['a blank role', input({ role: '   ' })],
  ])('adds a member with %s as designation "" — said, never left to a default (T137)', async (_name, member) => {
    backend({ 'POST /team': () => ok(memberRow(ANITA, { designation: '' })), 'GET /team': () => ok(TEAM()) });

    await service.addMember(member);

    expect(sent[0].body).toEqual({ name: 'Anita Rao', phone: '9000011111', designation: '' });
  });

  it('adds a member with the photo it uploaded, sent as it is held', async () => {
    backend({ 'POST /team': () => ok(memberRow(ANITA, { profileImage: STORED_PATH })), 'GET /team': () => ok(TEAM()) });

    await service.addMember(input({ photoUrl: STORED_URL }));

    // The backend takes the full URL back as its own path (contract §2).
    expect(sent[0].body).toEqual({
      name: 'Anita Rao',
      phone: '9000011111',
      designation: 'Senior electrician',
      profileImage: STORED_URL,
    });
  });

  it('sends no photo key for a member added without one — never an empty one', async () => {
    backend({ 'POST /team': () => ok(memberRow(ANITA)), 'GET /team': () => ok(TEAM()) });

    await service.addMember(input({ photoUrl: '  ' }));

    expect(sent[0].body).not.toHaveProperty('profileImage');
  });

  it('rejects a backend validation failure as validation', async () => {
    backend({ 'POST /team': () => fail(400, 'Validation Failed', 'VALIDATION_FAILED') });

    expect((await rejectionOf(service.addMember(input()))).kind).toBe('validation');
  });
});

describe('updateMember', () => {
  it('replaces every detail by id — no photo in the input clears the one they had', async () => {
    backend({ 'POST /team/update': () => ok(memberRow(ANITA)), 'GET /team': () => ok(TEAM()) });

    await service.updateMember(ANITA, input());

    expect(sent[0]).toEqual({
      method: 'POST',
      url: '/team/update',
      body: { id: ANITA, name: 'Anita Rao', phone: '9000011111', designation: 'Senior electrician', profileImage: null },
    });
    // No status: saving details can never re-enable a member.
    expect(sent[0].body).not.toHaveProperty('status');
    expect(sent[1]).toEqual({ method: 'GET', url: '/team', body: undefined });
  });

  it('sends the photo the member already has back unchanged, without reading it first', async () => {
    backend({ 'POST /team/update': () => ok(memberRow(ANITA, { profileImage: PHOTO })), 'GET /team': () => ok(TEAM()) });

    await service.updateMember(ANITA, input({ photoUrl: PHOTO }));

    expect(sent.map(call => call.url)).toEqual(['/team/update', '/team']);
    expect(sent[0].body).toMatchObject({ id: ANITA, profileImage: PHOTO });
  });

  it('sends a new photo it uploaded, as it is held', async () => {
    backend({
      'POST /team/update': () => ok(memberRow(ANITA, { profileImage: STORED_PATH })),
      'GET /team': () => ok(TEAM()),
    });

    await service.updateMember(ANITA, input({ photoUrl: STORED_URL }));

    expect(sent[0].body).toMatchObject({ id: ANITA, profileImage: STORED_URL });
  });

  it('reads a refused photo back as the validation failure it is', async () => {
    backend({
      'POST /team/update': () => fail(400, 'Validation Failed', 'VALIDATION_FAILED'),
    });

    const error = await rejectionOf(service.updateMember(ANITA, input({ photoUrl: 'https://picsum.photos/seed/x/8/6' })));

    expect(error.kind).toBe('validation');
  });

  it('clears the phone of an edit without one with `phone: null` — absent would keep the old number', async () => {
    backend({ 'POST /team/update': () => ok(memberRow(ANITA, { phone: null })), 'GET /team': () => ok(TEAM()) });

    await service.updateMember(ANITA, input({ phone: '  ' }));

    // No read first: the edit replaces every detail whatever the member had.
    expect(sent.map(call => call.url)).toEqual(['/team/update', '/team']);
    expect(sent[0].body).toEqual({
      id: ANITA,
      name: 'Anita Rao',
      phone: null,
      designation: 'Senior electrician',
      profileImage: null,
    });
  });

  it('clears the role of an edit without one with designation "" (T137)', async () => {
    backend({ 'POST /team/update': () => ok(memberRow(ANITA, { designation: '' })), 'GET /team': () => ok(TEAM()) });

    await service.updateMember(ANITA, input({ role: undefined }));

    expect(sent[0].body).toEqual({
      id: ANITA,
      name: 'Anita Rao',
      phone: '9000011111',
      designation: '',
      profileImage: null,
    });
  });

  it('answers somebody else’s member as not found, as the backend’s 404 says', async () => {
    backend({ 'POST /team/update': () => fail(404, 'Team member not found.', 'NOT_FOUND') });

    expect((await rejectionOf(service.updateMember(ANITA, input()))).kind).toBe('notFound');
  });
});

describe('setMemberStatus', () => {
  it.each([
    [TEAM_MEMBER_STATUS.disabled, 'INACTIVE'],
    [TEAM_MEMBER_STATUS.active, 'ACTIVE'],
  ] as const)('sends %s as the backend’s %s, and nothing else', async (status, backendStatus) => {
    backend({ 'POST /team/update': () => ok(memberRow(ANITA)), 'GET /team': () => ok(TEAM()) });

    await service.setMemberStatus(ANITA, status);

    expect(sent[0]).toEqual({ method: 'POST', url: '/team/update', body: { id: ANITA, status: backendStatus } });
  });

  it('refuses a status the app does not set, before sending anything', async () => {
    backend({});

    const error = await rejectionOf(service.setMemberStatus(ANITA, 'ON_LEAVE' as never));

    expect(error.kind).toBe('validation');
    expect(sent).toEqual([]);
  });
});

describe('removeMember', () => {
  it('deletes by id, carried in the body as the backend reads it, then answers with who remains', async () => {
    backend({ 'DELETE /team/delete': () => ok(null), 'GET /team': () => ok([memberRow(ANITA)]) });

    const team = await service.removeMember(SURESH);

    expect(sent[0]).toEqual({ method: 'DELETE', url: '/team/delete', body: { id: SURESH } });
    expect(team.map(member => member.id)).toEqual([ANITA]);
  });
});

describe('references and the session', () => {
  const calls: [string, (s: ApiVendorTeamService, id: string) => Promise<unknown>][] = [
    ['updateMember', (s, id) => s.updateMember(id, input())],
    ['setMemberStatus', (s, id) => s.setMemberStatus(id, TEAM_MEMBER_STATUS.disabled)],
    ['removeMember', (s, id) => s.removeMember(id)],
  ];

  it.each(calls)('%s answers an id that is not a backend id as not found, without asking', async (_name, call) => {
    backend({});

    expect((await rejectionOf(call(service, 'tm_1'))).kind).toBe('notFound');
    expect(sent).toEqual([]);
  });

  it.each([
    ['nobody', null],
    ['a customer', { ...vendor, role: 'customer' as const }],
  ])('refuses %s as unauthorized on every call, sending nothing', async (_name, who) => {
    session = who;
    backend({});

    for (const call of [
      () => service.listMembers(),
      () => service.addMember(input()),
      ...calls.map(([, run]) => () => run(service, ANITA)),
    ]) {
      expect((await rejectionOf(call())).kind).toBe('unauthorized');
    }
    expect(sent).toEqual([]);
  });

  it('rejects a dropped connection as network', async () => {
    backend({ 'GET /team': () => 'network' });

    expect((await rejectionOf(service.listMembers())).kind).toBe('network');
  });
});
