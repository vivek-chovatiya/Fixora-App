/**
 * MockLocationService
 *
 * Stands in for the device's geolocation until a real one exists.
 *
 * ⚠️ It is not a location. There is no geolocation library in this project, so
 * there is nothing here reading a satellite, a cell tower or a wifi scan — this
 * returns a fixed point in Bengaluru with an honest accuracy figure, and it is
 * named so that no caller can be under any illusion about that. The value of it
 * is that the permission flow, the reverse-geocode step, the confirm-before-you
 * -continue step and every failure path around them are all real and can be
 * built and tested now.
 *
 * ⚠️ It asks for nothing. `PermissionService` owns the dialog; a caller has
 * already established that it may look by the time this is called. That
 * separation is why this file has no platform import and needs no device to run.
 *
 * Replacing it means writing a `DeviceLocationService` beside
 * `DevicePermissionService` around whichever geolocation dependency is approved,
 * and changing one line in `configureServices`. Nothing above this moves.
 */

import { createLogger } from '@/core/logger/Logger';
import { simulateNetwork } from '@/shared/services/mock/mockUtils';
import type { Coordinates, LocationService } from '@/shared/services/types/LocationService';

const log = createLogger('MockLocationService');

/**
 * The fixture point. Bengaluru, to match the addresses the mock gazetteer knows.
 *
 * A constant rather than a random walk: a "current location" that moved between
 * runs would make the reverse-geocoded address change under a developer who was
 * testing something else, and the wandering would look like a bug in whatever
 * they were actually working on.
 */
const FIXTURE: Coordinates = Object.freeze({
  latitude: 12.9716,
  longitude: 77.5946,
  // What a decent urban fix looks like. Stated so nothing downstream mistakes a
  // fixture for a survey-grade point.
  accuracyMetres: 18,
});

export class MockLocationService implements LocationService {
  async getCurrentCoordinates(): Promise<Coordinates> {
    return simulateNetwork(() => {
      /*
        Counted, never placed.

        Coordinates are where somebody lives. The useful debugging fact is that a
        fix was obtained and roughly how good it was; the fix itself belongs in
        the request and nowhere else — certainly not in a log line that ends up
        in a crash report.
      */
      log.info('Mock location fix produced', { accuracyMetres: FIXTURE.accuracyMetres });

      return { ...FIXTURE };
    });
  }
}
