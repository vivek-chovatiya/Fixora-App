/**
 * MockAuthService stands in for backend judgement until the backend exists, so
 * these tests pin the behaviour the UI will be built against — including the
 * rules that must survive the real implementation: no existence leaks, and no
 * credential ever appearing in an error.
 */

import { MockAuthService } from '@/shared/services/mock/MockAuthService';
import { MOCK_OTP_CODE, MOCK_OTP_TTL_SECONDS } from '@/shared/services/mock/mockAuthData';
import { AppError } from '@/shared/types/error';

const CUSTOMER_PHONE = '9876543210';
const VENDOR_PHONE = '9000000001';
const VENDOR_CODE = 'FX-VENDOR-APPROVED';
const PENDING_VENDOR_PHONE = '9000000002';
const REJECTED_VENDOR_PHONE = '9000000003';

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
    const service = new MockAuthService();

    const challenge = await service.requestCustomerOtp(CUSTOMER_PHONE);

    expect(challenge.maskedDestination).toBe('••••••3210');
    expect(challenge.maskedDestination).not.toContain('987654');
    expect(Date.parse(challenge.expiresAt)).toBeGreaterThan(Date.now());
    expect(challenge.resendAfterSeconds).toBeGreaterThan(0);
  });

  it('succeeds for an unregistered number, so accounts cannot be enumerated', async () => {
    const service = new MockAuthService();

    await expect(service.requestCustomerOtp('9999999999')).resolves.toBeDefined();
  });

  it('rejects an implausible phone number', async () => {
    const service = new MockAuthService();

    const error = await rejectionOf(service.requestCustomerOtp('12345'));

    expect(error.kind).toBe('validation');
  });

  it('returns a customer session for the correct code', async () => {
    const service = new MockAuthService();
    await service.requestCustomerOtp(CUSTOMER_PHONE);

    const session = await service.verifyCustomerOtp(CUSTOMER_PHONE, MOCK_OTP_CODE);

    expect(session.token).toEqual(expect.any(String));
    expect(session.user.role).toBe('customer');
    expect(session.user.phone).toBe(CUSTOMER_PHONE);
    expect(session.user.vendorApproval).toBeUndefined();
  });

  it('rejects an incorrect code without disclosing the real one', async () => {
    const service = new MockAuthService();
    await service.requestCustomerOtp(CUSTOMER_PHONE);

    const error = await rejectionOf(service.verifyCustomerOtp(CUSTOMER_PHONE, '000000'));

    expect(error.kind).toBe('validation');
    expect(error.userMessage).not.toContain(MOCK_OTP_CODE);
    expect(error.message).not.toContain(MOCK_OTP_CODE);
  });

  it('keeps the challenge alive after a wrong attempt, so a typo is recoverable', async () => {
    const service = new MockAuthService();
    await service.requestCustomerOtp(CUSTOMER_PHONE);
    await rejectionOf(service.verifyCustomerOtp(CUSTOMER_PHONE, '000000'));

    await expect(service.verifyCustomerOtp(CUSTOMER_PHONE, MOCK_OTP_CODE)).resolves.toBeDefined();
  });

  it('rejects verification when no code was ever requested', async () => {
    const service = new MockAuthService();

    const error = await rejectionOf(service.verifyCustomerOtp(CUSTOMER_PHONE, MOCK_OTP_CODE));

    expect(error.kind).toBe('validation');
  });

  it('rejects an expired code', async () => {
    let clock = Date.now();
    const service = new MockAuthService(() => clock);
    await service.requestCustomerOtp(CUSTOMER_PHONE);

    clock += (MOCK_OTP_TTL_SECONDS + 1) * 1000;

    const error = await rejectionOf(service.verifyCustomerOtp(CUSTOMER_PHONE, MOCK_OTP_CODE));

    expect(error.kind).toBe('unauthorized');
  });
});

describe('MockAuthService — vendor sign in', () => {
  it('returns an approved vendor session for the correct code', async () => {
    const service = new MockAuthService();

    const session = await service.signInVendor(VENDOR_PHONE, VENDOR_CODE);

    expect(session.user.role).toBe('vendor');
    expect(session.user.vendorApproval).toBe('approved');
  });

  it('rejects an incorrect vendor code without echoing the attempt or the real code', async () => {
    const service = new MockAuthService();

    const error = await rejectionOf(service.signInVendor(VENDOR_PHONE, 'WRONG-CODE-ATTEMPT'));

    expect(error.kind).toBe('unauthorized');
    expect(error.userMessage).not.toContain('WRONG-CODE-ATTEMPT');
    expect(error.userMessage).not.toContain(VENDOR_CODE);
    expect(error.message).not.toContain('WRONG-CODE-ATTEMPT');
    expect(error.message).not.toContain(VENDOR_CODE);
  });

  it('refuses an unknown number with the same generic message as a bad code', async () => {
    const service = new MockAuthService();

    const unknown = await rejectionOf(service.signInVendor('9111111111', VENDOR_CODE));
    const badCode = await rejectionOf(service.signInVendor(VENDOR_PHONE, 'NOPE'));

    expect(unknown.kind).toBe('unauthorized');
    expect(unknown.userMessage).toBe(badCode.userMessage);
  });

  it('tells a pending vendor they are still under verification', async () => {
    const service = new MockAuthService();

    const error = await rejectionOf(service.signInVendor(PENDING_VENDOR_PHONE, VENDOR_CODE));

    expect(error.kind).toBe('forbidden');
    expect(error.userMessage).toContain('verification');
  });

  it('tells a rejected vendor their application was not approved', async () => {
    const service = new MockAuthService();

    const error = await rejectionOf(service.signInVendor(REJECTED_VENDOR_PHONE, VENDOR_CODE));

    expect(error.kind).toBe('forbidden');
    expect(error.userMessage).toContain('not approved');
  });

  it('refuses a customer number on the vendor route', async () => {
    const service = new MockAuthService();

    const error = await rejectionOf(service.signInVendor(CUSTOMER_PHONE, VENDOR_CODE));

    expect(error.kind).toBe('unauthorized');
  });
});

describe('MockAuthService — sign out', () => {
  it('resolves and invalidates any outstanding challenge', async () => {
    const service = new MockAuthService();
    await service.requestCustomerOtp(CUSTOMER_PHONE);

    await expect(service.signOut()).resolves.toBeUndefined();

    const error = await rejectionOf(service.verifyCustomerOtp(CUSTOMER_PHONE, MOCK_OTP_CODE));
    expect(error.kind).toBe('validation');
  });
});
