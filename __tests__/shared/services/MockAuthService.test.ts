/**
 * MockAuthService stands in for backend judgement until the backend exists, so
 * these tests pin the behaviour the UI will be built against — including the
 * rules that must survive the real implementation: no account enumeration, no
 * credential in any error, and above all that verifying a phone number does not
 * by itself sign a vendor in.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { MockAuthService } from '@/shared/services/mock/MockAuthService';
import {
  MOCK_OTP_CODE,
  MOCK_OTP_TTL_SECONDS,
  type MockRandomSource,
} from '@/shared/services/mock/mockAuthData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type { VendorRegistrationDetails } from '@/shared/services/types/AuthService';
import { AppError } from '@/shared/types/error';

const CUSTOMER_PHONE = '9876543210';
const SEEDED_VENDOR_PHONE = '9000000001';
const SEEDED_VENDOR_CODE = '482913';
const SECOND_VENDOR_PHONE = '9000000002';
const SECOND_VENDOR_CODE = '573014';
/** Six digits that are neither seeded vendor's code. */
const WRONG_CODE = '111111';

/**
 * A random source that yields these digits in turn, then repeats them — so the
 * code a registration is issued is known in advance.
 */
function digitsSource(digits: string): MockRandomSource {
  let index = 0;
  return () => {
    const digit = Number(digits[index % digits.length]);
    index += 1;
    // The middle of the digit's tenth, so flooring lands on it exactly.
    return (digit + 0.5) / 10;
  };
}

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
function createService(now?: () => number, random?: MockRandomSource): MockAuthService {
  return new MockAuthService({ now, latency: NO_LATENCY, random });
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

/** Registers and verifies a vendor, returning the issued auth code. */
async function onboardToAuthCode(service: MockAuthService) {
  const registration = await service.registerVendor(NEW_VENDOR);
  const issued = await service.verifyVendorOtp(registration.registrationId, MOCK_OTP_CODE);
  return { registrationId: registration.registrationId, code: issued.code };
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

describe('MockAuthService — vendor OTP activates but does not authenticate', () => {
  it('issues an auth code rather than a session', async () => {
    const service = createService();
    const registration = await service.registerVendor(NEW_VENDOR);

    const issued = await service.verifyVendorOtp(registration.registrationId, MOCK_OTP_CODE);

    expect(issued.code).toMatch(new RegExp(`^\\d{${AppConfig.vendorAuthCode.length}}$`));
    expect(issued).not.toHaveProperty('token');
    expect(issued).not.toHaveProperty('user');
  });

  it('issues the code its random source gives, as a string with its leading zeros', async () => {
    const service = createService(undefined, digitsSource('048213'));
    const registration = await service.registerVendor(NEW_VENDOR);

    const issued = await service.verifyVendorOtp(registration.registrationId, MOCK_OTP_CODE);

    expect(issued.code).toBe('048213');
    expect(typeof issued.code).toBe('string');
  });

  it('rejects an incorrect code', async () => {
    const service = createService();
    const registration = await service.registerVendor(NEW_VENDOR);

    const error = await rejectionOf(
      service.verifyVendorOtp(registration.registrationId, '000000'),
    );

    expect(error.kind).toBe('validation');
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
  });

  it('refuses to confirm an auth code before the phone is verified', async () => {
    const service = createService();
    const registration = await service.registerVendor(NEW_VENDOR);

    const error = await rejectionOf(
      service.verifyVendorAuthCode(registration.registrationId, WRONG_CODE),
    );

    expect(error.kind).toBe('forbidden');
  });
});

describe('MockAuthService — vendor auth code confirmation', () => {
  it('creates the session only once the code is confirmed', async () => {
    const service = createService();
    const { registrationId, code } = await onboardToAuthCode(service);

    const session = await service.verifyVendorAuthCode(registrationId, code);

    expect(session.token).toEqual(expect.any(String));
    expect(session.user.role).toBe('vendor');
    expect(session.token).not.toContain(code);
  });

  it('rejects a wrong code without echoing the attempt or the real code', async () => {
    // Pinned, so the wrong code below can never be the one issued by chance.
    const service = createService(undefined, digitsSource('482913'));
    const { registrationId, code } = await onboardToAuthCode(service);

    const error = await rejectionOf(service.verifyVendorAuthCode(registrationId, WRONG_CODE));

    expect(error.kind).toBe('validation');
    expect(error.userMessage).not.toContain(WRONG_CODE);
    expect(error.message).not.toContain(WRONG_CODE);
    expect(error.userMessage).not.toContain(code);
    expect(error.message).not.toContain(code);
  });
});

describe('MockAuthService — auth code regeneration', () => {
  it('revokes the previous code and accepts the replacement', async () => {
    const service = createService();
    const { registrationId, code: original } = await onboardToAuthCode(service);

    const replacement = await service.regenerateVendorAuthCode(registrationId);

    expect(replacement.code).not.toBe(original);

    const error = await rejectionOf(service.verifyVendorAuthCode(registrationId, original));
    expect(error.kind).toBe('validation');

    await expect(
      service.verifyVendorAuthCode(registrationId, replacement.code),
    ).resolves.toBeDefined();
  });

  it('issues a different code even when the random source repeats itself', async () => {
    // Every draw is the same six digits, so a regeneration that trusted the
    // source would "replace" the code with itself and revoke nothing.
    const service = createService(undefined, digitsSource('573014'));
    const { registrationId, code: original } = await onboardToAuthCode(service);
    expect(original).toBe('573014');

    const replacement = await service.regenerateVendorAuthCode(registrationId);

    expect(replacement.code).not.toBe(original);
    expect(replacement.code).toMatch(/^\d{6}$/);
    expect((await rejectionOf(service.verifyVendorAuthCode(registrationId, original))).kind)
      .toBe('validation');
  });

  it('leaves the old code dead for signing in once a replacement is confirmed', async () => {
    const service = createService(undefined, digitsSource('204060'));
    const { registrationId, code: original } = await onboardToAuthCode(service);
    const replacement = await service.regenerateVendorAuthCode(registrationId);
    await service.verifyVendorAuthCode(registrationId, replacement.code);

    const refused = await rejectionOf(service.signInVendor(NEW_VENDOR.phone, original));

    expect(refused.kind).toBe('unauthorized');
    await expect(service.signInVendor(NEW_VENDOR.phone, replacement.code)).resolves.toBeDefined();
  });

  it('never writes an issued or regenerated code to the log', async () => {
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    const service = createService(undefined, digitsSource('739105'));

    const { registrationId, code } = await onboardToAuthCode(service);
    const replacement = await service.regenerateVendorAuthCode(registrationId);
    await rejectionOf(service.verifyVendorAuthCode(registrationId, code));
    await service.verifyVendorAuthCode(registrationId, replacement.code);
    await service.signInVendor(NEW_VENDOR.phone, replacement.code);
    await rejectionOf(service.signInVendor(SEEDED_VENDOR_PHONE, WRONG_CODE));

    const logged = spies
      .flatMap(spy => spy.mock.calls)
      .flat()
      .map(entry => JSON.stringify(entry))
      .join(' ');
    spies.forEach(spy => spy.mockRestore());

    expect(code).toBe('739105');
    expect(logged).not.toContain(code);
    expect(logged).not.toContain(replacement.code);
    expect(logged).not.toContain(WRONG_CODE);
  });
});

describe('MockAuthService — vendor sign in', () => {
  it('signs a returning vendor in with phone and auth code, without an OTP', async () => {
    const service = createService();

    const session = await service.signInVendor(SEEDED_VENDOR_PHONE, SEEDED_VENDOR_CODE);

    expect(session.user.role).toBe('vendor');
    expect(session.user.id).toBe('usr_vendor_1');
  });

  it('seeds a second vendor with a code of their own', async () => {
    const service = createService();

    const session = await service.signInVendor(SECOND_VENDOR_PHONE, SECOND_VENDOR_CODE);
    expect(session.user.id).toBe('usr_vendor_2');

    // Each code opens its own account only.
    const crossed = await rejectionOf(
      service.signInVendor(SECOND_VENDOR_PHONE, SEEDED_VENDOR_CODE),
    );
    expect(crossed.kind).toBe('unauthorized');
  });

  it('accepts the code issued during onboarding', async () => {
    const service = createService();
    const { registrationId, code } = await onboardToAuthCode(service);
    await service.verifyVendorAuthCode(registrationId, code);

    const session = await service.signInVendor(NEW_VENDOR.phone, code);

    expect(session.user.role).toBe('vendor');
  });

  it('fails identically for an unknown number and a wrong code', async () => {
    const service = createService();

    const unknown = await rejectionOf(service.signInVendor('9111111111', SEEDED_VENDOR_CODE));
    const badCode = await rejectionOf(service.signInVendor(SEEDED_VENDOR_PHONE, WRONG_CODE));

    expect(unknown.kind).toBe('unauthorized');
    expect(badCode.kind).toBe('unauthorized');
    expect(unknown.userMessage).toBe(badCode.userMessage);
    expect(badCode.userMessage).not.toContain(SEEDED_VENDOR_CODE);
  });
});

describe('MockAuthService — sign out', () => {
  it('invalidates outstanding challenges but not activated vendors', async () => {
    const service = createService();
    await service.requestCustomerOtp(CUSTOMER_PHONE);

    await expect(service.signOut()).resolves.toBeUndefined();

    const error = await rejectionOf(service.verifyCustomerOtp(CUSTOMER_PHONE, MOCK_OTP_CODE));
    expect(error.kind).toBe('validation');

    await expect(
      service.signInVendor(SEEDED_VENDOR_PHONE, SEEDED_VENDOR_CODE),
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
