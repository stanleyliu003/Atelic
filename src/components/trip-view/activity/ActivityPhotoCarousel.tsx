import React, { useState, useEffect } from 'react';
import { View, Image, Dimensions, ActivityIndicator, StyleSheet } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { Activity } from '../../../types/activity.types';
import { Colors } from '../../../../constants/Colors';
import { TripCarouselImage } from '../../profile/TripCarouselImage';

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
const UNSPLASH_ACCESS_KEY = 'yn2QK-2i5D4As5qcKEriMb31MQjrM6z8a0K4xERjGJ8';
const UNSPLASH_API_BASE = 'https://api.unsplash.com';

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

      // Try Unsplash API first
      const unsplashImages = await fetchUnsplashImages(activity.name);

      // If we got 5 images from Unsplash, use them
      if (unsplashImages.length >= 5) {
        setUnsplashUrls(unsplashImages.slice(0, 5));
        setPhotos([]); // Clear Google Places photos
        setLoading(false);
        return;
      }

      // Fallback to Google Places if Unsplash didn't return enough images
      await fetchGooglePlacesPhotos();

    } catch (error) {
      console.error('[ActivityPhotoCarousel] Error with Unsplash, falling back to Google Places:', error);
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
    let photoRefs: string[] = activity.photo_references || [];

    // If no photo_references but we have a single photo_reference, use it
    if (photoRefs.length === 0 && activity.photo_reference) {
      photoRefs = [activity.photo_reference];
    }

    // Convert to PhotoData objects for TripCarouselImage
    const photoData: PhotoData[] = photoRefs.map(ref => ({
      photo_reference: ref,
      place_id: activity.place_id || ''
    }));

    setPhotos(photoData);
    setUnsplashUrls([]); // Clear Unsplash URLs
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
