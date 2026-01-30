import React, { useState, useEffect } from 'react';
import { View, Dimensions, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Carousel from 'react-native-reanimated-carousel';
import { Activity } from '../../../types/activity.types';
import { Colors } from '../../../../constants/Colors';
import { TripCarouselImage } from '../../profile/TripCarouselImage';
import { useLazyCarousel } from '../../../hooks/useLazyCarousel';
import { GOOGLE_PLACES_API_KEY, UNSPLASH_ACCESS_KEY } from '../../../constants/api';
import { UnsplashImageWithAttribution } from '../../../types/unsplash.types';
import UnsplashInfoButton from '../../common/UnsplashInfoButton';
import { getPhotoUrl } from '../../../services/photoService';
import {
  shouldUseUnsplashFirst,
  getCachedGoogleRefs,
  getCachedUnsplashPhotos,
  setCachedFirstPhoto,
  setCachedGoogleRefs,
  setCachedUnsplashPhotos,
} from '../../../utils/activityPhotoCache';

// expo-image blurhash placeholder for smooth loading
const PLACEHOLDER_BLURHASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6telebu~qayj[j[fQayWBofofayayayj[fQj[ayayj[ayfjj[ay';

const UNSPLASH_API_BASE = 'https://api.unsplash.com';

interface ActivityPhotoCarouselProps {
  activity: Activity;
  height?: number;
}

interface PhotoData {
  photo_reference: string;
  place_id: string;
}

interface UnsplashPhoto {
  urls: { regular: string; small: string; thumb: string };
  id: string;
  user?: { name: string; links?: { html: string } };
  links?: { html: string; download_location: string };
}

interface UnsplashResponse {
  results: UnsplashPhoto[];
  total: number;
}

export function ActivityPhotoCarousel({ activity, height = 250 }: ActivityPhotoCarouselProps) {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [unsplashData, setUnsplashData] = useState<UnsplashImageWithAttribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const width = Dimensions.get('window').width - 32;

  // Lazy loading for Google Places photos (Unsplash is free, so no need to lazy load)
  const { onSnapToItem: onGoogleSnapToItem, shouldLoad: shouldLoadGoogle } = useLazyCarousel(photos.length || 5);

  useEffect(() => {
    fetchPhotos();
  }, [activity.name, activity.place_id]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);

      // 1) Use shared cache so first photo = card thumbnail; avoid duplicate API calls
      const cachedUnsplash = activity.name ? getCachedUnsplashPhotos(activity.name) : null;
      const cachedGoogleRefs = activity.place_id ? getCachedGoogleRefs(activity.place_id) : null;

      if (cachedUnsplash && cachedUnsplash.length > 0) {
        setUnsplashData(cachedUnsplash.slice(0, 5));
        setPhotos([]);
        setLoading(false);
        return;
      }

      if (cachedGoogleRefs && cachedGoogleRefs.length > 0) {
        const photoData: PhotoData[] = cachedGoogleRefs.map(ref => ({
          photo_reference: ref,
          place_id: activity.place_id || '',
        }));
        setPhotos(photoData);
        setUnsplashData([]);
        setLoading(false);
        return;
      }

      const useUnsplashFirst = shouldUseUnsplashFirst(activity.primaryType, activity.types);

      if (useUnsplashFirst) {
        const unsplashImages = await fetchUnsplashImages(activity.name);
        if (unsplashImages.length >= 5) {
          setCachedUnsplashPhotos(activity.name, unsplashImages.slice(0, 5));
          setCachedFirstPhoto(activity.place_id, activity.name, {
            source: 'unsplash',
            url: unsplashImages[0].imageUrl,
            attribution: unsplashImages[0].attribution,
          });
          setUnsplashData(unsplashImages.slice(0, 5));
          setPhotos([]);
          setLoading(false);
          return;
        }
        await fetchGooglePlacesPhotos();
      } else {
        const hasGooglePhoto = !!activity.photo_reference;
        if (hasGooglePhoto) {
          await fetchGooglePlacesPhotos();
        } else {
          const unsplashImages = await fetchUnsplashImages(activity.name);
          if (unsplashImages.length > 0) {
            setCachedUnsplashPhotos(activity.name, unsplashImages.slice(0, 5));
            setCachedFirstPhoto(activity.place_id, activity.name, {
              source: 'unsplash',
              url: unsplashImages[0].imageUrl,
              attribution: unsplashImages[0].attribution,
            });
            setUnsplashData(unsplashImages.slice(0, 5));
            setPhotos([]);
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

  const fetchUnsplashImages = async (query: string): Promise<UnsplashImageWithAttribution[]> => {
    try {
      const cached = getCachedUnsplashPhotos(query);
      if (cached && cached.length > 0) {
        return cached;
      }

      const url = `${UNSPLASH_API_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=5&client_id=${UNSPLASH_ACCESS_KEY}`;
      const response = await fetch(url);
      if (!response.ok) return [];

      const data: UnsplashResponse = await response.json();
      const photosWithAttribution: UnsplashImageWithAttribution[] = data.results ? data.results.map(photo => ({
        imageUrl: photo.urls.regular,
        attribution: {
          photographerName: photo.user?.name || 'Unknown',
          photographerProfileUrl: photo.user?.links?.html || 'https://unsplash.com',
          photoPageUrl: photo.links?.html || 'https://unsplash.com',
          downloadLocationUrl: photo.links?.download_location || '',
        }
      })) : [];

      if (photosWithAttribution.length > 0) {
        setCachedUnsplashPhotos(query, photosWithAttribution);
      }
      return photosWithAttribution;
    } catch (error) {
      console.error('[ActivityPhotoCarousel] Error fetching Unsplash images:', error);
      return [];
    }
  };

  const fetchGooglePlacesPhotos = async () => {
    if (activity.place_id) {
      const cachedRefs = getCachedGoogleRefs(activity.place_id);
      if (cachedRefs && cachedRefs.length > 0) {
        const photoData: PhotoData[] = cachedRefs.map(ref => ({
          photo_reference: ref,
          place_id: activity.place_id || ''
        }));
        setPhotos(photoData);
        setUnsplashData([]);
        return;
      }

      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${activity.place_id}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.result?.photos?.length > 0) {
          const photoRefs = data.result.photos.slice(0, 5).map((p: any) => p.photo_reference);
          setCachedGoogleRefs(activity.place_id, photoRefs);
          try {
            const firstUrl = await getPhotoUrl(activity.place_id!, photoRefs[0], 400);
            setCachedFirstPhoto(activity.place_id, activity.name, {
              source: 'google',
              url: firstUrl,
              photoReference: photoRefs[0],
              place_id: activity.place_id,
            });
          } catch (_) {
            // Card will resolve when it mounts
          }

          const photoData: PhotoData[] = photoRefs.map((ref: string) => ({
            photo_reference: ref,
            place_id: activity.place_id || ''
          }));
          setPhotos(photoData);
          setUnsplashData([]);
          return;
        }
      } catch (error) {
        console.error('[ActivityPhotoCarousel] Error fetching Google Places photos:', error);
      }
    }

    if (activity.photo_reference) {
      setPhotos([{
        photo_reference: activity.photo_reference,
        place_id: activity.place_id || ''
      }]);
      setUnsplashData([]);
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
  if (unsplashData.length > 0) {
    // Single Unsplash photo
    if (unsplashData.length === 1) {
      return (
        <View style={styles.container}>
          <Image
            source={{ uri: unsplashData[0].imageUrl }}
            style={[styles.carouselImage, { width, height }]}
            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
          />
          <UnsplashInfoButton attribution={unsplashData[0].attribution} />
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
          data={unsplashData}
          scrollAnimationDuration={300}
          defaultIndex={0}
          onSnapToItem={setCurrentIndex}
          renderItem={({ item }) => (
            <View>
              <Image
                source={{ uri: item.imageUrl }}
                style={[styles.carouselImage, { width, height }]}
                placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
                contentFit="cover"
                transition={200}
                cachePolicy="disk"
              />
              <UnsplashInfoButton attribution={item.attribution} />
            </View>
          )}
        />

        {/* Pagination Dots */}
        {unsplashData.length > 1 && (
          <View style={styles.paginationContainer}>
            {unsplashData.map((_, index) => (
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

  // Multiple Google Places photos - with lazy loading to reduce API costs
  const handleGoogleCarouselSnap = (index: number) => {
    setCurrentIndex(index);
    onGoogleSnapToItem(index);
  };

  return (
    <View style={styles.container}>
      <Carousel
        loop={false}
        width={width}
        height={height}
        data={photos}
        scrollAnimationDuration={300}
        defaultIndex={0}
        onSnapToItem={handleGoogleCarouselSnap}
        renderItem={({ item, index }) => (
          <TripCarouselImage
            photo_reference={item.photo_reference}
            place_id={item.place_id}
            style={[styles.carouselImage, { width, height }]}
            shouldLoad={shouldLoadGoogle(index)}
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
