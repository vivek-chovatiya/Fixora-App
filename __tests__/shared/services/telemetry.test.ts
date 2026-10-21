/**
 * telemetry.ts is the one door to analytics and crash reporting, and every rule
 * that keeps them from interfering with the app (PROJECT_BIBLE.md section 54)
 * lives in it:
 *
 * - nothing registered is not an error: a suite that reset the registry, or a
 *   call before bootstrap, must lose an event and nothing else;
 * - an implementation that throws in spite of its contract is contained, and one
 *   service failing does not stop the other from being told;
 * - only an id and a role ever leave for a user, whatever object was passed;
 * - a property whose key looks personal never reaches the provider. Asserted
 *   as the exact key set that arrives, so a key let through by accident fails.
 */

import type { AuthUser } from '@/features/auth/types';
import { MockAnalyticsService } from '@/shared/services/mock/MockAnalyticsService';
import { MockCrashReporter } from '@/shared/services/mock/MockCrashReporter';
import {
  configureServices,
  getService,
  registerService,
  resetServices,
} from '@/shared/services/ServiceRegistry';
import { identifyUser, recordError, trackEvent } from '@/shared/services/telemetry';
import type {
  AnalyticsProperties,
  AnalyticsService,
} from '@/shared/services/types/AnalyticsService';
import type { CrashReporter } from '@/shared/services/types/CrashReporter';

const CUSTOMER: AuthUser = {
  id: 'usr_customer_1',
  firstName: 'Asha',
  lastName: 'Patel',
  email: 'asha@example.com',
  phone: '9876543210',
  role: 'customer',
};

function stubAnalytics() {
  return { track: jest.fn(), identify: jest.fn() };
}

function stubCrashReporter() {
  return { recordError: jest.fn(), setUser: jest.fn() };
}

const throwing = () =>
  jest.fn(() => {
    throw new Error('provider exploded');
  });

/** Every method throws: a provider that broke its contract completely. */
const BROKEN_ANALYTICS: AnalyticsService = { track: throwing(), identify: throwing() };
const BROKEN_CRASH_REPORTER: CrashReporter = { recordError: throwing(), setUser: throwing() };

afterEach(() => {
  resetServices();
  jest.restoreAllMocks();
});

describe('telemetry with nothing registered', () => {
  it('does nothing, and throws nothing', () => {
    resetServices();

    expect(() => trackEvent('app_opened')).not.toThrow();
    expect(() => trackEvent('login_completed', { role: 'customer' })).not.toThrow();
    expect(() => identifyUser(CUSTOMER)).not.toThrow();
    expect(() => identifyUser(null)).not.toThrow();
    expect(() => recordError(new Error('boom'), { fatal: true })).not.toThrow();
  });
});

