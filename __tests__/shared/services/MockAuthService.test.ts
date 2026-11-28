/**
 * MockAuthService stands in for backend judgement until the backend exists, so
 * these tests pin the behaviour the UI will be built against — including the
 * rules that must survive the real implementation: no account enumeration, no
 * code in any error or log, and the one-time-code flows of phase5-contract.md
 * sections 1 and 2 (28/11/2026): a returning vendor signs in with a one-time
 * code, a new vendor's registration code signs them in, the permanent auth code
 * is gone, and every challenge says which channel carried the code.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { MockAuthService } from '@/shared/services/mock/MockAuthService';
import { MOCK_OTP_CODE, MOCK_OTP_TTL_SECONDS } from '@/shared/services/mock/mockAuthData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type {
  OtpDeliveryChannel,
  VendorRegistrationDetails,
} from '@/shared/services/types/AuthService';
import { AppError } from '@/shared/types/error';

const CUSTOMER_PHONE = '9876543210';
const SEEDED_VENDOR_PHONE = '9000000001';
const SECOND_VENDOR_PHONE = '9000000002';
/** A well-formed number with no account of either kind. */
const UNKNOWN_PHONE = '9111111111';
/** Six digits that are not the mock's code. */
const WRONG_CODE = '111111';

const NEW_VENDOR: VendorRegistrationDetails = {
  businessName: 'Sharma Electricals',
  ownerFirstName: 'Neha',
  ownerLastName: 'Sharma',
  phone: '9123456780',
  serviceCategoryIds: ['cat_electrician'],
};

/**
 * Every test builds its service through here.
 *
 * Latency is switched off because none of these tests assert on waiting — they
 * assert on decisions. The running app keeps `AppConfig.mock` latency, which is
 * what makes loading and retry states reachable; paying for it here bought
 * nothing but a slow suite.
 */
function createService(
  now?: () => number,
  deliveryChannel?: OtpDeliveryChannel,
): MockAuthService {
  return new MockAuthService({ now, latency: NO_LATENCY, deliveryChannel });
}

/** Captures the rejection so its type and contents can be asserted. */
async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    return AppError.from(caught);
  }
  throw new Error('Expected the call to reject, but it resolved.');
}

describe('MockAuthService — customer OTP', () => {
  it('issues a challenge with a masked destination and an expiry', async () => {
    const service = createService();

    const challenge = await service.requestCustomerOtp(CUSTOMER_PHONE);

    expect(challenge.maskedDestination).toBe('••••••3210');
    expect(challenge.maskedDestination).not.toContain('987654');
    expect(Date.parse(challenge.expiresAt)).toBeGreaterThan(Date.now());
  });

  it('succeeds for an unregistered number, so accounts cannot be enumerated', async () => {
    const service = createService();

    await expect(service.requestCustomerOtp('9999999999')).resolves.toBeDefined();
  });

  it('returns a customer session for the correct code', async () => {
    const service = createService();
    await service.requestCustomerOtp(CUSTOMER_PHONE);

    const session = await service.verifyCustomerOtp(CUSTOMER_PHONE, MOCK_OTP_CODE);

    expect(session.token).toEqual(expect.any(String));
    expect(session.user.role).toBe('customer');
  });

  it('rejects an incorrect code without disclosing the real one', async () => {
    const service = createService();
    await service.requestCustomerOtp(CUSTOMER_PHONE);

    const error = await rejectionOf(service.verifyCustomerOtp(CUSTOMER_PHONE, '000000'));

    expect(error.kind).toBe('validation');
    expect(error.userMessage).not.toContain(MOCK_OTP_CODE);
  });

  it('rejects an expired code', async () => {
    let clock = Date.now();
    const service = createService(() => clock);
    await service.requestCustomerOtp(CUSTOMER_PHONE);

    clock += (MOCK_OTP_TTL_SECONDS + 1) * 1000;

    const error = await rejectionOf(service.verifyCustomerOtp(CUSTOMER_PHONE, MOCK_OTP_CODE));

    expect(error.kind).toBe('unauthorized');
  });
});

