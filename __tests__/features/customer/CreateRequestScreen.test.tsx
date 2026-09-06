/**
 * This screen collects; it does not send. PROJECT_BIBLE.md section 13 puts vendor
 * selection between these details and submission, so what is pinned down here is
 * the handoff: what the customer's answers become, that they are complete, and
 * that `createRequest` is never reached from this screen — which is asserted by
 * registering a request service whose create method throws.
 *
 * Section 14 fixes the fields, section 15 the priority values, section 16 the
 * rule that a request must never look submitted when its images are not, and
 * section 17 that notes are optional. Each is a test here rather than a comment.
 *
 * The payload itself is proved where it is built, in the preferred-vendor suite.
 *
 * Every service the screen touches is registered as a stub, so it is exercised
 * through the same abstractions the real implementations arrive behind.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { CreateRequestScreen } from '@/features/customer/screens/CreateRequestScreen';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService, SubCategory } from '@/shared/services/types/CategoryService';
import type { ImageAsset, ImageService } from '@/shared/services/types/ImageService';
import type { PermissionService } from '@/shared/services/types/PermissionService';
import type { RequestService } from '@/shared/services/types/RequestService';
import {
  RequestDraftProvider,
  useRequestDraft,
  type RequestDraft,
} from '@/features/customer/state/RequestDraftContext';
import { ThemeProvider } from '@/shared/theme';
import { ToastProvider } from '@/shared/components';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.createRequest;

const CATEGORY_ID = 'cat_electrical';
const SUB_CATEGORY_ID = 'sub_fan';

const CATEGORIES = [
  { id: CATEGORY_ID, name: 'Electrician', iconGlyph: 'flash' },
  { id: 'cat_other', name: 'Plumber' },
];

const SERVICES: SubCategory[] = [
  { id: SUB_CATEGORY_ID, name: 'Fan Repair', description: 'Ceiling and wall fans' },
  { id: 'sub_wiring', name: 'Wiring' },
];

const ASSET: ImageAsset = {
  id: 'img_1',
  uri: 'file:///tmp/img_1.jpg',
  fileName: 'img_1.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1000,
  width: 800,
  height: 600,
};

const REMOTE_URL = 'https://cdn.example.test/img_1.jpg';

/** A promise a test can leave hanging, so an in-flight state is observable. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

interface Stubs {
  services?: (categoryId: string) => Promise<SubCategory[]>;
  image?: Partial<ImageService>;
  cameraStatus?: 'granted' | 'denied' | 'blocked' | 'unavailable';
}

/**
 * Reports the draft out of the provider, so a test can see what the screen
 * handed on without reaching into component internals.
 */
function DraftProbe({ onDraft }: { onDraft: (draft: RequestDraft | null) => void }) {
  const { draft } = useRequestDraft();
  onDraft(draft);
  return null;
}

async function render({ services, image, cameraStatus = 'granted' }: Stubs = {}) {
  const listSubCategories = jest.fn(services ?? (async (_id: string) => SERVICES));

  registerService('category', {
    listServiceCategories: jest.fn(async () => CATEGORIES),
    listSubCategories,
  } as CategoryService);

  /*
    Both throw, and that is the assertion.

    This screen reads the catalogue and hands a draft on; it has no business
    calling either of these. A stub that resolved would let a regression that
    submitted straight from here pass every test in this file.
  */
  registerService('request', {
    listRecentRequests: jest.fn(() => {
      throw new Error('listRecentRequests must not be called from request details');
    }),
    createRequest: jest.fn(() => {
      throw new Error('createRequest must not be called from request details');
    }),
  } as RequestService);

  const upload = jest.fn(async (asset: ImageAsset) => ({
    assetId: asset.id,
    remoteUrl: REMOTE_URL,
  }));

  registerService('image', {
    pickFromCamera: jest.fn(async () => [ASSET]),
    pickFromGallery: jest.fn(async () => [ASSET]),
    compress: jest.fn(async (asset: ImageAsset) => asset),
    generatePreview: jest.fn(async (asset: ImageAsset) => asset.uri),
    validate: jest.fn(() => ({ valid: true })),
    upload,
    retryUpload: upload,
    remove: jest.fn(async () => undefined),
    ...image,
  } as ImageService);

  const requestPermission = jest.fn(async () => cameraStatus);
  registerService('permission', {
    check: jest.fn(async () => cameraStatus),
    request: requestPermission,
    openSettings: jest.fn(async () => undefined),
  } as PermissionService);

  const goBack = jest.fn();
  const navigate = jest.fn();
  const navigation = { goBack, navigate } as never;
  const route = {
    key: 'CreateRequest',
    name: 'CreateRequest' as const,
    params: { categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID },
  } as never;

  let handedOver: RequestDraft | null = null;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <RequestDraftProvider>
            <CreateRequestScreen navigation={navigation} route={route} />
            <DraftProbe
              onDraft={draft => {
                handedOver = draft;
              }}
            />
          </RequestDraftProvider>
        </ToastProvider>
      </ThemeProvider>,
    );
  });

  /** Finds a node by role and accessible name, whatever host renders it. */
  const find = (role: string, label: string) =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === role &&
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    )[0];

  const tap = async (role: string, label: string) => {
    const target = find(role, label);
    if (!target) {
      throw new Error(`No ${role} labelled "${label}"`);
    }
    await act(async () => {
      target.props.onPress();
    });
  };

  return {
    renderer,
    goBack,
    navigate,
    upload,
    listSubCategories,
    requestPermission,
    text: () => textOf(renderer.toJSON()),
    /** What the screen handed on when Continue was pressed. */
    draft: (): RequestDraft => {
      if (!handedOver) {
        throw new Error('No draft was handed over.');
      }
      return handedOver;
    },
    /** True when nothing has been handed on yet. */
    hasDraft: () => handedOver !== null,
    press: (label: string) => tap('button', label),
    choose: (label: string) => tap('radio', label),
    chip: (label: string) => find('radio', label),
    byTestID: (id: string) =>
      renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id),
    type: async (value: string) => {
      const [field] = renderer.root.findAll(
        node => node.props?.accessibilityLabel === COPY.notesLabel && node.props?.onChangeText,
      );
      await act(async () => {
        field.props.onChangeText(value);
      });
    },
    /** Fills in the one required answer, so a test can get to Submit. */
    fillRequired: async () => {
      await tap('radio', 'Medium');
    },
  };
}

