/**
 * ApiNotificationService reads the signed-in account's inbox from the real
 * backend. These tests pin:
 *
 * - the POST list route with paging in the body (the GET route reads a body it
 *   never gets), and `meta` as the app's `Page`;
 * - each row read by name: `message` as `body`, `isRead` as `read`, `type`
 *   passed through, and the one link built from a request's reference —
 *   in exactly the shape `parseNotificationLink` opens;
 * - the unread count read from every page (no count endpoint) — a floor
 *   (`{ atLeast }`) when the inbox is longer than the page ceiling;
 * - mark-all as one mark per unread notification, in order, a vanished one
 *   skipped (no bulk endpoint), and saying nothing false: incomplete when the
 *   inbox was cut short or it stopped after marking some, a rejection only when
 *   nothing was marked;
 * - `remove` as the backend's delete by id, and anything not in this inbox
 *   (404 `NOTIFICATION_NOT_FOUND`, Phase 4B contract §8) as not found; push
 *   registration inert;
 * - that `userId`, `userRole`, `referenceId` and `_id` never leave.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import { parseNotificationLink } from '@/features/notifications/constants/notificationLinks';
import { ApiNotificationService } from '@/shared/services/api/ApiNotificationService';
import { AppError } from '@/shared/types/error';

type Reply = { status: number; body: unknown } | 'network';

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

function backendAnswers(reply: (url: string, body: Record<string, unknown>) => Reply): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    const answer = reply(config.url ?? '', JSON.parse((config.data as string) ?? '{}'));
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

function ok(data: unknown, meta: Record<string, unknown> = {}): Reply {
  return { status: 200, body: { success: true, message: 'OK', data, meta, errors: null } };
}

function list(data: unknown[], meta: Record<string, unknown> = {}): Reply {
  return ok(data, { total: data.length, page: 1, limit: 100, pages: 1, hasNextPage: false, ...meta });
}

function failure(status: number, code: string): Reply {
  return { status, body: { success: false, message: 'Backend English', code, errors: null, data: null } };
}

function bodies(): Record<string, unknown>[] {
  return sent.map(config => JSON.parse((config.data as string) ?? '{}'));
}

const USER_ID = '6afc3e5d7c2e50812e44de8f';
const REQUEST_ID = '6afc3ea3c2951ec40c9a177a';

/** `notificationMapper`'s row. */
function row(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    userId: USER_ID,
    userRole: 'CUSTOMER',
    title: 'Service Request Created',
    message: 'Your booking REQ-0031002405 has been received.',
    type: 'SERVICE_REQUEST',
    referenceId: REQUEST_ID,
    isRead: false,
    readAt: null,
    createdAt: '2026-11-17T11:46:43.150Z',
    ...extra,
  };
}

const n = (index: number) => `6afc41000000000000000${String(index).padStart(3, '0')}`;

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

let service: ApiNotificationService;

