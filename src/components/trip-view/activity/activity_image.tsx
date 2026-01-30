import { useState, useEffect, useRef } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { GOOGLE_PLACES_API_KEY, UNSPLASH_ACCESS_KEY } from '../../../constants/api';
import { getPhotoUrl as getCachedPhotoUrl, invalidateCacheForPlace } from '../../../services/photoService';

// expo-image blurhash placeholder for smooth loading
const PLACEHOLDER_BLURHASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6telebu~qayj[j[fQayWBofofayayayj[fQj[ayayj[ayfjj[ay';

interface ActivityImageProps {
    photo_reference: string;
    place_id?: string;
    style: any;
    onPhotoRefUpdate?: (newPhotoRef: string) => void;
    activityName?: string;
    primaryType?: string;
    types?: string[];
}

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

// Module-level cache for thumbnail URLs to prevent re-fetching
// Keyed by place_id (preferred) or activityName as fallback
interface ThumbnailCacheEntry {
  url: string;
  source: 'unsplash' | 'google';
  photoReference?: string; // Store for onPhotoRefUpdate callback
}
const thumbnailCache: { [key: string]: ThumbnailCacheEntry } = {};

// Helper function to determine if we should use Unsplash first
const shouldUseUnsplashFirst = (primaryType?: string, types?: string[]): boolean => {
  // Collect all types to check
  const typesToCheck: string[] = [];

  if (primaryType) {
    typesToCheck.push(primaryType);
  }

  if (types && types.length > 0) {
    typesToCheck.push(...types);
  }

  // If no types available, default to Unsplash
  if (typesToCheck.length === 0) {
    return true;
  }

  // Normalize all types
  const normalizedTypes = typesToCheck.map(t => t.toLowerCase().replace(/\s+/g, '_'));

  // Check if ANY type matches local business patterns (Google Places first)
  const isLocalBusiness = normalizedTypes.some(normalizedType =>
    GOOGLE_PLACES_PRIORITY_TYPES.some(businessType => normalizedType.includes(businessType))
  );

  if (isLocalBusiness) {
    return false; // Use Google Places first
  }

  // Check if ANY type matches landmark patterns (Unsplash first)
  const isLandmark = normalizedTypes.some(normalizedType =>
    UNSPLASH_PRIORITY_TYPES.some(landmarkType => normalizedType.includes(landmarkType))
  );

  if (isLandmark) {
    return true; // Use Unsplash first
  }

  // Default to Unsplash for other types
  return true;
};

/**
 * ActivityImage Component
 *
 * Displays activity thumbnail using the same photo prioritization logic as ActivityPhotoCarousel.
 * Shows the first photo from whatever source the carousel would use.
 */
export function ActivityImage({ photo_reference, place_id, style, onPhotoRefUpdate, activityName, primaryType, types }: ActivityImageProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const retryCountRef = useRef(0);

    useEffect(() => {
        fetchPhoto();
    }, [activityName, photo_reference, place_id]);

    const fetchPhoto = async () => {
        try {
            setIsLoading(true);
            setImageError(false);
            retryCountRef.current = 0;

            // Generate cache key - prefer place_id, fallback to activityName
            const cacheKey = place_id || activityName || '';

            // Check cache first
            if (cacheKey && thumbnailCache[cacheKey]) {
                const cached = thumbnailCache[cacheKey];
                setImageUrl(cached.url);

                // Trigger onPhotoRefUpdate callback if we have a cached photo reference
                if (cached.photoReference && onPhotoRefUpdate) {
                    onPhotoRefUpdate(cached.photoReference);
                }
                setIsLoading(false);
                return;
            }

            const useUnsplashFirst = shouldUseUnsplashFirst(primaryType, types);

            if (useUnsplashFirst) {
                // For landmarks & attractions: Try Unsplash first
                const unsplashUrl = await fetchUnsplashImage(activityName || '');

                if (unsplashUrl) {
                    setImageUrl(unsplashUrl);
                    // Cache the result
                    if (cacheKey) {
                        thumbnailCache[cacheKey] = { url: unsplashUrl, source: 'unsplash' };
                    }
                    setIsLoading(false);
                    return;
                }

                // Fallback to Google Places
                await fetchGooglePlacesPhoto(cacheKey);
            } else {
                // For local businesses: Use Google Places first
                const hasGooglePhoto = !!photo_reference;

                if (hasGooglePhoto) {
                    await fetchGooglePlacesPhoto(cacheKey);
                } else {
                    // No Google Places photos available, fallback to Unsplash
                    const unsplashUrl = await fetchUnsplashImage(activityName || '');
                    if (unsplashUrl) {
                        setImageUrl(unsplashUrl);
                        // Cache the result
                        if (cacheKey) {
                            thumbnailCache[cacheKey] = { url: unsplashUrl, source: 'unsplash' };
                        }
                    } else {
                        setImageError(true);
                    }
                }
            }
        } catch (error) {
            console.error('[ActivityImage] Error fetching photo:', error);
            const cacheKey = place_id || activityName || '';
            await fetchGooglePlacesPhoto(cacheKey);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUnsplashImage = async (query: string): Promise<string | null> => {
        if (!query) return null;

        try {
            const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=${UNSPLASH_ACCESS_KEY}`;
            const response = await fetch(url);

            if (!response.ok) {
                return null;
            }

            const data = await response.json();

            if (data.results && data.results.length > 0) {
                // Use small size for thumbnails (~400px)
                return data.results[0].urls.small;
            }

            return null;
        } catch (error) {
            console.error('[ActivityImage] Error fetching Unsplash image:', error);
            return null;
        }
    };

    const fetchGooglePlacesPhoto = async (cacheKey: string) => {
        // Try to fetch from Google Places API if we have place_id
        if (place_id) {
            try {
                // If we have a photo_reference, use the S3/CloudFront cached photo service
                if (photo_reference) {
                    const photoUrl = await getCachedPhotoUrl(place_id, photo_reference, 400);
                    setImageUrl(photoUrl);

                    // Cache the result in session
                    if (cacheKey) {
                        thumbnailCache[cacheKey] = { url: photoUrl, source: 'google', photoReference: photo_reference };
                    }

                    // Notify parent of photo reference
                    if (onPhotoRefUpdate) {
                        onPhotoRefUpdate(photo_reference);
                    }
                    return;
                }

                // No photo_reference - fetch place details to get one (ID Only SKU - free)
                const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.status === 'OK' && data.result?.photos?.[0]) {
                    const photoRef = data.result.photos[0].photo_reference;
                    // Use the S3/CloudFront cached photo service
                    const photoUrl = await getCachedPhotoUrl(place_id, photoRef, 400);
                    setImageUrl(photoUrl);

                    // Cache the result
                    if (cacheKey) {
                        thumbnailCache[cacheKey] = { url: photoUrl, source: 'google', photoReference: photoRef };
                    }

                    // Notify parent of updated photo reference
                    if (onPhotoRefUpdate) {
                        onPhotoRefUpdate(photoRef);
                    }
                    return;
                }
            } catch (error) {
                console.error('[ActivityImage] Error fetching Google Places photo:', error);
            }
        }

        // Fallback to existing photo_reference with cached service
        if (photo_reference && place_id) {
            try {
                const photoUrl = await getCachedPhotoUrl(place_id, photo_reference, 400);
                setImageUrl(photoUrl);

                // Cache the result
                if (cacheKey) {
                    thumbnailCache[cacheKey] = { url: photoUrl, source: 'google', photoReference: photo_reference };
                }
            } catch (error) {
                console.error('[ActivityImage] Error with cached photo service, using direct URL:', error);
                // Final fallback to direct Google URL
                const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
                setImageUrl(photoUrl);

                if (cacheKey) {
                    thumbnailCache[cacheKey] = { url: photoUrl, source: 'google', photoReference: photo_reference };
                }
            }
        } else if (photo_reference) {
            // No place_id, use direct Google URL as fallback
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
            setImageUrl(photoUrl);

            if (cacheKey) {
                thumbnailCache[cacheKey] = { url: photoUrl, source: 'google', photoReference: photo_reference };
            }
        } else {
            setImageError(true);
        }
    };

    const handleImageError = async () => {
        // Only retry once to prevent infinite loops
        if (retryCountRef.current >= 1) {
            setImageError(true);
            return;
        }

        // Only retry for Google-sourced images (not Unsplash)
        const cacheKey = place_id || activityName || '';
        const cachedEntry = cacheKey ? thumbnailCache[cacheKey] : null;

        if (cachedEntry && cachedEntry.source === 'unsplash') {
            setImageError(true);
            return;
        }

        // Need a place_id to fetch a fresh photo_reference
        if (!place_id) {
            setImageError(true);
            return;
        }

        retryCountRef.current += 1;
        setIsLoading(true);
        setImageError(false);

        try {
            // Clear stale URL from both caches
            if (cacheKey) {
                delete thumbnailCache[cacheKey];
            }
            invalidateCacheForPlace(place_id);

            // Fetch a fresh photo_reference from Google Places Details API (ID Only SKU - free)
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;
            const response = await fetch(detailsUrl);
            const data = await response.json();

            if (data.status === 'OK' && data.result?.photos?.[0]) {
                const freshPhotoRef = data.result.photos[0].photo_reference;

                // Re-call Lambda with fresh photo_reference and forceRefresh to bypass stale DynamoDB cache
                const freshPhotoUrl = await getCachedPhotoUrl(place_id, freshPhotoRef, 400, true);

                // Append cache-busting query param so expo-image doesn't serve
                // the broken image from its disk cache (same CloudFront URL = same cache key)
                const cacheBustedUrl = `${freshPhotoUrl}${freshPhotoUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

                setImageUrl(cacheBustedUrl);
                if (cacheKey) {
                    thumbnailCache[cacheKey] = {
                        url: cacheBustedUrl,
                        source: 'google',
                        photoReference: freshPhotoRef,
                    };
                }

                if (onPhotoRefUpdate) {
                    onPhotoRefUpdate(freshPhotoRef);
                }
            } else {
                setImageError(true);
            }
        } catch (error) {
            console.error('[ActivityImage] Retry failed:', error);
            setImageError(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Show loading state
    if (isLoading) {
        return (
            <View style={[style, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="small" color="#999" />
            </View>
        );
    }

    // Show error message if no image available
    if (imageError || !imageUrl) {
        return (
            <View style={[style, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
                    Image{'\n'}Unavailable
                </Text>
            </View>
        );
    }

    return (
        <Image
            style={style}
            source={{ uri: imageUrl }}
            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
            onError={() => {
                handleImageError();
            }}
        />
    );
}
