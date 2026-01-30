import { useState, useEffect, useRef } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { GOOGLE_PLACES_API_KEY, UNSPLASH_ACCESS_KEY } from '../../../constants/api';
import { getPhotoUrl as getCachedPhotoUrl, invalidateCacheForPlace } from '../../../services/photoService';
import type { UnsplashImageWithAttribution } from '../../../types/unsplash.types';
import {
  shouldUseUnsplashFirst,
  getCachedFirstPhoto,
  setCachedFirstPhoto,
  setCachedGoogleRefs,
  getCachedUnsplashPhotos,
  setCachedUnsplashPhotos,
  clearCachedFirstPhoto,
} from '../../../utils/activityPhotoCache';

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

            // 1) Use shared cache so card thumbnail and carousel first photo stay in sync; avoid duplicate API calls
            const cachedFirst = getCachedFirstPhoto(place_id, activityName);
            if (cachedFirst) {
                setImageUrl(cachedFirst.url);
                if (cachedFirst.photoReference && onPhotoRefUpdate) {
                    onPhotoRefUpdate(cachedFirst.photoReference);
                }
                setIsLoading(false);
                return;
            }

            // 2) Unsplash: use shared Unsplash cache (may have been filled by carousel) so first = carousel first
            const cachedUnsplash = activityName ? getCachedUnsplashPhotos(activityName) : null;
            if (cachedUnsplash?.length) {
                const first = cachedUnsplash[0];
                setImageUrl(first.imageUrl);
                setCachedFirstPhoto(place_id, activityName, {
                    source: 'unsplash',
                    url: first.imageUrl,
                    attribution: first.attribution,
                });
                setIsLoading(false);
                return;
            }

            const useUnsplashFirst = shouldUseUnsplashFirst(primaryType, types);

            if (useUnsplashFirst) {
                // For landmarks & attractions: fetch 5 so carousel can use same set (one API call, same first)
                const unsplashPhotos = await fetchUnsplashImagesFive(activityName || '');
                if (unsplashPhotos.length) {
                    const first = unsplashPhotos[0];
                    setImageUrl(first.imageUrl);
                    setCachedFirstPhoto(place_id, activityName, {
                        source: 'unsplash',
                        url: first.imageUrl,
                        attribution: first.attribution,
                    });
                    setCachedUnsplashPhotos(activityName || '', unsplashPhotos);
                    setIsLoading(false);
                    return;
                }
                await fetchGooglePlacesPhoto();
            } else {
                const hasGooglePhoto = !!photo_reference;
                if (hasGooglePhoto) {
                    await fetchGooglePlacesPhoto();
                } else {
                    const unsplashPhotos = await fetchUnsplashImagesFive(activityName || '');
                    if (unsplashPhotos.length) {
                        const first = unsplashPhotos[0];
                        setImageUrl(first.imageUrl);
                        setCachedFirstPhoto(place_id, activityName, {
                            source: 'unsplash',
                            url: first.imageUrl,
                            attribution: first.attribution,
                        });
                        setCachedUnsplashPhotos(activityName || '', unsplashPhotos);
                    } else {
                        setImageError(true);
                    }
                }
            }
        } catch (error) {
            console.error('[ActivityImage] Error fetching photo:', error);
            await fetchGooglePlacesPhoto();
        } finally {
            setIsLoading(false);
        }
    };

    /** Fetch up to 5 Unsplash photos (same as carousel) so shared cache has one source of truth; first = thumbnail = carousel first. */
    const fetchUnsplashImagesFive = async (query: string): Promise<Array<{ imageUrl: string; attribution: UnsplashImageWithAttribution['attribution'] }>> => {
        if (!query) return [];

        try {
            const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&client_id=${UNSPLASH_ACCESS_KEY}`;
            const response = await fetch(url);
            if (!response.ok) return [];

            const data = await response.json();
            if (!data.results?.length) return [];

            return data.results.map((photo: any) => ({
                imageUrl: photo.urls.small,
                attribution: {
                    photographerName: photo.user?.name || 'Unknown',
                    photographerProfileUrl: photo.user?.links?.html || 'https://unsplash.com',
                    photoPageUrl: photo.links?.html || 'https://unsplash.com',
                    downloadLocationUrl: photo.links?.download_location || '',
                },
            }));
        } catch (error) {
            console.error('[ActivityImage] Error fetching Unsplash images:', error);
            return [];
        }
    };

    const fetchGooglePlacesPhoto = async () => {
        if (place_id) {
            try {
                if (photo_reference) {
                    const photoUrl = await getCachedPhotoUrl(place_id, photo_reference, 400);
                    setImageUrl(photoUrl);
                    setCachedFirstPhoto(place_id, activityName, {
                        source: 'google',
                        url: photoUrl,
                        photoReference: photo_reference,
                        place_id,
                    });
                    if (onPhotoRefUpdate) onPhotoRefUpdate(photo_reference);
                    return;
                }

                // No photo_reference: fetch place details once and cache refs so carousel doesn't call again
                const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.status === 'OK' && data.result?.photos?.length) {
                    const refs = data.result.photos.slice(0, 5).map((p: any) => p.photo_reference);
                    setCachedGoogleRefs(place_id, refs);
                    const photoRef = refs[0];
                    const photoUrl = await getCachedPhotoUrl(place_id, photoRef, 400);
                    setImageUrl(photoUrl);
                    setCachedFirstPhoto(place_id, activityName, {
                        source: 'google',
                        url: photoUrl,
                        photoReference: photoRef,
                        place_id,
                    });
                    if (onPhotoRefUpdate) onPhotoRefUpdate(photoRef);
                    return;
                }
            } catch (error) {
                console.error('[ActivityImage] Error fetching Google Places photo:', error);
            }
        }

        if (photo_reference && place_id) {
            try {
                const photoUrl = await getCachedPhotoUrl(place_id, photo_reference, 400);
                setImageUrl(photoUrl);
                setCachedFirstPhoto(place_id, activityName, {
                    source: 'google',
                    url: photoUrl,
                    photoReference: photo_reference,
                    place_id,
                });
            } catch (error) {
                console.error('[ActivityImage] Error with cached photo service, using direct URL:', error);
                const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
                setImageUrl(photoUrl);
                setCachedFirstPhoto(place_id, activityName, {
                    source: 'google',
                    url: photoUrl,
                    photoReference: photo_reference,
                    place_id,
                });
            }
        } else if (photo_reference) {
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
            setImageUrl(photoUrl);
            setCachedFirstPhoto(place_id, activityName, {
                source: 'google',
                url: photoUrl,
                photoReference: photo_reference,
                place_id,
            });
        } else {
            setImageError(true);
        }
    };

    const handleImageError = async () => {
        if (retryCountRef.current >= 1) {
            setImageError(true);
            return;
        }

        const cachedFirst = getCachedFirstPhoto(place_id, activityName);
        if (cachedFirst?.source === 'unsplash') {
            setImageError(true);
            return;
        }

        if (!place_id) {
            setImageError(true);
            return;
        }

        retryCountRef.current += 1;
        setIsLoading(true);
        setImageError(false);

        try {
            clearCachedFirstPhoto(place_id, activityName);
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
                setCachedFirstPhoto(place_id, activityName, {
                    source: 'google',
                    url: cacheBustedUrl,
                    photoReference: freshPhotoRef,
                    place_id,
                });

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
