/**
 * MockVendorService
 *
 * In-memory VendorService for the UI-first phase.
 *
 * ⚠️ The seed is fixture data standing in for whatever the backend's
 * eligibility, ranking and availability logic decides. PROJECT_BIBLE.md section
 * 18A.1 puts all of that on the backend, so this mock does no filtering worth
 * the name: it looks a service up and returns what it finds, in the order it is
 * written. Anything cleverer here would be the frontend rehearsing a decision it
 * is forbidden to make.
 *
 * The order is deliberate rather than alphabetical, because the contract says
 * the order is the recommendation. A fixture sorted by name would let a screen
 * come to rely on an ordering the backend never promised.
 *
 * One service is deliberately left with no vendors. Section 18A.4 requires the
 * empty state to still allow submission, and a state that can only be reached by
 * editing a mock is a state nobody looks at.
 *
 * Replacing this with an ApiVendorService requires no change to any screen.
 */

import { createLogger } from '@/core/logger/Logger';
import { simulateNetwork } from '@/shared/services/mock/mockUtils';
import type { EligibleVendor, VendorService } from '@/shared/services/types/VendorService';

const log = createLogger('MockVendorService');

/**
 * Keyed by sub-category id, never by name.
 *
 * Same rule as the category seed: a map keyed on a display name is a map that
 * breaks the moment the backend renames or translates one.
 */
const SEED: Readonly<Record<string, readonly EligibleVendor[]>> = Object.freeze({
  sub_fan_repair: Object.freeze([
    {
      id: 'ven_sharma_electricals',
      name: 'Sharma Electricals',
      rating: 4.8,
      reviewCount: 126,
      areaLabel: '2 km away',
      availabilityLabel: 'Available today',
    },
    {
      id: 'ven_bright_spark',
      name: 'Bright Spark Electrical Services and Repairs',
      rating: 4.6,
      reviewCount: 89,
      areaLabel: 'Indiranagar',
      availabilityLabel: 'Available tomorrow',
    },
    // No rating and no reviews: a vendor new to the platform is a normal row,
    // not a broken one.
    { id: 'ven_ns_electricals', name: 'N.S. Electricals', areaLabel: '5 km away' },
    {
      id: 'ven_voltas_care',
      name: 'Voltas Care',
      rating: 4.9,
      reviewCount: 512,
      availabilityLabel: 'Busy until Thursday',
    },
  ]),
  sub_switch_repair: Object.freeze([
    {
      id: 'ven_sharma_electricals',
      name: 'Sharma Electricals',
      rating: 4.8,
      reviewCount: 126,
      areaLabel: '2 km away',
      availabilityLabel: 'Available today',
    },
    { id: 'ven_ns_electricals', name: 'N.S. Electricals', areaLabel: '5 km away' },
  ]),
  sub_leak_repair: Object.freeze([
    {
      id: 'ven_citywide_plumbing',
      name: 'Citywide Plumbing',
      rating: 4.5,
      reviewCount: 203,
      areaLabel: '1 km away',
      availabilityLabel: 'Available today',
    },
  ]),
  // sub_light_installation is deliberately absent, so the empty state is
  // reachable by tapping through the real application.
});

export class MockVendorService implements VendorService {
  async listEligibleVendors(
    categoryId: string,
    subCategoryId: string,
  ): Promise<EligibleVendor[]> {
    return simulateNetwork(() => {
      const vendors = SEED[subCategoryId] ?? [];

      // Counted, never listed. Which vendors a particular customer was offered
      // is their business and the vendors', and a log line is the wrong place
      // for it.
      log.info('Mock eligible vendors listed', {
        categoryId,
        subCategoryId,
        count: vendors.length,
      });

      // Copied so a caller cannot mutate the seed for the rest of the process.
      return vendors.map(vendor => ({ ...vendor }));
    });
  }
}
