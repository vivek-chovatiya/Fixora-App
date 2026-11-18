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
 * | `imageUrl`             | `profileImage`                                |
 * | `shopImageUrls`        | `shopImages`                                  |
 * | `acceptingRequests`    | `availability`                                |
 * | `ownerName`            | `ownerFirstName` + `ownerLastName`, else `ownerName` |
 * | `phone`, `email`       | `phone`, `email` (read only)                  |
 * | `workingHours`         | — none: always an empty week                  |
 * | `isSetupComplete`      | — derived: a business name and a category     |
 *
 * Decisions:
 * - **Setup is complete when the record has a business name and at least one
 *   category.** The backend has no setup flag; registration captures both and
 *   a vendor confirmed their code is ACTIVE and APPROVED (the shared sign-in
 *   contract), so a vendor with both is set up. A derivation from the real
 *   record — the navigator routes on it, and a vendor missing either is sent to
 *   the form that fills them in.
 * - **Working hours**: the backend keeps none. The profile carries an empty
 *   week — no hours on record, which is the truth — and the screens draw no
 *   summary and open the form on a closed week. Saving one refuses
 *   (`WORKING_HOURS_NOT_SUPPORTED`).
 * - **The service area is the record's `address`.** The backend has one place
 *   field per vendor, which the web views label "Address"; the app's section 38
 *   "Working Areas" is the nearest meaning it has. ⚠️ A decision for the owner:
 *   recorded in WORKING_NOTES' open items.
 * - **Text the backend cannot clear.** `/vendors/update` refuses an empty
 *   description or address, so a profile saved without one keeps the stored
 *   one — or, when there is one, the save is refused
 *   (`PROFILE_TEXT_CLEAR_NOT_SUPPORTED`) instead of quietly keeping what the
 *   vendor removed.
 * - **Photos.** There is no upload endpoint and the app's ImageService is still
 *   a mock whose URLs are placeholders, so a photo is accepted only when it is
 *   one the backend already holds: the profile picture sent back unchanged, or
 *   shop images removed or reordered. A new one is refused
 *   (`PHOTO_UPLOAD_NOT_SUPPORTED`) rather than writing a placeholder into a
 *   real record; removing the profile picture clears it (`profileImage: null`).
 *   ⚠️ When uploads are real, a new URL is simply sent.
 * - **Availability** is the record's `availability`, sent alone. ⚠️ The backend
 *   stores it but nothing reads it yet: open requests still reach a vendor who
 *   has turned it off (a recorded gap — section 18A.1 puts acting on it with
 *   the backend).
 * - Saving reads the record first (`GET /auth/me`) to compare the photos and
 *   the text the backend cannot clear, then answers with the record the update
 *   returned — the device adopts the server's answer.
 *
 * ⚠️ `/vendors/update` checks no ownership: any vendor's token may update any
 * vendor's id. This service only ever sends the session's own id, and refuses a
 * profile answer that is not for it — the backend gap is recorded.
 */

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import {
  malformedResponse,
  optionalString,
  referenceId,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import { notSupported } from '@/shared/services/api/notSupported';
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

function distinctStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''))];
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
  const imageUrl = optionalString(record, 'profileImage');
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
    shopImageUrls: distinctStrings(record.shopImages),
    acceptingRequests: record.availability,
    // No working hours on the backend: an empty week, never an invented one.
    workingHours: [],
    ownerName: ownerNameOf(record),
    phone: requireString(record, 'phone', 'vendorProfile'),
    ...(email ? { email } : {}),
    isSetupComplete: businessName.trim() !== '' && serviceCategoryIds.length > 0,
  };
}

/**
 * A text field the backend cannot clear: sent when there is one, left out when
 * the stored record has none either, refused when the vendor removed one.
 */
function textField(key: string, value: string | undefined, stored: string | undefined) {
  if (value) {
    return { [key]: value };
  }
  if (stored) {
    throw notSupported(`clearing the vendor's ${key}`, 'PROFILE_TEXT_CLEAR_NOT_SUPPORTED');
  }
  return {};
}

function photoUploadNotSupported(what: string): AppError {
  return notSupported(`${what} (no upload endpoint)`, 'PHOTO_UPLOAD_NOT_SUPPORTED');
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

    const stored = await this.readProfile(vendor.id);
    if (imageUrl !== undefined && imageUrl !== stored.imageUrl) {
      throw photoUploadNotSupported('a new profile picture');
    }

    const saved = await this.post<unknown>('/vendors/update', {
      id: vendor.id,
      businessName,
      categoryIds,
      ...textField('description', description, stored.description),
      ...textField('address', area, stored.serviceArea?.description),
      // Unchanged: not sent. Removed: cleared.
      ...(imageUrl === undefined && stored.imageUrl ? { profileImage: null } : {}),
    });
    return toProfile(saved, vendor.id);
  }

  async updateShopImages(imageUrls: string[]): Promise<VendorProfile> {
    const vendor = await this.requireVendor();

    if (!Array.isArray(imageUrls) || imageUrls.some(url => typeof url !== 'string' || url.trim() === '')) {
      refuse('shop images must be uploaded URLs');
    }
    if (imageUrls.length > AppConfig.image.maxShopImagesPerVendor) {
      refuse('too many shop images');
    }
    if (new Set(imageUrls).size !== imageUrls.length) {
      refuse('the same shop image twice');
    }

    const stored = await this.readProfile(vendor.id);
    if (imageUrls.some(url => !stored.shopImageUrls.includes(url))) {
      throw photoUploadNotSupported('a new shop image');
    }

    const saved = await this.post<unknown>('/vendors/update', {
      id: vendor.id,
      shopImages: [...imageUrls],
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

  async updateWorkingHours(_days: VendorWorkingDay[]): Promise<VendorProfile> {
    await this.requireVendor();
    throw notSupported('the vendor’s working hours', 'WORKING_HOURS_NOT_SUPPORTED');
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
