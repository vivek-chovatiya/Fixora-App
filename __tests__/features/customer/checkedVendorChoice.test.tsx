/**
 * `useCheckedVendorChoice` on its own (Phase 3D-12): the rule that a request
 * never goes to a preferred professional who is not in the latest eligible
 * list for its service.
 *
 * The screens' suites cover the paths a customer can reach. These pin the one
 * they cannot reach today, because neither screen offers a pull: a list held
 * from an earlier read while a newer one is in the air, or after that newer
 * one failed, is not the latest list. It confirms nobody and withdraws nobody.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import {
  useCheckedVendorChoice,
  type CheckedVendorChoice,
} from '@/features/customer/hooks/useCheckedVendorChoice';
import {
  RequestDraftProvider,
  useRequestDraft,
  type RequestDraft,
} from '@/features/customer/state/RequestDraftContext';
import { setRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { EligibleVendor, VendorService } from '@/shared/services/types/VendorService';
import { AppError } from '@/shared/types/error';

const DRAFT: RequestDraft = {
  categoryId: 'cat_electrical',
  subCategoryId: 'sub_fan',
  values: { priority: 'HIGH', preferredDate: '', preferredTime: '', notes: '' },
  imageUrls: [],
  address: { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' },
  vendor: { kind: 'vendor', vendorId: 'ven_zenith' },
};

const WITH_ZENITH: EligibleVendor[] = [{ id: 'ven_zenith', name: 'Zenith Electricals' }];
const WITHOUT_ZENITH: EligibleVendor[] = [{ id: 'ven_apex', name: 'Apex Repairs' }];

type Handle = {
  checked: CheckedVendorChoice | null;
  draft: ReturnType<typeof useRequestDraft> | null;
};

function Probe({ handle }: { handle: Handle }) {
  const drafts = useRequestDraft();
  const seeded = React.useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    drafts.startDraft(DRAFT);
  }
  handle.draft = drafts;
  handle.checked = useCheckedVendorChoice(DRAFT.categoryId, DRAFT.subCategoryId);
  return null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  setRequestDraftStorage({
    read: async () => null,
    write: async () => true,
    clear: async () => undefined,
  });
});

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
});

/** Answers each read with the next of `answers`: a list, an error, or a read left in the air. */
async function mount(answers: Array<EligibleVendor[] | AppError | 'pending'>) {
  let call = 0;
  registerService('vendor', {
    listEligibleVendors: jest.fn(() => {
      const answer = answers[call];
      call += 1;
      if (answer === 'pending') {
        return new Promise<EligibleVendor[]>(() => {});
      }
      return answer instanceof AppError ? Promise.reject(answer) : Promise.resolve(answer);
    }),
  } as VendorService);

  const handle: Handle = { checked: null, draft: null };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <RequestDraftProvider>
        <Probe handle={handle} />
      </RequestDraftProvider>,
    );
  });
  mounted.push(renderer);
  return handle;
}

describe('useCheckedVendorChoice', () => {
  it('confirms a professional the loaded list has', async () => {
    const handle = await mount([WITH_ZENITH]);

    expect(handle.checked?.standing).toBe('available');
    expect(handle.checked?.isChoiceConfirmed).toBe(true);
  });

  it('confirms nobody on a list held from before while a newer read is in the air', async () => {
    const handle = await mount([WITH_ZENITH, 'pending']);

    await act(async () => {
      handle.checked?.vendors.refresh();
    });

    expect(handle.checked?.standing).toBe('unknown');
    expect(handle.checked?.isChoiceConfirmed).toBe(false);
    expect(handle.draft?.draft?.vendor).toEqual(DRAFT.vendor);
  });

  it('confirms nobody, and withdraws nobody, on a list held from before a read that failed', async () => {
    const handle = await mount([WITH_ZENITH, new AppError({ kind: 'network', message: 'offline' })]);

    await act(async () => {
      handle.checked?.vendors.refresh();
    });

    expect(handle.checked?.vendors.data).toEqual(WITH_ZENITH);
    expect(handle.checked?.standing).toBe('unknown');
    expect(handle.checked?.isChoiceConfirmed).toBe(false);
    expect(handle.draft?.draft?.vendor).toEqual(DRAFT.vendor);
    expect(handle.checked?.wasWithdrawn).toBe(false);
  });

  it('withdraws them once a newer list has loaded without them', async () => {
    const handle = await mount([WITH_ZENITH, WITHOUT_ZENITH]);
    expect(handle.checked?.isChoiceConfirmed).toBe(true);

    await act(async () => {
      handle.checked?.vendors.refresh();
    });

    expect(handle.draft?.draft?.vendor).toEqual({ kind: 'none' });
    expect(handle.checked?.wasWithdrawn).toBe(true);
    // Nobody named any more, so nothing is left to confirm.
    expect(handle.checked?.standing).toBe('unnamed');
  });
});
