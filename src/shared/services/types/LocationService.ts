/**
 * LocationService
 *
 * Where the device thinks it is, and nothing else.
 *
 * ⚠️ Coordinates, not addresses. Reading a satellite fix and turning a fix into
 * a street name are two different capabilities from two different suppliers —
 * one is the operating system, the other is a geocoding provider — and a single
 * "get my address" call would weld them together so that neither could be
 * replaced without the other. `AddressService` is the second half.
 *
 * ⚠️ It does not ask for permission, and must not. `PermissionService` owns that
 * conversation for the whole application, and a service that quietly prompted
 * would put a system dialog wherever it happened to be called from. A caller
 * establishes permission first and then asks for a position; this one assumes it
 * may look and reports failure if it may not.
 *
 * Screens never touch it directly (CLAUDE.md section 10). The route is
 *
 *   Screen → hook → LocationService interface → implementation
 *
 * which is what lets the address flow be built and tested with no device, and
 * what will let a real geolocation library land in one file.
 */

/** A point on the earth, WGS 84 — the same datum every map and backend expects. */
export interface Coordinates {
  latitude: number;
  longitude: number;

  /**
   * Reported horizontal accuracy in metres, when the platform gives one.
   *
   * Carried because a fix from a cell tower and a fix from a satellite are both
   * "the location" and are hundreds of metres apart. Nothing in the app branches
   * on it yet; it is here so that the day something needs to know how much to
   * trust a point, the number was not thrown away at the boundary.
   */
  accuracyMetres?: number;
}

export interface LocationService {
  /**
   * A single position fix.
   *
   * Rejects rather than resolving null when there is none. A device with the
   * radio switched off, a fix that times out and a platform that has no
   * geolocation at all are all "no position", and each is an `AppError` the
   * caller shows as one safe sentence — the address flow treats every one of
   * them the same way, by carrying on manually.
   *
   * Not a subscription. Nothing here follows anybody: the request flow needs one
   * point at one moment, and a stream would be a battery cost with no reader.
   * Live tracking is a later phase and gets its own method when it exists.
   */
  getCurrentCoordinates(): Promise<Coordinates>;
}
