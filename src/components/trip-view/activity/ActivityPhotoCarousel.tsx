import React, { useState, useEffect } from 'react';
import { View, Image, Dimensions, ActivityIndicator, StyleSheet } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { Activity } from '../../../types/activity.types';
import { Colors } from '../../../../constants/Colors';
import { TripCarouselImage } from '../../profile/TripCarouselImage';
import { GOOGLE_PLACES_API_KEY, UNSPLASH_ACCESS_KEY } from '../../../constants/api';

interface ActivityPhotoCarouselProps {
  activity: Activity;
  height?: number;
}

interface PhotoData {
  photo_reference: string;
  place_id: string;
}

interface UnsplashPhoto {
  urls: {
    regular: string;
    small: string;
    thumb: string;
  };
  id: string;
}

interface UnsplashResponse {
  results: UnsplashPhoto[];
  total: number;
}

// Unsplash API configuration
const UNSPLASH_API_BASE = 'https://api.unsplash.com';

// Cache to store Google Places photo references by place_id
// Stores arrays of up to 5 photo_reference strings per place
const googlePhotosCache: { [place_id: string]: string[] } = {};

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

export function ActivityPhotoCarousel({ activity, height = 250 }: ActivityPhotoCarouselProps) {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [unsplashUrls, setUnsplashUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const width = Dimensions.get('window').width - 32;

  useEffect(() => {
    fetchPhotos();
  }, [activity.name, activity.place_id]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);

      const useUnsplashFirst = shouldUseUnsplashFirst(activity.primaryType, activity.types);

      if (useUnsplashFirst) {
        // For landmarks & attractions: Try Unsplash first
        console.log(`[ActivityPhotoCarousel] Using Unsplash first for ${activity.primaryType} / types: ${activity.types?.join(', ')}: ${activity.name}`);
        const unsplashImages = await fetchUnsplashImages(activity.name);

        // If we got 5 images from Unsplash, use them
        if (unsplashImages.length >= 5) {
          setUnsplashUrls(unsplashImages.slice(0, 5));
          setPhotos([]); // Clear Google Places photos
          setLoading(false);
          return;
        }

        // Fallback to Google Places if Unsplash didn't return enough images
        console.log(`[ActivityPhotoCarousel] Unsplash returned ${unsplashImages.length} images, falling back to Google Places`);
        await fetchGooglePlacesPhotos();
      } else {
        // For local businesses: Use Google Places first
        console.log(`[ActivityPhotoCarousel] Using Google Places first for ${activity.primaryType} / types: ${activity.types?.join(', ')}: ${activity.name}`);

        // Check if we have Google Places photo
        const hasGooglePhoto = !!activity.photo_reference;

        if (hasGooglePhoto) {
          console.log(`[ActivityPhotoCarousel] Found Google Places photo for ${activity.name}`);
          await fetchGooglePlacesPhotos();
        } else {
          // No Google Places photos available, fallback to Unsplash
          console.log(`[ActivityPhotoCarousel] No Google Places photos found for ${activity.name}, trying Unsplash as fallback`);
          const unsplashImages = await fetchUnsplashImages(activity.name);
          if (unsplashImages.length > 0) {
            setUnsplashUrls(unsplashImages.slice(0, 5));
            setPhotos([]); // Clear Google Places photos
          }
        }
      }

    } catch (error) {
      console.error('[ActivityPhotoCarousel] Error fetching photos, falling back:', error);
      await fetchGooglePlacesPhotos();
    } finally {
      setLoading(false);
    }
  };

  const fetchUnsplashImages = async (query: string): Promise<string[]> => {
    try {
      const url = `${UNSPLASH_API_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=5&client_id=${UNSPLASH_ACCESS_KEY}`;

      const response = await fetch(url);

      if (!response.ok) {
        console.error('[ActivityPhotoCarousel] Unsplash API error:', response.status, response.statusText);
        return [];
      }

      const data: UnsplashResponse = await response.json();

      // Return array of image URLs (regular size ~1080px)
      return data.results ? data.results.map(photo => photo.urls.regular) : [];
    } catch (error) {
      console.error('[ActivityPhotoCarousel] Error fetching Unsplash images:', error);
      return [];
    }
  };

  const fetchGooglePlacesPhotos = async () => {
    // If we have a place_id, fetch multiple photos from Google Places API
    if (activity.place_id) {
      // Check cache first
      if (googlePhotosCache[activity.place_id] && googlePhotosCache[activity.place_id].length > 0) {
        const cachedPhotoRefs = googlePhotosCache[activity.place_id];
        const photoData: PhotoData[] = cachedPhotoRefs.map((ref: string) => ({
          photo_reference: ref,
          place_id: activity.place_id || ''
        }));

        console.log(`[ActivityPhotoCarousel] Using cached Google Places photos (${photoData.length}) for: ${activity.name}`);
        setPhotos(photoData);
        setUnsplashUrls([]); // Clear Unsplash URLs
        return;
      }

      try {
        console.log(`[ActivityPhotoCarousel] Fetching multiple photos from Google Places for: ${activity.name}`);

        // Fetch place details with photos field
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${activity.place_id}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.result?.photos && data.result.photos.length > 0) {
          // Get up to 5 photos (same as Unsplash)
          const photoRefs = data.result.photos.slice(0, 5).map((photo: any) => photo.photo_reference);

          // Store in cache
          googlePhotosCache[activity.place_id] = photoRefs;

          const photoData: PhotoData[] = photoRefs.map((ref: string) => ({
            photo_reference: ref,
            place_id: activity.place_id || ''
          }));

          console.log(`[ActivityPhotoCarousel] Found ${photoData.length} Google Places photos for: ${activity.name}`);
          setPhotos(photoData);
          setUnsplashUrls([]); // Clear Unsplash URLs
          return;
        } else {
          console.log(`[ActivityPhotoCarousel] No photos found in Google Places API response for: ${activity.name}`);
        }
      } catch (error) {
        console.error(`[ActivityPhotoCarousel] Error fetching Google Places photos:`, error);
      }
    }

    // Fallback: Use single photo_reference if available
    if (activity.photo_reference) {
      const photoData: PhotoData[] = [{
        photo_reference: activity.photo_reference,
        place_id: activity.place_id || ''
      }];

      setPhotos(photoData);
      setUnsplashUrls([]); // Clear Unsplash URLs
    } else {
      setPhotos([]);
    }
  };

  // Handle photo reference updates from TripCarouselImage (Google Places only)
  const handlePhotoRefUpdate = (index: number, newPhotoRef: string | null) => {
    setPhotos(prevPhotos => {
      if (newPhotoRef === null) {
        // Photo is expired and can't be refreshed, remove it
        return prevPhotos.filter((_, i) => i !== index);
      } else {
        // Update with fresh photo reference
        return prevPhotos.map((photo, i) =>
          i === index ? { ...photo, photo_reference: newPhotoRef } : photo
        );
      }
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator size="large" color={Colors.PRIMARY} />
      </View>
    );
  }

  // Render Unsplash carousel
  if (unsplashUrls.length > 0) {
    // Single Unsplash photo
    if (unsplashUrls.length === 1) {
      return (
        <View style={styles.container}>
          <Image
            source={{ uri: unsplashUrls[0] }}
            style={[styles.carouselImage, { width, height }]}
            resizeMode="cover"
          />
        </View>
      );
    }

    // Multiple Unsplash photos
    return (
      <View style={styles.container}>
        <Carousel
          loop={false}
          width={width}
          height={height}
          data={unsplashUrls}
          scrollAnimationDuration={300}
          defaultIndex={0}
          onSnapToItem={setCurrentIndex}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={[styles.carouselImage, { width, height }]}
              resizeMode="cover"
            />
          )}
        />

        {/* Pagination Dots */}
        {unsplashUrls.length > 1 && (
          <View style={styles.paginationContainer}>
            {unsplashUrls.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex && styles.dotActive
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  // Render Google Places carousel (fallback)
  if (photos.length === 0) {
    return null;
  }

  // Single Google Places photo
  if (photos.length === 1) {
    return (
      <View style={styles.container}>
        <TripCarouselImage
          photo_reference={photos[0].photo_reference}
          place_id={photos[0].place_id}
          style={[styles.carouselImage, { width, height }]}
          onPhotoRefUpdate={(newRef) => handlePhotoRefUpdate(0, newRef)}
        />
      </View>
    );
  }

  // Multiple Google Places photos
  return (
    <View style={styles.container}>
      <Carousel
        loop={false}
        width={width}
        height={height}
        data={photos}
        scrollAnimationDuration={300}
        defaultIndex={0}
        onSnapToItem={setCurrentIndex}
        renderItem={({ item, index }) => (
          <TripCarouselImage
            photo_reference={item.photo_reference}
            place_id={item.place_id}
            style={[styles.carouselImage, { width, height }]}
            onPhotoRefUpdate={(newRef) => handlePhotoRefUpdate(index, newRef)}
          />
        )}
      />

      {/* Pagination Dots */}
      {photos.length > 1 && (
        <View style={styles.paginationContainer}>
          {photos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 0,
    overflow: 'hidden',
    borderRadius: 20,
  },
  carouselImage: {
    borderRadius: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 6,
  },
});
