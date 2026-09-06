/**
 * MockRequestService
 *
 * In-memory RequestService for the UI-first phase.
 *
 * ⚠️ The seed below is fixture data standing in for a backend table. The
 * service names deliberately match the category fixtures so the two mocks tell
 * one consistent story, but nothing in the application reads either as a list of
 * what Fixora offers — both are the backend's to define.
 *
 * The statuses are section 21's, spread across the seed on purpose: a home
 * screen that only ever renders one status is a home screen whose status
 * presentation has never been looked at. One record deliberately carries no
 * vendor, because a request awaiting dispatch is a normal state the card has to
 * render rather than an incomplete row.
 *
 * ⚠️ A created request is acknowledged but not kept. `createRequest` returns a
 * fresh identifier and nothing is added to the seed above, so a new request does
 * not appear in the recent list. That is the honest mock: persistence is the
 * backend's, and a mock that quietly remembered would let a screen come to
 * depend on ordering and de-duplication no contract promises.
 *
 * Replacing this with an ApiRequestService requires no change to any screen.
 */

import { createLogger } from '@/core/logger/Logger';
import { isoMinutesAgo, mockId, simulateNetwork } from '@/shared/services/mock/mockUtils';
import type {
  CreateRequestInput,
  CreatedRequest,
  CustomerRequest,
  RequestService,
} from '@/shared/services/types/RequestService';

const log = createLogger('MockRequestService');

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 60 * 24;

/**
 * Newest first, which is the order the contract promises. Written in that order
 * rather than sorted at read time, so the fixture states the guarantee it is
 * standing in for instead of quietly relying on the mock to produce it.
 */
const SEED: readonly CustomerRequest[] = Object.freeze([
  {
    id: 'REQ-24081',
    serviceName: 'Plumber',
    status: 'PENDING_VENDOR',
    priority: 'HIGH',
    createdAt: isoMinutesAgo(35),
  },
  {
    id: 'REQ-24076',
    serviceName: 'AC Repair',
    vendorName: 'CoolAir Services',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    createdAt: isoMinutesAgo(6 * MINUTES_PER_HOUR),
  },
  {
    id: 'REQ-24063',
    serviceName: 'Appliance Repair',
    vendorName: 'QuickFix Appliances',
    status: 'ACCEPTED',
    priority: 'EMERGENCY',
    createdAt: isoMinutesAgo(MINUTES_PER_DAY),
  },
  {
    id: 'REQ-24048',
    serviceName: 'Electrician',
    vendorName: 'Sharma Electricals',
    status: 'COMPLETED',
    priority: 'LOW',
    createdAt: isoMinutesAgo(3 * MINUTES_PER_DAY),
  },
  {
    id: 'REQ-24020',
    serviceName: 'Cleaning',
    status: 'CANCELLED',
    priority: 'MEDIUM',
    createdAt: isoMinutesAgo(9 * MINUTES_PER_DAY),
  },
]);

export class MockRequestService implements RequestService {
  async listRecentRequests(limit: number): Promise<CustomerRequest[]> {
    return simulateNetwork(() => {
      // Clamped rather than trusted. A negative or absurd limit is a caller's
      // mistake, and a mock that returns the whole table for one hides it until
      // the real endpoint refuses.
      const count = Math.max(0, Math.min(Math.trunc(limit), SEED.length));

      log.info('Mock recent requests listed', { limit, count });

      // Copied so a caller cannot mutate the seed for the rest of the process.
      return SEED.slice(0, count).map(request => ({ ...request }));
    });
  }

  async createRequest(input: CreateRequestInput): Promise<CreatedRequest> {
    return simulateNetwork(() => {
      const created: CreatedRequest = {
        id: mockId('REQ'),
        // Section 21's first state, stated by the "backend" rather than assumed
        // by the caller — which is the whole point of returning it at all.
        status: 'CREATED',
        createdAt: new Date().toISOString(),
      };

      /*
        Counted, never contents.

        Notes are whatever the customer typed about their own home, and the
        image URLs point at photographs of it. Neither belongs in a log line,
        and a payload logged whole is the easiest way for both to end up in a
        crash report. What is useful for debugging is the shape: which service,
        how urgent, whether a preference and how many photographs.
      */
      log.info('Mock request created', {
        id: created.id,
        categoryId: input.categoryId,
        subCategoryId: input.subCategoryId,
        priority: input.priority,
        hasPreferredDate: input.preferredDate !== undefined,
        hasPreferredTime: input.preferredTime !== undefined,
        imageCount: input.imageUrls?.length ?? 0,
        hasNotes: Boolean(input.notes),
        // Which dispatch the request went out on (section 18A), without naming
        // the vendor a particular customer chose.
        dispatch: input.vendorId === undefined ? 'open' : 'directed',
      });

      return created;
    });
  }
}
