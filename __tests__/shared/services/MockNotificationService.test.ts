/**
 * The mock notification service stands in for the endpoints section 57's
 * inbox will live on, so it is held to what a backend would do, independently
 * of any screen:
 *
 * - it answers for whoever is signed in, of either role; nobody is refused on
 *   every call, and no call takes an account
 * - each account has its own inbox: a vendor never sees a customer's
 *   notifications, one customer never sees another's, and marking one inbox
 *   changes no other
 * - a notification that is not in this account's inbox is `notFound`, even
 *   when it is in somebody else's
 * - it pages newest first at the size asked for, refuses a page that cannot
 *   exist, and hands out copies rather than what it holds
 * - the unread count follows every mark; marking one twice is not an error
 * - the starting inboxes are the fixtures': a long one for 360dp, more than one
 *   page for Asha, all unread for the second customer, nothing for the third
 *   customer or for Meena, links the app opens and links it does not
 * - the push surface is inert
 */

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser } from '@/features/auth/types';
import { parseNotificationLink } from '@/features/notifications/constants/notificationLinks';
import { MockNotificationService } from '@/shared/services/mock/MockNotificationService';
import { mockInboxFor } from '@/shared/services/mock/mockNotificationData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type { AppNotification } from '@/shared/services/types/NotificationService';
import { AppError } from '@/shared/types/error';

const ASHA: AuthUser = {
  id: 'usr_customer_1',
  firstName: 'Asha',
  lastName: 'Patel',
  phone: '9876543210',
  role: 'customer',
};

const VENKATA: AuthUser = {
  id: 'usr_customer_2',
  firstName: 'Venkata Subrahmanya Lakshmi',
  lastName: 'Narasimhamurthy-Ramachandran',
  phone: '9876543211',
  role: 'customer',
};

const NAMELESS: AuthUser = {
  id: 'usr_customer_3',
  firstName: '',
  lastName: '',
  phone: '9876543212',
  role: 'customer',
};

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

const PAGE_SIZE = AppConfig.pagination.defaultPageSize;
const FIRST = AppConfig.pagination.initialPage;

let current: AuthUser | null;
const CLOCK = Date.parse('2026-10-20T09:30:00.000Z');

function service(options: { inboxFor?: (userId: string, nowMs: number) => AppNotification[] } = {}) {
  return new MockNotificationService({
    latency: NO_LATENCY,
    currentUser: async () => current,
    now: () => CLOCK,
    ...options,
  });
}

