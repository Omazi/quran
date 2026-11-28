/**
 * Settings of the sun module (docs/specs/sun.md). Every number is named and explained, as the
 * architecture asks (docs/ARCHITECTURE.md, "Règles transverses").
 */
export const SUN_CONFIG = Object.freeze({
  /**
   * The sun's centre is this many degrees from the zenith at sunrise and sunset: 90° plus 50' (the
   * standard refraction of 34' and the sun's radius of 16'), NOAA's and almanacs' convention.
   */
  sunriseZenithDegrees: 90.833,
  /** Civil dawn and dusk: the sun's centre 6° under the horizon. */
  civilZenithDegrees: 96,
  /**
   * The sun's position is evaluated at the hour of the event; each pass puts the event closer to
   * that hour. Two passes bring it within a second of the converged value.
   */
  refinementPasses: 2,
  /**
   * Without a known time zone, the place is estimated from the UTC offset (15° of longitude per
   * hour) at this latitude: 30° N, where most people live, and near the latitude of Mecca, Cairo
   * and Delhi (owner's design, 27 November 2026).
   */
  fallbackLatitude: 30,
  /** The UTC offsets clocks use: from 12 hours west (Baker Island) to 14 east (Kiribati). */
  minimumUtcOffsetMinutes: -12 * 60,
  maximumUtcOffsetMinutes: 14 * 60,
});