describe('MockAuthService — vendor registration', () => {
  it('starts onboarding and returns a challenge, not a session', async () => {
    const service = createService();

    const registration = await service.registerVendor(NEW_VENDOR);

    expect(registration.registrationId).toEqual(expect.any(String));
    expect(registration.challenge.maskedDestination).toBe('••••••6780');
    expect(registration).not.toHaveProperty('token');
  });

  it('refuses a number that already belongs to a vendor', async () => {
    const service = createService();

    const error = await rejectionOf(
      service.registerVendor({ ...NEW_VENDOR, phone: SEEDED_VENDOR_PHONE }),
    );

    expect(error.kind).toBe('conflict');
  });

  it('rejects an implausible phone number', async () => {
    const service = createService();

    const error = await rejectionOf(service.registerVendor({ ...NEW_VENDOR, phone: '12345' }));

    expect(error.kind).toBe('validation');
  });
});

describe('MockAuthService — vendor registration code signs the vendor in', () => {
  it('returns a vendor session for the correct code, and nothing else', async () => {
    const service = createService();
    const registration = await service.registerVendor(NEW_VENDOR);

    const session = await service.verifyVendorOtp(registration.registrationId, MOCK_OTP_CODE);

    expect(Object.keys(session).sort()).toEqual(['token', 'user']);
    expect(session.user.role).toBe('vendor');
    expect(session.user.firstName).toBe(NEW_VENDOR.ownerFirstName);
    // No auth code rides along under any name.
    expect(JSON.stringify(session)).not.toMatch(/authCode|issuedAt/);
  });

  it('rejects an incorrect code as OTP_INVALID', async () => {
    const service = createService();
    const registration = await service.registerVendor(NEW_VENDOR);

    const error = await rejectionOf(
      service.verifyVendorOtp(registration.registrationId, '000000'),
    );

    expect(error.kind).toBe('validation');
    expect(error.code).toBe('OTP_INVALID');
    expect(error.userMessage).toBe('That code is not correct. Please check and try again.');
  });

  it('rejects an expired code', async () => {
    let clock = Date.now();
    const service = createService(() => clock);
    const registration = await service.registerVendor(NEW_VENDOR);

    clock += (MOCK_OTP_TTL_SECONDS + 1) * 1000;

    const error = await rejectionOf(
      service.verifyVendorOtp(registration.registrationId, MOCK_OTP_CODE),
    );

    expect(error.kind).toBe('unauthorized');
    expect(error.code).toBe('OTP_EXPIRED');
  });

  it('finishes the registration: its id is spent, and the number is now a vendor', async () => {
    const service = createService();
    const registration = await service.registerVendor(NEW_VENDOR);
    await service.verifyVendorOtp(registration.registrationId, MOCK_OTP_CODE);

    const reused = await rejectionOf(
      service.verifyVendorOtp(registration.registrationId, MOCK_OTP_CODE),
    );
    expect(reused.code).toBe('REGISTRATION_NOT_FOUND');

    const again = await rejectionOf(service.registerVendor(NEW_VENDOR));
    expect(again.kind).toBe('conflict');

    // And signs in the way every returning vendor does.
    await service.requestVendorSignInOtp(NEW_VENDOR.phone);
    const session = await service.verifyVendorSignInOtp(NEW_VENDOR.phone, MOCK_OTP_CODE);
    expect(session.user.role).toBe('vendor');
  });

  it('has no auth-code method left to call', () => {
    const service = createService() as unknown as Record<string, unknown>;

    for (const retired of ['verifyVendorAuthCode', 'regenerateVendorAuthCode', 'signInVendor']) {
      expect(service[retired]).toBeUndefined();
    }
  });
});

