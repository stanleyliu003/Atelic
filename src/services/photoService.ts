import { API, graphqlOperation } from 'aws-amplify';
import { buildDirectPhotoUrl } from '../utils/googlePhotoUtils';

interface PhotoResult {
    photoUrl: string;
    cached: boolean;
    fallback?: boolean;
}

// In-memory cache for current session to avoid redundant Lambda calls
const sessionCache = new Map<string, string>();

/**
 * Get photo URL for a place - uses S3/CloudFront cache when available
 * Falls back to direct Google URL if Lambda fails
 *
 * @param placeId - Google place_id
 * @param photoReference - Google photo_reference
 * @param maxWidth - Max width of photo (default 400)
 * @param forceRefresh - Skip DynamoDB cache and re-fetch from Google (for expired photos)
 * @returns Photo URL (CloudFront cached or Google fallback)
 */
export async function getPhotoUrl(
    placeId: string,
    photoReference: string,
    maxWidth: number = 400,
    forceRefresh: boolean = false
): Promise<string> {
    // Check session cache first (avoid Lambda call for same photo in same session)
    // Skip session cache when forceRefresh is true (photo was expired)
    const cacheKey = `${placeId}_${photoReference}_${maxWidth}`;
    if (!forceRefresh && sessionCache.has(cacheKey)) {
        return sessionCache.get(cacheKey)!;
    }

    try {
        // Call Lambda to get cached URL or fetch new one
        const result = await API.graphql(graphqlOperation(`
            query GetPlacePhoto($placeId: String!, $photoReference: String!, $maxWidth: Int, $forceRefresh: Boolean) {
                getPlacePhoto(placeId: $placeId, photoReference: $photoReference, maxWidth: $maxWidth, forceRefresh: $forceRefresh) {
                    photoUrl
                    cached
                    fallback
                }
            }
        `, {
            placeId,
            photoReference,
            maxWidth,
            forceRefresh
        })) as { data: { getPlacePhoto: PhotoResult } };

        const photoResult = result.data.getPlacePhoto;
        const photoUrl = photoResult.photoUrl;

        if (photoUrl) {
            // Store in session cache
            sessionCache.set(cacheKey, photoUrl);
            return photoUrl;
        }

        // If no URL returned, fall back to Google
        throw new Error('No photo URL returned from Lambda');
    } catch (error) {
        console.warn('[photoService] Failed to get cached photo, falling back to Google URL:', error);

        // Fallback to direct Google URL (supports both legacy and new photo ref formats)
        const fallbackUrl = buildDirectPhotoUrl(photoReference, maxWidth);

        // Cache the fallback URL too to avoid repeated failures
        sessionCache.set(cacheKey, fallbackUrl);

        return fallbackUrl;
    }
}

/**
 * Preload photos for a list of activities (call when loading trip data)
 * This warms the cache for better UX
 *
 * @param activities - Array of activities with place_id and photo_reference
 */
export async function preloadPhotos(
    activities: Array<{ place_id?: string; photo_reference?: string }>
): Promise<void> {
    const promises = activities
        .filter(a => a.place_id && a.photo_reference)
        .slice(0, 10) // Limit to first 10 to avoid overwhelming Lambda
        .map(a => getPhotoUrl(a.place_id!, a.photo_reference!, 400).catch(() => null));

    await Promise.all(promises);
}

/**
 * Clear session cache (call on logout or memory pressure)
 */
export function clearPhotoCache(): void {
    sessionCache.clear();
}

/**
 * Invalidate cached photo entries for a specific place.
 * Removes all session cache entries whose key starts with the given placeId.
 * Call this when a cached photo URL is discovered to be expired/broken.
 *
 * @param placeId - Google place_id to invalidate
 */
export function invalidateCacheForPlace(placeId: string): void {
    const keysToDelete: string[] = [];
    for (const key of sessionCache.keys()) {
        if (key.startsWith(`${placeId}_`)) {
            keysToDelete.push(key);
        }
    }
    for (const key of keysToDelete) {
        sessionCache.delete(key);
    }
}

/**
 * Check if a photo is already cached in this session
 * Useful for determining if we need to show a loading state
 *
 * @param placeId - Google place_id
 * @param maxWidth - Max width of photo
 * @returns boolean indicating if cached
 */
export function isPhotoCached(placeId: string, maxWidth: number = 400): boolean {
    const cacheKey = `${placeId}_${maxWidth}`;
    return sessionCache.has(cacheKey);
}

/**
 * Get cached photo URL synchronously if available
 * Returns null if not cached (caller should use getPhotoUrl for async fetch)
 *
 * @param placeId - Google place_id
 * @param maxWidth - Max width of photo
 * @returns Cached URL or null
 */
export function getCachedPhotoUrl(placeId: string, maxWidth: number = 400): string | null {
    const cacheKey = `${placeId}_${maxWidth}`;
    return sessionCache.get(cacheKey) || null;
}
