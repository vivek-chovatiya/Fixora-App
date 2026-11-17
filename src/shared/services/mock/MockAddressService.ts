/**
 * MockAddressService
 *
 * A small gazetteer, standing in for a geocoding provider.
 *
 * ⚠️ Nothing here is geocoded. The seed below is a handful of invented
 * Bengaluru addresses with plausible coordinates attached, matched by substring;
 * it is a fixture table, not a search index, and `describeCoordinates` returns
 * the nearest seed entry rather than describing the point it was given. Both are
 * named and commented so that no screen comes to rely on precision this cannot
 * deliver.
 *
 * ⚠️ It answers with an empty list rather than an error when nothing matches,
 * because that is the case the real provider will hit constantly and the case
 * the screen must handle well: a customer whose street is not in anyone's
 * gazetteer still has to be able to book a plumber, so the typed text stays
 * usable and nothing is blocked.
 *
 * Replacing this with a real provider requires no change to any screen. What it
 * will require is a key, which is why none is referenced here — the day this
 * becomes an `ApiAddressService`, the credential belongs in the build
 * configuration, never in a source file.
 */

import { createLogger } from '@/core/logger/Logger';
import { mockId, simulateNetwork } from '@/shared/services/mock/mockUtils';
import type { AddressService, AddressSuggestion } from '@/shared/services/types/AddressService';
import type { Coordinates } from '@/shared/services/types/LocationService';
import { AppError } from '@/shared/types/error';

const log = createLogger('MockAddressService');

/**
 * How short a query is ignored altogether.
 *
 * One letter matches half the table and teaches the customer nothing. The real
 * provider will have its own floor and will charge per call, so having one here
 * keeps the calling code honest about not searching on every keystroke.
 */
export const ADDRESS_QUERY_MIN_LENGTH = 3;

/** How many candidates a search returns. A list nobody scrolls is a list of five. */
const MAX_SUGGESTIONS = 5;

