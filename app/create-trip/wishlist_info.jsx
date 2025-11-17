import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { WishlistActivities } from '../../src/components/trip-view';
import { ActivityDetailView } from '../../src/components/trip-view/description_card';
import { SearchBar } from '../../src/components/explore/SearchBar';
import { AutocompleteModal } from '../../src/components/explore/AutocompleteModal';
import { Colors } from './../../constants/Colors';

export default function WishlistInfo() {
    const router = useRouter();
    const { activities, updateActivities, removeActivities, selectedCity, searchActivities } = useCreateTrip();

    // State for selected activities - initialize with all activities selected
    const [selectedActivities, setSelectedActivities] = useState([]);

    // Select all activities by default on mount or when activities change
    useEffect(() => {
        if (activities && activities.length > 0) {
            const allActivityIds = activities
                .filter(activity => activity.instanceId || activity.place_id)
                .map(activity => activity.instanceId || activity.place_id);
            setSelectedActivities(allActivityIds);
        }
    }, [activities]);
    // Loading state for create trip
    const [loading, setLoading] = useState(false);

    // State for activity detail view
    const [selectedActivityForDetail, setSelectedActivityForDetail] = useState(null);
    const [showActivityDetail, setShowActivityDetail] = useState(false);

    // State for SearchBar and AutocompleteModal
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilters, setSelectedFilters] = useState([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);

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

    // Handler for SearchBar press
    const handleSearchPress = () => {
        setShowAutocomplete(true);
    };

    // Handler for search query change
    const handleSearchQueryChange = (text) => {
        setSearchQuery(text);
    };

    // Handler for filter toggle
    const handleFilterToggle = (filterId) => {
        setSelectedFilters((prev) => {
            if (prev.includes(filterId)) {
                return prev.filter((id) => id !== filterId);
            } else {
                return [...prev, filterId];
            }
        });
    };

    // Handler for searching activities
    const handleSearchActivities = async (query, filters, existingActivities) => {
        try {
            const results = await searchActivities(query, filters, existingActivities);
            return results;
        } catch (error) {
            console.error('[wishlist_info] Error fetching search results:', error);
            throw error;
        }
    };

    // Handler for saving search results
    const handleSaveSearchResults = (selectedActivitiesFromSearch, deselectedWishlistActivityIds = []) => {
        // Remove deselected wishlist activities
        if (deselectedWishlistActivityIds.length > 0) {
            removeActivities(deselectedWishlistActivityIds);
            // Also remove from local selected state
            setSelectedActivities(prev => 
                prev.filter(id => !deselectedWishlistActivityIds.includes(id))
            );
        }

        // Add newly selected activities
        if (selectedActivitiesFromSearch.length > 0) {
            // Add the selected activities to the wishlist
            updateActivities([...(activities || []), ...selectedActivitiesFromSearch]);

            // Auto-select the newly added activities
            const newActivityIds = selectedActivitiesFromSearch
                .map(activity => activity.place_id)
                .filter(Boolean);
            setSelectedActivities(prev => [...prev, ...newActivityIds]);
        }

        // Close the autocomplete modal and reset search
        setShowAutocomplete(false);
        setSearchQuery('');
    };

    // Handle create trip button press
    const handleCreateTrip = () => {
        setLoading(true);

        // Filter activities to only include selected ones
        const selectedActivitiesList = activities.filter(activity => {
            const activityId = activity.instanceId || activity.place_id;
            return activityId && selectedActivities.includes(activityId);
        });

        // Get IDs of deselected activities to remove from context
        const deselectedActivities = activities.filter(activity => {
            const activityId = activity.instanceId || activity.place_id;
            return activityId && !selectedActivities.includes(activityId);
        });

        // Get instanceIds or place_ids for removal
        const deselectedIds = deselectedActivities
            .map(activity => activity.instanceId || activity.place_id)
            .filter(Boolean);

        // Remove deselected activities from context first
        if (deselectedIds.length > 0) {
            removeActivities(deselectedIds);
        }

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

              {/* Search Bar for Adding Activities */}
              <View style={styles.searchBarContainer}>
                <SearchBar
                  value={searchQuery}
                  onChangeText={handleSearchQueryChange}
                  onPress={handleSearchPress}
                  placeholder="Add more activities"
                />
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

        {/* AutocompleteModal for searching activities */}
        <AutocompleteModal
          visible={showAutocomplete}
          query={searchQuery}
          filters={selectedFilters}
          selectedCity={selectedCity || ''}
          onClose={() => {
            setShowAutocomplete(false);
            setSearchQuery('');
          }}
          onFilterToggle={handleFilterToggle}
          onQueryChange={handleSearchQueryChange}
          onSearchActivities={handleSearchActivities}
          onSaveActivities={handleSaveSearchResults}
          wishlistActivities={activities || []}
          activeTab="wishlist"
        />
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
    searchBarContainer: {
      marginTop: -10,
      marginBottom: 50,
    },
});