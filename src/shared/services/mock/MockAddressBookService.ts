/**
 * MockAddressBookService
 *
 * Stands in for the address-book endpoints until they exist (PROJECT_BIBLE.md
 * section 18). It behaves like a backend rather than like a convenience: it
 * re-checks what it is sent, it owns which address is default, it decides the
 * order, and it refuses when nobody is signed in.
 *
 * ⚠️ The collection's rules live here and nowhere else:
 *
 * - the first address saved becomes the default; later ones do not displace it
 * - exactly one address is default while any exist, and none when none do
 * - deleting the default promotes the most recently added of those remaining
 * - the default is listed first, then the rest in the order they were added
 *
 * They are here because every one of them is a property of the *collection*. A
 * screen that flipped a flag on one record would have to repair every other to
 * keep "exactly one" true, which is how two defaults eventually appear; so the
 * only way to change the default is to ask for it, and every mutation answers
 * with the whole list.
 *
 * ⚠️ Ordering without timestamps. Insertion order is what the stored array
 * already is, so it is read straight off it — a `createdAt` would exist purely
 * to re-derive something the array never lost, and would then need maintaining.
 *
 * ⚠️ Per customer, and refuses without one. An address book with no owner is
 * either nobody's or everybody's, and the second is how one customer sees
 * another's home address.
 */

