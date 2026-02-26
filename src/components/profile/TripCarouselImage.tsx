import React, { useState, useEffect, memo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { UNSPLASH_ACCESS_KEY } from '../../constants/api';
import { buildDirectPhotoUrl, fetchPhotoRefs } from '../../utils/googlePhotoUtils';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors } from '../../../constants/Colors';
import { getPhotoUrl as getCachedPhotoUrl } from '../../services/photoService';

// expo-image blurhash placeholder for smooth loading
const PLACEHOLDER_BLURHASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6telebu~qayj[j[fQayWBofofayayayj[fQj[ayayj[ayfjj[ay';
import { UnsplashImageWithAttribution } from '../../types/unsplash.types';
import UnsplashInfoButton from '../common/UnsplashInfoButton';

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

// Cache to store fetched Unsplash photos with attribution by city name
const unsplashCache: { [cityName: string]: UnsplashImageWithAttribution[] } = {};

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
function TripCarouselImageComponent({
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
  const [unsplashAttribution, setUnsplashAttribution] = useState<UnsplashImageWithAttribution | null>(null);

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
  // isUnsplashImage is derived from cityName and photo_reference — no need to list it separately
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityName, photo_reference, place_id, photoIndex, shouldLoad]);


  const fetchImage = async () => {
    try {
      setIsLoading(true);
      setHasAttemptedFetch(true);

      // Try Unsplash first if we have a city name
      if (cityName) {
        const unsplashData = await fetchUnsplashImages(cityName, photoIndex);
        if (unsplashData) {
          setImageUrl(unsplashData.imageUrl);
          setUnsplashAttribution(unsplashData);
          setImageError(false);
          setIsLoading(false);
          return;
        }
      }

      // Fallback to Google Places
      await fetchGooglePlacesPhoto();
    } catch (error) {
      console.error('[TripCarouselImage] ❌ Error fetching image:', error);
      await fetchGooglePlacesPhoto();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnsplashImages = async (query: string, index: number): Promise<UnsplashImageWithAttribution | null> => {
    try {
      // Check cache first
      if (unsplashCache[query] && unsplashCache[query].length > 0) {
        const photos = unsplashCache[query];
        const photoData = photos[index % photos.length];

        // Notify parent of the total photo count (only on first image)
        if (index === 0 && onPhotoCountUpdate) {
          onPhotoCountUpdate(photos.length);
        }

        return photoData;
      }

      if (!UNSPLASH_ACCESS_KEY) {
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

      // Collect photos from multiple search strategies to ensure we have at least 5
      let allPhotos: UnsplashImageWithAttribution[] = [];
      const seenUrls = new Set<string>();

      for (const searchQuery of searchStrategies) {
        // Stop if we already have 5+ unique photos
        if (allPhotos.length >= 5) break;

        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=10&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;

        try {
          const response = await fetch(url);

          if (!response.ok) {
            if (response.status === 403) {
              break; // Rate limit or invalid key - stop trying Unsplash
            }
            continue; // Try next strategy
          }

          const data = await response.json();

          if (data.results && data.results.length > 0) {
            // Extract photo data with attribution, avoiding duplicates
            for (const photo of data.results) {
              if (allPhotos.length >= 5) break;
              if (seenUrls.has(photo.urls.regular)) continue;

              seenUrls.add(photo.urls.regular);
              allPhotos.push({
                imageUrl: photo.urls.regular,
                attribution: {
                  photographerName: photo.user?.name || 'Unknown',
                  photographerProfileUrl: photo.user?.links?.html || 'https://unsplash.com',
                  photoPageUrl: photo.links?.html || 'https://unsplash.com',
                  downloadLocationUrl: photo.links?.download_location || '',
                }
              });
            }
          }
        } catch (error) {
          continue; // Try next strategy
        }
      }

      // If we found any photos, cache and return them
      if (allPhotos.length > 0) {
        unsplashCache[query] = allPhotos;

        // Notify parent of the total photo count (only on first image)
        if (index === 0 && onPhotoCountUpdate) {
          onPhotoCountUpdate(allPhotos.length);
        }

        // Return the photo at the given index (with wrapping)
        return allPhotos[index % allPhotos.length];
      }

      return null;
    } catch (error) {
      return null;
    }
  };

  const fetchGooglePlacesPhoto = async () => {
    const cacheKey = photo_reference || place_id || '';

    // Check session cache first
    if (cacheKey && googlePhotosCache[cacheKey]) {
      const cached = googlePhotosCache[cacheKey];
      setImageUrl(cached.url);
      setImageError(false);

      if (cached.photoReference && onPhotoRefUpdate) {
        onPhotoRefUpdate(cached.photoReference);
      }
      return;
    }

    // If we already have a photo_reference and place_id, use the S3/CloudFront cached service
    if (photo_reference && place_id) {
      try {
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
      const photoUrl = buildDirectPhotoUrl(photo_reference, 800);
      setImageUrl(photoUrl);
      setImageError(false);

      // Cache the result
      if (cacheKey) {
        googlePhotosCache[cacheKey] = { url: photoUrl, photoReference: photo_reference };
      }
      return;
    }

    // Only fetch from API if we don't have a photo_reference but have a place_id
    if (place_id) {
      try {
        // Fetch photo refs using New Places API (IDs Only = $0)
        const photoRefs = await fetchPhotoRefs(place_id);

        if (photoRefs.length > 0) {
          const photoRef = photoRefs[0];

          const photoUrl = await getCachedPhotoUrl(place_id, photoRef, 800);

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

  // If image is invalid and cannot be loaded, show a placeholder
  if (imageError || !imageUrl) {
    return (
      <View style={[styles.placeholderContainer, style]}>
        <FontAwesome name="image" size={40} color={Colors.GRAY} />
      </View>
    );
  }

  return (
    <View style={style}>
      <Image
        style={StyleSheet.absoluteFillObject}
        source={{ uri: imageUrl }}
        placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
        contentFit="cover"
        transition={200}
        cachePolicy="disk"
        resizeMode="cover"
        onError={() => {
          setImageError(true);
          if (onPhotoRefUpdate) {
            onPhotoRefUpdate(null);
          }
        }}
      />
      {unsplashAttribution && (
        <UnsplashInfoButton attribution={unsplashAttribution.attribution} />
      )}
    </View>
  );
}

export const TripCarouselImage = memo(TripCarouselImageComponent);

const styles = StyleSheet.create({
  placeholderContainer: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
