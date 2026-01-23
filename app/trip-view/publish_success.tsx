import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { GOOGLE_PLACES_API_KEY } from '../../src/constants/api';
import { getPhotoUrl as getCachedPhotoUrl } from '../../src/services/photoService';

export default function PublishSuccess() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { activities, selectedCity, dayActivities } = useCreateTrip();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Extract data from navigation parameters
    const dayCount = parseInt(params.dayCount as string) || 1;

    // Get first activity from day 1; if none, fall back to first wishlist activity
    const getFirstActivity = () => {
        const day1Activities = dayActivities[1]?.activities;
        const firstDayActivity = day1Activities && day1Activities.length > 0 ? day1Activities[0] : null;
        const firstWishlistActivity = (!firstDayActivity && activities && activities.length > 0) ? activities[0] : null;

        return firstDayActivity || firstWishlistActivity || null;
    };

    const firstActivity = getFirstActivity();
    const photoReference = firstActivity?.photo_reference || null;
    const placeId = firstActivity?.place_id || null;

    // Fetch cached photo URL on mount
    useEffect(() => {
        const fetchPhoto = async () => {
            if (!photoReference) {
                setIsLoading(false);
                return;
            }

            try {
                if (placeId) {
                    // Use S3/CloudFront cached service
                    const url = await getCachedPhotoUrl(placeId, photoReference, 400);
                    setImageUrl(url);
                } else {
                    // Fallback to direct Google URL if no place_id
                    setImageUrl(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`);
                }
            } catch (error) {
                console.error('[PublishSuccess] Error fetching photo:', error);
                // Fallback to direct Google URL
                setImageUrl(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPhoto();
    }, [photoReference, placeId]);

    const getDayCountText = () => {
        if (dayCount === 1) return '1 day';
        return `${dayCount} day`;
    };

    return (
        <View style={styles.container}>
            {/* Main Content */}
            <View style={styles.content}>
                {/* Activity Image */}
                {isLoading ? (
                    <View style={styles.placeholderImage}>
                        <ActivityIndicator size="large" color={Colors.PRIMARY} />
                    </View>
                ) : imageUrl ? (
                    <Image
                        source={{ uri: imageUrl }}
                        style={styles.activityImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.placeholderImage}>
                        <Ionicons name="location" size={60} color={Colors.GRAY} />
                    </View>
                )}

                {/* Congratulations Message */}
                <View style={styles.messageContainer}>
                    <Text style={styles.congratulationsText}>
                        Congratulations, you've made a {getDayCountText()} trip{selectedCity ? ` to ${selectedCity}` : ''}!
                    </Text>
                </View>
            </View>

            {/* Action Buttons */}
            
            <View style={styles.buttonContainer}>
                {/* Share Trip Button... Commented out temporarily 
                <TouchableOpacity 
                    style={styles.shareTripButton}
                    onPress={() => {
                        // TODO: Implement share functionality
                        Alert.alert(
                            'Share Trip',
                            'Feature Coming Soon',
                            [{ text: 'OK', style: 'default' }]
                          );
                    }}
                >
                    <Text style={styles.shareTripButtonText}>Share Trip</Text>
                </TouchableOpacity>
                */}

                <TouchableOpacity 
                    style={styles.viewProfileButton}
                    onPress={() => router.push({
                        pathname: '/profile',
                        params: {
                            photoReference: photoReference || '',
                            dayCount: dayCount.toString()
                        }
                    })}
                >
                    <Text style={styles.viewProfileButtonText}>View Profile</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.WHITE,
        padding: 20,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    activityImage: {
        width: 280,
        height: 280,
        borderRadius: 20,
        marginBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    placeholderImage: {
        width: 280,
        height: 280,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    messageContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    congratulationsText: {
        fontSize: 24,
        fontFamily: 'outfit',
        color: Colors.PRIMARY,
        textAlign: 'center',
        lineHeight: 32,
        paddingHorizontal: 30,
    },
    successIconContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonContainer: {
        paddingBottom: 80,
        gap: 16,
    },
    shareTripButton: {
        backgroundColor: Colors.PRIMARY,
        marginTop: -40,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    shareTripButtonText: {
        color: Colors.WHITE,
        fontSize: 18,
        fontFamily: 'outfit-bold',
        fontWeight: '600',
    },
    viewProfileButton: {
        backgroundColor: '#F36406',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F36406',
        marginTop: -100
    },
    viewProfileButtonText: {
        color: Colors.WHITE,
        fontSize: 18,
        fontFamily: 'outfit-bold',
        fontWeight: '600',
    },
}); 