/**
 * ApiAddressBookService
 *
 * AddressBookService against the real backend's saved addresses
 * (PROJECT_BIBLE.md section 18): `GET /addresses`, `POST /addresses`, `POST
 * /addresses/update`, `POST /addresses/default`, `DELETE /addresses/delete`
 * (the id in the body). Each change answers with the whole list, read again, as
 * the interface requires. Live since only the address line is required there
 * (`requests-contract.md` §7, 17/11/2026), so a line typed by hand saves.
 *
 * Saving — nothing invented:
 * - `addressLine1` is the street when the source separated it out, otherwise
 *   the whole line; `city` is the app's `locality` and `pincode` its
 *   `postalCode`, each only when the app has one; coordinates only as a pair.
 *   No title (the backend's default stands: labels are Phase 2, section 63) and
 *   no state on a new address — the app's address has none.
 * - An edit replaces, never merges: every part the new address lacks is sent
 *   as `null`, which the contract clears — the second line, the town, the PIN
 *   code, the point, and a state an address written elsewhere carried — so a
 *   new line never sits beside the old address's town.
 * - The service keeps the interface's rules the backend does not: the first
 *   address saved, or any saved while none is the default, becomes the default;
 *   deleting the default promotes the most recently added of the rest.
 *
 * Reading:
 * - The address shown is put together from the parts — line(s), city, state
 *   when an address written elsewhere has one, PIN code — rather than taken from
 *   the backend's `fullAddress`, whose fixed template would print a state the
 *   app never sent.
 * - The default first, then the order they were added (the backend sends
 *   newest first); at most one default.
 * - `title`, `customerId`, timestamps and `_id` stay behind.
 */

import { BaseApiService } from '@/shared/services/api/BaseApiService';
import {
  malformedResponse,
  optionalString,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import type {
  AddressBookService,
  SavedAddress,
  SavedAddressInput,
} from '@/shared/services/types/AddressBookService';
import { AppError } from '@/shared/types/error';

interface ReadAddress {
  address: SavedAddress;
  createdAt: number;
}

function hasPoint(latitude: unknown, longitude: unknown): latitude is number {
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude)
  );
}

function toSavedAddress(raw: unknown): ReadAddress {
  const record = requireRecord(raw, 'address');
  const lines = [optionalString(record, 'addressLine1'), optionalString(record, 'addressLine2')]
    .filter((line): line is string => line !== undefined)
    .join(', ');
  if (!lines) {
    throw malformedResponse('address.addressLine1');
  }
  const locality = optionalString(record, 'city');
  const state = optionalString(record, 'state');
  const postalCode = optionalString(record, 'pincode');
  const place = [lines, locality, state].filter((part): part is string => part !== undefined).join(', ');
  const { latitude, longitude } = record;
  const createdAt = Date.parse(typeof record.createdAt === 'string' ? record.createdAt : '');

  return {
    address: {
      id: requireString(record, 'id', 'address'),
      formattedAddress: postalCode ? `${place} ${postalCode}` : place,
      addressLine: lines,
      ...(locality ? { locality } : {}),
      ...(postalCode ? { postalCode } : {}),
      isDefault: record.isDefault === true,
      ...(hasPoint(latitude, longitude) ? { latitude, longitude: longitude as number } : {}),
    },
    createdAt: Number.isNaN(createdAt) ? 0 : createdAt,
  };
}

/** The default first, then insertion order; one default at most. */
function inBookOrder(rows: ReadAddress[]): SavedAddress[] {
  const ordered = rows
    .map((row, index) => ({ ...row, index }))
    // Oldest first; the backend's newest-first order breaks a tie.
    .sort((a, b) => a.createdAt - b.createdAt || b.index - a.index)
    .map(row => row.address);

  const defaultIndex = ordered.findIndex(address => address.isDefault);
  if (defaultIndex < 0) {
    return ordered;
  }
  const chosen = ordered[defaultIndex];
  const rest = ordered
    .filter((_, index) => index !== defaultIndex)
    .map(address => (address.isDefault ? { ...address, isDefault: false } : address));

  return [chosen, ...rest];
}

/** The street when the source separated one out, otherwise the whole line. */
function lineOf(input: SavedAddressInput): string {
  return (input.addressLine?.trim() ? input.addressLine : input.formattedAddress).trim();
}

/**
 * The parts the app holds, in the backend's words — each only when present.
 * The line is the one thing an address cannot be without.
 */
function toBackendFields(input: SavedAddressInput): {
  addressLine1: string;
  city?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
} {
  const addressLine1 = lineOf(input);
  if (!addressLine1) {
    throw new AppError({ kind: 'validation', message: 'Address refused before sending: no address line' });
  }
  const city = input.locality?.trim();
  const pincode = input.postalCode?.trim();

  return {
    addressLine1,
    ...(city ? { city } : {}),
    ...(pincode ? { pincode } : {}),
    ...(hasPoint(input.latitude, input.longitude)
      ? { latitude: input.latitude, longitude: input.longitude as number }
      : {}),
  };
}

export class ApiAddressBookService extends BaseApiService implements AddressBookService {
  constructor() {
    super('/addresses');
  }

  async listAddresses(): Promise<SavedAddress[]> {
    const data = await this.get<unknown>();
    if (!Array.isArray(data)) {
      throw malformedResponse('addresses data');
    }
    return inBookOrder(data.map(toSavedAddress));
  }

  async createAddress(input: SavedAddressInput): Promise<SavedAddress[]> {
    const fields = toBackendFields(input);
    // The first address — or one saved while none is the default — becomes it.
    const before = await this.listAddresses();

    await this.post<unknown>('', {
      ...fields,
      isDefault: !before.some(address => address.isDefault),
    });
    return this.listAddresses();
  }

  async updateAddress(id: string, input: SavedAddressInput): Promise<SavedAddress[]> {
    const fields = toBackendFields(input);

    await this.post<unknown>('/update', {
      id,
      addressLine1: fields.addressLine1,
      // Replaced, not merged: whatever the new address lacks is cleared (`null`).
      addressLine2: null,
      city: fields.city ?? null,
      state: null,
      pincode: fields.pincode ?? null,
      latitude: fields.latitude ?? null,
      longitude: fields.longitude ?? null,
    });
    return this.listAddresses();
  }

  async deleteAddress(id: string): Promise<SavedAddress[]> {
    await this.delete<unknown>('/delete', { data: { id } });

    const remaining = await this.listAddresses();
    if (remaining.length === 0 || remaining.some(address => address.isDefault)) {
      return remaining;
    }
    // The default went: the most recently added of the rest takes it.
    return this.setDefaultAddress(remaining[remaining.length - 1].id);
  }

  async setDefaultAddress(id: string): Promise<SavedAddress[]> {
    await this.post<unknown>('/default', { id });
    return this.listAddresses();
  }
}
