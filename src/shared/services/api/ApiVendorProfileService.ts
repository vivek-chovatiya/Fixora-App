/**
 * ApiVendorProfileService
 *
 * VendorProfileService against the real backend (Phase 4A, 17/11/2026;
 * PROJECT_BIBLE.md section 38). The vendor's business as the backend's vendor
 * record holds it: read from `GET /auth/me`, written with `POST /vendors/update`
 * carrying the signed-in vendor's own id and nothing else's.
 *
 * Field by field, both ways:
 *
 * | App (`VendorProfile`)  | Backend vendor record                         |
 * |------------------------|-----------------------------------------------|
 * | `vendorId`             | `id` — must be the session's own              |
 * | `businessName`         | `businessName`                                |
 * | `description`          | `description`                                 |
 * | `serviceCategoryIds`   | `categoryIds` (ids, or populated documents)   |
 * | `serviceArea`          | `address` — the record's one place field ⚠️   |
 * | `imageUrl`             | `profileImage` (read through `toImageUrl`)    |
 * | `shopImageUrls`        | `shopImages` (read through `toImageUrl`)      |
 * | `acceptingRequests`    | `availability`                                |
 * | `ownerName`            | `ownerFirstName` + `ownerLastName`, else `ownerName` |
 * | `phone`, `email`       | `phone`, `email` (read only)                  |
 * | `workingHours`         | `workingHours` — `[]` until the vendor sets one |
 * | `isSetupComplete`      | — derived: a business name and a category     |
 *
 * Decisions:
 * - **Setup is complete when the record has a business name and at least one
 *   category.** The backend has no setup flag; registration captures both and
 *   a vendor confirmed their code is ACTIVE and APPROVED (the shared sign-in
 *   contract), so a vendor with both is set up. A derivation from the real
 *   record — the navigator routes on it, and a vendor missing either is sent to
 *   the form that fills them in.
 * - **Working hours** (Phase 4B contract §6, 24/11/2026) are the record's
 *   `workingHours`, read as sent: `[]` — never set — stays the empty week, and
 *   the screens draw no summary and open the form on a closed week. Saved alone,
 *   `{ id, workingHours }`, each closed day without times. Whether a week is
 *   valid is the backend's to say (400 `VALIDATION_FAILED`, kind `validation`):
 *   the form already keeps its rule, and a second copy here could only drift.
 * - **The service area is the record's `address`.** The backend has one place
 *   field per vendor, which the web views label "Address"; the app's section 38
 *   "Working Areas" is the nearest meaning it has. ⚠️ A decision for the owner:
 *   recorded in WORKING_NOTES' open items.
 * - **Clearing text** sends `""` (contract §6): the description or the area the
 *   vendor removed is removed, and text the record never had is not sent.
 * - **Photos** are the image service's URLs, sent as they are — the backend
 *   turns its own `/uploads/...` URL back into the stored path, and accepts only
 *   an upload of this vendor's or the value already stored (contract §2). A new
 *   profile picture is sent; an unchanged one is not; a removed one is cleared
 *   (`profileImage: null`). Shop images are sent whole, in order. ⚠️ Anything
 *   `toImageUrl` cannot read — a local file, say — is refused before sending:
 *   only an uploaded image can be kept on the record.
 * - ⚠️ **A stored picture the app cannot show is never lost** (code review,
 *   24/11/2026). A seeded or web-view value such as `shop1.jpg` is left off the
 *   profile — it cannot load — but it is still the vendor's. Changing the shop
 *   images reads the record first and sends every such value back after the
 *   vendor's list, unchanged (the backend accepts a value already stored in that
 *   field, contract §2(a)); a profile picture the app cannot show reads as none
 *   and so is "unchanged" when the business is saved, and is not sent.
 * - **Availability** is the record's `availability`, sent alone. The backend
 *   acts on it (contract §6): off, no new requests reach the vendor.
 * - Saving the business reads the record first (`GET /auth/me`) to send only
 *   the picture and the text that changed, then answers with the record the
 *   update returned — the device adopts the server's answer.
 *
 * ⚠️ `/vendors/update` checks no ownership: any vendor's token may update any
 * vendor's id. This service only ever sends the session's own id, and refuses a
 * profile answer that is not for it — the backend gap is recorded.
 */

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import {
  isRecord,
  malformedResponse,
  optionalString,
  referenceId,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import { toImageUrl } from '@/shared/services/api/uploadUrls';
import type {
  VendorProfile,
  VendorProfileService,
  VendorProfileUpdate,
  VendorWorkingDay,
} from '@/shared/services/types/VendorProfileService';
import { AppError } from '@/shared/types/error';

export interface ApiVendorProfileServiceOptions {
  /** The signed-in account, or null. Asked on every call. */
  currentUser: () => Promise<AuthUser | null>;
}

function refuse(message: string): never {
  throw new AppError({ kind: 'validation', message: `Vendor profile refused: ${message}` });
}

/** The stored images as URLs that load, each once, in order; one that cannot load is left out. */
function imageUrlsOf(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map(toImageUrl).filter((url): url is string => url !== undefined))];
}