describe('MockAuthService — vendor sign in by one-time code', () => {
  it('signs a returning vendor in with phone and code', async () => {
    const service = createService();

    const challenge = await service.requestVendorSignInOtp(SEEDED_VENDOR_PHONE);
    const session = await service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, MOCK_OTP_CODE);

    expect(challenge.maskedDestination).toBe('••••••0001');
    expect(session.user.role).toBe('vendor');
    expect(session.user.id).toBe('usr_vendor_1');
  });

  it('opens each seeded vendor’s own account only', async () => {
    const service = createService();

    await service.requestVendorSignInOtp(SECOND_VENDOR_PHONE);
    const session = await service.verifyVendorSignInOtp(SECOND_VENDOR_PHONE, MOCK_OTP_CODE);

    expect(session.user.id).toBe('usr_vendor_2');
  });

  it('answers a code request alike for a vendor, an unknown number and a customer', async () => {
    const service = createService();

    const answers = await Promise.all(
      [SEEDED_VENDOR_PHONE, UNKNOWN_PHONE, CUSTOMER_PHONE].map(async phone => {
        const challenge = await service.requestVendorSignInOtp(phone);
        return Object.keys(challenge).sort();
      }),
    );

    expect(answers).toEqual([
      ['deliveryChannel', 'expiresAt', 'maskedDestination', 'resendAfterSeconds'],
      ['deliveryChannel', 'expiresAt', 'maskedDestination', 'resendAfterSeconds'],
      ['deliveryChannel', 'expiresAt', 'maskedDestination', 'resendAfterSeconds'],
    ]);
  });

  it('refuses an unknown number exactly as it refuses a wrong code', async () => {
    const service = createService();
    await service.requestVendorSignInOtp(UNKNOWN_PHONE);
    await service.requestVendorSignInOtp(SEEDED_VENDOR_PHONE);

    const unknown = await rejectionOf(service.verifyVendorSignInOtp(UNKNOWN_PHONE, MOCK_OTP_CODE));
    const badCode = await rejectionOf(service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, WRONG_CODE));

    for (const error of [unknown, badCode]) {
      expect(error.kind).toBe('validation');
      expect(error.code).toBe('OTP_INVALID');
    }
    expect(unknown.userMessage).toBe(badCode.userMessage);
    expect(unknown.message).toBe(badCode.message);
  });

  it('does not sign a customer in through the vendor door', async () => {
    const service = createService();
    await service.requestVendorSignInOtp(CUSTOMER_PHONE);

    const error = await rejectionOf(service.verifyVendorSignInOtp(CUSTOMER_PHONE, MOCK_OTP_CODE));

    expect(error.code).toBe('OTP_INVALID');
  });

  it('refuses a code that was never requested as expired, for a vendor and an unknown number alike', async () => {
    const service = createService();

    const vendor = await rejectionOf(
      service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, MOCK_OTP_CODE),
    );
    const unknown = await rejectionOf(service.verifyVendorSignInOtp(UNKNOWN_PHONE, MOCK_OTP_CODE));

    for (const error of [vendor, unknown]) {
      expect(error.code).toBe('OTP_EXPIRED');
    }
    expect(vendor.userMessage).toBe(unknown.userMessage);
  });

  it('keeps an unknown number’s request, so a wrong code there reads as a wrong code', async () => {
    const service = createService();
    await service.requestVendorSignInOtp(UNKNOWN_PHONE);

    const wrong = await rejectionOf(service.verifyVendorSignInOtp(UNKNOWN_PHONE, WRONG_CODE));

    expect(wrong.code).toBe('OTP_INVALID');
  });

  it('keeps the code after a mistyped attempt, so one digit does not cost a resend', async () => {
    const service = createService();
    await service.requestVendorSignInOtp(SEEDED_VENDOR_PHONE);

    await rejectionOf(service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, WRONG_CODE));

    await expect(
      service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, MOCK_OTP_CODE),
    ).resolves.toBeDefined();
  });

  it('spends the code on success', async () => {
    const service = createService();
    await service.requestVendorSignInOtp(SEEDED_VENDOR_PHONE);
    await service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, MOCK_OTP_CODE);

    const replay = await rejectionOf(
      service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, MOCK_OTP_CODE),
    );

    // Nothing is held for the number any more: as if no code had been asked for.
    expect(replay.code).toBe('OTP_EXPIRED');
  });

  it('rejects an expired code', async () => {
    let clock = Date.now();
    const service = createService(() => clock);
    await service.requestVendorSignInOtp(SEEDED_VENDOR_PHONE);

    clock += (MOCK_OTP_TTL_SECONDS + 1) * 1000;

    const error = await rejectionOf(
      service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, MOCK_OTP_CODE),
    );

    expect(error.code).toBe('OTP_EXPIRED');
    expect(error.userMessage).toBe('That code has expired. Request a new one.');
  });

  it('refuses an implausible phone number before issuing anything', async () => {
    const service = createService();

    const error = await rejectionOf(service.requestVendorSignInOtp('12345'));

    expect(error.kind).toBe('validation');
  });

  it('never writes a code, typed or expected, to the log', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    const service = createService();

    await service.requestVendorSignInOtp(SEEDED_VENDOR_PHONE);
    await rejectionOf(service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, WRONG_CODE));
    await service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, MOCK_OTP_CODE);
    const registration = await service.registerVendor(NEW_VENDOR);
    await rejectionOf(service.verifyVendorOtp(registration.registrationId, WRONG_CODE));
    await service.verifyVendorOtp(registration.registrationId, MOCK_OTP_CODE);

    const logged = spies
      .flatMap(spy => spy.mock.calls)
      .flat()
      .map(entry => JSON.stringify(entry))
      .join(' ');
    spies.forEach(spy => spy.mockRestore());

    expect(logged).not.toContain(MOCK_OTP_CODE);
    expect(logged).not.toContain(WRONG_CODE);
  });
});