function textOf(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string {
  if (node === null) {
    return '';
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(' ');
  }
  return (node.children ?? [])
    .map(child => (typeof child === 'string' ? child : textOf(child as ReactTestRendererJSON)))
    .join(' ');
}

afterEach(() => {
  resetServices();
});

describe('CreateRequestScreen — the service it is for', () => {
  it('resolves the service from the ids it was routed with', async () => {
    const { listSubCategories, text } = await render();

    expect(listSubCategories).toHaveBeenCalledWith(CATEGORY_ID);
    expect(text()).toContain('Fan Repair');
    expect(text()).toContain('Electrician');
  });

  it('still takes a request when the service name cannot be loaded', async () => {
    const { text, fillRequired, press, draft, navigate } = await render({
      services: async () => {
        throw new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.0.1:443' });
      },
    });

    expect(text()).toContain(COPY.serviceFallback);
    expect(text()).toContain(COPY.serviceUnavailable);

    await fillRequired();
    await press(COPY.submit);

    // The name was a caption. The request is identified by ids, which arrived.
    expect(navigate).toHaveBeenCalledWith('PreferredVendor', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
    expect(draft().subCategoryId).toBe(SUB_CATEGORY_ID);
  });

  it('never renders a raw failure from the catalogue', async () => {
    const { text } = await render({
      services: async () => {
        throw new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.0.1:443' });
      },
    });

    expect(text()).not.toContain('ECONNREFUSED');
    expect(text()).not.toContain('10.0.0.1');
  });
});

describe('CreateRequestScreen — priority', () => {
  it('offers exactly the four values section 15 defines', async () => {
    const { chip } = await render();

    for (const label of ['Low', 'Medium', 'High', 'Emergency']) {
      expect(chip(label)).toBeDefined();
    }
    expect(chip('Critical')).toBeUndefined();
  });

  it('starts with nothing chosen, so no urgency is assumed', async () => {
    const { chip } = await render();

    for (const label of ['Low', 'Medium', 'High', 'Emergency']) {
      expect(chip(label)?.props.accessibilityState.selected).toBe(false);
    }
  });

  it('announces the chosen one as selected, not merely colours it', async () => {
    const { choose, chip } = await render();

    await choose('High');

    expect(chip('High')?.props.accessibilityState.selected).toBe(true);
    expect(chip('High')?.props.accessibilityState.checked).toBe(true);
    expect(chip('Low')?.props.accessibilityState.selected).toBe(false);
  });

  it('refuses to continue without one, and says so', async () => {
    const { press, hasDraft, navigate, text } = await render();

    await press(COPY.submit);

    expect(hasDraft()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(text()).toContain('Choose how urgent this is.');
  });

  it('carries the backend constant, never the label', async () => {
    const { choose, press, draft } = await render();

    await choose('Emergency');
    await press(COPY.submit);

    expect(draft().values.priority).toBe('EMERGENCY');
  });
});

describe('CreateRequestScreen — when they would like it', () => {
  it('opens with no preference for either, which is a choice not a blank', async () => {
    const { chip } = await render();

    const anyDate = chip(COPY.anyDate);
    const anyTime = chip(COPY.anyTime);

    // Both rails offer the same label, so at least one of each must be selected.
    expect(anyDate?.props.accessibilityState.selected).toBe(true);
    expect(anyTime?.props.accessibilityState.selected).toBe(true);
  });

  it('carries an unexpressed preference as the empty value the control holds', async () => {
    const { fillRequired, press, draft } = await render();

    await fillRequired();
    await press(COPY.submit);

    // Turning this into an omitted field is the payload's job, proved where the
    // payload is built.
    expect(draft().values.preferredDate).toBe('');
    expect(draft().values.preferredTime).toBe('');
  });

  it('carries a calendar date, not the words on the chip', async () => {
    const { fillRequired, choose, press, draft } = await render();

    await fillRequired();
    await choose(COPY.today);
    await press(COPY.submit);

    const today = new Date();
    const expected = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    expect(draft().values.preferredDate).toBe(expected);
    expect(draft().values.preferredDate).not.toBe(COPY.today);
  });

  it('carries a 24-hour time, whatever the locale printed on the chip', async () => {
    const { fillRequired, press, draft, renderer } = await render();

    await fillRequired();

    // The first real time option, found by its structured value rather than by
    // a label that changes with the device's clock format.
    const [chip] = renderer.root.findAll(
      node => node.props?.testID === 'create-request-time-07:00' && node.props?.onPress,
    );
    await act(async () => {
      chip.props.onPress();
    });

    await press(COPY.submit);

    expect(draft().values.preferredTime).toBe('07:00');
  });
});

describe('CreateRequestScreen — notes', () => {
  it('carries what was typed, untouched', async () => {
    const { fillRequired, type, press, draft } = await render();

    await type('  The fan stops after ten minutes.  ');
    await fillRequired();
    await press(COPY.submit);

    expect(draft().values.notes).toBe('  The fan stops after ten minutes.  ');
  });

  it('carries an empty box as an empty string, not as a missing answer', async () => {
    const { fillRequired, press, draft } = await render();

    await fillRequired();
    await press(COPY.submit);

    expect(draft().values.notes).toBe('');
  });

  it('refuses an entry beyond the ceiling rather than truncating it', async () => {
    const { fillRequired, type, press, hasDraft, text } = await render();

    await fillRequired();
    await type('x'.repeat(501));
    await press(COPY.submit);

    expect(hasDraft()).toBe(false);
    expect(text()).toContain('500 characters or fewer');
  });
});

describe('CreateRequestScreen — photographs (section 16)', () => {
  it('asks for the camera only when the camera is asked for', async () => {
    const { requestPermission, press } = await render();

    expect(requestPermission).not.toHaveBeenCalled();

    await press(COPY.photosGallery);
    expect(requestPermission).not.toHaveBeenCalled();

    await press(COPY.photosCamera);
    expect(requestPermission).toHaveBeenCalledWith('camera');
  });

  it('points at the gallery when the camera is refused, and adds nothing', async () => {
    const { press, text, byTestID } = await render({ cameraStatus: 'blocked' });

    await press(COPY.photosCamera);

    expect(text()).toContain(COPY.cameraUnavailable);
    expect(byTestID(`request-photo-${ASSET.id}`)).toHaveLength(0);
  });

  it('uploads as a photo is added, and carries the remote url', async () => {
    const { press, upload, fillRequired, draft } = await render();

    await press(COPY.photosGallery);
    expect(upload).toHaveBeenCalledTimes(1);

    await fillRequired();
    await press(COPY.submit);

    // The url, never the local file and never the asset id.
    expect(draft().imageUrls).toEqual([REMOTE_URL]);
  });

  it('carries no urls when there are no photographs', async () => {
    const { fillRequired, press, draft } = await render();

    await fillRequired();
    await press(COPY.submit);

    expect(draft().imageUrls).toEqual([]);
  });

  it('never adds a file the image service rejects', async () => {
    const { press, upload, text } = await render({
      image: { validate: jest.fn(() => ({ valid: false, reason: 'size', message: 'Too large.' })) },
    });

    await press(COPY.photosGallery);

    expect(upload).not.toHaveBeenCalled();
    expect(text()).toContain('Too large.');
  });

  it('will not continue while an upload is still going', async () => {
    const { press, hasDraft, text, fillRequired } = await render({
      image: { upload: jest.fn(() => pending()) },
    });

    await fillRequired();
    await press(COPY.photosGallery);
    await press(COPY.submit);

    expect(hasDraft()).toBe(false);
    expect(text()).toContain(COPY.photosBusy);
  });

  it('will not continue while an upload has failed, and offers a retry', async () => {
    const upload = jest
      .fn()
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'socket hang up' }))
      .mockResolvedValueOnce({ assetId: ASSET.id, remoteUrl: REMOTE_URL });

    const { press, hasDraft, text, fillRequired, draft } = await render({
      image: { upload, retryUpload: upload },
    });

    await fillRequired();
    await press(COPY.photosGallery);

    expect(text()).toContain(COPY.photoFailed);
    expect(text()).not.toContain('socket hang up');

    await press(COPY.submit);
    expect(hasDraft()).toBe(false);
    expect(text()).toContain(COPY.photosUnresolved);

    await press(`${COPY.photoRetry}, ${COPY.photosTitle} 1, ${COPY.photoFailed}`);
    await press(COPY.submit);

    expect(draft().imageUrls).toEqual([REMOTE_URL]);
  });

  it('removes a photograph from the form and from what is handed on', async () => {
    const { press, fillRequired, draft, byTestID } = await render();

    await press(COPY.photosGallery);
    expect(byTestID(`request-photo-${ASSET.id}`).length).toBeGreaterThan(0);

    await press(`${COPY.photoRemove}, ${COPY.photosTitle} 1`);
    expect(byTestID(`request-photo-${ASSET.id}`)).toHaveLength(0);

    await fillRequired();
    await press(COPY.submit);
    expect(draft().imageUrls).toEqual([]);
  });
});