/** Whether a value can be kept on the record: an uploaded image, never a local file. */
function isUploadedImage(value: unknown): value is string {
  return toImageUrl(value) !== undefined;
}

/**
 * The stored images the profile leaves out because they cannot load, exactly
 * as stored and in their stored order — to be sent back untouched (see the
 * header), so a change to the photos the vendor can see never deletes them.
 */
function hiddenImagesOf(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value.filter(
        (stored): stored is string =>
          typeof stored === 'string' && stored.trim() !== '' && !isUploadedImage(stored),
      ),
    ),
  ];
}

/**
 * The stored week, day by day as sent: `[]` when never set (contract §6). An
 * open day keeps its times; a closed day has none. Not checked for shape — a
 * day the app does not know is shown plainly, and the form re-reads each of
 * the seven days for itself (`draftWeek`) — but an entry that is not a day at
 * all is left out rather than shown.
 */
function workingHoursOf(value: unknown): VendorWorkingDay[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const week: VendorWorkingDay[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.day !== 'string' || typeof entry.isOpen !== 'boolean') {
      continue;
    }
    const opensAt = entry.isOpen ? optionalString(entry, 'opensAt') : undefined;
    const closesAt = entry.isOpen ? optionalString(entry, 'closesAt') : undefined;
    week.push({
      day: entry.day,
      isOpen: entry.isOpen,
      ...(opensAt ? { opensAt } : {}),
      ...(closesAt ? { closesAt } : {}),
    });
  }
  return week;
}

/**
 * The week as the backend is sent it: the days in the order given, each with
 * the contract's keys only, a closed day without times (contract §6).
 */
function workingHoursBody(days: unknown): Record<string, unknown>[] {
  if (!Array.isArray(days)) {
    refuse('working hours must be a list of days');
  }
  return days.map((day: unknown) => {
    if (!isRecord(day)) {
      refuse('working hours must be a list of days');
    }
    return day.isOpen === true
      ? { day: day.day, isOpen: true, opensAt: day.opensAt, closesAt: day.closesAt }
      : { day: day.day, isOpen: day.isOpen };
  });
}

function ownerNameOf(record: Record<string, unknown>): string {
  const parts = [optionalString(record, 'ownerFirstName'), optionalString(record, 'ownerLastName')]
    .filter((part): part is string => part !== undefined)
    .map(part => part.trim());
  return parts.length > 0 ? parts.join(' ') : (optionalString(record, 'ownerName')?.trim() ?? '');
}

/**
 * The backend's vendor record as the app's profile. `vendorId` is the session's:
 * a record for any other vendor is a contract break, never shown.
 */