describe('MockAuthService — the delivery channel', () => {
  it('reports NONE by default: the mock sends nothing', async () => {
    const service = createService();

    const challenges = [
      await service.requestCustomerOtp(CUSTOMER_PHONE),
      await service.requestVendorSignInOtp(SEEDED_VENDOR_PHONE),
      (await service.registerVendor(NEW_VENDOR)).challenge,
    ];

    expect(challenges.map(challenge => challenge.deliveryChannel)).toEqual([
      'NONE',
      'NONE',
      'NONE',
    ]);
  });

  it('reports the channel it was given on every challenge, the resend included', async () => {
    const service = createService(undefined, 'WHATSAPP');

    const registration = await service.registerVendor(NEW_VENDOR);
    const challenges = [
      await service.requestCustomerOtp(CUSTOMER_PHONE),
      await service.requestVendorSignInOtp(SEEDED_VENDOR_PHONE),
      registration.challenge,
      await service.requestVendorOtp(registration.registrationId),
    ];

    expect(new Set(challenges.map(challenge => challenge.deliveryChannel))).toEqual(
      new Set(['WHATSAPP']),
    );
  });
});

describe('MockAuthService — sign out', () => {
  it('invalidates outstanding challenges but not vendors', async () => {
    const service = createService();
    await service.requestCustomerOtp(CUSTOMER_PHONE);
    await service.requestVendorSignInOtp(SEEDED_VENDOR_PHONE);

    await expect(service.signOut()).resolves.toBeUndefined();

    const customer = await rejectionOf(service.verifyCustomerOtp(CUSTOMER_PHONE, MOCK_OTP_CODE));
    expect(customer.kind).toBe('validation');
    const vendor = await rejectionOf(
      service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, MOCK_OTP_CODE),
    );
    expect(vendor.code).toBe('OTP_EXPIRED');

    // The vendor still exists: a fresh code signs them in.
    await service.requestVendorSignInOtp(SEEDED_VENDOR_PHONE);
    await expect(
      service.verifyVendorSignInOtp(SEEDED_VENDOR_PHONE, MOCK_OTP_CODE),
    ).resolves.toBeDefined();
  });
});

describe('MockAuthService — simulated latency', () => {
  it('still takes realistic time when latency is not overridden', async () => {
    // Guards the reason latency exists: without it the loading, error and retry
    // states the UI is built against would never be visible in development. The
    // rest of this suite opts out; the app must not.
    const service = new MockAuthService();

    const startedAt = Date.now();
    await service.requestCustomerOtp(CUSTOMER_PHONE);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(AppConfig.mock.minLatencyMs);
  });

  it('resolves without waiting when latency is switched off', async () => {
    const service = createService();

    const startedAt = Date.now();
    await service.requestCustomerOtp(CUSTOMER_PHONE);

    expect(Date.now() - startedAt).toBeLessThan(AppConfig.mock.minLatencyMs);
  });
});
