/**
 * MockVendorProfileService
 *
 * Stands in for the vendor profile endpoints until they exist (Phase 3E-1). It
 * behaves like a backend rather than like a convenience:
 *
 * - it re-checks what it is sent, because a real server does and a screen that
 *   has never met a refusal will not handle one;
 * - it normalises — trims, drops blanks and duplicate categories — and returns
 *   what it stored, so the device adopts the server's answer;
 * - it refuses when no vendor is signed in, and a customer is not a vendor.
 *
 * ⚠️ Setup is complete exactly when a business has been saved. That is this
 * mock's rule, not a product one: a real backend may pre-fill the profile from
 * registration and decide completeness on its own terms, and the app only
 * reads `isSetupComplete`.
 *
 * ⚠️ Registration's business name and categories are not carried over. The
 * mock auth service keeps registrations in memory and has no profile to hand
 * them to, so a newly registered vendor starts setup with empty business
 * fields; a backend that remembers them will simply return them from
 * `getProfile`, and the form opens on whatever it is given.
 *
 * ⚠️ Shop images live in the same record as the business, so both changes
 * read what is stored and write it back — and are therefore applied one at a
 * time, in the order they arrive, as the team's are (Phase 3E-7): two shop
 * images added in quick succession both land, and a form saved while a photo
 * is being added cannot write the old list back over it. Saving the form keeps
 * the stored shop images whatever it is sent (`VendorProfileUpdate` has no
 * field for them).
 *
 * ⚠️ A change that could not be stored did not happen: a failed write fails the
 * call (`unknown`) and the record is as it was.
 *
 * ⚠️ Availability and working hours (section 38) live in the same record and
 * are changed the same way: `setAcceptingRequests` and `updateWorkingHours`
 * wait in the same line as every other change, refuse before setup
 * (`notFound`, as shop images do) and re-check what they are sent — the week
 * by the very rules the store reads it back with (`decodeWorkingHours`).
 * Saving the form keeps both, whatever it is sent. A vendor who has never set
 * either is accepting new requests and works the default week below — this
 * app's assumption, standing in for whatever a real backend starts a vendor
 * on. The mock only stores them: nothing here, or anywhere in the app, offers
 * or withholds work because of them (section 18A.1).
 */

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser } from '@/features/auth/types';
import { getFullName } from '@/features/auth/types';
import {
  decodeWorkingHours,
  type MockVendorProfileStorage,
  type StoredVendorProfile,
} from '@/shared/services/mock/MockVendorProfileStorage';
import { NO_LATENCY, simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import {
  VENDOR_BUSINESS_NAME_MAX_LENGTH,
  VENDOR_DESCRIPTION_MAX_LENGTH,
  VENDOR_SERVICE_AREA_MAX_LENGTH,
  VENDOR_WORKING_DAYS,
  type VendorProfile,
  type VendorProfileService,
  type VendorProfileUpdate,
  type VendorWorkingDay,
} from '@/shared/services/types/VendorProfileService';
import { AppError } from '@/shared/types/error';

export interface MockVendorProfileServiceOptions {
  /** Simulated latency. Pass `NO_LATENCY` in tests. */
  latency?: MockLatency;

  /** Where profiles are kept between launches. Without it, memory only. */
  storage?: MockVendorProfileStorage;

  /** The signed-in account, or null. Asked on every call. */
  currentUser?: () => Promise<AuthUser | null>;
}

function refuse(message: string): never {
  throw new AppError({ kind: 'validation', message: `Mock vendor profile refused: ${message}` });
}

/**
 * The week a vendor works before they say otherwise: Monday to Saturday, nine
 * in the morning to seven in the evening, Sunday closed.
 *
 * ⚠️ This app's assumption — a common shape for a local trade, chosen so a new
 * vendor's Profile shows a sensible week rather than seven closed days. A real
 * backend decides its own starting week, and the app shows whatever it is
 * given.
 */
const DEFAULT_WORKING_HOURS: readonly VendorWorkingDay[] = Object.freeze(
  VENDOR_WORKING_DAYS.map(
    (day): VendorWorkingDay =>
      day === 'SUN'
        ? { day, isOpen: false }
        : { day, isOpen: true, opensAt: '09:00', closesAt: '19:00' },
  ),
);

/** The update as it would be stored, or a refusal. */
function normalise(input: VendorProfileUpdate): StoredVendorProfile {
  const businessName = input.businessName.trim();
  const description = input.description?.trim();
  const area = input.serviceArea?.description.trim();
  const imageUrl = input.imageUrl?.trim();
  const serviceCategoryIds = [
    ...new Set(input.serviceCategoryIds.map(id => id.trim()).filter(Boolean)),
  ];

  if (!businessName) {
    refuse('business name is required');
  }
  if (businessName.length > VENDOR_BUSINESS_NAME_MAX_LENGTH) {
    refuse('business name is too long');
  }
  if (serviceCategoryIds.length === 0) {
    refuse('at least one service category is required');
  }
  if (description && description.length > VENDOR_DESCRIPTION_MAX_LENGTH) {
    refuse('description is too long');
  }
  if (area && area.length > VENDOR_SERVICE_AREA_MAX_LENGTH) {
    refuse('service area is too long');
  }
  /*
    A local file would restore a broken image on the next launch and show
    nothing on any other device. Uploading happens before this is called.
  */
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    refuse('image must be an uploaded URL');
  }

  return {
    businessName,
    serviceCategoryIds,
    ...(description ? { description } : {}),
    ...(area ? { serviceArea: { description: area } } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

/**
 * The shop images as they would be stored, or a refusal.
 *
 * Trimmed, as every other value is. Nothing is dropped or reordered on the
 * vendor's behalf: a list the app got wrong is refused whole, because quietly
 * storing a different list from the one sent would leave the screen showing
 * photographs that are not there.
 */
function normaliseShopImages(imageUrls: unknown): string[] {
  if (!Array.isArray(imageUrls)) {
    refuse('shop images must be a list');
  }
  const urls = imageUrls.map(url => (typeof url === 'string' ? url.trim() : ''));

  if (urls.length > AppConfig.image.maxShopImagesPerVendor) {
    refuse('too many shop images');
  }
  // The same rule as the business picture: uploaded first, then referred to.
  if (!urls.every(url => /^https?:\/\/\S/i.test(url))) {
    refuse('every shop image must be an uploaded URL');
  }
  if (new Set(urls).size !== urls.length) {
    refuse('the same shop image is listed twice');
  }

  return urls;
}

/** The account's half and the business's half, as one profile. */
function compose(user: AuthUser, stored: StoredVendorProfile | null): VendorProfile {
  return {
    vendorId: user.id,
    businessName: stored?.businessName ?? '',
    serviceCategoryIds: stored?.serviceCategoryIds ?? [],
    ...(stored?.description ? { description: stored.description } : {}),
    ...(stored?.serviceArea ? { serviceArea: stored.serviceArea } : {}),
    ...(stored?.imageUrl ? { imageUrl: stored.imageUrl } : {}),
    // A copy: the caller may keep it, and it must not be the stored list.
    shopImageUrls: [...(stored?.shopImageUrls ?? [])],
    // Never set is accepting, and the default week (see `DEFAULT_WORKING_HOURS`).
    acceptingRequests: stored?.acceptingRequests ?? true,
    // Copies of every day, for the same reason as the list above.
    workingHours: (stored?.workingHours ?? DEFAULT_WORKING_HOURS).map(day => ({ ...day })),
    ownerName: getFullName(user),
    phone: user.phone,
    ...(user.email ? { email: user.email } : {}),
    isSetupComplete: stored !== null,
  };
}

export class MockVendorProfileService implements VendorProfileService {
  private readonly latency: MockLatency;
  private readonly storage?: MockVendorProfileStorage;
  private readonly currentUser?: () => Promise<AuthUser | null>;

  /** Profiles per vendor, for when there is no storage to hold them. */
  private readonly memory = new Map<string, StoredVendorProfile>();

  /** The last change in line; the next one waits for it. */
  private changes: Promise<unknown> = Promise.resolve();

  constructor(options: MockVendorProfileServiceOptions = {}) {
    this.latency = options.latency ?? NO_LATENCY;
    this.storage = options.storage;
    this.currentUser = options.currentUser;
  }

  async getProfile(): Promise<VendorProfile> {
    return simulateNetwork(async () => {
      const vendor = await this.requireVendor();

      return compose(vendor, await this.load(vendor.id));
    }, this.latency);
  }

  async saveProfile(input: VendorProfileUpdate): Promise<VendorProfile> {
    return this.change(async vendor => {
      const business = normalise(input);
      const existing = await this.load(vendor.id);

      /*
        The form's business, and everything the form has no field for —
        shop images, availability, working hours — exactly as it already was.
      */
      return {
        ...business,
        ...(existing?.shopImageUrls?.length ? { shopImageUrls: [...existing.shopImageUrls] } : {}),
        ...(existing?.acceptingRequests === undefined
          ? {}
          : { acceptingRequests: existing.acceptingRequests }),
        ...(existing?.workingHours
          ? { workingHours: existing.workingHours.map(day => ({ ...day })) }
          : {}),
      };
    });
  }

  async updateShopImages(imageUrls: string[]): Promise<VendorProfile> {
    return this.change(async vendor => {
      const shopImageUrls = normaliseShopImages(imageUrls);
      const existing = await this.load(vendor.id);

      /*
        Not found rather than stored on their own: there is no business to keep
        them on, and a record with images and no business would read back as a
        finished setup. The app only offers shop images once setup is done.
      */
      if (!existing) {
        throw new AppError({ kind: 'notFound', message: 'Mock vendor profile: not set up yet' });
      }

      return { ...existing, shopImageUrls };
    });
  }

  async setAcceptingRequests(accepting: boolean): Promise<VendorProfile> {
    return this.change(async vendor => {
      // Checked as a server would: the app is typed, the wire is not.
      if (typeof accepting !== 'boolean') {
        refuse('accepting requests must be true or false');
      }
      const existing = await this.setUp(vendor.id);

      return { ...existing, acceptingRequests: accepting };
    });
  }

  async updateWorkingHours(days: VendorWorkingDay[]): Promise<VendorProfile> {
    return this.change(async vendor => {
      /*
        Refused whole rather than repaired: a week quietly stored differently
        from the one sent would leave the screen showing hours that are not
        the vendor's.
      */
      const workingHours = decodeWorkingHours(days);
      if (!workingHours) {
        refuse('working hours must be seven days in order, each open day closing after it opens');
      }
      const existing = await this.setUp(vendor.id);

      return { ...existing, workingHours };
    });
  }

  /**
   * The vendor's stored business, or `notFound` — as for shop images: with no
   * business to keep them on, a record holding only availability or hours
   * would read back as a finished setup. The app offers both only after it.
   */
  private async setUp(vendorId: string): Promise<StoredVendorProfile> {
    const existing = await this.load(vendorId);
    if (!existing) {
      throw new AppError({ kind: 'notFound', message: 'Mock vendor profile: not set up yet' });
    }

    return existing;
  }

  /**
   * One change: who is asking, what the record becomes, then storing it — in
   * line behind any change already running, so each reads what the last one
   * wrote.
   */
  private change(
    next: (vendor: AuthUser) => Promise<StoredVendorProfile>,
  ): Promise<VendorProfile> {
    const run = this.changes.then(() =>
      simulateNetwork(async () => {
        const vendor = await this.requireVendor();
        const stored = await next(vendor);

        await this.store(vendor.id, stored);
        return compose(vendor, stored);
      }, this.latency),
    );

    // A failed change must not stop the next one.
    this.changes = run.catch(() => undefined);
    return run;
  }

  /** What an authenticated vendor endpoint does to anybody else. */
  private async requireVendor(): Promise<AuthUser> {
    const user = (await this.currentUser?.()) ?? null;
    if (!user || user.role !== 'vendor') {
      throw new AppError({ kind: 'unauthorized', message: 'Mock vendor profile: no vendor session' });
    }

    return user;
  }

  private async load(vendorId: string): Promise<StoredVendorProfile | null> {
    if (this.storage) {
      return this.storage.read(vendorId);
    }

    return this.memory.get(vendorId) ?? null;
  }

  private async store(vendorId: string, stored: StoredVendorProfile): Promise<void> {
    if (this.storage) {
      if (!(await this.storage.write(vendorId, stored))) {
        /*
          Refused rather than reported, unlike the address book. Setup routes on
          this answer: saying "saved" for a profile that is gone on the next
          launch would send the vendor back through setup with no explanation —
          and a shop image said to be saved would vanish the same way.
        */
        throw new AppError({ kind: 'unknown', message: 'Mock vendor profile could not be stored' });
      }
      return;
    }

    this.memory.set(vendorId, stored);
  }
}