/** Every notification the signed-in account has, page by page. */
async function everything(notifications: MockNotificationService): Promise<AppNotification[]> {
  const all: AppNotification[] = [];
  for (let page = FIRST; ; page += 1) {
    const answer = await notifications.list({ page, pageSize: PAGE_SIZE });
    all.push(...answer.items);
    if (!answer.hasMore) {
      return all;
    }
  }
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

beforeEach(() => {
  current = ASHA;
});

describe('MockNotificationService — the session', () => {
  it('refuses every call with nobody signed in', async () => {
    current = null;
    const notifications = service();

    const calls: Array<Promise<unknown>> = [
      notifications.list({ page: FIRST, pageSize: PAGE_SIZE }),
      notifications.getUnreadCount(),
      notifications.markAsRead('ntf_c1_01'),
      notifications.markAllAsRead(),
      notifications.remove('ntf_c1_01'),
      notifications.removeAll(),
    ];

    for (const call of calls) {
      expect((await refusal(call)).kind).toBe('unauthorized');
    }
  });

  it('refuses with no way of knowing who is signed in', async () => {
    const notifications = new MockNotificationService({ latency: NO_LATENCY });

    expect((await refusal(notifications.getUnreadCount())).kind).toBe('unauthorized');
  });

  it('answers both roles: an inbox is not a customer thing or a vendor thing', async () => {
    const notifications = service();

    expect(await notifications.getUnreadCount()).toBe(6);
    current = RAVI;
    expect(await notifications.getUnreadCount()).toBe(5);
  });
});

describe('MockNotificationService — one inbox per account', () => {
  it('never shows a vendor a customer’s notifications, or a customer a vendor’s', async () => {
    const notifications = service();

    const asha = await everything(notifications);
    current = RAVI;
    const ravi = await everything(notifications);

    const ashaIds = new Set(asha.map(item => item.id));
    expect(ravi.some(item => ashaIds.has(item.id))).toBe(false);
    expect(JSON.stringify(ravi)).not.toContain('REQ-24063');
    expect(JSON.stringify(asha)).not.toContain('REQ-31042');
  });

  it('never shows one customer another customer’s notifications', async () => {
    const notifications = service();

    const asha = await everything(notifications);
    current = VENKATA;
    const venkata = await everything(notifications);

    const ashaIds = new Set(asha.map(item => item.id));
    expect(venkata.some(item => ashaIds.has(item.id))).toBe(false);
  });

  it('gives the third customer and Meena an empty inbox', async () => {
    const notifications = service();

    for (const user of [NAMELESS, MEENA]) {
      current = user;
      const page = await notifications.list({ page: FIRST, pageSize: PAGE_SIZE });
      expect(page).toEqual({ items: [], page: FIRST, pageSize: PAGE_SIZE, total: 0, hasMore: false });
      expect(await notifications.getUnreadCount()).toBe(0);
    }
  });

  it('gives an account nobody wrote fixtures for nothing, whatever its role', async () => {
    const notifications = service();

    current = { ...RAVI, id: 'usr_registered_vendor' };
    expect(await everything(notifications)).toEqual([]);
    current = { ...ASHA, id: 'usr_new_customer' };
    expect(await everything(notifications)).toEqual([]);
  });

  it('answers notFound for somebody else’s notification, and changes nothing of theirs', async () => {
    const notifications = service();
    const [ashasNewest] = (await notifications.list({ page: FIRST, pageSize: 1 })).items;

    current = RAVI;
    expect((await refusal(notifications.markAsRead(ashasNewest.id))).kind).toBe('notFound');
    expect((await refusal(notifications.remove(ashasNewest.id))).kind).toBe('notFound');

    current = ASHA;
    const [stillNewest] = (await notifications.list({ page: FIRST, pageSize: 1 })).items;
    expect(stillNewest).toEqual(ashasNewest);
    expect(stillNewest.read).toBe(false);
  });

  it('marks one account’s inbox read without touching another’s', async () => {
    const notifications = service();

    current = RAVI;
    await notifications.markAllAsRead();
    expect(await notifications.getUnreadCount()).toBe(0);

    current = ASHA;
    expect(await notifications.getUnreadCount()).toBe(6);
  });
});

describe('MockNotificationService — the list', () => {
  it('lists newest first', async () => {
    const all = await everything(service());

    const times = all.map(item => Date.parse(item.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('pages at the size asked for and says when there is more', async () => {
    const notifications = service();

    const first = await notifications.list({ page: FIRST, pageSize: PAGE_SIZE });
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(first.total).toBe(22);
    expect(first.hasMore).toBe(true);

    const second = await notifications.list({ page: FIRST + 1, pageSize: PAGE_SIZE });
    expect(second.items).toHaveLength(2);
    expect(second.hasMore).toBe(false);

    const ids = [...first.items, ...second.items].map(item => item.id);
    expect(new Set(ids).size).toBe(22);
  });

  it('refuses a page that cannot exist', async () => {
    const notifications = service();

    for (const request of [
      { page: FIRST - 1, pageSize: PAGE_SIZE },
      { page: 1.5, pageSize: PAGE_SIZE },
      { page: FIRST, pageSize: 0 },
      { page: FIRST, pageSize: Number.NaN },
    ]) {
      expect((await refusal(notifications.list(request))).kind).toBe('validation');
    }
  });

  it('hands out copies, so changing one changes nothing it holds', async () => {
    const notifications = service();

    const [newest] = (await notifications.list({ page: FIRST, pageSize: 1 })).items;
    newest.read = true;
    newest.title = 'Changed on the device';

    const [again] = (await notifications.list({ page: FIRST, pageSize: 1 })).items;
    expect(again.read).toBe(false);
    expect(again.title).toBe('Request accepted');
    expect(await notifications.getUnreadCount()).toBe(6);
  });

  it('orders two from the same instant the same way every time', async () => {
    const at = new Date(CLOCK).toISOString();
    const notifications = service({
      inboxFor: () => [
        { id: 'b', title: 'B', body: 'B', createdAt: at, read: false, type: 'x' },
        { id: 'a', title: 'A', body: 'A', createdAt: at, read: false, type: 'x' },
      ],
    });

    const page = await notifications.list({ page: FIRST, pageSize: PAGE_SIZE });
    expect(page.items.map(item => item.id)).toEqual(['a', 'b']);
  });
});

describe('MockNotificationService — reading', () => {
  it('counts the unread ones', async () => {
    const notifications = service();

    const all = await everything(notifications);
    expect(await notifications.getUnreadCount()).toBe(all.filter(item => !item.read).length);
  });

  it('marks one as read, and the count follows', async () => {
    const notifications = service();
    const [newest] = (await notifications.list({ page: FIRST, pageSize: 1 })).items;

    await notifications.markAsRead(newest.id);

    expect(await notifications.getUnreadCount()).toBe(5);
    const [after] = (await notifications.list({ page: FIRST, pageSize: 1 })).items;
    expect(after).toEqual({ ...newest, read: true });
  });

  it('marks one already read without complaint, and changes nothing', async () => {
    const notifications = service();
    const read = (await everything(notifications)).find(item => item.read);
    expect(read).toBeDefined();

    await expect(notifications.markAsRead(String(read?.id))).resolves.toBeUndefined();
    expect(await notifications.getUnreadCount()).toBe(6);
  });

  it('answers notFound for a notification that does not exist', async () => {
    const notifications = service();

    expect((await refusal(notifications.markAsRead('ntf_nobody'))).kind).toBe('notFound');
    expect(await notifications.getUnreadCount()).toBe(6);
  });

  it('marks everything as read, including the page not yet listed', async () => {
    current = VENKATA;
    const notifications = service();
    expect(await notifications.getUnreadCount()).toBe(22);

    await notifications.markAllAsRead();

    expect(await notifications.getUnreadCount()).toBe(0);
    expect((await everything(notifications)).every(item => item.read)).toBe(true);
  });

  it('marks all of an empty inbox without complaint', async () => {
    current = MEENA;
    const notifications = service();

    await expect(notifications.markAllAsRead()).resolves.toBeUndefined();
    expect(await notifications.getUnreadCount()).toBe(0);
  });

  it('keeps both of two marks in flight at once', async () => {
    const notifications = service();
    const unread = (await everything(notifications)).filter(item => !item.read);

    await Promise.all([notifications.markAsRead(unread[0].id), notifications.markAsRead(unread[1].id)]);

    expect(await notifications.getUnreadCount()).toBe(4);
  });

  it('removes one, and answers notFound for it afterwards', async () => {
    const notifications = service();
    const [newest] = (await notifications.list({ page: FIRST, pageSize: 1 })).items;

    await notifications.remove(newest.id);

    expect((await everything(notifications)).map(item => item.id)).not.toContain(newest.id);
    expect((await refusal(notifications.markAsRead(newest.id))).kind).toBe('notFound');
    expect((await refusal(notifications.remove(newest.id))).kind).toBe('notFound');
  });

  it('removes every one, the pages not yet listed too, and keeps the inbox empty', async () => {
    current = VENKATA;
    const notifications = service();
    expect((await everything(notifications)).length).toBeGreaterThan(PAGE_SIZE);

    await notifications.removeAll();

    expect(await everything(notifications)).toEqual([]);
    expect(await notifications.getUnreadCount()).toBe(0);
    // Emptied, not reset: the fixtures do not come back on the next read.
    expect((await notifications.list({ page: FIRST, pageSize: PAGE_SIZE })).total).toBe(0);
  });

  it('removes all of one account’s inbox and nobody else’s', async () => {
    const notifications = service();
    current = RAVI;
    const ravis = await everything(notifications);

    current = ASHA;
    await notifications.removeAll();

    expect(await everything(notifications)).toEqual([]);
    current = RAVI;
    expect(await everything(notifications)).toEqual(ravis);
  });

  it('clears an empty inbox without complaint', async () => {
    current = MEENA;
    const notifications = service();

    await expect(notifications.removeAll()).resolves.toBeUndefined();
  });
});

describe('MockNotificationService — the starting inboxes', () => {
  it('gives Asha twenty-two, six unread — more than one page', () => {
    const inbox = mockInboxFor('usr_customer_1', CLOCK);

    expect(inbox).toHaveLength(22);
    expect(inbox.length).toBeGreaterThan(PAGE_SIZE);
    expect(inbox.filter(item => !item.read)).toHaveLength(6);
  });

  it('gives the second customer the same history, every one unread — the "9+" badge', () => {
    const asha = mockInboxFor('usr_customer_1', CLOCK);
    const venkata = mockInboxFor('usr_customer_2', CLOCK);

    expect(venkata.map(item => item.title)).toEqual(asha.map(item => item.title));
    expect(venkata.every(item => !item.read)).toBe(true);
  });

  it('gives Ravi eight, five unread', () => {
    const inbox = mockInboxFor('usr_vendor_1', CLOCK);

    expect(inbox).toHaveLength(8);
    expect(inbox.filter(item => !item.read)).toHaveLength(5);
  });

  it('gives every notification a unique id, never shared between accounts', () => {
    const ids = ['usr_customer_1', 'usr_customer_2', 'usr_vendor_1'].flatMap(userId =>
      mockInboxFor(userId, CLOCK).map(item => item.id),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('dates every one in the past, spread over minutes, hours and days', () => {
    for (const userId of ['usr_customer_1', 'usr_vendor_1']) {
      const ages = mockInboxFor(userId, CLOCK).map(item => CLOCK - Date.parse(item.createdAt));

      expect(ages.every(age => age > 0)).toBe(true);
      expect(ages.some(age => age < 60 * 60_000)).toBe(true);
      expect(ages.some(age => age >= 60 * 60_000 && age < 24 * 60 * 60_000)).toBe(true);
      expect(ages.some(age => age >= 7 * 24 * 60 * 60_000)).toBe(true);
    }
  });

  it('holds one long title and body for each role, for the 360dp check', () => {
    for (const userId of ['usr_customer_1', 'usr_vendor_1']) {
      const inbox = mockInboxFor(userId, CLOCK);

      expect(inbox.some(item => item.title.length > 60 && item.body.length > 180)).toBe(true);
    }
  });

  it('links to requests the app opens, to places it does not, and to nothing', () => {
    for (const userId of ['usr_customer_1', 'usr_vendor_1']) {
      const inbox = mockInboxFor(userId, CLOCK);

      expect(inbox.some(item => parseNotificationLink(item.deepLink) !== null)).toBe(true);
      expect(
        inbox.some(item => item.deepLink !== undefined && parseNotificationLink(item.deepLink) === null),
      ).toBe(true);
      expect(inbox.some(item => !('deepLink' in item))).toBe(true);
    }
  });

  it('links a customer only to the requests every customer has', () => {
    const seeded = ['REQ-24081', 'REQ-24079', 'REQ-24076', 'REQ-24070', 'REQ-24063', 'REQ-24048', 'REQ-24020'];

    for (const item of mockInboxFor('usr_customer_1', CLOCK)) {
      const target = parseNotificationLink(item.deepLink);
      if (target) {
        expect(seeded).toContain(target.requestId);
      }
    }
  });

  it('sends every one with a glyph and a type token, as a backend would', () => {
    for (const userId of ['usr_customer_1', 'usr_vendor_1']) {
      for (const item of mockInboxFor(userId, CLOCK)) {
        expect(item.iconName).toEqual(expect.any(String));
        expect(item.type).toEqual(expect.any(String));
      }
    }
  });
});

/*
  The push token calls answer as the backend's /devices endpoints do
  (phase5-contract.md section 6.1): one account per token, moved by registering
  it elsewhere, removed only by its own account, and nothing for nobody.
*/
describe('MockNotificationService — push devices', () => {
  const TOKEN = 'fcm-token-for-this-device';

  it("pairs a token with the signed-in account and unpairs it on that account's word", async () => {
    const notifications = service();

    await notifications.registerDevice({ token: TOKEN, platform: 'android' });
    expect(notifications.isDeviceRegistered(TOKEN, ASHA.id)).toBe(true);

    await notifications.unregisterDevice(TOKEN);
    expect(notifications.isDeviceRegistered(TOKEN, ASHA.id)).toBe(false);
  });

  it('moves a token registered from another account, which then cannot remove it', async () => {
    const notifications = service();
    await notifications.registerDevice({ token: TOKEN, platform: 'android' });

    current = RAVI;
    await notifications.registerDevice({ token: TOKEN, platform: 'android' });
    expect(notifications.isDeviceRegistered(TOKEN, RAVI.id)).toBe(true);
    expect(notifications.isDeviceRegistered(TOKEN, ASHA.id)).toBe(false);

    // Somebody else's token: succeeds, changes nothing, says nothing.
    current = ASHA;
    await expect(notifications.unregisterDevice(TOKEN)).resolves.toBeUndefined();
    expect(notifications.isDeviceRegistered(TOKEN, RAVI.id)).toBe(true);
  });

  it('refuses nobody, a blank or over-long token, and an unknown platform', async () => {
    const notifications = service();

    expect((await refusal(notifications.registerDevice({ token: '   ', platform: 'ios' }))).kind).toBe(
      'validation',
    );
    expect(
      (await refusal(notifications.registerDevice({ token: 'x'.repeat(4097), platform: 'ios' }))).kind,
    ).toBe('validation');
    expect(
      (
        await refusal(
          notifications.registerDevice({ token: TOKEN, platform: 'web' as unknown as 'ios' }),
        )
      ).kind,
    ).toBe('validation');

    current = null;
    expect((await refusal(notifications.registerDevice({ token: TOKEN, platform: 'ios' }))).kind).toBe(
      'unauthorized',
    );
    expect((await refusal(notifications.unregisterDevice(TOKEN))).kind).toBe('unauthorized');
  });
});