import { createLogger } from '@/core/logger/Logger';
import {
  isUsableAddress,
  ADDRESS_MAX_LENGTH,
  ADDRESS_MIN_LENGTH,
} from '@/features/customer/validation/addressRules';
import type { MockSavedAddressStorage } from '@/shared/services/mock/MockSavedAddressStorage';
import { mockId, NO_LATENCY, simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import type {
  AddressBookService,
  SavedAddress,
  SavedAddressInput,
} from '@/shared/services/types/AddressBookService';
import { AppError } from '@/shared/types/error';

const log = createLogger('MockAddressBookService');

export interface MockAddressBookServiceOptions {
  /** Simulated latency. Pass `NO_LATENCY` in tests. */
  latency?: MockLatency;

  /** Where the collection is kept between launches. Without it, memory only. */
  storage?: MockSavedAddressStorage;

  /** The signed-in customer's id, or null. Asked on every call. */
  currentCustomerId?: () => Promise<string | null>;
}

/** The default first, then the order they were added. */
function ordered(addresses: readonly SavedAddress[]): SavedAddress[] {
  const first = addresses.filter(address => address.isDefault);
  const rest = addresses.filter(address => !address.isDefault);

  return [...first, ...rest];
}

/** Only `id` survives from the existing record; everything else is replaced. */
function applyInput(id: string, input: SavedAddressInput, isDefault: boolean): SavedAddress {
  const hasPoint = input.latitude !== undefined && input.longitude !== undefined;

  return {
    id,
    formattedAddress: input.formattedAddress.trim(),
    isDefault,
    ...(input.addressLine?.trim() ? { addressLine: input.addressLine.trim() } : {}),
    ...(input.locality?.trim() ? { locality: input.locality.trim() } : {}),
    ...(input.postalCode?.trim() ? { postalCode: input.postalCode.trim() } : {}),
    ...(input.placeId?.trim() ? { placeId: input.placeId.trim() } : {}),
    ...(hasPoint ? { latitude: input.latitude, longitude: input.longitude } : {}),
  };
}

export class MockAddressBookService implements AddressBookService {
  private readonly latency: MockLatency;
  private readonly storage?: MockSavedAddressStorage;
  private readonly currentCustomerId?: () => Promise<string | null>;

  /** The collection per customer, for when there is no storage to hold it. */
  private readonly memory = new Map<string, SavedAddress[]>();

  constructor(options: MockAddressBookServiceOptions = {}) {
    this.latency = options.latency ?? NO_LATENCY;
    this.storage = options.storage;
    this.currentCustomerId = options.currentCustomerId;
  }

  async listAddresses(): Promise<SavedAddress[]> {
    return simulateNetwork(async () => {
      const customerId = await this.requireCustomer();

      return ordered(await this.load(customerId));
    }, this.latency);
  }

  async createAddress(input: SavedAddressInput): Promise<SavedAddress[]> {
    return simulateNetwork(async () => {
      const customerId = await this.requireCustomer();
      this.check(input);

      const existing = await this.load(customerId);
      // The first address saved is the default; a later one never displaces it.
      const created = applyInput(mockId('addr'), input, existing.length === 0);

      return this.store(customerId, [...existing, created]);
    }, this.latency);
  }

  async updateAddress(id: string, input: SavedAddressInput): Promise<SavedAddress[]> {
    return simulateNetwork(async () => {
      const customerId = await this.requireCustomer();
      this.check(input);

      const existing = await this.load(customerId);
      const current = existing.find(address => address.id === id);
      if (!current) {
        throw new AppError({ kind: 'notFound', message: 'Mock address book: no such address' });
      }

      /*
        The default flag is carried across untouched. Editing an address is
        changing where it is, not which one is used by default — and a screen
        that silently moved the default while saving a typo fix would be
        changing something the customer did not ask about.
      */
      const updated = applyInput(id, input, current.isDefault);

      return this.store(
        customerId,
        existing.map(address => (address.id === id ? updated : address)),
      );
    }, this.latency);
  }

  async deleteAddress(id: string): Promise<SavedAddress[]> {
    return simulateNetwork(async () => {
      const customerId = await this.requireCustomer();

      const existing = await this.load(customerId);
      const removed = existing.find(address => address.id === id);
      if (!removed) {
        throw new AppError({ kind: 'notFound', message: 'Mock address book: no such address' });
      }

      const remaining = existing.filter(address => address.id !== id);

      /*
        Losing the default must not leave the book without one. The most
        recently added of those that remain takes it: it is the address the
        customer showed most recent interest in, and any rule is better than
        a collection that quietly has no default until somebody notices.
      */
      if (removed.isDefault && remaining.length > 0) {
        const promoted = remaining.length - 1;

        return this.store(
          customerId,
          remaining.map((address, index) => ({ ...address, isDefault: index === promoted })),
        );
      }

      return this.store(customerId, remaining);
    }, this.latency);
  }

  async setDefaultAddress(id: string): Promise<SavedAddress[]> {
    return simulateNetwork(async () => {
      const customerId = await this.requireCustomer();

      const existing = await this.load(customerId);
      if (!existing.some(address => address.id === id)) {
        throw new AppError({ kind: 'notFound', message: 'Mock address book: no such address' });
      }

      // Set and cleared in one pass: "exactly one" cannot be maintained by
      // touching a single record.
      return this.store(
        customerId,
        existing.map(address => ({ ...address, isDefault: address.id === id })),
      );
    }, this.latency);
  }

  /**
   * Checked again here, after the form has already checked it.
   *
   * The form's validation is for the person typing; this is for the record. A
   * backend that trusted its client would be one bad build away from a blank
   * address, and the screen has to survive a refusal anyway.
   */
  private check(input: SavedAddressInput): void {
    if (!isUsableAddress({ formattedAddress: input.formattedAddress })) {
      throw new AppError({
        kind: 'validation',
        message: `Mock address book refused: address must be ${ADDRESS_MIN_LENGTH}-${ADDRESS_MAX_LENGTH} characters`,
      });
    }
  }

  /** What an authenticated endpoint does when the caller is not. */
  private async requireCustomer(): Promise<string> {
    const customerId = (await this.currentCustomerId?.()) ?? null;
    if (!customerId) {
      throw new AppError({ kind: 'unauthorized', message: 'Mock address book: no session' });
    }

    return customerId;
  }

  private async load(customerId: string): Promise<SavedAddress[]> {
    if (this.storage) {
      return this.storage.read(customerId);
    }

    return this.memory.get(customerId) ?? [];
  }

  /** Keeps the collection and answers with it, in the order a caller draws it. */
  private async store(customerId: string, addresses: SavedAddress[]): Promise<SavedAddress[]> {
    this.memory.set(customerId, addresses);

    if (this.storage) {
      const written = await this.storage.write(customerId, addresses);
      if (!written) {
        /*
          Reported, not thrown. The change is real for this launch — the caller
          is about to draw it — and failing the mutation would tell the customer
          their address was not saved when it was, just not durably.
        */
        log.warn('Saved addresses could not be persisted; they last until restart');
      }
    }

    return ordered(addresses);
  }
}
