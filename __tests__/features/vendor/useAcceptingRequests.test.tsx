/**
 * "Accepting new requests" is changed from two screens — Profile's switch and
 * the dashboard's notice — and each holds its own `useAcceptingRequests`. The
 * rule pinned here: one change in the air per vendor session, seen as busy by
 * every holder, whichever screen started it (review finding, 21/10/2026: kept
 * per hook, the second screen could send the same change again and the vendor
 * got two toasts).
 *
 * Two consumers under one real `VendorProfileProvider`, against the real mock
 * profile service with its change held at a gate the test opens.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import type { AuthUser } from '@/features/auth/types';
import {
  useAcceptingRequests,
  type AcceptingRequestsState,
  type AvailabilityOutcome,
} from '@/features/vendor/hooks/useAcceptingRequests';
import { VendorProfileProvider } from '@/features/vendor/state/VendorProfileContext';
import { ToastProvider } from '@/shared/components';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

/** What each consumer's hook said on its latest render. */
const seen: Record<string, AcceptingRequestsState> = {};

function Holder({ name }: { name: string }) {
  seen[name] = useAcceptingRequests();
  return null;
}

/**
 * The mock's change, held until the test opens the gate. The business is set
 * up first: availability is offered only once it is, and the mock refuses it
 * before.
 */
async function gatedProfiles() {
  const profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser: async () => RAVI });
  await profiles.saveProfile({
    businessName: 'Kumar Electricals',
    serviceCategoryIds: ['cat_electrician'],
  });
  const real = profiles.setAcceptingRequests.bind(profiles);
  let open!: () => void;
  let fail = false;
  const setAcceptingRequests = jest.fn(async (accepting: boolean) => {
    await new Promise<void>(resolve => {
      open = resolve;
    });
    if (fail) {
      throw new AppError({ kind: 'network', message: 'offline' });
    }
    return real(accepting);
  });
  profiles.setAcceptingRequests = setAcceptingRequests;
  registerService('vendorProfile', profiles);
  return {
    setAcceptingRequests,
    open: async () => {
      await act(async () => {
        open();
      });
    },
    failNext: () => {
      fail = true;
    },
  };
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  for (const name of Object.keys(seen)) {
    delete seen[name];
  }
  resetServices();
});

function tree(holders: string[]) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <VendorProfileProvider>
          {holders.map(name => (
            <Holder key={name} name={name} />
          ))}
        </VendorProfileProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

async function render(holders: string[] = ['profile', 'dashboard']) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(tree(holders));
  });
  mounted.push(renderer);
  return renderer;
}

/**
 * Starts a change on one holder without waiting for it. The outcome comes back
 * wrapped: an async function returning the promise itself would adopt it, and
 * the caller would wait for an answer the test has not let through yet.
 */
async function start(name: string, accepting: boolean): Promise<{ outcome: Promise<AvailabilityOutcome> }> {
  let outcome!: Promise<AvailabilityOutcome>;
  await act(async () => {
    outcome = seen[name].setAccepting(accepting);
  });
  return { outcome };
}

describe('useAcceptingRequests — one change per vendor session, across screens', () => {
  it('shows a change started on Profile as busy on the dashboard too, and refuses the dashboard’s own', async () => {
    const service = await gatedProfiles();
    await render();
    expect(seen.profile.isAccepting).toBe(true);

    const { outcome: fromProfile } = await start('profile', false);

    for (const name of ['profile', 'dashboard']) {
      expect(seen[name].isChanging).toBe(true);
      expect(seen[name].pending).toBe(false);
    }

    // The dashboard's press while Profile's change is in the air.
    let fromDashboard!: AvailabilityOutcome;
    await act(async () => {
      fromDashboard = await seen.dashboard.setAccepting(false);
    });
    expect(fromDashboard).toBe('ignored');
    expect(service.setAcceptingRequests).toHaveBeenCalledTimes(1);

    await service.open();

    await expect(fromProfile).resolves.toBe('changed');
    expect(service.setAcceptingRequests).toHaveBeenCalledTimes(1);
    for (const name of ['profile', 'dashboard']) {
      expect(seen[name].isChanging).toBe(false);
      expect(seen[name].pending).toBeNull();
      expect(seen[name].isAccepting).toBe(false);
    }
  });

  it('gives the claim back once the change has answered, so the next one goes from either screen', async () => {
    const service = await gatedProfiles();
    await render();

    const { outcome: off } = await start('profile', false);
    await service.open();
    await expect(off).resolves.toBe('changed');

    const { outcome: on } = await start('dashboard', true);
    expect(seen.profile.isChanging).toBe(true);
    await service.open();

    await expect(on).resolves.toBe('changed');
    expect(service.setAcceptingRequests).toHaveBeenCalledTimes(2);
    expect(seen.profile.isAccepting).toBe(true);
    expect(seen.dashboard.isChanging).toBe(false);
  });

  it('gives the claim back after a failure too, the switch going back on both', async () => {
    const service = await gatedProfiles();
    service.failNext();
    await render();

    const { outcome: off } = await start('dashboard', false);
    expect(seen.profile.isChanging).toBe(true);
    await service.open();

    await expect(off).resolves.toBe('failed');
    for (const name of ['profile', 'dashboard']) {
      expect(seen[name].isChanging).toBe(false);
      expect(seen[name].isAccepting).toBe(true);
    }
  });

  it('keeps the change busy on the dashboard when Profile, which started it, is left mid-change', async () => {
    const service = await gatedProfiles();
    const renderer = await render();

    const { outcome: off } = await start('profile', false);
    await act(async () => {
      renderer.update(tree(['dashboard']));
    });
    expect(seen.dashboard.isChanging).toBe(true);

    await service.open();

    await expect(off).resolves.toBe('changed');
    expect(seen.dashboard.isChanging).toBe(false);
    expect(seen.dashboard.isAccepting).toBe(false);
  });
});