interface SeedEntry {
  id: string;
  label: string;
  detail: string;
  addressLine: string;
  locality: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

/**
 * Invented, and deliberately varied.
 *
 * Apartments, a house on a numbered cross, an office block and a landmark,
 * because those are four different lengths of string and the row that renders
 * them has to survive all four.
 *
 * ⚠️ `label` and `detail` do not overlap, which is how a real provider splits a
 * place — a main line and a secondary one. They used to, and a row announced
 * itself on device as "412, 5th Block, Koramangala, Koramangala, Bengaluru
 * 560095": the locality read twice, once in each half.
 */
const SEED: readonly SeedEntry[] = Object.freeze([
  {
    id: 'place_indiranagar_100ft',
    label: 'Prestige Acropolis, 100 Feet Road',
    detail: 'Indiranagar, Bengaluru 560038',
    addressLine: 'Prestige Acropolis, 100 Feet Road',
    locality: 'Indiranagar, Bengaluru',
    postalCode: '560038',
    latitude: 12.9719,
    longitude: 77.6412,
  },
  {
    id: 'place_koramangala_5th',
    label: '412, 5th Block',
    detail: 'Koramangala, Bengaluru 560095',
    addressLine: '412, 5th Block',
    locality: 'Koramangala, Bengaluru',
    postalCode: '560095',
    latitude: 12.9352,
    longitude: 77.6245,
  },
  {
    id: 'place_jayanagar_11th',
    label: '27, 11th Main, 4th Block',
    detail: 'Jayanagar, Bengaluru 560011',
    addressLine: '27, 11th Main, 4th Block',
    locality: 'Jayanagar, Bengaluru',
    postalCode: '560011',
    latitude: 12.9299,
    longitude: 77.5827,
  },
  {
    id: 'place_whitefield_itpl',
    label: 'ITPL Main Road',
    detail: 'Whitefield, Bengaluru 560066',
    addressLine: 'ITPL Main Road',
    locality: 'Whitefield, Bengaluru',
    postalCode: '560066',
    latitude: 12.9856,
    longitude: 77.7369,
  },
  {
    id: 'place_mg_road',
    label: 'Brigade Road, near MG Road Metro',
    detail: 'Ashok Nagar, Bengaluru 560001',
    addressLine: 'Brigade Road',
    locality: 'Ashok Nagar, Bengaluru',
    postalCode: '560001',
    latitude: 12.9752,
    longitude: 77.6069,
  },
  {
    id: 'place_hsr_sector2',
    label: '9, Sector 2',
    detail: 'HSR Layout, Bengaluru 560102',
    addressLine: '9, Sector 2',
    locality: 'HSR Layout, Bengaluru',
    postalCode: '560102',
    latitude: 12.9121,
    longitude: 77.6446,
  },
  {
    id: 'place_malleshwaram_8th',
    label: '58, 8th Cross',
    detail: 'Malleshwaram, Bengaluru 560003',
    addressLine: '58, 8th Cross',
    locality: 'Malleshwaram, Bengaluru',
    postalCode: '560003',
    latitude: 13.0035,
    longitude: 77.5709,
  },
]);

/** Fixture row to suggestion, so the two representations cannot drift apart. */
function toSuggestion(entry: SeedEntry): AddressSuggestion {
  return {
    id: entry.id,
    label: entry.label,
    detail: entry.detail,
    address: {
      // The line a person would write, assembled once here rather than by each
      // caller — the app must never be in the business of composing addresses.
      formattedAddress: `${entry.addressLine}, ${entry.locality} ${entry.postalCode}`,
      latitude: entry.latitude,
      longitude: entry.longitude,
      addressLine: entry.addressLine,
      locality: entry.locality,
      postalCode: entry.postalCode,
      placeId: entry.id,
    },
  };
}

/** Squared degrees. Fine for ordering a table of seven; never a distance. */
function crudeProximity(entry: SeedEntry, point: Coordinates): number {
  const dLat = entry.latitude - point.latitude;
  const dLon = entry.longitude - point.longitude;
  return dLat * dLat + dLon * dLon;
}

export class MockAddressService implements AddressService {
  async searchAddresses(query: string): Promise<AddressSuggestion[]> {
    return simulateNetwork(() => {
      const needle = query.trim().toLowerCase();

      if (needle.length < ADDRESS_QUERY_MIN_LENGTH) {
        return [];
      }

      const matches = SEED.filter(
        entry =>
          entry.label.toLowerCase().includes(needle) ||
          entry.detail.toLowerCase().includes(needle),
      ).slice(0, MAX_SUGGESTIONS);

      /*
        The shape of the answer, never the question.

        What somebody types into an address box is where they live. The count is
        what is useful when a search looks wrong; the query itself is not
        something to write into a log that may be collected.
      */
      log.info('Mock address search completed', {
        queryLength: needle.length,
        matchCount: matches.length,
      });

      return matches.map(toSuggestion);
    });
  }

  async describeCoordinates(coordinates: Coordinates): Promise<AddressSuggestion> {
    return simulateNetwork(() => {
      /*
        ⚠️ Nearest fixture, not a description of this point.

        A real reverse geocode returns the address *at* the coordinates. This
        returns whichever seed entry happens to be closest, which for a point
        outside Bengaluru is nonsense — so the customer confirms what comes back
        before it is used, which the screen requires anyway and which is the
        right behaviour against a real provider too.
      */
      const nearest = [...SEED].sort(
        (a, b) => crudeProximity(a, coordinates) - crudeProximity(b, coordinates),
      )[0];

      if (!nearest) {
        throw new AppError({
          kind: 'notFound',
          message: 'Mock gazetteer is empty',
          userMessage: 'We could not work out the address for your location.',
        });
      }

      log.info('Mock reverse geocode completed', { placeId: nearest.id });

      /*
        The point is kept, the description is the fixture's.

        The customer's actual coordinates are what the backend can act on, and
        overwriting them with a fixture's would silently move the request several
        kilometres. A fresh id marks it as a resolved fix rather than a place
        that was chosen from a list.
      */
      const suggestion = toSuggestion(nearest);
      return {
        ...suggestion,
        id: mockId('fix'),
        address: {
          ...suggestion.address,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
      };
    });
  }
}
