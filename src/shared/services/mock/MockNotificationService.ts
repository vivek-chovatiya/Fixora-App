/**
 * MockNotificationService
 *
 * In-memory NotificationService for the UI-first phase.
 *
 * Mock data lives here, never inside a screen. Replacing this with an
 * ApiNotificationService requires no change to any screen, hook or component.
 */

import { createLogger } from '@/core/logger/Logger';
import type {
  AppNotification,
  NotificationService,
} from '@/shared/services/types/NotificationService';
import { isoMinutesAgo, simulateNetwork } from '@/shared/services/mock/mockUtils';
import { AppError } from '@/shared/types/error';
import { toPage, type Page, type PageRequest } from '@/shared/types/pagination';

const log = createLogger('MockNotificationService');

/**
 * `type` values mirror what the backend is expected to send. The app stores and
 * displays them but never branches on them.
 */
function seed(): AppNotification[] {
  return [
    {
      id: 'ntf_1',
      title: 'Request accepted',
      body: 'A vendor has accepted your service request.',
      createdAt: isoMinutesAgo(4),
      read: false,
      type: 'request.accepted',
      iconName: 'check-circle-outline',
    },
    {
      id: 'ntf_2',
      title: 'New request nearby',
      body: 'A new request matching your services is available.',
      createdAt: isoMinutesAgo(38),
      read: false,
      type: 'request.broadcast',
      iconName: 'clipboard-text-outline',
    },
    {
      id: 'ntf_3',
      title: 'Work completed',
      body: 'Your request has been marked complete. Leave a review.',
      createdAt: isoMinutesAgo(180),
      read: true,
      type: 'request.completed',
      iconName: 'star-outline',
    },
    {
      id: 'ntf_4',
      title: 'Profile verified',
      body: 'Your documents have been approved.',
      createdAt: isoMinutesAgo(1500),
      read: true,
      type: 'account.verified',
      iconName: 'shield-check-outline',
    },
  ];
}

export class MockNotificationService implements NotificationService {
  private notifications: AppNotification[] = seed();

  async list(request: PageRequest): Promise<Page<AppNotification>> {
    return simulateNetwork(() => {
      const sorted = [...this.notifications].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      return toPage(sorted, request);
    });
  }

  async getUnreadCount(): Promise<number> {
    return simulateNetwork(() => this.notifications.filter(item => !item.read).length);
  }

  async markAsRead(id: string): Promise<void> {
    return simulateNetwork(() => {
      const target = this.notifications.find(item => item.id === id);
      if (!target) {
        throw new AppError({ kind: 'notFound', message: `Notification ${id} not found` });
      }
      target.read = true;
    });
  }

  async markAllAsRead(): Promise<void> {
    return simulateNetwork(() => {
      this.notifications = this.notifications.map(item => ({ ...item, read: true }));
    });
  }

  async remove(id: string): Promise<void> {
    return simulateNetwork(() => {
      const before = this.notifications.length;
      this.notifications = this.notifications.filter(item => item.id !== id);
      if (this.notifications.length === before) {
        throw new AppError({ kind: 'notFound', message: `Notification ${id} not found` });
      }
    });
  }

  async registerDevice(deviceToken: string): Promise<void> {
    // Intentionally inert. FCM integration lands with the backend contract.
    log.debug('registerDevice called in mock mode', { hasToken: Boolean(deviceToken) });
  }

  async unregisterDevice(): Promise<void> {
    log.debug('unregisterDevice called in mock mode');
  }
}
