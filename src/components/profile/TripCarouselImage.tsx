import React, { useState, useEffect } from 'react';
import { Image, View, ActivityIndicator, StyleSheet } from 'react-native';
import { GOOGLE_PLACES_API_KEY } from '../../constants/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors } from '../../../constants/Colors';

interface TripCarouselImageProps {
  photo_reference?: string | null;
  place_id?: string;
  style?: any;
  /**
   * Called when this image discovers a fresh or invalid photo_reference.
   * - Passes a non-empty string when a new valid photo_reference is fetched.
   * - Passes null when the image is definitively unusable (expired and cannot be refreshed).
   */
  onPhotoRefUpdate?: (newPhotoRef: string | null) => void;
}

/**
 * TripCarouselImage Component
 *
 * Displays trip activity photos from Google Places API with automatic refresh on expiration.
 *
 * Features:
 * - Detects when photo_reference has expired (image fails to load)
 * - Automatically fetches fresh photo_reference using place_id
 * - Shows loading state while fetching new photo
 * - Falls back to placeholder if no photo is available
 *
 * @param photo_reference - Current photo reference from Google Places
 * @param place_id - Activity place_id to fetch fresh photo if current one expires
 * @param style - Image style
 * @param onPhotoRefUpdate - Optional callback when photo_reference is updated
 */
export function TripCarouselImage({
  photo_reference,
  place_id,
  style,
  onPhotoRefUpdate
}: TripCarouselImageProps) {
  const [imageError, setImageError] = useState(false);
  const [currentPhotoRef, setCurrentPhotoRef] = useState<string | null | undefined>(photo_reference);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = useState(false);

  // Reset state when photo_reference prop changes
  useEffect(() => {
    setCurrentPhotoRef(photo_reference);
    setImageError(false);
    setHasAttemptedRefresh(false);
  }, [photo_reference]);

  // Fetch fresh photo reference directly from Google Places API
  const fetchFreshPhotoReference = async (placeId: string) => {
    try {
      setIsRefreshing(true);
      console.log(`[TripCarouselImage] Fetching fresh photo_reference for place_id: ${placeId}`);

      // Call Google Places API directly to get fresh photo_reference (FREE - ID Only SKU)
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.result?.photos?.[0]) {
        const freshPhotoRef = data.result.photos[0].photo_reference;
        console.log(`[TripCarouselImage] Successfully fetched fresh photo_reference for place_id: ${placeId}`);
        setCurrentPhotoRef(freshPhotoRef);
        setImageError(false);

        // Notify parent component of updated photo reference
        if (onPhotoRefUpdate) {
          onPhotoRefUpdate(freshPhotoRef);
        }
      } else {
        console.log(`[TripCarouselImage] No photo available for place_id: ${placeId}`);
        setImageError(true);
      }
    } catch (error) {
      console.error(`[TripCarouselImage] Error fetching fresh photo_reference for place_id ${placeId}:`, error);
      setImageError(true);
    } finally {
      setIsRefreshing(false);
      setHasAttemptedRefresh(true);
    }
  };

  // Handle image load error
  const handleImageError = () => {
    console.log(`[TripCarouselImage] Image failed to load, photo_reference may be expired`);

    // If we have a place_id and haven't already attempted refresh, try to get a fresh photo
    if (place_id && !hasAttemptedRefresh && !isRefreshing) {
      fetchFreshPhotoReference(place_id);
    } else {
      setImageError(true);
      // Notify parent that this photo is no longer usable so it can be removed
      if (onPhotoRefUpdate) {
        onPhotoRefUpdate(null);
      }
    }
  };

  // Show loading state while fetching new photo
  if (isRefreshing) {
    return (
      <View style={[styles.placeholderContainer, style]}>
        <ActivityIndicator size="large" color={Colors.PRIMARY} />
      </View>
    );
  }

  // If image is invalid and cannot be refreshed, let the parent remove this slide.
  // Return null here so individual expired slides disappear instead of showing a placeholder.
  if (imageError || !currentPhotoRef) {
    return null;
  }

  const imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=350&photoreference=${currentPhotoRef}&key=${GOOGLE_PLACES_API_KEY}`;

  return (
    <Image
      style={style}
      source={{ uri: imageUrl }}
      resizeMode="cover"
      onError={handleImageError}
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
