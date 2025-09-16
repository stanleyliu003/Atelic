import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';

export default function PublishSuccess() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { activities, selectedCity, dayActivities } = useCreateTrip();

    // Extract data from navigation parameters
    const dayCount = parseInt(params.dayCount as string) || 1;

    // Get first activity from day 1 instead of last activity
    const getFirstActivityPhotoRef = () => {
        const day1Activities = dayActivities[1]?.activities;
        if (day1Activities && day1Activities.length > 0) {
            return day1Activities[0].photo_reference;
        }
        return null;
    };

    const photoReference = getFirstActivityPhotoRef();

    const getDayCountText = () => {
        if (dayCount === 1) return '1 day';
        return `${dayCount} day`;
    };

    const getImageUrl = (photoReference: string) => {
        const { GOOGLE_PLACES_API_KEY } = require('../../src/constants/api');
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
    };

    return (
        <View style={styles.container}>
            {/* Back Button */}
            <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => router.push('/trip-view/trip-view_main')}
            >
                <Ionicons name="arrow-back" size={24} color={Colors.PRIMARY} />
            </TouchableOpacity>

            {/* Main Content */}
            <View style={styles.content}>
                {/* Activity Image */}
                {photoReference ? (
                    <Image
                        source={{ uri: getImageUrl(photoReference) }}
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
    backButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        zIndex: 10,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
        paddingBottom: 40,
        gap: 16,
    },
    shareTripButton: {
        backgroundColor: Colors.PRIMARY,
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
        backgroundColor: 'transparent',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.PRIMARY,
    },
    viewProfileButtonText: {
        color: Colors.PRIMARY,
        fontSize: 18,
        fontFamily: 'outfit-bold',
        fontWeight: '600',
    },
}); 