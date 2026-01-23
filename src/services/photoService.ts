import { API, graphqlOperation } from 'aws-amplify';
import { GOOGLE_PLACES_API_KEY } from '../constants/api';

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
 * @returns Photo URL (CloudFront cached or Google fallback)
 */
export async function getPhotoUrl(
    placeId: string,
    photoReference: string,
    maxWidth: number = 400
): Promise<string> {
    // Check session cache first (avoid Lambda call for same photo in same session)
    // Include photoReference in cache key to support multiple photos per place
    const cacheKey = `${placeId}_${photoReference}_${maxWidth}`;
    if (sessionCache.has(cacheKey)) {
        return sessionCache.get(cacheKey)!;
    }

    try {
        // Call Lambda to get cached URL or fetch new one
        const result = await API.graphql(graphqlOperation(`
            query GetPlacePhoto($placeId: String!, $photoReference: String!, $maxWidth: Int) {
                getPlacePhoto(placeId: $placeId, photoReference: $photoReference, maxWidth: $maxWidth) {
                    photoUrl
                    cached
                    fallback
                }
            }
        `, {
            placeId,
            photoReference,
            maxWidth
        })) as { data: { getPlacePhoto: PhotoResult } };

        const photoUrl = result.data.getPlacePhoto.photoUrl;

        if (photoUrl) {
            // Store in session cache
            sessionCache.set(cacheKey, photoUrl);
            return photoUrl;
        }

        // If no URL returned, fall back to Google
        throw new Error('No photo URL returned from Lambda');
    } catch (error) {
        console.warn('[photoService] Failed to get cached photo, falling back to Google URL:', error);

        // Fallback to direct Google URL
        const fallbackUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;

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
