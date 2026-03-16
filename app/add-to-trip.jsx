import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { API, Auth } from 'aws-amplify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { randomUUID } from 'expo-crypto';
import { Colors } from '../constants/Colors';
import { TripCard } from '../src/components/profile/TripCard';
import { listUserTripsFromCloud, retrieveTripFromCloud } from '../src/services/lambdaService';
import { createTrip } from '../src/graphql/mutations';
import { useCreateTrip } from '../context/CreateTripContext';
import { setCachedTrip } from '../src/services/tripCacheService';

const ADD_TO_TRIP_STORAGE_KEY = '@atelic/add_to_trip_activities';

export default function AddToTripScreen() {
  const router = useRouter();
  const { restoreTripFromObject, setSelectedCity } = useCreateTrip();
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [userTrips, setUserTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserID, setCurrentUserID] = useState('');
  const [username, setUsername] = useState('');
  const [addingToTripId, setAddingToTripId] = useState(null);
  const [carouselIndices, setCarouselIndices] = useState({});
  const [tripPhotoCounts, setTripPhotoCounts] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem(ADD_TO_TRIP_STORAGE_KEY);
      if (stored) {
        setSelectedActivities(JSON.parse(stored));
      }

      const user = await Auth.currentAuthenticatedUser();
      const userID = user.username;
      const userName = user.attributes?.preferred_username || '';
      setCurrentUserID(userID);
      setUsername(userName);

      await loadUserTrips(userID);
    } catch (error) {
      console.error('[AddToTrip] Error loading data:', error);
      setIsLoading(false);
    }
  };

  const loadUserTrips = async (userID) => {
    try {
      setIsLoading(true);
      const tripSummaries = await listUserTripsFromCloud(userID);
      const allTrips = tripSummaries || [];

      // Normalize trip photo references (same logic as feed.jsx)
      const normalizedTrips = allTrips.map(trip => {
        let photoRef = trip.tripPhotoReference;

        if (typeof photoRef === 'string') {
          if (photoRef.startsWith('[[') && photoRef.endsWith(']]')) {
            photoRef = photoRef.slice(1, -1);
          }
          if (photoRef.startsWith('[') && photoRef.endsWith(']')) {
            const content = photoRef.slice(1, -1);
            if (content.trim()) {
              photoRef = content.split(',').map(item => item.trim());
            } else {
              photoRef = [];
            }
          } else {
            try {
              const parsed = JSON.parse(photoRef);
              photoRef = Array.isArray(parsed) ? parsed : [photoRef];
            } catch (e) {
              photoRef = [photoRef];
            }
          }
        } else if (!Array.isArray(photoRef)) {
          photoRef = photoRef ? [photoRef] : [];
        }

        const photoObjects = (photoRef || []).map(ref => {
          if (!ref) return null;
          if (typeof ref === 'object') {
            return {
              photo_reference: ref.photo_reference || ref.photoRef || null,
              place_id: ref.place_id || null,
            };
          }
          if (typeof ref === 'string') {
            const trimmed = ref.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try {
                const parsed = JSON.parse(trimmed);
                return {
                  photo_reference: parsed.photo_reference || parsed.photoRef || null,
                  place_id: parsed.place_id || null,
                };
              } catch (e) {}
            }
            return { photo_reference: trimmed || null, place_id: null };
          }
          return null;
        }).filter(Boolean);

        return { ...trip, tripPhotoReference: photoObjects };
      });

      // Include owned and editor trips (user has write access)
      const editableTrips = normalizedTrips.filter(
        t => t.userRole === 'owner' || t.userRole === 'editor'
      );
      setUserTrips(editableTrips);
    } catch (error) {
      console.error('[AddToTrip] Error loading trips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sanitizeActivity = (activity) => {
    if (!activity) return null;
    const {
      __typename, lastModified, modifiedBy, lastReordered, category,
      savedPlaceId, source, sourceUrl,
      ...rest
    } = activity;
    rest.place_id = typeof rest.place_id === 'string' && rest.place_id.trim() !== '' ? rest.place_id : 'unknown_place';
    rest.name = typeof rest.name === 'string' && rest.name.trim() !== '' ? rest.name : 'Unknown Place';
    if (rest.regular_opening_hours) {
      const { __typename: ohTypename, ...ohRest } = rest.regular_opening_hours;
      rest.regular_opening_hours = ohRest;
      if (rest.regular_opening_hours.periods) {
        rest.regular_opening_hours.periods = rest.regular_opening_hours.periods.map(p => {
          const { __typename: pTypename, ...pRest } = p || {};
          if (pRest.open) { const { __typename: openTypename, ...openRest } = pRest.open; pRest.open = openRest; }
          if (pRest.close) { const { __typename: closeTypename, ...closeRest } = pRest.close; pRest.close = closeRest; }
          return pRest;
        });
      }
    }
    if (rest.reviews) {
      rest.reviews = rest.reviews.map(r => {
        const { __typename: rTypename, ...rRest } = r || {};
        return rRest;
      });
    }
    return rest;
  };

  const handleTripPress = async (trip) => {
    if (addingToTripId) return;

    try {
      setAddingToTripId(trip.tripId);

      const fullTripData = await retrieveTripFromCloud(currentUserID, trip.tripId);
      if (!fullTripData) throw new Error('Could not retrieve trip data');

      // Sanitize new activities and assign fresh instanceIds
      const newActivities = selectedActivities.map(activity => {
        const sanitized = sanitizeActivity(activity);
        if (!sanitized) return null;
        sanitized.instanceId = randomUUID();
        return sanitized;
      }).filter(Boolean);

      const existingWishlist = (fullTripData.wishlist || []).map(sanitizeActivity).filter(Boolean);

      const tripData = {
        tripId: fullTripData.tripId,
        userID: currentUserID,
        tripTitle: fullTripData.tripTitle || null,
        days: (fullTripData.days || []).map(day => ({
          dayNumber: day.dayNumber,
          activities: (day.activities || []).map(sanitizeActivity).filter(Boolean),
          encodedPolyline: day.encodedPolyline || null,
        })),
        wishlist: [...existingWishlist, ...newActivities],
        tripLength: fullTripData.tripLength,
        selectedCity: fullTripData.selectedCity,
        tripPhotoReference: fullTripData.tripPhotoReference || [],
        createdAt: fullTripData.createdAt,
        startDate: fullTripData.startDate || null,
        endDate: fullTripData.endDate || null,
        cityCategories: (fullTripData.cityCategories || []).map(c => {
          if (!c) return null;
          const { __typename, ...rest } = c;
          if (typeof rest.category !== 'string' || rest.category.trim() === '') return null;
          rest.category_items = Array.isArray(rest.category_items)
            ? rest.category_items.filter(i => typeof i === 'string' && i.trim() !== '')
            : [];
          return rest;
        }).filter(Boolean),
        recentSearches: (fullTripData.recentSearches || []).map(rs => {
          if (!rs) return null;
          const { __typename, ...rest } = rs;
          if (typeof rest.place_id !== 'string' || rest.place_id.trim() === '') return null;
          if (typeof rest.name !== 'string' || rest.name.trim() === '') return null;
          rest.timestamp = typeof rest.timestamp === 'string' && rest.timestamp.trim() !== ''
            ? rest.timestamp
            : new Date().toISOString();
          return rest;
        }).filter(Boolean),
        collaborators: (fullTripData.collaborators || []).map(c => {
          if (!c) return null;
          const { __typename, ...rest } = c;
          rest.email = typeof rest.email === 'string' && rest.email.trim() !== '' ? rest.email : 'unknown@email.com';
          rest.fullName = typeof rest.fullName === 'string' && rest.fullName.trim() !== '' ? rest.fullName : 'Unknown User';
          rest.username = typeof rest.username === 'string' && rest.username.trim() !== '' ? rest.username : 'unknown';
          rest.userID = typeof rest.userID === 'string' && rest.userID.trim() !== '' ? rest.userID : 'unknown_user';
          rest.addedBy = typeof rest.addedBy === 'string' && rest.addedBy.trim() !== '' ? rest.addedBy : (rest.fullName || 'system');
          return rest;
        }).filter(Boolean),
        version: (fullTripData.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        lastUpdatedBy: username || 'unknown',
        deletedSavedPlaceIds: Array.isArray(fullTripData.deletedSavedPlaceIds)
          ? fullTripData.deletedSavedPlaceIds.filter(id => typeof id === 'string' && id.trim() !== '')
          : [],
        isPublic: fullTripData.isPublic || false,
      };

      await API.graphql({ query: createTrip, variables: { input: tripData } });
      await AsyncStorage.removeItem(ADD_TO_TRIP_STORAGE_KEY);

      // Restore the updated trip into context and navigate to it with wishlist tab active
      const tripForContext = {
        ...fullTripData,
        wishlist: tripData.wishlist,
      };
      // Keep cache in sync with the new wishlist (fire-and-forget)
      setCachedTrip(fullTripData.tripId, tripForContext);
      restoreTripFromObject(tripForContext, currentUserID);
      setSelectedCity(fullTripData.selectedCity);
      router.replace('/trip-view/trip-view_main');
    } catch (error) {
      console.error('[AddToTrip] Error adding to trip:', error);
      Alert.alert('Error', 'Failed to add activities to trip. Please try again.');
    } finally {
      setAddingToTripId(null);
    }
  };

  const handlePhotoRefUpdate = (tripId, index, newRef) => {
    setUserTrips(prev => prev.map(trip => {
      if (trip.tripId !== tripId || !Array.isArray(trip.tripPhotoReference)) return trip;
      let updatedPhotos;
      if (newRef === null) {
        updatedPhotos = trip.tripPhotoReference.filter((_, idx) => idx !== index);
      } else {
        updatedPhotos = trip.tripPhotoReference.map((ref, idx) => {
          if (idx !== index || !ref) return ref;
          if (typeof ref === 'object') return { ...ref, photo_reference: newRef };
          return { photo_reference: newRef, place_id: null };
        });
      }
      return { ...trip, tripPhotoReference: updatedPhotos };
    }));
  };

  const renderTrip = ({ item: trip }) => {
    const tripKey = `trip-${trip.tripId}`;
    return (
      <TripCard
        trip={trip}
        tripKey={tripKey}
        isLoading={addingToTripId === trip.tripId}
        isDeleting={false}
        isSelected={addingToTripId === trip.tripId}
        onPress={() => handleTripPress(trip)}
        onMenuPress={() => {}}
        onPhotoRefUpdate={handlePhotoRefUpdate}
        onPhotoCountUpdate={(key, count) =>
          setTripPhotoCounts(prev => ({ ...prev, [key]: count }))
        }
        photoCount={tripPhotoCounts[tripKey] || 5}
        currentCarouselIndex={carouselIndices[tripKey] || 0}
        onCarouselIndexChange={(key, index) =>
          setCarouselIndices(prev => ({ ...prev, [key]: index }))
        }
      />
    );
  };

  const activityCount = selectedActivities.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={Colors.PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>
          Select trip to add {activityCount} {activityCount === 1 ? 'activity' : 'activities'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.PRIMARY} />
          <Text style={styles.loadingText}>Loading trips...</Text>
        </View>
      ) : userTrips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="map-outline" size={64} color={Colors.GRAY} />
          <Text style={styles.emptyText}>No trips found</Text>
        </View>
      ) : (
        <FlatList
          data={userTrips}
          renderItem={renderTrip}
          keyExtractor={item => item.tripId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 20,
    color: Colors.PRIMARY,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
    marginTop: 12,
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
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
});
