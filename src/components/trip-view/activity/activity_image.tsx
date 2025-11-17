import React, { useState, useEffect } from 'react';
import { Image, Text, View, ActivityIndicator } from 'react-native';
import { GOOGLE_PLACES_API_KEY } from '../../../constants/api';

interface ActivityImageProps {
    photo_reference: string;
    place_id?: string;
    style: any;
    onPhotoRefUpdate?: (newPhotoRef: string) => void;
}

/**
 * ActivityImage Component
 *
 * Displays activity photos from Google Places API with automatic refresh on expiration.
 *
 * Features:
 * - Detects when photo_reference has expired (image fails to load)
 * - Automatically fetches fresh photo_reference using place_id
 * - Notifies parent component of updated photo_reference via callback
 * - Shows loading state while fetching new photo
 *
 * @param photo_reference - Current photo reference from Google Places
 * @param place_id - Place ID to fetch fresh photo if current one expires
 * @param style - Image style
 * @param onPhotoRefUpdate - Optional callback when photo_reference is updated
 */
export function ActivityImage({ photo_reference, place_id, style, onPhotoRefUpdate }: ActivityImageProps) {
    const [imageError, setImageError] = useState(false);
    const [currentPhotoRef, setCurrentPhotoRef] = useState(photo_reference);
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

            // Call Google Places API directly to get fresh photo_reference (FREE - ID Only SKU)
            // This is the same approach used in getLocationCoordinates Lambda
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.result?.photos?.[0]) {
                const freshPhotoRef = data.result.photos[0].photo_reference;
                setCurrentPhotoRef(freshPhotoRef);
                setImageError(false);

                // Notify parent component of updated photo reference
                if (onPhotoRefUpdate) {
                    onPhotoRefUpdate(freshPhotoRef);
                }
            } else {
                setImageError(true);
            }
        } catch (error) {
            setImageError(true);
        } finally {
            setIsRefreshing(false);
            setHasAttemptedRefresh(true);
        }
    };

    // Handle image load error
    const handleImageError = () => {
        console.log(`[ActivityImage] Image failed to load, photo_reference may be expired`);

        // If we have a place_id and haven't already attempted refresh, try to get a fresh photo
        if (place_id && !hasAttemptedRefresh && !isRefreshing) {
            fetchFreshPhotoReference(place_id);
        } else {
            setImageError(true);
        }
    };

    // Don't display anything if no photo reference
    if (!currentPhotoRef && !isRefreshing) {
        return null;
    }

    // Show loading state while fetching new photo
    if (isRefreshing) {
        return (
            <View style={[style, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="small" color="#999" />
            </View>
        );
    }

    // Show error message if image failed to load and we can't refresh
    if (imageError) {
        return (
            <View style={[style, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
                    Image{'\n'}Unavailable
                </Text>
            </View>
        );
    }

    const imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${currentPhotoRef}&key=${GOOGLE_PLACES_API_KEY}`;

    return (
        <Image
            style={style}
            source={{ uri: imageUrl }}
            onError={handleImageError}
            onLoad={() => {
                // Successfully loaded
            }}
        />
    );
} 