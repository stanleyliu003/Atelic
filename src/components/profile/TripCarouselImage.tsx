import React, { useState, useEffect } from 'react';
import { Image, View, ActivityIndicator, StyleSheet } from 'react-native';
import { GOOGLE_PLACES_API_KEY, UNSPLASH_ACCESS_KEY } from '../../constants/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors } from '../../../constants/Colors';

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
}

// Cache to store fetched Unsplash photos by city name
const unsplashCache: { [cityName: string]: string[] } = {};

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
  onPhotoRefUpdate
}: TripCarouselImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  // Reset state when props change
  useEffect(() => {
    setHasAttemptedFetch(false);
    setImageError(false);
    setIsLoading(true);
    fetchImage();
  }, [cityName, photo_reference, place_id, photoIndex]);

  const fetchImage = async () => {
    if (hasAttemptedFetch) return;

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
        console.log(`[TripCarouselImage] Using cached Unsplash image ${index} for: ${query}`);
        return photoUrl;
      }

      // Search for city landscape/skyline photos - fetch 5 different photos
      const searchQuery = `${query} city skyline landmark`;
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;

      console.log(`[TripCarouselImage] Fetching 5 Unsplash images for: ${query}`);

      const response = await fetch(url);

      if (!response.ok) {
        console.error('[TripCarouselImage] Unsplash API error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        // Store all photo URLs in cache
        const photoUrls = data.results.map((photo: any) => photo.urls.regular);
        unsplashCache[query] = photoUrls;

        console.log(`[TripCarouselImage] Successfully fetched ${photoUrls.length} Unsplash images for: ${query}`);

        // Return the photo at the given index (with wrapping)
        return photoUrls[index % photoUrls.length];
      }

      console.log(`[TripCarouselImage] No Unsplash results for: ${query}`);
      return null;
    } catch (error) {
      console.error('[TripCarouselImage] Error fetching Unsplash images:', error);
      return null;
    }
  };

  const fetchGooglePlacesPhoto = async () => {
    // If we already have a photo_reference, use it directly (don't refetch)
    // This is important for activity carousels where each item has a specific photo
    if (photo_reference) {
      console.log(`[TripCarouselImage] Using provided photo_reference directly`);
      const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
      setImageUrl(photoUrl);
      setImageError(false);
      return;
    }

    // Only fetch from API if we don't have a photo_reference but have a place_id
    // This is useful for city carousels or when we need to refresh expired photos
    if (place_id) {
      try {
        console.log(`[TripCarouselImage] Fetching Google Places photo for place_id: ${place_id}`);

        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.result?.photos?.[0]) {
          const photoRef = data.result.photos[0].photo_reference;
          const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;

          console.log(`[TripCarouselImage] Successfully fetched Google Places photo`);
          setImageUrl(photoUrl);
          setImageError(false);

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
      resizeMode="cover"
      onError={() => {
        console.log('[TripCarouselImage] Image failed to load');
        setImageError(true);
        if (onPhotoRefUpdate) {
          onPhotoRefUpdate(null);
        }
      }}
      onLoad={() => {
        // Successfully loaded
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