describe('trackEvent', () => {
  it('hands the event and its properties to the registered service', () => {
    const analytics = stubAnalytics();
    registerService('analytics', analytics);

    trackEvent('login_completed', { role: 'customer' });

    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith('login_completed', { role: 'customer' });
  });

  it('sends an event with no properties as exactly that', () => {
    const analytics = stubAnalytics();
    registerService('analytics', analytics);

    trackEvent('app_opened');

    expect(analytics.track).toHaveBeenCalledWith('app_opened', undefined);
  });

  it('drops an id-named key that holds a contact handle, and keeps the opaque ids', () => {
    const analytics = stubAnalytics();
    registerService('analytics', analytics);

    trackEvent('request_created', {
      requestId: 'REQ-24063',
      addressId: 'addr_1',
      emailId: 'asha@example.com',
      upiId: 'asha@okhdfc',
      mobileId: '9876543210',
      contactId: 'ravi@example.com',
    });

    const sent = analytics.track.mock.calls[0][1] as AnalyticsProperties;
    expect(Object.keys(sent).sort()).toEqual(['addressId', 'requestId']);
    const serialised = JSON.stringify(analytics.track.mock.calls);
    expect(serialised).not.toContain('@');
    expect(serialised).not.toContain('9876543210');
  });

  it('reads a key by its words: an id that merely contains "upi" is kept, a payment handle is not', () => {
    const analytics = stubAnalytics();
    registerService('analytics', analytics);

    trackEvent('request_created', {
      groupId: 'grp_1',
      pickupId: 'pck_1',
      setupStep: 3,
      upi: 'asha.okhdfc',
      upiHandle: 'asha.okhdfc',
      payeeVpa: 'asha.okhdfc',
      whatsappNumber: '9876543210',
      customerPhoneId: 'ph_1',
      contact: 'asha@example.com',
    });

    const sent = analytics.track.mock.calls[0][1] as AnalyticsProperties;
    expect(Object.keys(sent).sort()).toEqual(['groupId', 'pickupId', 'setupStep']);
    const serialised = JSON.stringify(analytics.track.mock.calls);
    expect(serialised).not.toContain('asha');
    expect(serialised).not.toContain('9876543210');
  });

  it('drops identity numbers and a brand-spelt WhatsApp id, whatever their capitals', () => {
    const analytics = stubAnalytics();
    registerService('analytics', analytics);

    trackEvent('request_created', {
      whatsAppId: '919876543210',
      aadhaarId: '1234-5678-9012',
      panId: 'ABCDE1234F',
      contactNumber: '9876543210',
      aadhaarNumber: '123456789012',
      panNumber: 'ABCDE1234F',
      dob: '1990-01-01',
      birthDate: '1990-01-01',
      pinCode: '560095',
      landmark: 'Near the temple',
      houseNumber: '412',
      PANNumber: 'ABCDE1234F',
      PANId: 'ABCDE1234F',
      DOBDate: '1990-01-01',
      UPIHandle: 'asha.okhdfc',
      lat: 12.93,
      lng: 77.62,
      zip: '560095',
      companyId: 'cmp_1',
    });

    const sent = analytics.track.mock.calls[0][1] as AnalyticsProperties;
    expect(Object.keys(sent)).toEqual(['companyId']);
  });

  it('keeps every property the app sends today', () => {
    // The keys section 54's events carry (slices 3F-1): a filter that drops
    // one of these has broken the events, not protected anybody.
    const analytics = stubAnalytics();
    registerService('analytics', analytics);
    const today = {
      role: 'customer',
      requestId: 'REQ-24083',
      categoryId: 'cat_electrician',
      subCategoryId: 'sub_fan_repair',
      vendorId: 'vnd_1',
      priority: 'HIGH',
      directed: true,
      photoCount: 2,
      hasPreferredDate: false,
      hasPreferredTime: true,
      rating: 4,
      reason: 'chosen_none',
      dispatch: 'broadcast',
      paymentStatus: 'PAID',
    };

    trackEvent('request_created', today);

    expect(analytics.track.mock.calls[0][1]).toEqual(today);
  });

  it('drops every property whose key looks personal, and keeps ids, counts, enums and flags', () => {
    const analytics = stubAnalytics();
    registerService('analytics', analytics);

    trackEvent('request_created', {
      role: 'customer',
      requestId: 'req_1',
      addressId: 'addr_1',
      priority: 'urgent',
      photoCount: 2,
      hasNote: true,
      phone: '9876543210',
      customerPhone: 9876543210,
      name: 'Asha Patel',
      ownerName: 'Ravi Kumar',
      email: 'asha@example.com',
      addressLine: '12 MG Road',
      note: 'Ring the bell twice',
      reviewText: 'Great work',
      otp: '123456',
      authCode: '482913',
      latitude: 12.97,
    });

    const sent = analytics.track.mock.calls[0][1] as AnalyticsProperties;
    expect(Object.keys(sent).sort()).toEqual([
      'addressId',
      'hasNote',
      'photoCount',
      'priority',
      'requestId',
      'role',
    ]);
    const serialised = JSON.stringify(analytics.track.mock.calls);
    expect(serialised).not.toContain('9876543210');
    expect(serialised).not.toContain('Asha');
    expect(serialised).not.toContain('MG Road');
    expect(serialised).not.toContain('123456');
    expect(serialised).not.toContain('482913');
  });

  it('drops a nested value, which is how a whole record would get sent', () => {
    const analytics = stubAnalytics();
    registerService('analytics', analytics);

    trackEvent('vendor_selected', {
      vendorId: 'vnd_1',
      vendor: { id: 'vnd_1', phone: '9000000001' },
    } as unknown as AnalyticsProperties);

    expect(analytics.track.mock.calls[0][1]).toEqual({ vendorId: 'vnd_1' });
  });

  it('contains a service that throws', () => {
    registerService('analytics', BROKEN_ANALYTICS);

    expect(() => trackEvent('login_completed', { role: 'vendor' })).not.toThrow();
  });
});

