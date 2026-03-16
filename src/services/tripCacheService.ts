import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@atelic/trip_cache/';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  trip: any;
  cachedAt: number;
}

/**
 * Returns cached trip data if it exists and is within the TTL window.
 * Returns null on cache miss, expiry, or any error.
 */
export const getCachedTrip = async (tripId: string): Promise<any | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + tripId);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
    return entry.trip;
  } catch {
    return null;
  }
};

/**
 * Writes trip data to AsyncStorage cache. Non-critical — errors are silently ignored.
 */
export const setCachedTrip = async (tripId: string, trip: any): Promise<void> => {
  try {
    const entry: CacheEntry = { trip, cachedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_PREFIX + tripId, JSON.stringify(entry));
  } catch {
    // Cache write failures are non-critical
  }
};
