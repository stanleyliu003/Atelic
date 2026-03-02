import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import { ActivityCard } from '../trip-view/activity/activity_card';
import { ActivityDetailView } from '../trip-view/description_card';
import { useRouter } from 'expo-router';
import { API, Auth } from 'aws-amplify';
import { deleteSavedPlace } from '../../graphql/mutations';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ADD_TO_TRIP_STORAGE_KEY = '@atelic/add_to_trip_activities';

export function CitySavedPlacesModal({ onClose, cityName, places, onPlaceDeleted, isCountry }) {
  const router = useRouter();
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [descriptionCardVisible, setDescriptionCardVisible] = useState(false);
  const [localPlaces, setLocalPlaces] = useState(places);
  // Map of savedPlaceId -> activityWithDetails for selected activities
  const [selectedActivitiesMap, setSelectedActivitiesMap] = useState(new Map());

  useEffect(() => {
    setLocalPlaces(places);
  }, [places]);

  useEffect(() => {
    setSelectedActivitiesMap(new Map());
  }, [cityName]);

  const handleToggleSelection = (activity) => {
    setSelectedActivitiesMap(prev => {
      const newMap = new Map(prev);
      if (newMap.has(activity.savedPlaceId)) {
        newMap.delete(activity.savedPlaceId);
      } else {
        newMap.set(activity.savedPlaceId, activity);
      }
      return newMap;
    });
  };

  const handleAddToTrip = async () => {
    if (selectedActivitiesMap.size === 0) return;
    const activities = Array.from(selectedActivitiesMap.values());
    await AsyncStorage.setItem(ADD_TO_TRIP_STORAGE_KEY, JSON.stringify(activities));
    onClose();
    router.push('/add-to-trip');
  };

  const handleFavoritesButtonPress = () => {
    onClose();
    router.push('/saved-places-favorites');
  };

  const handleActivityPress = (activity) => {
    setSelectedActivity(activity);
    setDescriptionCardVisible(true);
  };

  const handleDescriptionCardClose = () => {
    setDescriptionCardVisible(false);
    setSelectedActivity(null);
  };

  const handleDeleteActivity = async (activityToDelete) => {
    // The activity object from ActivityCard contains the savedPlaceId we added
    const { savedPlaceId } = activityToDelete;
    if (!savedPlaceId) {
      console.error('[CitySavedPlacesModal] Cannot delete: savedPlaceId is missing.');
      return;
    }

    // Optimistic UI update
    setLocalPlaces(currentPlaces =>
      currentPlaces.filter(p => p.savedPlaceId !== savedPlaceId)
    );

    try {
      const user = await Auth.currentAuthenticatedUser();
      const userID = user.username;

      await API.graphql({
        query: deleteSavedPlace,
        variables: { userID, savedPlaceId, deleteType: isCountry ? 'country' : 'city' },
      });

      onPlaceDeleted?.(savedPlaceId);
    } catch (error) {
      console.error('[CitySavedPlacesModal] Error deleting saved place:', error);
      setLocalPlaces(places); // Revert on failure
    }
  };

  const renderActivityItem = ({ item }) => {
    console.log('[CitySavedPlacesModal] Rendering item:', {
      savedPlaceId: item.savedPlaceId,
      city: item.city,
      hasActivity: !!item.activity,
      activityName: item.activity?.name,
      source: item.source,
      sourceUrl: item.sourceUrl
    });

    // Extract the activity data from the saved place
    const activity = item.activity; // The DynamoDB field is 'activity', not 'activityData'

    // Skip rendering if activity data is missing
    if (!activity) {
      console.warn('[CitySavedPlacesModal] Skipping item with missing activity');
      return null;
    }

    // Copy source and sourceUrl from SavedPlace to Activity for display in description card
    // Also pass savedPlaceId so the delete function can find it
    const activityWithDetails = {
      ...activity,
      savedPlaceId: item.savedPlaceId,
      source: item.source,
      sourceUrl: item.sourceUrl,
    };

    return (
      <ActivityCard
        activity={activityWithDetails}
        onPress={() => handleToggleSelection(activityWithDetails)}
        onDescriptionCardPress={() => handleActivityPress(activityWithDetails)}
        onSwipeDelete={handleDeleteActivity}
        showSelectionIndicator={true}
        useInlineSelectionLayout={true}
        isSelected={selectedActivitiesMap.has(activityWithDetails.savedPlaceId)}
        hideNotesButton={true}
        hideRouteInfo={true}
        deleteSavedPlace={true}
        showFavoritesButton={true}
        initialIsFavorite={item.isFavorite === true}
      />
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="arrow-back" size={28} color={Colors.PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{cityName}</Text>
          <TouchableOpacity
            onPress={handleFavoritesButtonPress}
            style={styles.favoritesHeaderButton}
          >
            <Feather name="heart" size={24} color={Colors.GRAY} />
          </TouchableOpacity>
        </View>

        {/* Activity List */}
        {places && places.length > 0 ? (
          <FlatList
            data={localPlaces}
            renderItem={renderActivityItem}
            keyExtractor={(item, index) => item.savedPlaceId || `saved-place-${index}`}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color={Colors.GRAY} />
            <Text style={styles.emptyText}>No saved places in {cityName}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.createTripButtonContainer}>
          <TouchableOpacity
            style={[
              styles.createTripButton,
              selectedActivitiesMap.size === 0 && styles.createTripButtonDisabled,
            ]}
            onPress={handleAddToTrip}
            disabled={selectedActivitiesMap.size === 0}
          >
            <Text style={styles.createTripButtonText}>
              {selectedActivitiesMap.size > 0
                ? `Add Now to Trip (${selectedActivitiesMap.size})`
                : 'Add Now to Trip'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Description Card Modal */}
        <Modal
          visible={descriptionCardVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleDescriptionCardClose}
        >
          <SafeAreaView style={styles.descriptionCardModalContainer}>
            <View style={styles.descriptionCardWrapper}>
              {selectedActivity && (
                <ActivityDetailView
                  activity={selectedActivity}
                  onClose={handleDescriptionCardClose}
                  variant="wishlist"
                  showDragIndicator={false}
                  currentUserRole="owner"
                />
              )}
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 22,
    color: Colors.PRIMARY,
  },
  favoritesHeaderButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: 'outfit',
    fontSize: 18,
    color: Colors.GRAY,
    marginTop: 16,
    textAlign: 'center',
  },
  createTripButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 34,
    paddingTop: 12,
    backgroundColor: Colors.WHITE,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    gap: 10,
  },
  createTripButton: {
    backgroundColor: '#F36406',
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTripButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  createTripButtonText: {
    color: Colors.WHITE,
    fontFamily: 'outfit-bold',
    fontSize: 17,
  },
  descriptionCardModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  descriptionCardWrapper: {
    flex: 1,
    marginHorizontal: 10,
  },
});