describe('identifyUser', () => {
  it('tells both services, with the id and the role and nothing else', () => {
    const analytics = stubAnalytics();
    const crashReporter = stubCrashReporter();
    registerService('analytics', analytics);
    registerService('crashReporter', crashReporter);

    identifyUser(CUSTOMER);

    const identified = analytics.identify.mock.calls[0][0];
    const crashUser = crashReporter.setUser.mock.calls[0][0];
    expect(identified).toEqual({ id: 'usr_customer_1', role: 'customer' });
    expect(Object.keys(identified ?? {}).sort()).toEqual(['id', 'role']);
    expect(crashUser).toEqual({ id: 'usr_customer_1', role: 'customer' });
    expect(Object.keys(crashUser ?? {}).sort()).toEqual(['id', 'role']);
  });

  it('clears both on sign out', () => {
    const analytics = stubAnalytics();
    const crashReporter = stubCrashReporter();
    registerService('analytics', analytics);
    registerService('crashReporter', crashReporter);

    identifyUser(null);

    expect(analytics.identify).toHaveBeenCalledWith(null);
    expect(crashReporter.setUser).toHaveBeenCalledWith(null);
  });

  it('still tells the crash reporter when analytics throws', () => {
    const crashReporter = stubCrashReporter();
    registerService('analytics', BROKEN_ANALYTICS);
    registerService('crashReporter', crashReporter);

    expect(() => identifyUser(CUSTOMER)).not.toThrow();
    expect(crashReporter.setUser).toHaveBeenCalledWith({ id: 'usr_customer_1', role: 'customer' });
  });

  it('still tells analytics when only analytics is registered', () => {
    const analytics = stubAnalytics();
    registerService('analytics', analytics);

    expect(() => identifyUser(CUSTOMER)).not.toThrow();
    expect(analytics.identify).toHaveBeenCalledTimes(1);
  });
});

describe('recordError', () => {
  it('hands the very error and its context to the crash reporter', () => {
    const crashReporter = stubCrashReporter();
    registerService('crashReporter', crashReporter);
    const error = new Error('boom');

    recordError(error, { fatal: true, source: 'global' });

    expect(crashReporter.recordError).toHaveBeenCalledTimes(1);
    expect(crashReporter.recordError).toHaveBeenCalledWith(error, {
      fatal: true,
      source: 'global',
    });
  });

  it('contains a crash reporter that throws', () => {
    registerService('crashReporter', BROKEN_CRASH_REPORTER);

    expect(() => recordError(new Error('boom'))).not.toThrow();
    expect(() => identifyUser(CUSTOMER)).not.toThrow();
  });
});

describe('configureServices', () => {
  it('registers the analytics service and the crash reporter', () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    configureServices();

    expect(getService('analytics')).toBeInstanceOf(MockAnalyticsService);
    expect(getService('crashReporter')).toBeInstanceOf(MockCrashReporter);
  });
});
