import { GOOGLE_PLACES_API_KEY } from '../constants/api';

/**
 * Detect if a photo_reference is in the New Places API resource name format.
 * New format: "places/ChIJ.../photos/AUc7tX..."
 * Legacy format: opaque string like "AUc7tXnT..."
 */
export function isNewApiPhotoRef(photoReference: string): boolean {
    return photoReference.startsWith('places/');
}

/**
 * Build a direct Google photo URL (for fallback when S3/CloudFront is unavailable).
 * Handles both legacy and new API photo reference formats.
 */
export function buildDirectPhotoUrl(photoReference: string, maxWidth: number): string {
    if (isNewApiPhotoRef(photoReference)) {
        return `https://places.googleapis.com/v1/${photoReference}/media?maxHeightPx=${maxWidth}&maxWidthPx=${maxWidth}&key=${GOOGLE_PLACES_API_KEY}`;
    }
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

/**
 * Fetch photo references for a place_id using the New Places API.
 * Returns up to 5 photo resource names (IDs Only SKU = $0).
 */
export async function fetchPhotoRefs(placeId: string): Promise<string[]> {
    try {
        const response = await fetch(
            `https://places.googleapis.com/v1/places/${placeId}`,
            {
                headers: {
                    'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                    'X-Goog-FieldMask': 'photos',
                },
            }
        );
        const data = await response.json();
        if (data.photos?.length > 0) {
            return data.photos.slice(0, 5).map((p: any) => p.name);
        }
    } catch (error) {
        console.error('[googlePhotoUtils] Error fetching photo refs:', error);
    }
    return [];
}
