/**
 * Shared activity photo cache so the first photo on the activity card (ActivityImage)
 * and the first photo in ActivityPhotoCarousel are always the same, and we avoid
 * duplicate Google Place Details / Unsplash API calls.
 */

import type { UnsplashImageWithAttribution } from '../types/unsplash.types';

// Place types that should prioritize Unsplash (landmarks & attractions)
const UNSPLASH_PRIORITY_TYPES = [
  'tourist_attraction',
  'monument',
  'landmark',
  'museum',
  'art_gallery',
  'park',
  'national_park',
  'natural_feature',
  'stadium',
  'zoo',
  'aquarium',
  'historical_landmark',
  'point_of_interest',
  'place_of_worship',
  'church',
  'mosque',
  'temple',
  'synagogue',
];

// Place types that should prioritize Google Places (local businesses)
const GOOGLE_PLACES_PRIORITY_TYPES = [
  'restaurant',
  'bar',
  'night_club',
  'cafe',
  'bakery',
  'meal_takeaway',
  'meal_delivery',
  'food',
  'store',
  'shopping_mall',
  'clothing_store',
  'shoe_store',
  'jewelry_store',
  'book_store',
  'lodging',
  'hotel',
  'spa',
  'hair_care',
  'beauty_salon',
];

export function shouldUseUnsplashFirst(primaryType?: string, types?: string[]): boolean {
  const typesToCheck: string[] = [];
  if (primaryType) typesToCheck.push(primaryType);
  if (types?.length) typesToCheck.push(...types);
  if (typesToCheck.length === 0) return true;

  const normalized = typesToCheck.map(t => t.toLowerCase().replace(/\s+/g, '_'));
  const isLocalBusiness = normalized.some(n =>
    GOOGLE_PLACES_PRIORITY_TYPES.some(b => n.includes(b))
  );
  if (isLocalBusiness) return false;
  const isLandmark = normalized.some(n =>
    UNSPLASH_PRIORITY_TYPES.some(l => n.includes(l))
  );
  if (isLandmark) return true;
  return true;
}

export type FirstPhotoSource = 'unsplash' | 'google';

export interface CachedFirstPhoto {
  source: FirstPhotoSource;
  /** Resolved URL for display (thumbnail and carousel first slide). */
  url: string;
  /** Google only: photo_reference used to resolve url (for carousel slides 2–5). */
  photoReference?: string;
  place_id?: string;
  /** Unsplash only: attribution for first photo. */
  attribution?: UnsplashImageWithAttribution['attribution'];
}

/** Cached Google Place Details photos (photo_references) so we don't call Place Details twice. */
export interface CachedGoogleRefs {
  place_id: string;
  photoReferences: string[];
}

/** Cached Unsplash result (up to 5) so thumbnail and carousel use same first and no duplicate call. */
export interface CachedUnsplashPhotos {
  query: string;
  photos: UnsplashImageWithAttribution[];
}

const firstPhotoByKey = new Map<string, CachedFirstPhoto>();
const googleRefsByPlaceId = new Map<string, string[]>();
const unsplashByQuery = new Map<string, UnsplashImageWithAttribution[]>();

function cacheKey(place_id?: string, activityName?: string): string {
  return place_id || activityName || '';
}

export function getCachedFirstPhoto(place_id?: string, activityName?: string): CachedFirstPhoto | null {
  const key = cacheKey(place_id, activityName);
  return key ? firstPhotoByKey.get(key) ?? null : null;
}

export function setCachedFirstPhoto(
  place_id: string | undefined,
  activityName: string | undefined,
  data: CachedFirstPhoto
): void {
  const key = cacheKey(place_id, activityName);
  if (key) firstPhotoByKey.set(key, data);
}

export function clearCachedFirstPhoto(place_id?: string, activityName?: string): void {
  const key = cacheKey(place_id, activityName);
  if (key) firstPhotoByKey.delete(key);
}

export function getCachedGoogleRefs(place_id: string): string[] | null {
  return googleRefsByPlaceId.get(place_id) ?? null;
}

export function setCachedGoogleRefs(place_id: string, photoReferences: string[]): void {
  googleRefsByPlaceId.set(place_id, photoReferences);
}

export function getCachedUnsplashPhotos(query: string): UnsplashImageWithAttribution[] | null {
  return unsplashByQuery.get(query) ?? null;
}

export function setCachedUnsplashPhotos(query: string, photos: UnsplashImageWithAttribution[]): void {
  if (photos.length > 0) unsplashByQuery.set(query, photos);
}
