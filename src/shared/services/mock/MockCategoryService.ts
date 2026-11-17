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
import type {
  CategoryService,
  ServiceCategory,
  SubCategory,
} from '@/shared/services/types/CategoryService';

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

/**
 * What is inside each category, keyed by the category's id.
 *
 * ⚠️ Keyed by id and never by name. A map from "Electrician" to a list of
 * services is exactly the client-side catalogue PROJECT_BIBLE.md section 12
 * forbids — it would break the moment the backend renamed or translated a
 * category, and it would put the product's offering back inside the app.
 *
 * Two categories are deliberately left out. A category the backend has not
 * filled in yet is a real state, and a fixture where every id returns something
 * is a fixture that never shows anyone the empty screen.
 */
const SUB_CATEGORY_SEED: Readonly<Record<string, readonly SubCategory[]>> = Object.freeze({
  cat_electrician: Object.freeze([
    { id: 'sub_fan_repair', name: 'Fan Repair', iconGlyph: 'fan' },
    { id: 'sub_switch_repair', name: 'Switch Repair', iconGlyph: 'toggle-switch-outline' },
    {
      id: 'sub_light_installation',
      name: 'Light Installation',
      description: 'Ceiling lights, wall lights and fittings',
      iconGlyph: 'lightbulb-outline',
    },
    { id: 'sub_mcb_repair', name: 'MCB Repair', iconGlyph: 'electric-switch' },
    { id: 'sub_wiring', name: 'Wiring and rewiring', iconGlyph: 'cable-data' },
  ]),
  cat_plumber: Object.freeze([
    { id: 'sub_leak_repair', name: 'Leak Repair', iconGlyph: 'water-alert-outline' },
    { id: 'sub_tap_fitting', name: 'Tap Fitting', iconGlyph: 'water-pump' },
    {
      id: 'sub_drain_cleaning',
      name: 'Drain Cleaning',
      description: 'Kitchen and bathroom drains',
      iconGlyph: 'pipe-disconnected',
    },
    { id: 'sub_geyser_install', name: 'Geyser Installation', iconGlyph: 'water-boiler' },
  ]),
  cat_carpenter: Object.freeze([
    { id: 'sub_door_repair', name: 'Door Repair', iconGlyph: 'door-closed' },
    { id: 'sub_furniture_assembly', name: 'Furniture Assembly', iconGlyph: 'sofa-outline' },
    { id: 'sub_cupboard_work', name: 'Cupboard and Wardrobe Work', iconGlyph: 'wardrobe-outline' },
  ]),
  cat_ac_repair: Object.freeze([
    { id: 'sub_ac_service', name: 'AC Servicing', iconGlyph: 'air-filter' },
    { id: 'sub_ac_gas', name: 'Gas Refilling', iconGlyph: 'gas-cylinder' },
    { id: 'sub_ac_install', name: 'Installation and Uninstallation', iconGlyph: 'air-conditioner' },
  ]),
  cat_cleaning: Object.freeze([
    { id: 'sub_deep_clean', name: 'Deep Home Cleaning', iconGlyph: 'home-heart' },
    { id: 'sub_bathroom_clean', name: 'Bathroom Cleaning', iconGlyph: 'shower' },
    { id: 'sub_sofa_clean', name: 'Sofa and Carpet Cleaning', iconGlyph: 'sofa-single-outline' },
  ]),
  cat_painting: Object.freeze([
    { id: 'sub_interior_paint', name: 'Interior Painting', iconGlyph: 'roller-shade' },
    { id: 'sub_exterior_paint', name: 'Exterior Painting', iconGlyph: 'home-outline' },
    { id: 'sub_waterproofing', name: 'Waterproofing', iconGlyph: 'water-off-outline' },
  ]),
});

/**
 * What a request for this service is called, for the mock request table.
 *
 * ⚠️ For the other mocks and nothing else. A backend names a stored request by
 * joining its request table against its catalogue; `MockRequestService` stands
 * in for that table, so it joins against this one instead of keeping a second
 * copy of every name that could drift from the first. The application never
 * imports this — it asks `CategoryService`, and never a fixture.
 *
 * Null when either identifier is not in the catalogue, which is the backend
 * declining to raise a request for a service it does not offer.
 */
export function findMockServiceNames(
  categoryId: string,
  subCategoryId: string,
): { categoryName: string; serviceName: string } | null {
  const category = SEED.find(entry => entry.id === categoryId);
  const service = SUB_CATEGORY_SEED[categoryId]?.find(entry => entry.id === subCategoryId);

  return category && service ? { categoryName: category.name, serviceName: service.name } : null;
}

export class MockCategoryService implements CategoryService {
  async listServiceCategories(): Promise<ServiceCategory[]> {
    return simulateNetwork(() => {
      log.info('Mock service categories listed', { count: SEED.length });
      // Copied so a caller cannot mutate the seed for the rest of the process.
      return SEED.map(category => ({ ...category }));
    });
  }

  async listSubCategories(categoryId: string): Promise<SubCategory[]> {
    return simulateNetwork(() => {
      // An id the seed does not know is an empty category, not a failure. The
      // backend would answer the same way for one nobody has filled in yet.
      const services = SUB_CATEGORY_SEED[categoryId] ?? [];

      log.info('Mock sub-categories listed', { categoryId, count: services.length });

      // Copied so a caller cannot mutate the seed for the rest of the process.
      return services.map(service => ({ ...service }));
    });
  }
}
