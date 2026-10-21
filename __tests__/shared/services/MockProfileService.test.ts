/**
 * The mock profile endpoint (PROJECT_BIBLE.md section 25, Phase 3D-8).
 *
 * It stands in for a backend, so what is pinned here is backend behaviour: it
 * re-checks what it is sent rather than trusting the form, it normalises and
 * returns what it stored, it refuses an unauthenticated call, and it never
 * writes anything itself — the caller owns the session.
 */

import type { AuthUser } from '@/features/auth/types';
import { MockProfileService } from '@/shared/services/mock/MockProfileService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { PROFILE_NAME_MAX_LENGTH } from '@/shared/services/types/ProfileService';
import { AppError } from '@/shared/types/error';

const ASHA: AuthUser = {
  id: 'usr_customer_1',
  firstName: 'Asha',
  lastName: 'Patel',
  email: 'asha@example.com',
  phone: '9876543210',
  role: 'customer',
};

function service(user: AuthUser | null = ASHA) {
  return new MockProfileService({ latency: NO_LATENCY, readUser: async () => user });
}

async function kindOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (caught) {
    return AppError.from(caught).kind;
  }
  return 'resolved';
}

describe('MockProfileService — updating the details', () => {
  it('returns the whole customer, with the changes applied', async () => {
    const updated = await service().updateProfile({
      firstName: 'Asha',
      lastName: 'Sharma',
      email: 'asha@example.com',
    });

    expect(updated).toEqual({ ...ASHA, lastName: 'Sharma' });
  });

  it('normalises like a backend, and hands back what it stored', async () => {
    const updated = await service().updateProfile({
      firstName: '  Asha  ',
      lastName: ' Patel ',
      email: '  ASHA@Example.COM ',
    });

    expect(updated.firstName).toBe('Asha');
    expect(updated.lastName).toBe('Patel');
    expect(updated.email).toBe('asha@example.com');
  });

  it('removes the email when none is sent, rather than leaving the old one', async () => {
    const updated = await service().updateProfile({ firstName: 'Asha', lastName: 'Patel' });

    expect(Object.keys(updated)).not.toContain('email');
  });

  it('keeps a blank last name — not every name has two parts', async () => {
    const updated = await service().updateProfile({ firstName: 'Prince', lastName: '' });

    expect(updated.lastName).toBe('');
    expect(updated.firstName).toBe('Prince');
  });

  it('never lets the id, phone or role be changed through a profile edit', async () => {
    const updated = await service().updateProfile({
      firstName: 'Someone',
      lastName: 'Else',
      email: 'someone@example.com',
    });

    expect(updated.id).toBe(ASHA.id);
    expect(updated.phone).toBe(ASHA.phone);
    expect(updated.role).toBe('customer');
  });

  it('refuses a blank name, whitespace included', async () => {
    expect(await kindOf(() => service().updateProfile({ firstName: '   ', lastName: 'Patel' }))).toBe(
      'validation',
    );
  });

  it('refuses a name longer than the contract allows', async () => {
    const tooLong = 'a'.repeat(PROFILE_NAME_MAX_LENGTH + 1);

    expect(await kindOf(() => service().updateProfile({ firstName: tooLong, lastName: '' }))).toBe(
      'validation',
    );
    expect(
      await kindOf(() => service().updateProfile({ firstName: 'Asha', lastName: tooLong })),
    ).toBe('validation');
  });

  it('refuses an address that is not one, even though the form checked first', async () => {
    expect(
      await kindOf(() =>
        service().updateProfile({ firstName: 'Asha', lastName: 'Patel', email: 'not-an-email' }),
      ),
    ).toBe('validation');
  });

  it('refuses every operation when nobody is signed in', async () => {
    const anonymous = service(null);

    expect(await kindOf(() => anonymous.updateProfile({ firstName: 'A', lastName: 'B' }))).toBe(
      'unauthorized',
    );
    expect(await kindOf(() => anonymous.setProfileImage('https://cdn/a.jpg'))).toBe('unauthorized');
    expect(await kindOf(() => anonymous.removeProfileImage())).toBe('unauthorized');
  });
});

describe('MockProfileService — the picture', () => {
  it('attaches an uploaded image and leaves everything else alone', async () => {
    const updated = await service().setProfileImage('https://cdn.example.com/a.jpg');

    expect(updated).toEqual({ ...ASHA, avatarUrl: 'https://cdn.example.com/a.jpg' });
  });

  it('refuses an empty url rather than storing a broken picture', async () => {
    expect(await kindOf(() => service().setProfileImage('   '))).toBe('validation');
  });

  it('removes the picture, and says so by the field being gone', async () => {
    const withImage = { ...ASHA, avatarUrl: 'https://cdn.example.com/a.jpg' };

    const updated = await service(withImage).removeProfileImage();

    expect(Object.keys(updated)).not.toContain('avatarUrl');
  });

  it('is content to remove a picture that was never there', async () => {
    await expect(service().removeProfileImage()).resolves.toEqual(ASHA);
  });
});