describe('CreateRequestScreen — handing on to vendor selection', () => {
  it('goes to the vendor step instead of creating anything', async () => {
    // The request service registered by `render` throws from both methods, so a
    // screen that submitted here would fail this test rather than pass it.
    const { fillRequired, press, navigate } = await render();

    await fillRequired();
    await press(COPY.submit);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('PreferredVendor', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
  });

  it('puts only identifiers in the route, and everything else in the draft', async () => {
    const { fillRequired, choose, type, press, navigate, draft } = await render();

    await fillRequired();
    await choose(COPY.today);
    await type('Sparks from the switch.');
    await press(COPY.photosGallery);
    await press(COPY.submit);

    // Navigation state is serialised, logged and restorable. What the customer
    // typed about their home, and photographs of it, do not belong in it.
    const params = navigate.mock.calls[0]?.[1];
    expect(Object.keys(params).sort()).toEqual(['categoryId', 'subCategoryId']);

    const serialised = JSON.stringify(params);
    expect(serialised).not.toContain('Sparks');
    expect(serialised).not.toContain(REMOTE_URL);
    expect(serialised).not.toContain('Fan Repair');

    // All of it survives, on the draft.
    expect(draft().values.notes).toBe('Sparks from the switch.');
    expect(draft().imageUrls).toEqual([REMOTE_URL]);
    expect(draft().categoryId).toBe(CATEGORY_ID);
  });

  it('names its action for what it does, which is not submitting', async () => {
    const { renderer } = await render();

    const labels = renderer.root
      .findAll(node => node.props?.accessibilityRole === 'button')
      .map(node => node.props.accessibilityLabel as string);

    expect(labels).toContain('Continue');
    expect(labels).not.toContain('Submit Request');
  });
});

describe('CreateRequestScreen — accessibility', () => {
  it('names every control a customer has to operate', async () => {
    const { renderer, chip } = await render();

    const named = (label: string) =>
      renderer.root.findAll(node => node.props?.accessibilityLabel === label).length > 0;

    expect(named(COPY.back)).toBe(true);
    expect(named(COPY.notesLabel)).toBe(true);
    expect(named(COPY.submit)).toBe(true);
    expect(named(COPY.photosCamera)).toBe(true);
    expect(named(COPY.photosGallery)).toBe(true);
    expect(chip('Medium')).toBeDefined();
  });

  it('groups each set of alternatives, so chips are not loose radios', async () => {
    const { renderer } = await render();

    const groups = renderer.root
      .findAll(node => node.props?.accessibilityRole === 'radiogroup')
      .map(node => node.props.accessibilityLabel);

    expect(groups).toEqual(
      expect.arrayContaining([COPY.priorityTitle, COPY.dateTitle, COPY.timeTitle]),
    );
  });

  it('names a photograph and its actions without leaking a glyph', async () => {
    const { press, renderer } = await render();

    await press(COPY.photosGallery);

    const labels = renderer.root
      .findAll(node => typeof node.props?.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel as string);

    expect(labels).toContain(`${COPY.photoRemove}, ${COPY.photosTitle} 1`);
    // Icon glyphs are private ligature names; none may reach an announcement.
    expect(labels.some(label => label.includes('camera-outline'))).toBe(false);
    expect(labels.some(label => label.includes('image-multiple-outline'))).toBe(false);
  });
});
