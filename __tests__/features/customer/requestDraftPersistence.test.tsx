/**
 * Whether an unfinished request survives being walked away from.
 *
 * The rules under test are the ones with a cost if they are wrong: a draft
 * cleared too eagerly loses work the customer did, and one cleared too late has
 * Home offering to resume a request that has already been sent.
 *
 * Storage is stubbed rather than mocked away, so a failing device is a case
 * these tests can actually put the provider in.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import {
  RequestDraftProvider,
  useRequestDraft,
  type RequestDraft,
} from '@/features/customer/state/RequestDraftContext';
import { NO_VENDOR_CHOICE } from '@/features/customer/state/requestDraft';
import {
  setRequestDraftStorage,
  type RequestDraftStorage,
  type SavedRequestDraft,
} from '@/features/customer/state/requestDraftStorage';

/**
 * A chosen suggestion, coordinates and all.
 *
 * Structured rather than a bare line, because the thing worth pinning is that
 * the *whole* address survives a round trip through storage — a serialisation
 * that quietly dropped the latitude would still pass a test that only checked
 * the words.
 */
const ADDRESS = {
  formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
  latitude: 12.9352,
  longitude: 77.6245,
  placeId: 'place_koramangala_5th',
};

const DRAFT: RequestDraft = {
  categoryId: 'cat_1',
  subCategoryId: 'sub_1',
  values: {
    priority: 'HIGH',
    preferredDate: '',
    preferredTime: '',
    notes: 'The fan rattles.',
  },
  imageUrls: [],
  address: ADDRESS,
  vendor: NO_VENDOR_CHOICE,
};

/** A storage stub that records what it was asked to do. */
function stubStorage(overrides: Partial<RequestDraftStorage> = {}) {
  const writes: RequestDraft[] = [];
  let clears = 0;
  let saved: SavedRequestDraft | null = null;

  const storage: RequestDraftStorage = {
    read: async () => saved,
    write: async draft => {
      writes.push(draft);
      saved = { draft, savedAt: '2026-09-10T09:00:00.000Z' };
      return true;
    },
    clear: async () => {
      clears += 1;
      saved = null;
    },
    ...overrides,
  };

  setRequestDraftStorage(storage);

  return {
    writes,
    clearCount: () => clears,
    /** Pretends the app was closed and reopened with whatever was written. */
    seed: (value: SavedRequestDraft | null) => {
      saved = value;
    },
  };
}

/** Exposes the context so a test can drive it the way the screens do. */
let api: ReturnType<typeof useRequestDraft>;

function Probe() {
  api = useRequestDraft();
  return null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function mount() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <RequestDraftProvider>
        <Probe />
      </RequestDraftProvider>,
    );
  });
  mounted.push(renderer);
  return renderer;
}

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
});

