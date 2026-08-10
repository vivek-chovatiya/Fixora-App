/**
 * MockCategoryService
 *
 * In-memory CategoryService for the UI-first phase.
 *
 * ⚠️ The seed below is fixture data standing in for a backend table, not a
 * definition of what Fixora offers. It lives here — never in a screen, a
 * constant file, or a theme icon map — precisely so that no part of the
 * application ends up knowing which services exist (PROJECT_BIBLE.md section
 * 11).
 *
 * Replacing this with an ApiCategoryService requires no change to any screen.
 */

import { createLogger } from '@/core/logger/Logger';
import { simulateNetwork } from '@/shared/services/mock/mockUtils';
import type { CategoryService, ServiceCategory } from '@/shared/services/types/CategoryService';

const log = createLogger('MockCategoryService');

/**
 * Names and glyphs are arbitrary sample values. `iconGlyph` uses raw
 * MaterialCommunityIcons names because that is what the backend will send, and
 * `DynamicIcon` resolves them without the app knowing any of them in advance.
 */
const SEED: readonly ServiceCategory[] = Object.freeze([
  { id: 'cat_electrician', name: 'Electrician', iconGlyph: 'lightning-bolt-outline' },
  { id: 'cat_plumber', name: 'Plumber', iconGlyph: 'pipe-wrench' },
  { id: 'cat_carpenter', name: 'Carpenter', iconGlyph: 'hammer-screwdriver' },
  { id: 'cat_ac_repair', name: 'AC Repair', iconGlyph: 'air-conditioner' },
  { id: 'cat_cleaning', name: 'Cleaning', iconGlyph: 'spray-bottle' },
  { id: 'cat_painting', name: 'Painting', iconGlyph: 'format-paint' },
  { id: 'cat_appliance_repair', name: 'Appliance Repair', iconGlyph: 'washing-machine' },
  { id: 'cat_pest_control', name: 'Pest Control', iconGlyph: 'bug-outline' },
]);

export class MockCategoryService implements CategoryService {
  async listServiceCategories(): Promise<ServiceCategory[]> {
    return simulateNetwork(() => {
      log.info('Mock service categories listed', { count: SEED.length });
      // Copied so a caller cannot mutate the seed for the rest of the process.
      return SEED.map(category => ({ ...category }));
    });
  }
}
