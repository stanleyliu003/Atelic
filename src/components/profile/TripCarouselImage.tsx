import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { GOOGLE_PLACES_API_KEY, UNSPLASH_ACCESS_KEY } from '../../constants/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors } from '../../../constants/Colors';
import { getPhotoUrl as getCachedPhotoUrl } from '../../services/photoService';

// expo-image blurhash placeholder for smooth loading
const PLACEHOLDER_BLURHASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6telebu~qayj[j[fQayWBofofayayayj[fQj[ayayj[ayfjj[ay';

interface TripCarouselImageProps {
  photo_reference?: string | null;
  place_id?: string;
  cityName?: string;
  photoIndex?: number; // Index to determine which photo from the set to display
  style?: any;
  /**
   * Called when this image discovers a fresh or invalid photo_reference.
   * - Passes a non-empty string when a new valid photo_reference is fetched.
   * - Passes null when the image is definitively unusable (expired and cannot be refreshed).
   */
  onPhotoRefUpdate?: (newPhotoRef: string | null) => void;
  /**
   * Called when the component determines the total number of available photos for this city.
   * This allows the parent to render the correct number of pagination dots.
   */
  onPhotoCountUpdate?: (count: number) => void;
  /**
   * Controls whether this image should load. Used for lazy loading carousels.
   * When false, shows a placeholder instead of fetching the image.
   * Defaults to true for backward compatibility.
   */
  shouldLoad?: boolean;
}

// Cache to store fetched Unsplash photos by city name
const unsplashCache: { [cityName: string]: string[] } = {};

// Cache to store Google Places photo URLs by photo_reference or place_id
// This prevents re-fetching the same photo when navigating back to the list
interface GooglePhotosCacheEntry {
  url: string;
  photoReference?: string; // Store for onPhotoRefUpdate callback
}
const googlePhotosCache: { [key: string]: GooglePhotosCacheEntry } = {};

/**
 * TripCarouselImage Component
 *
 * Displays trip city photos from Unsplash API with fallback to Google Places.
 *
 * Features:
 * - Prioritizes Unsplash for beautiful city images
 * - Falls back to Google Places if Unsplash fails
 * - Shows loading state while fetching photos
 * - Automatically refreshes expired Google Places photos
 *
 * @param photo_reference - Current photo reference from Google Places (fallback)
 * @param place_id - Activity place_id to fetch fresh photo if needed
 * @param cityName - City name for Unsplash search
 * @param style - Image style
 * @param onPhotoRefUpdate - Optional callback when photo_reference is updated
 */
export function TripCarouselImage({
  photo_reference,
  place_id,
  cityName,
  photoIndex = 0,
  style,
  onPhotoRefUpdate,
  onPhotoCountUpdate,
  shouldLoad = true // Default to true for backward compatibility
}: TripCarouselImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  // Determine if this is an Unsplash-based image (free) or Google Places (costs money)
  // Unsplash is used when cityName is provided without a specific photo_reference
  const isUnsplashImage = !!cityName && !photo_reference;

  // Reset state when props change
  useEffect(() => {
    // If image is already loaded successfully, don't re-fetch
    if (imageUrl && !imageError) {
      return;
    }

    // Only apply lazy loading to Google Places images (they cost money)
    // Unsplash images are free, so always load them immediately
    if (!shouldLoad && !isUnsplashImage) {
      setIsLoading(false);
      return;
    }

    setHasAttemptedFetch(false);
    setImageError(false);
    setIsLoading(true);
    fetchImage();
  }, [cityName, photo_reference, place_id, photoIndex, shouldLoad, isUnsplashImage]);

  // Check if image is in expo-image disk cache and log for verification
  // This hook must be at the top level, not inside conditional returns
  useEffect(() => {
    const checkCacheStatus = async () => {
      if (imageUrl && imageUrl.includes('googleapis.com')) {
        try {
          const cachePath = await Image.getCachePathAsync(imageUrl);
          if (cachePath) {
            console.log(`[TripCarouselImage] ✅ CACHE HIT - Google image loaded from disk cache: ${cachePath}`);
          } else {
            console.log(`[TripCarouselImage] ❌ CACHE MISS - Google image will be fetched from network: ${imageUrl.substring(0, 80)}...`);
          }
        } catch (error) {
          console.log(`[TripCarouselImage] Cache check error:`, error);
        }
      }
    };
    checkCacheStatus();
  }, [imageUrl]);

  const fetchImage = async () => {
    // Note: hasAttemptedFetch guard removed - useEffect controls when to fetch
    // The guard was causing a race condition with async state updates

    try {
      setIsLoading(true);
      setHasAttemptedFetch(true);

      // Try Unsplash first if we have a city name
      if (cityName) {
        const unsplashUrl = await fetchUnsplashImages(cityName, photoIndex);
        if (unsplashUrl) {
          setImageUrl(unsplashUrl);
          setImageError(false);
          setIsLoading(false);
          return;
        }
      }

      // Fallback to Google Places
      await fetchGooglePlacesPhoto();
    } catch (error) {
      console.error('[TripCarouselImage] Error fetching image:', error);
      await fetchGooglePlacesPhoto();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnsplashImages = async (query: string, index: number): Promise<string | null> => {
    try {
      // Check cache first
      if (unsplashCache[query] && unsplashCache[query].length > 0) {
        // Return the photo at the given index (with wrapping)
        const photos = unsplashCache[query];
        const photoUrl = photos[index % photos.length];

        // Notify parent of the total photo count (only on first image)
        if (index === 0 && onPhotoCountUpdate) {
          onPhotoCountUpdate(photos.length);
        }

        return photoUrl;
      }

      if (!UNSPLASH_ACCESS_KEY) {
        console.error('[TripCarouselImage] UNSPLASH_ACCESS_KEY is not configured!');
        return null;
      }

      // Try multiple search strategies to maximize chances of finding photos
      // Remove country suffix (e.g., "Madrid, Spain" -> "Madrid")
      const cityNameOnly = query.split(',')[0].trim();
      
      const searchStrategies = [
        cityNameOnly, // Simple city name
        `${cityNameOnly} travel`, // Travel photos
        `${cityNameOnly} city`, // City photos
        `${query} landmark`, // Original query with landmark
      ];

      // Try each search strategy until we find results
      for (const searchQuery of searchStrategies) {
        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;
        
        try {
          const response = await fetch(url);

          if (!response.ok) {
            console.error('[TripCarouselImage] Unsplash API error:', response.status, response.statusText);
            continue; // Try next strategy
          }

          const data = await response.json();

          if (data.results && data.results.length > 0) {
            // Store all photo URLs in cache
            const photoUrls = data.results.map((photo: any) => photo.urls.regular);
            unsplashCache[query] = photoUrls;

            // Notify parent of the total photo count (only on first image)
            if (index === 0 && onPhotoCountUpdate) {
              onPhotoCountUpdate(photoUrls.length);
            }

            // Return the photo at the given index (with wrapping)
            return photoUrls[index % photoUrls.length];
          }
        } catch (error) {
          console.error(`[TripCarouselImage] Error with search "${searchQuery}":`, error);
          continue; // Try next strategy
        }
      }

      return null;
    } catch (error) {
      console.error('[TripCarouselImage] Error fetching Unsplash images:', error);
      return null;
    }
  };

  const fetchGooglePlacesPhoto = async () => {
    // Generate cache key - prefer photo_reference, fallback to place_id
    const cacheKey = photo_reference || place_id || '';

    // Check session cache first
    if (cacheKey && googlePhotosCache[cacheKey]) {
      const cached = googlePhotosCache[cacheKey];
      console.log(`[TripCarouselImage] Using cached Google Places photo for: ${cacheKey}`);
      setImageUrl(cached.url);
      setImageError(false);

      // Trigger onPhotoRefUpdate callback if we have a cached photo reference
      if (cached.photoReference && onPhotoRefUpdate) {
        onPhotoRefUpdate(cached.photoReference);
      }
      return;
    }

    // If we already have a photo_reference and place_id, use the S3/CloudFront cached service
    if (photo_reference && place_id) {
      try {
        console.log(`[TripCarouselImage] Using cached photo service for: ${place_id}`);
        const photoUrl = await getCachedPhotoUrl(place_id, photo_reference, 800);
        setImageUrl(photoUrl);
        setImageError(false);

        // Cache the result in session
        if (cacheKey) {
          googlePhotosCache[cacheKey] = { url: photoUrl, photoReference: photo_reference };
        }
        return;
      } catch (error) {
        console.error('[TripCarouselImage] Error with cached photo service:', error);
        // Fall through to direct URL fallback
      }
    }

    // Fallback: If we have photo_reference but no place_id, use direct Google URL
    if (photo_reference) {
      console.log(`[TripCarouselImage] Using direct Google URL (no place_id for caching)`);
      const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
      setImageUrl(photoUrl);
      setImageError(false);

      // Cache the result
      if (cacheKey) {
        googlePhotosCache[cacheKey] = { url: photoUrl, photoReference: photo_reference };
      }
      return;
    }

    // Only fetch from API if we don't have a photo_reference but have a place_id
    // This is useful for city carousels or when we need to refresh expired photos
    if (place_id) {
      try {
        console.log(`[TripCarouselImage] Fetching Google Places photo for place_id: ${place_id}`);

        // Fetch place details to get photo_reference (ID Only SKU - free)
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.result?.photos?.[0]) {
          const photoRef = data.result.photos[0].photo_reference;

          // Use S3/CloudFront cached service
          const photoUrl = await getCachedPhotoUrl(place_id, photoRef, 800);

          console.log(`[TripCarouselImage] Successfully fetched Google Places photo`);
          setImageUrl(photoUrl);
          setImageError(false);

          // Cache the result (cache by both place_id and the new photo_reference)
          googlePhotosCache[place_id] = { url: photoUrl, photoReference: photoRef };
          googlePhotosCache[photoRef] = { url: photoUrl, photoReference: photoRef };

          // Notify parent of updated photo reference
          if (onPhotoRefUpdate) {
            onPhotoRefUpdate(photoRef);
          }
          return;
        }
      } catch (error) {
        console.error('[TripCarouselImage] Error fetching Google Places photo:', error);
      }
    }

    // No photo available
    console.log('[TripCarouselImage] No photo available');
    setImageError(true);
    if (onPhotoRefUpdate) {
      onPhotoRefUpdate(null);
    }
  };

  // Show placeholder when lazy loading is deferred (shouldLoad is false)
  // Only for Google Places images - Unsplash images always load immediately
  if (!shouldLoad && !isUnsplashImage) {
    return (
      <View style={[styles.placeholderContainer, style]}>
        <FontAwesome name="image" size={40} color={Colors.GRAY} />
      </View>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <View style={[styles.placeholderContainer, style]}>
        <ActivityIndicator size="large" color={Colors.PRIMARY} />
      </View>
    );
  }

  // If image is invalid and cannot be loaded, return null
  if (imageError || !imageUrl) {
    return null;
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
        console.log('[TripCarouselImage] Image failed to load');
        setImageError(true);
        if (onPhotoRefUpdate) {
          onPhotoRefUpdate(null);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
