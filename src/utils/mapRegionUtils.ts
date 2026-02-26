import { Region } from 'react-native-maps';

interface RegionOptions {
  /** Multiplier applied to the bounding-box span (e.g. 1.7 adds 70% padding). Default: 1.7 */
  paddingMultiplier?: number;
  /** latitudeDelta / longitudeDelta used when there is only one coordinate. Default: 0.05 */
  singleDelta?: number;
  /** Minimum latitudeDelta / longitudeDelta to prevent over-zooming. Default: 0.01 */
  minDelta?: number;
  /**
   * Fraction of latDelta to shift the center latitude southward.
   * Useful when a UI panel covers the bottom portion of the map — pass
   * (panelHeightFraction / divisor) so the bounding box appears centred
   * in the visible area rather than the full viewport.
   * Default: 0 (no shift).
   */
  yOffsetFraction?: number;
}

/**
 * Returns a MapView Region that fits all supplied coordinates with optional
 * padding and a vertical centre offset to compensate for overlapping UI panels.
 *
 * Returns null when the coordinate list is empty or all coords are invalid.
 */
export function getRegionForCoordinates(
  coords: Array<{ lat: number; lng: number }>,
  options?: RegionOptions,
): Region | null {
  const {
    paddingMultiplier = 1.7,
    singleDelta = 0.05,
    minDelta = 0.01,
    yOffsetFraction = 0,
  } = options ?? {};

  const valid = coords.filter(c => c.lat != null && c.lng != null);
  if (valid.length === 0) return null;

  if (valid.length === 1) {
    return {
      latitude: valid[0].lat - singleDelta * yOffsetFraction,
      longitude: valid[0].lng,
      latitudeDelta: singleDelta,
      longitudeDelta: singleDelta,
    };
  }

  const lats = valid.map(c => c.lat);
  const lngs = valid.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latDelta = Math.max((maxLat - minLat) * paddingMultiplier, minDelta);
  const lngDelta = Math.max((maxLng - minLng) * paddingMultiplier, minDelta);

  return {
    latitude: (minLat + maxLat) / 2 - latDelta * yOffsetFraction,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}