beforeEach(() => {
  sent.length = 0;
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  service = new ApiNotificationService();
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

describe('list', () => {
  it('asks the POST list route for one page, paging in the body', async () => {
    backendAnswers(() => list([row(n(1))], { total: 21, page: 2, limit: 20, pages: 2, hasNextPage: false }));

    const page = await service.list({ page: 2, pageSize: 20 });

    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/notifications/list');
    expect(bodies()[0]).toEqual({ page: 2, limit: 20 });
    expect(page).toMatchObject({ page: 2, pageSize: 20, total: 21, hasMore: false });
  });

  it('reads a request notification with the one link the app opens', async () => {
    backendAnswers(() => list([row(n(1))]));

    const [notification] = (await service.list({ page: 1, pageSize: 20 })).items;

    expect(notification).toEqual({
      id: n(1),
      title: 'Service Request Created',
      body: 'Your booking REQ-0031002405 has been received.',
      createdAt: '2026-11-17T11:46:43.150Z',
      read: false,
      type: 'SERVICE_REQUEST',
      deepLink: `fixora://requests/${REQUEST_ID}`,
    });
    expect(parseNotificationLink(notification.deepLink)).toEqual({ kind: 'request', requestId: REQUEST_ID });
    expect(JSON.stringify(notification)).not.toMatch(/userId|userRole|referenceId|readAt|_id|CUSTOMER/);
  });

  it.each([
    ['another type', { type: 'GENERAL' }],
    ['no reference', { referenceId: null }],
  ])('gives a notification with %s no link at all', async (_case, extra) => {
    backendAnswers(() => list([row(n(1), extra)]));

    const [notification] = (await service.list({ page: 1, pageSize: 20 })).items;

    expect(notification).not.toHaveProperty('deepLink');
    expect(notification).not.toHaveProperty('iconName');
  });

  it('reads a read one as read', async () => {
    backendAnswers(() => list([row(n(1), { isRead: true, readAt: '2026-11-17T12:00:00.000Z' })]));

    const [notification] = (await service.list({ page: 1, pageSize: 20 })).items;

    expect(notification.read).toBe(true);
  });

  it.each([
    ['no id', { id: undefined }],
    ['no title', { title: '' }],
    ['no type', { type: undefined }],
  ])('refuses a row with %s as a server fault', async (_case, extra) => {
    backendAnswers(() => list([row(n(1), extra)]));

    const error = await rejectionOf(service.list({ page: 1, pageSize: 20 }));

    expect(error.kind).toBe('server');
  });
});

describe('getUnreadCount', () => {
  it('counts the unread ones on every page of the inbox', async () => {
    backendAnswers((_url, body) =>
      body.page === 1
        ? list([row(n(1)), row(n(2), { isRead: true }), row(n(3))], { hasNextPage: true })
        : list([row(n(3)), row(n(4))], { page: 2, hasNextPage: false }),
    );

    const count = await service.getUnreadCount();

    expect(bodies()).toEqual([
      { page: 1, limit: AppConfig.api.fullListPageSize },
      { page: 2, limit: AppConfig.api.fullListPageSize },
    ]);
    // n(3) is counted once, though a shifted page sent it twice.
    expect(count).toBe(3);
  });

  it('counts an empty inbox as nought', async () => {
    backendAnswers(() => list([]));

    await expect(service.getUnreadCount()).resolves.toBe(0);
  });

  it('answers a floor, not a figure, for an inbox longer than the page ceiling', async () => {
    backendAnswers((_url, body) =>
      list([row(n(Number(body.page) * 2)), row(n(Number(body.page) * 2 + 1), { isRead: true })], {
        page: body.page,
        hasNextPage: true,
      }),
    );

    const count = await service.getUnreadCount();

    expect(sent).toHaveLength(AppConfig.api.fullListMaxPages);
    expect(count).toEqual({ atLeast: AppConfig.api.fullListMaxPages });
  });
});

describe('markAsRead', () => {
  it('marks one by id, exactly', async () => {
    backendAnswers(() => ok(row(n(1), { isRead: true })));

    await service.markAsRead(n(1));

    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/notifications/read');
    expect(bodies()[0]).toEqual({ id: n(1) });
  });

  it('reads one that is not in this inbox as not found', async () => {
    backendAnswers(() => failure(404, 'NOT_FOUND'));

    const error = await rejectionOf(service.markAsRead(n(9)));

    expect(error.kind).toBe('notFound');
  });
});

describe('markAllAsRead', () => {
  it('marks each unread one, one at a time, in order, and nothing already read', async () => {
    backendAnswers(url =>
      url === '/notifications/list'
        ? list([row(n(1)), row(n(2), { isRead: true }), row(n(3))])
        : ok(null),
    );

    await service.markAllAsRead();

    expect(sent.map(config => config.url)).toEqual([
      '/notifications/list',
      '/notifications/read',
      '/notifications/read',
    ]);
    expect(bodies().slice(1)).toEqual([{ id: n(1) }, { id: n(3) }]);
  });

  it('skips one that vanished meanwhile and marks the rest', async () => {
    backendAnswers((url, body) => {
      if (url === '/notifications/list') {
        return list([row(n(1)), row(n(2)), row(n(3))]);
      }
      return body.id === n(2) ? failure(404, 'NOT_FOUND') : ok(null);
    });

    await expect(service.markAllAsRead()).resolves.toBeUndefined();
    expect(bodies().slice(1)).toEqual([{ id: n(1) }, { id: n(2) }, { id: n(3) }]);
  });

  it('answers incomplete when it stopped after marking some — neither "all" nor "none" is true', async () => {
    backendAnswers((url, body) => {
      if (url === '/notifications/list') {
        return list([row(n(1)), row(n(2)), row(n(3))]);
      }
      return body.id === n(2) ? 'network' : ok(null);
    });

    await expect(service.markAllAsRead()).resolves.toEqual({ complete: false });
    // It stopped there; running it again finishes the rest.
    expect(bodies().slice(1)).toEqual([{ id: n(1) }, { id: n(2) }]);
  });

  it('rejects when it failed before marking anything — "not marked" is then the truth', async () => {
    backendAnswers(url => (url === '/notifications/list' ? list([row(n(1)), row(n(2))]) : 'network'));

    const error = await rejectionOf(service.markAllAsRead());

    expect(error.kind).toBe('network');
    expect(sent).toHaveLength(2);
  });

  it('answers complete with nothing at all when every unread one was marked', async () => {
    backendAnswers(url => (url === '/notifications/list' ? list([row(n(1))]) : ok(null)));

    await expect(service.markAllAsRead()).resolves.toBeUndefined();
  });

  it('marks what it read of an inbox longer than the page ceiling, and says it is incomplete', async () => {
    backendAnswers((url, body) =>
      url === '/notifications/list'
        ? list([row(n(Number(body.page)))], { page: body.page, hasNextPage: true })
        : ok(null),
    );

    await expect(service.markAllAsRead()).resolves.toEqual({ complete: false });
    expect(sent.filter(config => config.url === '/notifications/read')).toHaveLength(
      AppConfig.api.fullListMaxPages,
    );
  });

  it('asks nothing more of an inbox with nothing unread', async () => {
    backendAnswers(() => list([row(n(1), { isRead: true })]));

    await service.markAllAsRead();

    expect(sent).toHaveLength(1);
  });
});

describe('remove', () => {
  it('deletes one by its id, and sends nothing else', async () => {
    backendAnswers(() => ok(null));

    await expect(service.remove(n(1))).resolves.toBeUndefined();

    expect(sent.map(config => [config.method?.toUpperCase(), config.url])).toEqual([['POST', '/notifications/delete']]);
    expect(bodies()).toEqual([{ id: n(1) }]);
  });

  it('rejects one not in this inbox — another account’s, the other role’s, already removed — as not found', async () => {
    backendAnswers(() => failure(404, 'NOTIFICATION_NOT_FOUND'));

    const error = await rejectionOf(service.remove(n(1)));

    expect(error.kind).toBe('notFound');
    expect(error.code).toBe('NOTIFICATION_NOT_FOUND');
    // The app's own words, never the backend's English.
    expect(error.userMessage).toBe('This notification is no longer available.');
  });

  it.each([
    ['a malformed id', failure(400, 'VALIDATION_FAILED'), 'validation'],
    ['a dropped connection', 'network' as const, 'network'],
  ])('rejects %s as its own kind', async (_name, reply, kind) => {
    backendAnswers(() => reply);

    expect((await rejectionOf(service.remove(n(1)))).kind).toBe(kind);
  });
});

describe('push', () => {
  it('keeps push registration inert, as Phase 2 leaves it', async () => {
    backendAnswers(() => ok(null));

    await expect(service.registerDevice('device-token')).resolves.toBeUndefined();
    await expect(service.unregisterDevice()).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});
