/**
 * A notification's link is the backend's opaque string, and the app
 * understands exactly one shape of it — `fixora://requests/<reference>`.
 * Everything else must come back as null, so the inbox marks the notification
 * read and opens nothing rather than guessing.
 *
 * Pinned here: the shape it opens (with the reference kept exactly, and a
 * query or fragment set aside); and null for absent and blank links, another
 * scheme, another place in the app, no reference, a path with more after the
 * reference, and a broken escape.
 */

import { parseNotificationLink } from '@/features/notifications/constants/notificationLinks';

describe('parseNotificationLink — what it opens', () => {
  it('opens the request a link names', () => {
    expect(parseNotificationLink('fixora://requests/REQ-24063')).toEqual({
      kind: 'request',
      requestId: 'REQ-24063',
    });
  });

  it('keeps a long reference exactly as sent', () => {
    expect(parseNotificationLink('fixora://requests/REQ-2026-BLR-EAST-0031021')).toEqual({
      kind: 'request',
      requestId: 'REQ-2026-BLR-EAST-0031021',
    });
  });

  it('reads the scheme and the place without case, and keeps the reference’s', () => {
    expect(parseNotificationLink('FIXORA://Requests/req-1')).toEqual({ kind: 'request', requestId: 'req-1' });
  });

  it('sets aside a query or a fragment, which change nothing about which request', () => {
    expect(parseNotificationLink('fixora://requests/REQ-1?from=push')).toEqual({
      kind: 'request',
      requestId: 'REQ-1',
    });
    expect(parseNotificationLink('fixora://requests/REQ-1#top')).toEqual({
      kind: 'request',
      requestId: 'REQ-1',
    });
  });

  it('decodes an escaped reference', () => {
    expect(parseNotificationLink('fixora://requests/REQ%2D1')).toEqual({ kind: 'request', requestId: 'REQ-1' });
  });

  it('ignores whitespace around the whole link', () => {
    expect(parseNotificationLink('  fixora://requests/REQ-1 \n')).toEqual({
      kind: 'request',
      requestId: 'REQ-1',
    });
  });
});

describe('parseNotificationLink — what it ignores', () => {
  it('opens nothing when there is no link', () => {
    expect(parseNotificationLink(undefined)).toBeNull();
    expect(parseNotificationLink(null)).toBeNull();
    expect(parseNotificationLink('')).toBeNull();
    expect(parseNotificationLink('   ')).toBeNull();
  });

  it('opens nothing for another scheme', () => {
    for (const link of [
      'https://fixora.app/requests/REQ-1',
      'http://requests/REQ-1',
      'fixora:requests/REQ-1',
      'fixora:/requests/REQ-1',
      'notfixora://requests/REQ-1',
      'requests/REQ-1',
      'REQ-1',
    ]) {
      expect(parseNotificationLink(link)).toBeNull();
    }
  });

  it('opens nothing for a place in the app it does not know', () => {
    for (const link of ['fixora://reviews', 'fixora://addresses', 'fixora://reviews/REQ-1', 'fixora://profile']) {
      expect(parseNotificationLink(link)).toBeNull();
    }
  });

  it('opens nothing when the reference is missing', () => {
    for (const link of [
      'fixora://requests',
      'fixora://requests/',
      'fixora://requests/?from=push',
      'fixora://requests/%20',
      'fixora://',
    ]) {
      expect(parseNotificationLink(link)).toBeNull();
    }
  });

  it('opens nothing when there is more after the reference — never "roughly the request"', () => {
    for (const link of [
      'fixora://requests/REQ-1/review',
      'fixora://requests/REQ-1/',
      'fixora:///requests/REQ-1',
      'fixora://requests//REQ-1',
    ]) {
      expect(parseNotificationLink(link)).toBeNull();
    }
  });

  it('opens nothing for a broken escape', () => {
    expect(parseNotificationLink('fixora://requests/%E0%A4%A')).toBeNull();
  });
});
