/**
 * FirebasePushService against the rule that matters most: with no Firebase
 * configured — every build until the owner adds `google-services.json` — push
 * is off and the app behaves exactly as before (phase5-contract.md section
 * 6.3). Off means no token, no listener ever attached, no message, no error.
 *
 * Then, with Firebase on, that a message is read as the contract sends it —
 * the visible text, and the data's string ids and nothing else (section 6.2) —
 * and that the background handler is set once.
 *
 * Firebase itself is the jest mock in `jest.setup.js`; `getApps` decides
 * whether a default app exists, as the native side does from the config file.
 */

import * as firebaseApp from '@react-native-firebase/app';
import * as messaging from '@react-native-firebase/messaging';

import { FirebasePushService } from '@/shared/services/device/FirebasePushService';
import type { PushMessage } from '@/shared/services/types/PushService';

const app = firebaseApp as unknown as { getApps: jest.Mock };
const fcm = messaging as unknown as Record<
  | 'getMessaging'
  | 'getToken'
  | 'onTokenRefresh'
  | 'onMessage'
  | 'onNotificationOpenedApp'
  | 'getInitialNotification'
  | 'setBackgroundMessageHandler',
  jest.Mock
>;

const MESSAGING = { instance: 'messaging' };

function configured(): void {
  app.getApps.mockImplementation(() => [{ name: '[DEFAULT]' }]);
}

function notConfigured(): void {
  app.getApps.mockImplementation(() => []);
}

beforeEach(() => {
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  jest.clearAllMocks();
  notConfigured();
  fcm.getMessaging.mockImplementation(() => MESSAGING);
  fcm.getToken.mockImplementation(async () => 'fcm-token');
  fcm.onTokenRefresh.mockImplementation(() => jest.fn());
  fcm.onMessage.mockImplementation(() => jest.fn());
  fcm.onNotificationOpenedApp.mockImplementation(() => jest.fn());
  fcm.getInitialNotification.mockImplementation(async () => null);
  fcm.setBackgroundMessageHandler.mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('with no Firebase configured', () => {
  it('is not available and does nothing at all', async () => {
    const push = new FirebasePushService();
    const listener = jest.fn();

    expect(push.isAvailable()).toBe(false);
    expect(await push.getToken()).toBeNull();
    expect(await push.getInitialMessage()).toBeNull();

    // Each returns a way to stop that is safe to call, and attaches nothing.
    push.onTokenRefresh(listener)();
    push.onForegroundMessage(listener)();
    push.onMessageOpened(listener)();
    push.handleBackgroundMessages();

    expect(listener).not.toHaveBeenCalled();
    // Messaging is never even created: on Android it throws without a default app.
    expect(fcm.getMessaging).not.toHaveBeenCalled();
    for (const call of [
      fcm.getToken,
      fcm.onTokenRefresh,
      fcm.onMessage,
      fcm.onNotificationOpenedApp,
      fcm.getInitialNotification,
      fcm.setBackgroundMessageHandler,
    ]) {
      expect(call).not.toHaveBeenCalled();
    }
  });

  it('is off, not broken, when the native module is missing from the build', async () => {
    // An older debug build running this JavaScript: loading Firebase throws.
    app.getApps.mockImplementation(() => {
      throw new Error('Native module RNFBAppModule is not registered.');
    });
    const push = new FirebasePushService();

    expect(push.isAvailable()).toBe(false);
    expect(await push.getToken()).toBeNull();
    expect(fcm.getMessaging).not.toHaveBeenCalled();
  });

  it('decides once, so a later configuration needs a rebuild, not a re-check', () => {
    const push = new FirebasePushService();
    expect(push.isAvailable()).toBe(false);

    configured();
    expect(push.isAvailable()).toBe(false);
    expect(app.getApps).toHaveBeenCalledTimes(1);
  });
});

describe('with Firebase configured', () => {
  beforeEach(configured);

  it('is available and reads the token', async () => {
    const push = new FirebasePushService();

    expect(push.isAvailable()).toBe(true);
    expect(await push.getToken()).toBe('fcm-token');
    expect(fcm.getToken).toHaveBeenCalledWith(MESSAGING);
  });

  it('answers no token, never an error, when the token cannot be read', async () => {
    fcm.getToken.mockImplementation(async () => {
      throw new Error('SERVICE_NOT_AVAILABLE');
    });

    expect(await new FirebasePushService().getToken()).toBeNull();
  });

  it('reads a message as the contract sends it: text, and string ids only', () => {
    const push = new FirebasePushService();
    const received: PushMessage[] = [];
    push.onForegroundMessage(message => received.push(message));

    const deliver = fcm.onMessage.mock.calls[0][1] as (remote: unknown) => void;
    deliver({
      notification: { title: 'Request accepted', body: 'Ravi accepted REQ-1.' },
      data: {
        notificationId: 'n-1',
        type: 'SERVICE_REQUEST',
        requestId: 'req-1',
        extra: 'not read',
        nested: { requestId: 'not a string' },
      },
    });
    deliver({ data: { requestId: '  ', type: 'GENERAL' } });

    expect(received).toEqual([
      {
        title: 'Request accepted',
        body: 'Ravi accepted REQ-1.',
        data: { notificationId: 'n-1', type: 'SERVICE_REQUEST', requestId: 'req-1' },
      },
      { data: { type: 'GENERAL' } },
    ]);
  });

  it('hands over a tapped message and the one that started the app', async () => {
    fcm.getInitialNotification.mockImplementation(async () => ({ data: { requestId: 'req-9' } }));
    const push = new FirebasePushService();
    const opened = jest.fn();
    push.onMessageOpened(opened);

    (fcm.onNotificationOpenedApp.mock.calls[0][1] as (remote: unknown) => void)({
      data: { notificationId: 'n-2' },
    });

    expect(opened).toHaveBeenCalledWith({ data: { notificationId: 'n-2' } });
    expect(await push.getInitialMessage()).toEqual({ data: { requestId: 'req-9' } });
  });

  it('passes on refreshed tokens, and only real ones', () => {
    const push = new FirebasePushService();
    const listener = jest.fn();
    push.onTokenRefresh(listener);

    const refresh = fcm.onTokenRefresh.mock.calls[0][1] as (token: unknown) => void;
    refresh('');
    refresh('fresh-token');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('fresh-token');
  });

  it('sets the background handler once, however often it is asked', () => {
    const push = new FirebasePushService();

    push.handleBackgroundMessages();
    push.handleBackgroundMessages();

    expect(fcm.setBackgroundMessageHandler).toHaveBeenCalledTimes(1);
    expect(fcm.setBackgroundMessageHandler).toHaveBeenCalledWith(MESSAGING, expect.any(Function));
  });

  it('never puts the token in a log line', async () => {
    fcm.getToken.mockImplementation(async () => {
      throw new Error('failed for fcm-token-secret');
    });
    const push = new FirebasePushService();
    await push.getToken();

    const logged = JSON.stringify(
      (['log', 'warn', 'error', 'info', 'debug'] as const).map(
        method => (console[method] as jest.Mock).mock.calls,
      ),
    );
    expect(logged).not.toContain('fcm-token-secret');
  });
});