function toProfile(data: unknown, vendorId: string): VendorProfile {
  const record = requireRecord(data, 'vendorProfile');
  if (requireString(record, 'id', 'vendorProfile') !== vendorId) {
    throw malformedResponse('vendorProfile.id');
  }
  const role = optionalString(record, 'role');
  if (role !== undefined && role.toLowerCase() !== 'vendor') {
    throw malformedResponse('vendorProfile.role');
  }
  if (typeof record.availability !== 'boolean') {
    throw malformedResponse('vendorProfile.availability');
  }

  const businessName = typeof record.businessName === 'string' ? record.businessName : '';
  const description = optionalString(record, 'description');
  const area = optionalString(record, 'address');
  const imageUrl = toImageUrl(record.profileImage);
  const email = optionalString(record, 'email');
  const serviceCategoryIds = Array.isArray(record.categoryIds)
    ? [
        ...new Set(
          record.categoryIds
            .map(referenceId)
            .filter((id): id is string => id !== undefined),
        ),
      ]
    : [];

  return {
    vendorId,
    businessName,
    ...(description ? { description } : {}),
    serviceCategoryIds,
    ...(area ? { serviceArea: { description: area } } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    shopImageUrls: imageUrlsOf(record.shopImages),
    acceptingRequests: record.availability,
    // Never set is `[]`: the empty week, never an invented one.
    workingHours: workingHoursOf(record.workingHours),
    ownerName: ownerNameOf(record),
    phone: requireString(record, 'phone', 'vendorProfile'),
    ...(email ? { email } : {}),
    isSetupComplete: businessName.trim() !== '' && serviceCategoryIds.length > 0,
  };
}

/**
 * A text field: sent when there is one, cleared with `""` when the vendor
 * removed one (contract §6), left out when the stored record has none either.
 */
function textField(key: string, value: string | undefined, stored: string | undefined) {
  if (value) {
    return { [key]: value };
  }
  return stored ? { [key]: '' } : {};
}

export class ApiVendorProfileService extends BaseApiService implements VendorProfileService {
  private readonly currentUser: () => Promise<AuthUser | null>;

  constructor(options: ApiVendorProfileServiceOptions) {
    // Two resources, so the paths are whole: `/auth/me`, `/vendors/update`.
    super('');
    this.currentUser = options.currentUser;
  }

  async getProfile(): Promise<VendorProfile> {
    const vendor = await this.requireVendor();
    return this.readProfile(vendor.id);
  }

  async saveProfile(input: VendorProfileUpdate): Promise<VendorProfile> {
    const vendor = await this.requireVendor();

    const businessName = input.businessName.trim();
    const description = input.description?.trim() || undefined;
    const area = input.serviceArea?.description.trim() || undefined;
    const imageUrl = input.imageUrl?.trim() || undefined;
    const categoryIds = [...new Set(input.serviceCategoryIds.map(id => id.trim()).filter(Boolean))];
    if (!businessName) {
      refuse('business name is required');
    }
    if (categoryIds.length === 0) {
      refuse('at least one service category is required');
    }
    if (imageUrl !== undefined && !isUploadedImage(imageUrl)) {
      refuse('the profile picture must be an uploaded image');
    }

    const stored = await this.readProfile(vendor.id);

    const saved = await this.post<unknown>('/vendors/update', {
      id: vendor.id,
      businessName,
      categoryIds,
      ...textField('description', description, stored.description),
      ...textField('address', area, stored.serviceArea?.description),
      // Unchanged: not sent. New: sent as the image service gave it. Removed: cleared.
      ...(imageUrl !== stored.imageUrl ? { profileImage: imageUrl ?? null } : {}),
    });
    return toProfile(saved, vendor.id);
  }

  async updateShopImages(imageUrls: string[]): Promise<VendorProfile> {
    const vendor = await this.requireVendor();

    if (!Array.isArray(imageUrls) || !imageUrls.every(isUploadedImage)) {
      refuse('shop images must be uploaded images');
    }
    if (imageUrls.length > AppConfig.image.maxShopImagesPerVendor) {
      refuse('too many shop images');
    }
    if (new Set(imageUrls).size !== imageUrls.length) {
      refuse('the same shop image twice');
    }

    // The record first: what it holds that the vendor cannot see goes back with the list.
    const record = await this.get<unknown>('/auth/me');
    // Read as the profile is, so a record that is not this vendor's is refused here too.
    toProfile(record, vendor.id);
    const hidden = hiddenImagesOf(requireRecord(record, 'vendorProfile').shopImages);

    // Sent whole, in order: kept, reordered and new alike (contract §2 checks each).
    const saved = await this.post<unknown>('/vendors/update', {
      id: vendor.id,
      shopImages: [...imageUrls, ...hidden],
    });
    return toProfile(saved, vendor.id);
  }

  async setAcceptingRequests(accepting: boolean): Promise<VendorProfile> {
    const vendor = await this.requireVendor();
    if (typeof accepting !== 'boolean') {
      refuse('accepting requests is true or false');
    }

    const saved = await this.post<unknown>('/vendors/update', {
      id: vendor.id,
      availability: accepting,
    });
    return toProfile(saved, vendor.id);
  }

  async updateWorkingHours(days: VendorWorkingDay[]): Promise<VendorProfile> {
    const vendor = await this.requireVendor();
    const workingHours = workingHoursBody(days);

    // Alone, as availability and the shop images are: the form's other fields are untouched.
    const saved = await this.post<unknown>('/vendors/update', { id: vendor.id, workingHours });
    return toProfile(saved, vendor.id);
  }

  private async readProfile(vendorId: string): Promise<VendorProfile> {
    return toProfile(await this.get<unknown>('/auth/me'), vendorId);
  }

  /** What an authenticated vendor endpoint does to anybody else. */
  private async requireVendor(): Promise<AuthUser> {
    const user = await this.currentUser();
    if (!user || user.role !== 'vendor') {
      throw new AppError({ kind: 'unauthorized', message: 'Vendor profile: no vendor session' });
    }
    return user;
  }
}
