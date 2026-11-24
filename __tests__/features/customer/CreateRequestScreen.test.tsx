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
import { buildCreateRequestInput } from '@/features/customer/hooks/useCreateRequest';
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
import { NO_VENDOR_CHOICE } from '@/features/customer/state/requestDraft';
import { setRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';
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

/** Answered on the screen after this one, and this screen must not lose it. */
const RESUMED_ADDRESS = { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' };

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
 * How the screens after this one write their answers — Service Address its
 * address, Preferred Vendor its choice — while this screen stays mounted under
 * them. Captured from the provider so a test can play their part.
 */
let answerOnLaterScreens: ((changes: Partial<RequestDraft>) => void) | null = null;

/**
 * Reports the draft out of the provider, so a test can see what the screen
 * handed on without reaching into component internals.
 */
function DraftProbe({ onDraft }: { onDraft: (draft: RequestDraft | null) => void }) {
  const { draft, updateDraft } = useRequestDraft();
  answerOnLaterScreens = updateDraft;
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
    getRequest: jest.fn(() => {
      throw new Error('getRequest must not be called while a request is being written');
    }),
    listRequests: jest.fn(() => {
      throw new Error('listRequests must not be called while a request is being written');
    }),
    cancelRequest: jest.fn(() => {
      throw new Error('cancelRequest must not be called while a request is being written');
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

  /*
    The provider outlives the screen on purpose.

    Leaving the flow unmounts the screen, not the application, and what the
    screen writes down on its way out is only observable if the thing holding it
    is still there to observe.
  */
  const tree = (screenMounted: boolean) => (
    <ThemeProvider>
      <ToastProvider>
        <RequestDraftProvider>
          {screenMounted ? (
            <CreateRequestScreen navigation={navigation} route={route} />
          ) : null}
          <DraftProbe
            onDraft={draft => {
              handedOver = draft;
            }}
          />
        </RequestDraftProvider>
      </ToastProvider>
    </ThemeProvider>
  );

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(tree(true));
  });
  mounted.push(renderer);

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
    /** The later steps answering, with this screen still mounted underneath. */
    answerLater: async (changes: Partial<RequestDraft>) => {
      await act(async () => {
        answerOnLaterScreens?.(changes);
      });
    },
    /** Takes the screen out of the tree, the way going back does. */
    leave: async () => {
      await act(async () => {
        renderer.update(tree(false));
      });
    },
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

/**
 * The draft is seeded through the provider, not read off the device, so each
 * test decides for itself whether there is one to resume.
 */
let savedDraft: RequestDraft | null = null;

beforeEach(() => {
  savedDraft = null;
  setRequestDraftStorage({
    read: async () => (savedDraft ? { draft: savedDraft, savedAt: '2026-09-10T09:00:00.000Z' } : null),
    write: async () => true,
    clear: async () => undefined,
  });
});

/**
 * Every tree a test rendered, unmounted after it.
 *
 * Found tracing jest's "A worker process has failed to exit gracefully": with
 * nothing unmounted, updates these trees still had pending went on rendering
 * the screen after jest had torn the environment down ("You are trying to
 * `import` a file after the Jest environment has been torn down"). Unmounting
 * runs the cleanup the components already have.
 */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
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
    expect(navigate).toHaveBeenCalledWith('ServiceAddress', {
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
    // As a request's photo (Phase 4B): the backend attaches it to a request and nothing else.
    expect(upload).toHaveBeenCalledWith(ASSET, 'request', expect.any(Function));

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
    const { press, navigate, text, fillRequired } = await render({
      image: { upload: jest.fn(() => pending()) },
    });

    await fillRequired();
    await press(COPY.photosGallery);
    await press(COPY.submit);

    // The draft is written down regardless — that is what makes the request
    // resumable. What must not happen is moving on with an unfinished upload.
    expect(navigate).not.toHaveBeenCalled();
    expect(text()).toContain(COPY.photosBusy);
  });

  it('will not continue while an upload has failed, and offers a retry', async () => {
    const upload = jest
      .fn()
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'socket hang up' }))
      .mockResolvedValueOnce({ assetId: ASSET.id, remoteUrl: REMOTE_URL });

    const { press, navigate, text, fillRequired, draft } = await render({
      image: { upload, retryUpload: upload },
    });

    await fillRequired();
    await press(COPY.photosGallery);

    expect(text()).toContain(COPY.photoFailed);
    expect(text()).not.toContain('socket hang up');

    await press(COPY.submit);
    expect(navigate).not.toHaveBeenCalled();
    expect(text()).toContain(COPY.photosUnresolved);

    await press(`${COPY.photoRetry}, ${COPY.photosTitle} 1, ${COPY.photoFailed}`);
    await press(COPY.submit);

    expect(draft().imageUrls).toEqual([REMOTE_URL]);
  });

  /*
    Section 16, proved on the control itself: a disabled Continue is what stops a
    customer reaching Submit with a photo that has not uploaded — not only the
    handler's own check, which a tap on an enabled button would never reach.
  */
  it('keeps Continue disabled while a photo uploads or has failed, and only then enables it', async () => {
    let finish!: (result: { assetId: string; remoteUrl: string }) => void;
    let fail!: (error: AppError) => void;
    const upload = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      );
    const { renderer, press, navigate, fillRequired, draft, text } = await render({
      image: { upload, retryUpload: upload },
    });
    const continueDisabled = () =>
      renderer.root.findAll(
        node =>
          node.props?.accessibilityLabel === COPY.submit &&
          node.props?.accessibilityState !== undefined,
      )[0].props.accessibilityState.disabled;

    await fillRequired();
    expect(continueDisabled()).toBe(false);

    await press(COPY.photosGallery);
    expect(continueDisabled()).toBe(true);
    expect(text()).toContain(COPY.photosBusy);

    await act(async () => {
      fail(new AppError({ kind: 'network', message: 'offline' }));
    });
    expect(continueDisabled()).toBe(true);
    expect(text()).toContain(COPY.photosUnresolved);

    await press(`${COPY.photoRetry}, ${COPY.photosTitle} 1, ${COPY.photoFailed}`);
    expect(continueDisabled()).toBe(true);

    await act(async () => {
      finish({ assetId: ASSET.id, remoteUrl: REMOTE_URL });
    });
    expect(continueDisabled()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();

    await press(COPY.submit);
    expect(navigate).toHaveBeenCalledTimes(1);
    // Only the photo that finished uploading travels, as its remote url.
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

describe('CreateRequestScreen — handing on to the address step', () => {
  it('goes to the address step instead of creating anything', async () => {
    // The request service registered by `render` throws from both methods, so a
    // screen that submitted here would fail this test rather than pass it.
    const { fillRequired, press, navigate } = await render();

    await fillRequired();
    await press(COPY.submit);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('ServiceAddress', {
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

describe('CreateRequestScreen — leaving and coming back', () => {
  it('keeps what was entered when the customer walks away mid-form', async () => {
    const { leave, choose, type, draft } = await render();

    await choose('High');
    await type('The fan rattles.');

    // Unmounting is what leaving the flow looks like: going forward keeps this
    // screen in the stack, so only going back takes it out.
    await leave();

    expect(draft().values.priority).toBe('HIGH');
    expect(draft().values.notes).toBe('The fan rattles.');
    expect(draft().vendor).toEqual(NO_VENDOR_CHOICE);
  });

  it('keeps a choice made with the chips alone, with nothing typed', async () => {
    // A Controller re-renders its own field and not the screen, so a priority
    // chosen and walked away from is exactly what a render-time copy would miss.
    const { leave, choose, draft } = await render();

    await choose('Emergency');
    await choose(COPY.tomorrow);
    await leave();

    expect(draft().values.priority).toBe('EMERGENCY');
    expect(draft().values.preferredDate).not.toBe('');
  });

  it('remembers nothing from a form that was opened and abandoned', async () => {
    const { leave, hasDraft } = await render();

    await leave();

    expect(hasDraft()).toBe(false);
  });

  it('opens on the answers a resumed draft carried, without re-asking', async () => {
    savedDraft = {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
      values: {
        priority: 'EMERGENCY',
        preferredDate: '',
        preferredTime: '',
        notes: 'It stops after ten minutes.',
      },
      imageUrls: [REMOTE_URL],
      address: RESUMED_ADDRESS,
      vendor: { kind: 'vendor', vendorId: 'ven_1' },
    };

    const { chip, renderer, byTestID } = await render();

    expect(chip('Emergency')?.props.accessibilityState.selected).toBe(true);

    const [field] = renderer.root.findAll(
      node => node.props?.accessibilityLabel === COPY.notesLabel && node.props?.onChangeText,
    );
    expect(field.props.value).toBe('It stops after ten minutes.');

    // The photograph comes back as an upload that already finished.
    expect(byTestID(`request-photo-${REMOTE_URL}`).length).toBeGreaterThan(0);
  });

  it('does not throw away the address when the details are edited again', async () => {
    savedDraft = {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
      values: { priority: 'LOW', preferredDate: '', preferredTime: '', notes: '' },
      imageUrls: [],
      address: RESUMED_ADDRESS,
      vendor: { kind: 'vendor', vendorId: 'ven_1' },
    };

    const { choose, press, draft } = await render();

    await choose('High');
    await press(COPY.submit);

    // Coming back to change a date must not silently un-answer the step after
    // it. The address is read from the live draft, not from what this screen
    // was opened with.
    expect(draft().address).toEqual(RESUMED_ADDRESS);
  });

  it('does not un-choose the professional when the details are edited again', async () => {
    savedDraft = {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
      values: { priority: 'LOW', preferredDate: '', preferredTime: '', notes: '' },
      imageUrls: [],
      address: RESUMED_ADDRESS,
      vendor: { kind: 'vendor', vendorId: 'ven_1' },
    };

    const { choose, press, draft } = await render();

    await choose('High');
    await press(COPY.submit);

    expect(draft().values.priority).toBe('HIGH');
    expect(draft().vendor).toEqual({ kind: 'vendor', vendorId: 'ven_1' });
  });

  it('keeps the professional chosen later in the same visit when the details change', async () => {
    // The path the open item described: details → address → professional, then
    // Back twice to this screen — which never unmounted — to change the urgency,
    // and Continue again. Continue used to start the draft afresh from this
    // screen's answers alone, which reset the professional to "not chosen".
    const { fillRequired, press, choose, draft, answerLater } = await render();

    await fillRequired();
    await press(COPY.submit);
    expect(draft().vendor).toEqual(NO_VENDOR_CHOICE);

    await answerLater({
      address: RESUMED_ADDRESS,
      vendor: { kind: 'vendor', vendorId: 'ven_1' },
    });

    await choose('High');
    await press(COPY.submit);

    expect(draft().values.priority).toBe('HIGH');
    expect(draft().vendor).toEqual({ kind: 'vendor', vendorId: 'ven_1' });
    expect(draft().address).toEqual(RESUMED_ADDRESS);
  });

  it('keeps "no preference" as an answer too, rather than un-asking it', async () => {
    const { fillRequired, press, choose, draft, answerLater } = await render();

    await fillRequired();
    await press(COPY.submit);
    await answerLater({ address: RESUMED_ADDRESS, vendor: { kind: 'open' } });

    await choose('Low');
    await press(COPY.submit);

    expect(draft().vendor).toEqual({ kind: 'open' });
  });
});

/**
 * There is one draft, and it can belong to another service: a customer who left
 * a leak repair half-done opens a fan repair from Home. Found by the analytics
 * work with a jest probe: this form's autosave merged into whatever draft
 * existed — on mount, on a pause in typing, on leaving — so the leak repair kept
 * its ids, address and plumber while its urgency, dates, notes and photos became
 * the fan repair's, and its notes were lost. And Continue carried the leak
 * repair's address and plumber into the fan repair's request.
 *
 * The rule now: only this service's draft is merged into or borrowed from.
 * Another service's draft is left exactly as it was until Continue — the one
 * deliberate act that starts this request — replaces it, carrying its address
 * and nothing else (owner decision, 21/10/2026: it is almost always the same
 * home). Never its professional, who was chosen from another service's list.
 */
describe('CreateRequestScreen — when the draft on hand is another service’s', () => {
  const LEAK_REPAIR: RequestDraft = {
    categoryId: 'cat_plumbing',
    subCategoryId: 'sub_leak',
    values: {
      priority: 'LOW',
      preferredDate: '',
      preferredTime: '',
      notes: 'Drips under the kitchen sink.',
    },
    imageUrls: ['https://cdn.example.test/leak.jpg'],
    address: RESUMED_ADDRESS,
    vendor: { kind: 'vendor', vendorId: 'ven_plumber' },
  };

  /** Long enough for the form's autosave (800 ms after the last change) to have fired. */
  const pauseForAutosave = () =>
    act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
    });

  it('leaves it exactly as it was when this form is opened and left untouched', async () => {
    savedDraft = LEAK_REPAIR;
    const { leave, draft } = await render();

    await leave();

    expect(draft()).toEqual(LEAK_REPAIR);
  });

  it('never autosaves this form into it, and leaving does not either', async () => {
    savedDraft = LEAK_REPAIR;
    const { choose, type, leave, draft } = await render();

    await choose('High');
    await type('Sparks from the switch.');
    await pauseForAutosave();

    expect(draft()).toEqual(LEAK_REPAIR);

    await leave();

    expect(draft()).toEqual(LEAK_REPAIR);
  });

  it('is replaced on Continue by this request, carrying its address and nothing else', async () => {
    savedDraft = LEAK_REPAIR;
    const { fillRequired, press, draft, navigate } = await render();

    await fillRequired();
    await press(COPY.submit);

    expect(Object.keys(draft()).sort()).toEqual([
      'address',
      'categoryId',
      'imageUrls',
      'subCategoryId',
      'values',
      'vendor',
    ]);
    expect(draft().categoryId).toBe(CATEGORY_ID);
    expect(draft().subCategoryId).toBe(SUB_CATEGORY_ID);
    expect(draft().values.priority).toBe('MEDIUM');
    expect(draft().values.notes).toBe('');
    expect(draft().imageUrls).toEqual([]);
    // The same home, almost always: Service Address opens on it, still editable.
    expect(draft().address).toEqual(RESUMED_ADDRESS);
    // ⚠️ Never the plumber: chosen from another service's list, perhaps not
    // offered for this one, and Preferred Vendor does not check.
    expect(draft().vendor).toEqual(NO_VENDOR_CHOICE);
    expect(JSON.stringify(draft())).not.toContain('ven_plumber');
    // Nor its answers, which describe the other job.
    expect(JSON.stringify(draft())).not.toContain(LEAK_REPAIR.values.notes);
    expect(JSON.stringify(draft())).not.toContain('leak.jpg');
    expect(navigate).toHaveBeenCalledWith('ServiceAddress', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
  });

  it('carries a matched address whole — its point and details — never a copy of the line alone', async () => {
    const MATCHED = {
      formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
      latitude: 12.9352,
      longitude: 77.6245,
      addressLine: '412, 5th Block',
      locality: 'Koramangala, Bengaluru',
      postalCode: '560095',
      placeId: 'place_koramangala_5th',
    };
    savedDraft = { ...LEAK_REPAIR, address: MATCHED };
    const { fillRequired, press, draft } = await render();

    await fillRequired();
    await press(COPY.submit);

    expect(draft().address).toEqual(MATCHED);
  });

  it('starts with no address when the other request had none yet', async () => {
    savedDraft = { ...LEAK_REPAIR, address: null };
    const { fillRequired, press, draft } = await render();

    await fillRequired();
    await press(COPY.submit);

    expect(draft().address).toBeNull();
    expect(draft().vendor).toEqual(NO_VENDOR_CHOICE);
  });

  it('sends the payload the contract defines from it: the address carried, no vendorId at all', async () => {
    savedDraft = LEAK_REPAIR;
    const { fillRequired, press, draft } = await render();

    await fillRequired();
    await press(COPY.submit);

    // Built the way Request Confirmation builds it (docs/WORKING_NOTES.md §9,
    // "The create-request payload") — open dispatch, since nobody was chosen.
    const handed = draft();
    const payload = buildCreateRequestInput(
      handed.categoryId,
      handed.subCategoryId,
      handed.values,
      handed.imageUrls,
      handed.address!,
      handed.vendor.kind === 'vendor' ? handed.vendor.vendorId : undefined,
    );
    const sent = JSON.parse(JSON.stringify(payload));

    expect(Object.keys(sent).sort()).toEqual(['address', 'categoryId', 'priority', 'subCategoryId']);
    expect(sent).toEqual({
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
      priority: 'MEDIUM',
      address: RESUMED_ADDRESS,
    });
    expect(JSON.stringify(payload)).not.toContain('vendorId');
  });

  it('does not let an emptied draft for another service block this one', async () => {
    // Every answer cleared: nothing to lose, so it counts as no draft at all.
    savedDraft = {
      ...LEAK_REPAIR,
      values: { priority: '', preferredDate: '', preferredTime: '', notes: '' },
      imageUrls: [],
      address: null,
      vendor: NO_VENDOR_CHOICE,
    };
    const { choose, leave, draft } = await render();

    await choose('High');
    await pauseForAutosave();

    expect(draft().subCategoryId).toBe(SUB_CATEGORY_ID);
    expect(draft().values.priority).toBe('HIGH');

    await leave();

    expect(draft().subCategoryId).toBe(SUB_CATEGORY_ID);
  });

  it('still autosaves into this service’s own draft, keeping its later answers', async () => {
    savedDraft = { ...LEAK_REPAIR, categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID };
    const { choose, draft } = await render();

    await choose('High');
    await pauseForAutosave();

    // The same service: merged as before, nothing borrowed or dropped.
    expect(draft().values.priority).toBe('HIGH');
    expect(draft().values.notes).toBe(LEAK_REPAIR.values.notes);
    expect(draft().address).toEqual(RESUMED_ADDRESS);
    expect(draft().vendor).toEqual(LEAK_REPAIR.vendor);
  });
});

/**
 * Continue here replaces another service's unfinished request, so the form says
 * so before it is pressed — at the top, in one spoken element, naming that
 * service the way Home's resume card does. Lead decision after review.
 */
describe('CreateRequestScreen — telling the customer about the other request', () => {
  const PLUMBING: RequestDraft = {
    categoryId: 'cat_other',
    subCategoryId: 'sub_leak',
    values: { priority: 'LOW', preferredDate: '', preferredTime: '', notes: 'Drips.' },
    imageUrls: [],
    address: null,
    vendor: NO_VENDOR_CHOICE,
  };

  const notice = (byTestID: (id: string) => ReactTestRenderer.ReactTestInstance[]) =>
    byTestID('create-request-other-draft-text')[0];

  it('says at the top that Continue will replace it, naming that service', async () => {
    savedDraft = PLUMBING;
    const { byTestID, text } = await render();

    const spoken = notice(byTestID);
    expect(spoken).toBeDefined();
    expect(spoken.props.accessible).toBe(true);
    // "Only", and "then": leaving without Continue keeps nothing while that
    // request exists, and the sentence must not imply otherwise.
    expect(spoken.props.accessibilityLabel).toBe(
      'You have an unfinished request for Plumber. ' +
        'This request is kept only when you press Continue, and it will then replace that one.',
    );
    expect(text()).toContain(COPY.otherDraftConsequence);
  });

  it('names a request in this same category by its service, not the shared category', async () => {
    // Found in review: "an unfinished request for Electrician" on an Electrician
    // form read as if it were this request.
    savedDraft = { ...PLUMBING, categoryId: CATEGORY_ID, subCategoryId: 'sub_wiring' };
    const { byTestID } = await render();

    const label = notice(byTestID).props.accessibilityLabel as string;
    expect(label.startsWith('You have an unfinished request for Wiring.')).toBe(true);
    expect(label).not.toContain('Electrician');
  });

  it('calls it "another Electrician service" when that service is no longer listed', async () => {
    savedDraft = { ...PLUMBING, categoryId: CATEGORY_ID, subCategoryId: 'sub_withdrawn' };
    const { byTestID } = await render();

    // Never the bare category in its own category: that reads as this request.
    expect(
      (notice(byTestID).props.accessibilityLabel as string).startsWith(
        'You have an unfinished request for another Electrician service.',
      ),
    ).toBe(true);
  });

  it('says "another Electrician service" when this category’s services cannot be read', async () => {
    savedDraft = { ...PLUMBING, categoryId: CATEGORY_ID, subCategoryId: 'sub_wiring' };
    const { byTestID } = await render({
      services: async () => {
        throw new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.0.1:443' });
      },
    });

    const label = notice(byTestID).props.accessibilityLabel as string;
    expect(
      label.startsWith('You have an unfinished request for another Electrician service.'),
    ).toBe(true);
    expect(label).not.toContain('for Electrician.');
  });

  it('says nothing about a same-category request until its service can be named', async () => {
    // Found in review: while the services were loading the notice fell back to
    // the category, so an Electrician form said "for Electrician" first.
    let answer!: (services: SubCategory[]) => void;
    const services = new Promise<SubCategory[]>(resolve => {
      answer = resolve;
    });
    savedDraft = { ...PLUMBING, categoryId: CATEGORY_ID, subCategoryId: 'sub_wiring' };
    const { byTestID } = await render({ services: () => services });

    expect(notice(byTestID)).toBeUndefined();

    await act(async () => {
      answer(SERVICES);
    });

    expect(
      (notice(byTestID).props.accessibilityLabel as string).startsWith(
        'You have an unfinished request for Wiring.',
      ),
    ).toBe(true);
  });

  it('does not hold back a request in another category while the services load', async () => {
    savedDraft = PLUMBING;
    const { byTestID } = await render({ services: () => pending() });

    // Its name comes from the catalogue, not from this category's services.
    expect(
      (notice(byTestID).props.accessibilityLabel as string).startsWith(
        'You have an unfinished request for Plumber.',
      ),
    ).toBe(true);
  });

  it('names a request in another category by that category, whatever its service id', async () => {
    // The services the form holds are this category's; a match there for a
    // request in another category would be a coincidence, not its name.
    savedDraft = { ...PLUMBING, subCategoryId: 'sub_wiring' };
    const { byTestID } = await render();

    expect(
      (notice(byTestID).props.accessibilityLabel as string).startsWith(
        'You have an unfinished request for Plumber.',
      ),
    ).toBe(true);
  });

  it('calls it "a service" when the catalogue cannot name it', async () => {
    savedDraft = { ...PLUMBING, categoryId: 'cat_withdrawn' };
    const { byTestID } = await render();

    expect(notice(byTestID).props.accessibilityLabel).toContain(
      `for ${CUSTOMER_COPY.home.resumeFallbackService}.`,
    );
  });

  it('says nothing when there is no other request', async () => {
    const { byTestID } = await render();

    expect(notice(byTestID)).toBeUndefined();
  });

  it('says nothing when the draft is this service’s own', async () => {
    savedDraft = { ...PLUMBING, categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID };
    const { byTestID } = await render();

    expect(notice(byTestID)).toBeUndefined();
  });

  it('says nothing about another service’s draft that has been emptied', async () => {
    savedDraft = {
      ...PLUMBING,
      values: { priority: '', preferredDate: '', preferredTime: '', notes: '' },
    };
    const { byTestID } = await render();

    expect(notice(byTestID)).toBeUndefined();
  });

  it('keeps the name on screen only, and goes once this request replaces it', async () => {
    savedDraft = PLUMBING;
    const { byTestID, fillRequired, press, navigate, draft } = await render();
    expect(notice(byTestID)).toBeDefined();

    await fillRequired();
    await press(COPY.submit);

    // Display data, so it reaches neither the route nor the draft written on
    // Continue (CLAUDE.md section 7: serialise and search).
    expect(JSON.stringify(navigate.mock.calls)).not.toContain('Plumber');
    expect(draft().subCategoryId).toBe(SUB_CATEGORY_ID);
    expect(JSON.stringify(draft())).not.toContain('Plumber');
    expect(notice(byTestID)).toBeUndefined();
  });
});

/**
 * Section 54's `request_started`: sent when a draft for this service first
 * exists — whichever of Continue, an autosave or leaving gets there first —
 * exactly once, by the two identifiers alone. Resuming a draft is not starting
 * one, and a form opened and left untouched starts nothing.
 */
describe('CreateRequestScreen — what analytics is told (section 54)', () => {
  let track: jest.Mock;

  beforeEach(() => {
    track = jest.fn();
    registerService('analytics', { track, identify: jest.fn() });
  });

  const started = () => track.mock.calls.filter(call => call[0] === 'request_started');

  it('starts the request on Continue, once, by its identifiers alone', async () => {
    const { fillRequired, choose, type, press } = await render();

    await fillRequired();
    await choose(COPY.today);
    await type('Sparks from the switch.');
    await press(COPY.photosGallery);
    await press(COPY.submit);

    expect(track).toHaveBeenCalledTimes(1);
    const [[event, properties]] = track.mock.calls;
    expect(event).toBe('request_started');
    expect(Object.keys(properties).sort()).toEqual(['categoryId', 'subCategoryId']);
    expect(properties).toEqual({ categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID });

    const serialised = JSON.stringify(track.mock.calls);
    expect(serialised).not.toContain('Sparks');
    expect(serialised).not.toContain(REMOTE_URL);
    expect(serialised).not.toContain('Fan Repair');
    expect(serialised).not.toContain('Electrician');
  });

  it('does not start it again when the customer comes back and continues again', async () => {
    const { fillRequired, press, choose, answerLater } = await render();

    await fillRequired();
    await press(COPY.submit);
    await answerLater({ address: RESUMED_ADDRESS, vendor: { kind: 'open' } });
    await choose('High');
    await press(COPY.submit);

    expect(started()).toHaveLength(1);
  });

  it('starts it once when a photograph saved the draft before Continue', async () => {
    const { press, fillRequired, hasDraft } = await render();

    // An upload that lands writes the draft down at once.
    await press(COPY.photosGallery);
    expect(hasDraft()).toBe(true);
    expect(started()).toHaveLength(1);

    await fillRequired();
    await press(COPY.submit);

    expect(started()).toHaveLength(1);
  });

  it('starts it when the customer walks away having said something', async () => {
    const { choose, leave } = await render();

    await choose('High');
    await leave();

    expect(started()).toHaveLength(1);
    expect(started()[0][1]).toEqual({ categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID });
  });

  it('starts nothing for a form that was opened and abandoned', async () => {
    const { leave, hasDraft } = await render();

    await leave();

    expect(hasDraft()).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('starts nothing when a saved draft is resumed and continued', async () => {
    savedDraft = {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
      values: { priority: 'LOW', preferredDate: '', preferredTime: '', notes: 'It rattles.' },
      imageUrls: [],
      address: null,
      vendor: NO_VENDOR_CHOICE,
    };

    const { choose, press, leave } = await render();

    await choose('High');
    await press(COPY.submit);
    await leave();

    expect(track).not.toHaveBeenCalled();
  });

  it('starts a new request when the draft on hand is for another service', async () => {
    savedDraft = {
      categoryId: 'cat_other',
      subCategoryId: 'sub_wiring',
      values: { priority: 'LOW', preferredDate: '', preferredTime: '', notes: '' },
      imageUrls: [],
      address: null,
      vendor: NO_VENDOR_CHOICE,
    };

    const { fillRequired, press, draft } = await render();

    await fillRequired();
    await press(COPY.submit);

    expect(draft().subCategoryId).toBe(SUB_CATEGORY_ID);
    expect(started()).toHaveLength(1);
    expect(started()[0][1]).toEqual({ categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID });
  });

  it('starts nothing when another service’s draft is on hand and this form is left', async () => {
    savedDraft = {
      categoryId: 'cat_other',
      subCategoryId: 'sub_wiring',
      values: { priority: 'LOW', preferredDate: '', preferredTime: '', notes: '' },
      imageUrls: [],
      address: null,
      vendor: NO_VENDOR_CHOICE,
    };

    const { choose, leave } = await render();

    await choose('High');
    await leave();

    // Nothing of this request was written down, so nothing was started.
    expect(track).not.toHaveBeenCalled();
  });
});