describe('the request draft', () => {
  it('starts with nothing, and says so once it has looked', async () => {
    stubStorage();
    await mount();

    expect(api.draft).toBeNull();
    expect(api.isRestored).toBe(true);
    expect(api.completion).toBeNull();
  });

  it('writes a draft down as soon as one is started', async () => {
    const storage = stubStorage();
    await mount();

    await act(async () => {
      api.startDraft(DRAFT);
    });

    expect(storage.writes).toHaveLength(1);
    expect(storage.writes[0]).toEqual(DRAFT);
  });

  it('comes back after the app has been closed and reopened', async () => {
    const storage = stubStorage();
    storage.seed({ draft: DRAFT, savedAt: '2026-09-10T09:00:00.000Z' });

    await mount();

    expect(api.draft).toEqual(DRAFT);
    expect(api.savedAt).toBe('2026-09-10T09:00:00.000Z');
    // The address came back whole, coordinates included — not just the words.
    expect(api.draft?.address).toEqual(ADDRESS);
    // And it knows where the customer should be put back.
    expect(api.completion?.step).toBe('vendor');
  });

  it('comes back to the address step when that is what is missing', async () => {
    const storage = stubStorage();
    storage.seed({
      draft: { ...DRAFT, address: null, vendor: { kind: 'open' } },
      savedAt: '2026-09-10T09:00:00.000Z',
    });

    await mount();

    // Answered the vendor question, never gave an address. The draft's own
    // completion decides where they go, not the order things were answered in.
    expect(api.completion?.isAddressComplete).toBe(false);
    expect(api.completion?.step).toBe('address');
  });

  it('writes an address down the moment one is chosen', async () => {
    const storage = stubStorage();
    await mount();

    await act(async () => {
      api.startDraft({ ...DRAFT, address: null });
    });
    await act(async () => {
      api.updateDraft({ address: ADDRESS });
    });

    // On the device, not only in memory: this is what survives a force-kill
    // between choosing an address and reaching the next screen.
    expect(storage.writes[storage.writes.length - 1].address).toEqual(ADDRESS);
    expect(api.completion?.isAddressComplete).toBe(true);
  });

  it('merges an answer in without disturbing the others', async () => {
    const storage = stubStorage();
    await mount();

    await act(async () => {
      api.startDraft(DRAFT);
    });
    await act(async () => {
      api.updateDraft({ vendor: { kind: 'vendor', vendorId: 'ven_1' } });
    });

    expect(api.draft?.vendor).toEqual({ kind: 'vendor', vendorId: 'ven_1' });
    expect(api.draft?.values.notes).toBe('The fan rattles.');
    expect(api.completion?.isReadyForReview).toBe(true);
    expect(storage.writes[storage.writes.length - 1].vendor).toEqual({
      kind: 'vendor',
      vendorId: 'ven_1',
    });
  });

  it('keeps one draft however many times the flow is re-entered', async () => {
    const storage = stubStorage();
    await mount();

    await act(async () => {
      api.startDraft(DRAFT);
    });
    await act(async () => {
      api.startDraft({ ...DRAFT, values: { ...DRAFT.values, priority: 'LOW' } });
    });

    // Replaced, never accumulated: there is one request being filled in.
    expect(api.draft?.values.priority).toBe('LOW');
    expect(storage.clearCount()).toBe(0);
  });

  it('forgets a draft that has been emptied back out', async () => {
    const storage = stubStorage();
    await mount();

    await act(async () => {
      api.startDraft(DRAFT);
    });
    await act(async () => {
      api.updateDraft({
        values: { priority: '', preferredDate: '', preferredTime: '', notes: '' },
        // The address counts as something the customer said, so clearing the
        // form alone is not an emptied draft any more — which is the point:
        // an address typed and nothing else is still worth coming back to.
        address: null,
      });
    });

    expect(storage.clearCount()).toBe(1);
  });

  it('still remembers a draft whose only answer is an address', async () => {
    const storage = stubStorage();
    await mount();

    await act(async () => {
      api.startDraft(DRAFT);
    });
    await act(async () => {
      api.updateDraft({
        values: { priority: '', preferredDate: '', preferredTime: '', notes: '' },
      });
    });

    // Somebody who typed where they live and was interrupted has said
    // something, and offering to resume it is the whole point of the feature.
    expect(storage.clearCount()).toBe(0);
    expect(api.draft?.address).toEqual(ADDRESS);
  });

  it('forgets it entirely once it has been cleared', async () => {
    const storage = stubStorage();
    await mount();

    await act(async () => {
      api.startDraft(DRAFT);
    });
    await act(async () => {
      api.clearDraft();
    });

    expect(api.draft).toBeNull();
    expect(api.savedAt).toBeNull();
    expect(storage.clearCount()).toBe(1);
  });
});

describe('the request draft, when the device will not cooperate', () => {
  it('starts the customer fresh rather than failing to load', async () => {
    stubStorage({
      read: async () => {
        throw new Error('storage unavailable');
      },
    });

    // The provider must survive a rejecting read; the customer simply has no
    // draft to resume, which is where they would be without the feature at all.
    await expect(mount()).resolves.toBeDefined();
    expect(api.draft).toBeNull();
    expect(api.isRestored).toBe(true);
  });

  it('keeps the in-memory draft when it cannot be written down', async () => {
    stubStorage({
      write: async () => {
        throw new Error('disk full');
      },
    });
    await mount();

    await act(async () => {
      api.startDraft(DRAFT);
    });

    // The request being filled in right now is unaffected. Only resuming it
    // after a restart is lost, and that is not worth interrupting anyone for.
    expect(api.draft).toEqual(DRAFT);
    expect(api.completion?.step).toBe('vendor');
  });

  it('still forgets the draft in memory when the removal fails', async () => {
    stubStorage({
      clear: async () => {
        throw new Error('storage unavailable');
      },
    });
    await mount();

    await act(async () => {
      api.startDraft(DRAFT);
    });
    await act(async () => {
      api.clearDraft();
    });

    expect(api.draft).toBeNull();
  });
});
