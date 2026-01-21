import React, { useState, useEffect } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { GOOGLE_PLACES_API_KEY, UNSPLASH_ACCESS_KEY } from '../../../constants/api';

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

    useEffect(() => {
        fetchPhoto();
    }, [activityName, photo_reference, place_id]);

    // Check if image is in expo-image disk cache and log for verification
    // This hook must be at the top level, not inside conditional returns
    useEffect(() => {
        const checkCacheStatus = async () => {
            if (imageUrl && imageUrl.includes('googleapis.com')) {
                try {
                    const cachePath = await Image.getCachePathAsync(imageUrl);
                    // if (cachePath) {
                    //     console.log(`[ActivityImage] ✅ CACHE HIT - Google image loaded from disk cache: ${cachePath}`);
                    // } else {
                    //     console.log(`[ActivityImage] ❌ CACHE MISS - Google image will be fetched from network: ${imageUrl.substring(0, 80)}...`);
                    // }
                } catch (error) {
                    console.log(`[ActivityImage] Cache check error:`, error);
                }
            }
        };
        checkCacheStatus();
    }, [imageUrl]);

    const fetchPhoto = async () => {
        try {
            setIsLoading(true);
            setImageError(false);

            // Generate cache key - prefer place_id, fallback to activityName
            const cacheKey = place_id || activityName || '';

            // Check cache first
            if (cacheKey && thumbnailCache[cacheKey]) {
                const cached = thumbnailCache[cacheKey];
                // console.log(`[ActivityImage] Using cached ${cached.source} thumbnail for: ${cacheKey}`);
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
                const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.status === 'OK' && data.result?.photos?.[0]) {
                    const photoRef = data.result.photos[0].photo_reference;
                    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;
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

        // Fallback to existing photo_reference
        if (photo_reference) {
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
            setImageUrl(photoUrl);

            // Cache the result
            if (cacheKey) {
                thumbnailCache[cacheKey] = { url: photoUrl, source: 'google', photoReference: photo_reference };
            }
        } else {
            setImageError(true);
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
                // If image fails to load, show error
                setImageError(true);
            }}
        />
    );
}
