import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useCreateTrip } from '../../context/CreateTripContext';
import { WishlistActivities } from '../../src/components/trip-view';
import { ActivityDetailView } from '../../src/components/trip-view/description_card';
import { AddPlacesButton } from '../../src/components/trip-view/add_places_button';
import { Colors } from './../../constants/Colors';
import { API_KEYS } from '../../constants/ApiKeys';
import { API, graphqlOperation } from 'aws-amplify';
import { addAdditionalPlaceWithDedup, buildExistingPlaceIdSet, defaultAddPlacesButtonStyle } from '../../src/services/add_additional_place';

export default function WishlistInfo() {
    const router = useRouter();
    const { activities, updateActivities, selectedCity } = useCreateTrip();

    // State for selected activities - initialize with all activities selected
    const [selectedActivities, setSelectedActivities] = useState([]);

    // Select all activities by default on mount or when activities change
    useEffect(() => {
        if (activities && activities.length > 0) {
            const allActivityIds = activities
                .filter(activity => activity.place_id)
                .map(activity => activity.place_id);
            setSelectedActivities(allActivityIds);
        }
    }, [activities]);
    // Loading state for create trip
    const [loading, setLoading] = useState(false);
    
    // State for activity detail view
    const [selectedActivityForDetail, setSelectedActivityForDetail] = useState(null);
    const [showActivityDetail, setShowActivityDetail] = useState(false);
    
    // State for add places modal
    const [isAddPlacesModalVisible, setIsAddPlacesModalVisible] = useState(false);
    const [isAddingPlace, setIsAddingPlace] = useState(false);

    // Note: Do not reset selectedActivities when activities change to preserve user selections

    // Handle activity selection
    const handleActivitySelect = (activityId) => {
        setSelectedActivities(prev => [...prev, activityId]);
    };

    // Handle activity deselection
    const handleActivityDeselect = (activityId) => {
        setSelectedActivities(prev => prev.filter(id => id !== activityId));
    };

    // Handler for activity description card selection
    const handleActivityDescriptionCardSelect = (activity) => {
        setSelectedActivityForDetail(activity);
        setShowActivityDetail(true);
    };

    // Handler for closing activity detail view
    const handleCloseActivityDetail = () => {
        setShowActivityDetail(false);
        setSelectedActivityForDetail(null);
    };

    // Get bias location from activities or selectedCity
    const getBiasLocation = () => {
        // First try to get coordinates from activities
        if (activities && activities.length > 0) {
            const validActivities = activities.filter(activity => activity.lat && activity.lng);
            if (validActivities.length > 0) {
                // Use the first activity with valid coordinates
                const firstActivity = validActivities[0];
                return `${firstActivity.lat},${firstActivity.lng}`;
            }
        }
        
        // Fallback to selectedCity if no activities have coordinates
        if (selectedCity) {
            return selectedCity;
        }
        
        return null;
    };

    // Handler for place selection from GooglePlacesAutocomplete
    const handlePlaceSelect = async (data, details) => {
        try {
            setIsAddPlacesModalVisible(false);
            setIsAddingPlace(true);
            
            // Build dedup set and call shared service with dedup
            const existingPlaceIds = buildExistingPlaceIdSet(activities);
            const { activity: newActivity, duplicate } = await addAdditionalPlaceWithDedup(
                data.description,
                selectedCity || 'Unknown City',
                existingPlaceIds
            );
            if (newActivity) {
                if (duplicate) {
                    Alert.alert(
                        'Duplicate Place', 
                        `"${newActivity.name}" is already in your trip.`,
                        [{ text: 'OK' }]
                    );
                } else {
                    // Add the new activity to the wishlist
                    updateActivities([...activities, newActivity]);
                    // Auto-select the newly added activity while preserving existing selections
                    if (newActivity.place_id) {
                        setSelectedActivities(prev => (
                            prev.includes(newActivity.place_id)
                                ? prev
                                : [...prev, newActivity.place_id]
                        ));
                    }
                }
            } else {
                console.warn('Could not get place details');
            }
        } catch (error) {
            console.error('Error adding place:', error);
            // Optionally show a user-facing error message
        } finally {
            setIsAddingPlace(false);
        }
    };

    // Handle create trip button press
    const handleCreateTrip = () => {
        setLoading(true);
        // Filter activities to only include selected ones
        const selectedActivitiesList = activities.filter(activity => 
            activity.place_id && selectedActivities.includes(activity.place_id)
        );
        
        // Update the context with only selected activities
        updateActivities(selectedActivitiesList);
        
        // Simulate async navigation for better UX (remove if not needed)
        setTimeout(() => {
        router.push('/trip-view/trip-view_main');
            setLoading(false);
        }, 500);
    };

    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={()=>router.replace('/create-trip/create_trip_explore')}>
          <Ionicons name="arrow-back" size={32} color="black" />
        </TouchableOpacity>

        <View style={styles.header}>
            <Text style={styles.title}>Trip Wishlist</Text>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Empty State */}
          {(!activities || activities.length === 0) && (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="map-outline" size={80} color={Colors.GRAY} />
              <Text style={styles.emptyStateTitle}>No Activities Yet</Text>
              <Text style={styles.emptyStateText}>
                Go back to the explore page to add activities
              </Text>
            </View>
          )}

          {/* All activities grouped by city */}
          {activities && activities.length > 0 && (
            <>
              {/* Recommended Activities */}
              {(() => {
                const recommendedActivities = activities.filter(a => a.is_recommended);
                if (recommendedActivities.length === 0) return null;

                const recommendedByCity = recommendedActivities.reduce((acc, activity) => {
                  const city = activity.city || 'Unknown City';
                  if (!acc[city]) acc[city] = [];
                  acc[city].push(activity);
                  return acc;
                }, {});

                return (
                  <>
                    <Text style={styles.recommendedTitle}>Activities</Text>
                    {Object.entries(recommendedByCity).map(([city, cityActivities]) => (
                      <View key={`recommended-${city}`} style={styles.citySection}>
                        <Text style={styles.cityTitle}>{city}</Text>
                        <WishlistActivities
                            activities={cityActivities}
                            selectedActivities={selectedActivities}
                            onActivitySelect={handleActivitySelect}
                            onActivityDeselect={handleActivityDeselect}
                            onDescriptionCardPress={handleActivityDescriptionCardSelect}
                            showSelectionIndicator={true}
                            scrollable={false}
                        />
                      </View>
                    ))}
                  </>
                );
              })()}

              {/* User Added Activities */}
              {(() => {
                const userAddedActivities = activities.filter(a => !a.is_recommended);
                if (userAddedActivities.length === 0) return null;

                const userAddedByCity = userAddedActivities.reduce((acc, activity) => {
                  const city = activity.city || 'Unknown City';
                  if (!acc[city]) acc[city] = [];
                  acc[city].push(activity);
                  return acc;
                }, {});

                return (
                  <>
                    <Text style={styles.userAddedTitle}>Your Added Activities</Text>
                    {Object.entries(userAddedByCity).map(([city, cityActivities]) => (
                      <View key={`user-added-${city}`} style={styles.citySection}>
                        <Text style={styles.cityTitle}>{city}</Text>
                        <WishlistActivities
                            activities={cityActivities}
                            selectedActivities={selectedActivities}
                            onActivitySelect={handleActivitySelect}
                            onActivityDeselect={handleActivityDeselect}
                            onDescriptionCardPress={handleActivityDescriptionCardSelect}
                            showSelectionIndicator={true}
                            scrollable={false}
                        />
                      </View>
                    ))}
                  </>
                );
              })()}

              {/* Add Additional Activities Button */}
              <View style={styles.addActivitiesContainer}>
                <TouchableOpacity
                  style={styles.addActivitiesButton}
                  onPress={() => router.replace('/create-trip/create_trip_explore')}
                >
                  <Feather name="plus-circle" size={24} color="black" />
                  <Text style={styles.addActivitiesButtonText}>
                    Add additional activities
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </ScrollView>

        {/* Create Trip Button */}
        <TouchableOpacity
          onPress={handleCreateTrip}
          style={[
            styles.createTripButton,
            (selectedActivities.length === 0 || loading) && styles.disabledButton
          ]}
          disabled={selectedActivities.length === 0 || loading}
        >
          <Text style={styles.createTripButtonText}>
            {loading ? 'Loading Trip...' : 'Load Trip'}
          </Text>
        </TouchableOpacity>

        {/* Activity Detail View Overlay */}
        {showActivityDetail && selectedActivityForDetail && (
          <View style={styles.activityDetailOverlay}>
            <TouchableOpacity 
              style={styles.overlayBackground}
              onPress={handleCloseActivityDetail}
              activeOpacity={1}
            />
            <View style={styles.bottomPopup}>
              <ActivityDetailView 
                activity={selectedActivityForDetail}
                onClose={handleCloseActivityDetail}
                variant="wishlist"
              />
            </View>
          </View>
        )}
      </View>
    )
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 25,
      paddingTop: 55,
      backgroundColor: Colors.WHITE,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 15,
      marginBottom: 10,
    },
    title: {
      fontFamily: 'outfit-bold',
      fontSize: 35,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    citySection: {
      marginBottom: 10,
    },
    cityTitle: {
      fontFamily: 'outfit-bold',
      fontSize: 24,
      marginTop: -5,
      textAlign: 'center',
      marginBottom: 15,
      color: '#1a1a1a',
    },
    createTripButton: {
      padding: 15,
      backgroundColor: '#F36406',
      borderRadius: 15,
      marginTop: 30,
      marginBottom: 20,
    },
    disabledButton: {
      backgroundColor: '#F36406',
      opacity: 0.6,
    },
    createTripButtonText: {
      color: Colors.WHITE,
      fontSize: 17,
      textAlign: 'center',
      fontFamily: 'outfit-bold',
    },
    recommendedTitle: {
      fontFamily: 'outfit-bold',
      fontSize: 24,
      marginTop: 25,
      marginBottom: 10,
      textAlign: 'center',
    },
    userAddedTitle: {
      fontFamily: 'outfit-bold',
      fontSize: 24,
      marginTop: -10,
      marginBottom: 10,
      textAlign: 'center',
      color: Colors.PRIMARY, // Slightly different color to distinguish from recommended
    },
    activityDetailOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      justifyContent: 'flex-end',
    },
    overlayBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomPopup: {
      height: '67%',
      backgroundColor: Colors.WHITE,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      paddingTop: 25,
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingVertical: 60,
      minHeight: 400,
    },
    emptyStateTitle: {
      fontFamily: 'outfit-bold',
      fontSize: 24,
      color: '#1a1a1a',
      marginTop: 20,
      marginBottom: 10,
      textAlign: 'center',
    },
    emptyStateText: {
      fontFamily: 'outfit',
      fontSize: 16,
      color: Colors.GRAY,
      textAlign: 'center',
      lineHeight: 24,
    },
    addActivitiesContainer: {
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    addActivitiesButton: {
      marginTop: -20,
      marginBottom: 70,
      backgroundColor: 'white',
      borderRadius: 15,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginHorizontal: -20,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    addActivitiesButtonText: {
      fontFamily: 'outfit',
      fontSize: 14,
      color: '#1a1a1a',
      fontWeight: '500',
    },
});