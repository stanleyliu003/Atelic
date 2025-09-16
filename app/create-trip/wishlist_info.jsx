import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useCreateTrip } from '../../context/CreateTripContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WishlistActivities } from '../../src/components/trip-view';
import { ActivityDetailView } from '../../src/components/trip-view/description_card';
import { AddPlacesButton } from '../../src/components/trip-view/add_places_button';
import { Colors } from './../../constants/Colors';
import { API_KEYS } from '../../constants/ApiKeys';
import { API, graphqlOperation } from 'aws-amplify';

export default function WishlistInfo() {
    const router = useRouter();
    const { activities, updateActivities, setCityCategories, CACHE_KEYS, selectedCity } = useCreateTrip();
    
    // State for selected activities - initialize with all activities selected
    const [selectedActivities, setSelectedActivities] = useState([]);
    // Loading state for create trip
    const [loading, setLoading] = useState(false);
    
    // State for activity detail view
    const [selectedActivityForDetail, setSelectedActivityForDetail] = useState(null);
    const [showActivityDetail, setShowActivityDetail] = useState(false);
    
    // State for add places modal
    const [isAddPlacesModalVisible, setIsAddPlacesModalVisible] = useState(false);
    const [isAddingPlace, setIsAddingPlace] = useState(false);

    // Initialize with no activities selected by default since all are now recommendations
    useEffect(() => {
        if (activities && activities.length > 0) {
            // Start with no activities selected - user can choose which ones they want
            setSelectedActivities([]);
        }
    }, [activities]);

    // Once activities are loaded, clear city categories and its cache so earlier steps won't display them
    useEffect(() => {
        const clearCategoriesIfLoaded = async () => {
            if (activities && activities.length > 0) {
                try {
                    setCityCategories(null);
                    await AsyncStorage.removeItem(CACHE_KEYS.CITY_CATEGORIES);
                } catch (e) {
                    console.warn('Failed clearing cached city categories in wishlist_info', e);
                }
            }
        };
        clearCategoriesIfLoaded();
        // We intentionally do not add setCityCategories or CACHE_KEYS to deps to avoid re-clearing unnecessarily
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activities]);

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
            
            // Call the backend to add additional place
            const result = await API.graphql(graphqlOperation(`
                query AddAdditionalPlace($placeName: String!, $selectedCity: String!) {
                    addAdditionalPlace(placeName: $placeName, selectedCity: $selectedCity) {
                        name
                        city
                        lat
                        lng
                        place_id
                        rating
                        user_ratings_total
                        formatted_address
                        types
                        primaryType
                        photo_reference
                        is_recommended
                        display_name
                        website_uri
                        regular_opening_hours {
                            open_now
                            weekday_text
                        }
                        reviews {
                            author_name
                            rating
                            text
                            time
                            author_url
                            profile_photo_url
                        }
                        editorial_summary
                        primary_type_display_name
                        international_phone_number
                    }
                }
            `, { 
                placeName: data.description,
                selectedCity: selectedCity || 'Unknown City'
            }));
            
            const newActivity = result?.data?.addAdditionalPlace;
            if (newActivity) {
                // Check for duplicates before adding
                const existingPlaceIds = new Set();
                
                // Collect place_ids from current activities
                (activities || []).forEach(activity => {
                    if (activity.place_id) {
                        existingPlaceIds.add(activity.place_id);
                    }
                });
                
                // Check if the new activity is a duplicate
                if (newActivity.place_id && existingPlaceIds.has(newActivity.place_id)) {
                    Alert.alert(
                        'Duplicate Place', 
                        `"${newActivity.name}" is already in your trip.`,
                        [{ text: 'OK' }]
                    );
                } else {
                    // Add the new activity to the wishlist
                    updateActivities([...activities, newActivity]);
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
        <TouchableOpacity onPress={()=>router.replace('/create-trip/create_trip_4_additional_info')}>
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
                    <Text style={styles.recommendedTitle}>Recommended Activities</Text>
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
            </>
          )}
          
          {/* Add Places Button - at the very bottom of scroll content */}
          <View style={styles.addPlacesButtonContainer}>
            <AddPlacesButton
                onPress={() => setIsAddPlacesModalVisible(true)}
                isAddingPlace={isAddingPlace}
                style={{ marginTop: 10, borderColor: Colors.GRAY }}
                showLoadingIndicator={false}
            />
          </View>
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
            {loading ? 'Creating Trip...' : 'Create Trip'}
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

        {/* Add Places Modal */}
        <Modal
          visible={isAddPlacesModalVisible}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setIsAddPlacesModalVisible(false)}
        >
          <KeyboardAvoidingView 
            style={styles.addPlacesModalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.addPlacesModalHeader}>
              <TouchableOpacity 
                onPress={() => setIsAddPlacesModalVisible(false)}
                style={styles.addPlacesModalCloseButton}
              >
                <Ionicons name="close" size={32} color={Colors.GRAY} />
              </TouchableOpacity>
              <Text style={styles.addPlacesModalTitle}>Add Additional Places</Text>
              <View style={styles.addPlacesModalSpacer} />
            </View>
            
            <View style={styles.addPlacesModalContent}>
              <GooglePlacesAutocomplete
                placeholder={`Search places in ${selectedCity}`}
                onPress={handlePlaceSelect}
                query={{
                  key: API_KEYS.GOOGLE_MAPS,
                  language: 'en',
                  ...(getBiasLocation() && {
                    location: getBiasLocation(),
                    radius: 10000, // 10km radius around the bias location
                  }),
                }}
                styles={{
                  container: styles.googlePlacesContainer,
                  textInputContainer: styles.googlePlacesTextInputContainer,
                  textInput: styles.googlePlacesInput,
                  listView: styles.googlePlacesList,
                  row: styles.googlePlacesRow,
                  description: styles.googlePlacesDescription,
                }}
                fetchDetails={false}
                enablePoweredByContainer={false}
                debounce={200}
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
    addPlacesButtonContainer: {
      alignItems: 'center',
      padding: 20,
      marginTop: -40,
      marginBottom: 0, // Extra space to ensure it's at the very bottom
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
      padding: 20,
      backgroundColor: Colors.PRIMARY,
      borderRadius: 15,
      marginTop: 30,
      marginBottom: 20,
    },
    disabledButton: {
      backgroundColor: Colors.GRAY,
      opacity: 0.6,
    },
    createTripButtonText: {
      color: Colors.WHITE,
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
    addPlacesModalContainer: {
      height: '50%', // Reduced to 50% of screen height
      backgroundColor: Colors.WHITE,
    },
    addPlacesModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E5E5',
    },
    addPlacesModalCloseButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPlacesModalTitle: {
      fontFamily: 'outfit-bold',
      fontSize: 24,
      color: '#1a1a1a',
    },
    addPlacesModalSpacer: {
      width: 40,
    },
    addPlacesModalContent: {
      flex: 1,
      padding: 20,
    },
    googlePlacesContainer: {
      flex: 0,
      zIndex: 1,
    },
    googlePlacesTextInputContainer: {
      flexDirection: 'row',
      width: '100%',
    },
    googlePlacesInput: {
      height: 50,
      color: '#1a1a1a',
      fontSize: 16,
      fontFamily: 'outfit',
      borderWidth: 1,
      borderRadius: 15,
      borderColor: '#1a1a1a',
      paddingHorizontal: 15,
      flex: 1,
    },
    googlePlacesList: {
      backgroundColor: 'white',
      borderRadius: 15,
      marginTop: 5,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    googlePlacesRow: {
      backgroundColor: 'white',
      padding: 13,
      height: 44,
      flexDirection: 'row',
    },
    googlePlacesDescription: {
      fontFamily: 'outfit',
      fontSize: 16,
      color: '#1a1a1a',
    }
});