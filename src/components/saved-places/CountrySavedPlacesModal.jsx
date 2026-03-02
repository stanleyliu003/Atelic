import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API, Auth } from 'aws-amplify';
import { Colors } from '../../../constants/Colors';
import { ActivityCard } from '../trip-view/activity/activity_card';
import { ActivityDetailView } from '../trip-view/description_card';
import { deleteSavedPlace as deleteSavedPlaceMutation } from '../../graphql/mutations';

const ADD_TO_TRIP_STORAGE_KEY = '@atelic/add_to_trip_activities';

const { height: screenHeight } = Dimensions.get('window');
const HEIGHT_STATES = [0.30, 0.65, 0.90];
const DEFAULT_HEIGHT_STATE = 1; // 0.65 default
const SNAP_THRESHOLD = 40;
const MARKER_LABELS = 'abcdefghijklmnopqrstuvwxyz';

// Strip ", Country" suffix from city names (e.g. "Milan, Italy" → "Milan")
function stripCountrySuffix(cityName) {
  if (!cityName) return cityName;
  const commaIdx = cityName.indexOf(',');
  return commaIdx !== -1 ? cityName.slice(0, commaIdx).trim() : cityName;
}

// Custom letter marker for city pins on the map
function CityMarker({ label }) {
  return (
    <View style={markerStyles.wrapper}>
      <View style={markerStyles.container}>
        <Text style={markerStyles.label}>{label}</Text>
      </View>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  container: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  label: {
    color: 'white',
    fontSize: 15,
    fontFamily: 'outfit-bold',
    fontWeight: 'bold',
  },
});

export function CountrySavedPlacesModal({ onClose, countryName, places, onPlaceDeleted }) {
  const router = useRouter();
  const mapRef = useRef(null);
  const [localPlaces, setLocalPlaces] = useState(places);
  const [expandedCities, setExpandedCities] = useState(new Set());
  const [currentHeightState, setCurrentHeightState] = useState(DEFAULT_HEIGHT_STATE);
  const [selectedActivitiesMap, setSelectedActivitiesMap] = useState(new Map());
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [descriptionCardVisible, setDescriptionCardVisible] = useState(false);

  // Animated value for smooth panel height transitions
  const panelHeightAnim = useRef(
    new Animated.Value(screenHeight * HEIGHT_STATES[DEFAULT_HEIGHT_STATE])
  ).current;

  // Shared value for access inside gesture worklets
  const heightStateShared = useSharedValue(DEFAULT_HEIGHT_STATE);

  useEffect(() => {
    setLocalPlaces(places);
  }, [places]);

  // Animate panel to new height when state changes
  useEffect(() => {
    Animated.spring(panelHeightAnim, {
      toValue: screenHeight * HEIGHT_STATES[currentHeightState],
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
      mass: 0.8,
    }).start();
  }, [currentHeightState]);

  const handleFavoritesButtonPress = () => {
    onClose();
    router.push('/saved-places-favorites');
  };

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

  const handleActivityPress = (activity) => {
    setSelectedActivity(activity);
    setDescriptionCardVisible(true);
  };

  const handleDescriptionCardClose = () => {
    setDescriptionCardVisible(false);
    setSelectedActivity(null);
  };

  const handleAddToTrip = async () => {
    if (selectedActivitiesMap.size === 0) return;
    const activities = Array.from(selectedActivitiesMap.values());
    await AsyncStorage.setItem(ADD_TO_TRIP_STORAGE_KEY, JSON.stringify(activities));
    onClose();
    router.push('/add-to-trip');
  };

  // Group localPlaces by city, compute centroid lat/lng from activity coordinates
  const citiesData = useMemo(() => {
    const cityMap = {};
    for (const place of localPlaces) {
      const cityName = stripCountrySuffix(place.city?.trim());
      if (!cityName) continue;
      if (!cityMap[cityName]) {
        cityMap[cityName] = { name: cityName, places: [], latSum: 0, lngSum: 0, coordCount: 0 };
      }
      cityMap[cityName].places.push(place);
      const lat = place.activity?.lat;
      const lng = place.activity?.lng;
      if (lat != null && lng != null) {
        cityMap[cityName].latSum += lat;
        cityMap[cityName].lngSum += lng;
        cityMap[cityName].coordCount++;
      }
    }
    return Object.values(cityMap)
      .map(c => ({
        name: c.name,
        places: c.places,
        count: c.places.length,
        lat: c.coordCount > 0 ? c.latSum / c.coordCount : null,
        lng: c.coordCount > 0 ? c.lngSum / c.coordCount : null,
      }))
      .sort((a, b) => b.count - a.count);
  }, [localPlaces]);

  const hasMapCoords = useMemo(
    () => citiesData.some(c => c.lat != null && c.lng != null),
    [citiesData]
  );

  // Re-fit map whenever height state changes
  useEffect(() => {
    const withCoords = citiesData.filter(c => c.lat != null && c.lng != null);
    if (!mapRef.current || withCoords.length === 0) return;
    const bottomPad = screenHeight * HEIGHT_STATES[currentHeightState] + 30;
    const coords = withCoords.map(c => ({ latitude: c.lat, longitude: c.lng }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: bottomPad, left: 60 },
      animated: true,
    });
  }, [currentHeightState]);

  const handleMapReady = () => {
    const withCoords = citiesData.filter(c => c.lat != null && c.lng != null);
    if (withCoords.length === 0 || !mapRef.current) return;

    const SINGLE_CITY_SPAN = 0.25;
    const bottomPad = screenHeight * HEIGHT_STATES[DEFAULT_HEIGHT_STATE] + 40;
    const coords = withCoords.length === 1
      ? [
          { latitude: withCoords[0].lat + SINGLE_CITY_SPAN, longitude: withCoords[0].lng + SINGLE_CITY_SPAN },
          { latitude: withCoords[0].lat - SINGLE_CITY_SPAN, longitude: withCoords[0].lng - SINGLE_CITY_SPAN },
        ]
      : withCoords.map(c => ({ latitude: c.lat, longitude: c.lng }));

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: bottomPad, left: 60 },
      animated: false,
    });
  };

  // Called from gesture worklet via runOnJS
  const applyHeightState = useCallback((newIndex) => {
    setCurrentHeightState(newIndex);
  }, []);

  // Drag handle gesture — drag up to expand, drag down to collapse
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      'worklet';
      const dy = event.translationY;
      let next = heightStateShared.value;
      if (dy < -SNAP_THRESHOLD) {
        next = Math.min(next + 1, HEIGHT_STATES.length - 1);
      } else if (dy > SNAP_THRESHOLD) {
        next = Math.max(next - 1, 0);
      }
      if (next !== heightStateShared.value) {
        heightStateShared.value = next;
        runOnJS(applyHeightState)(next);
      }
    });

  const handleToggleCity = (cityName) => {
    setExpandedCities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cityName)) {
        newSet.delete(cityName);
      } else {
        newSet.add(cityName);
      }
      return newSet;
    });
  };

  const handleDeleteActivity = async (activityToDelete) => {
    const { savedPlaceId } = activityToDelete;
    if (!savedPlaceId) {
      console.error('[CountrySavedPlacesModal] Cannot delete: savedPlaceId is missing.');
      return;
    }

    const deletedPlace = localPlaces.find(p => p.savedPlaceId === savedPlaceId);
    const cityName = stripCountrySuffix(deletedPlace?.city);

    // Optimistic UI update
    setLocalPlaces(prev => prev.filter(p => p.savedPlaceId !== savedPlaceId));

    try {
      const user = await Auth.currentAuthenticatedUser();
      await API.graphql({
        query: deleteSavedPlaceMutation,
        variables: { userID: user.username, savedPlaceId, deleteType: 'city' },
      });
      onPlaceDeleted?.(savedPlaceId, cityName);
    } catch (error) {
      console.error('[CountrySavedPlacesModal] Error deleting saved place:', error);
      setLocalPlaces(places); // Revert on failure
    }
  };

  const renderCityItem = ({ item, index }) => {
    const isExpanded = expandedCities.has(item.name);
    return (
      <View>
        <TouchableOpacity
          style={styles.cityRow}
          onPress={() => handleToggleCity(item.name)}
          activeOpacity={0.7}
        >
          <View style={styles.cityLabelBadge}>
            <Text style={styles.cityLabelText}>{MARKER_LABELS[index] ?? '•'}</Text>
          </View>
          <Text style={styles.cityName}>{item.name}</Text>
          <View style={styles.cityRowRight}>
            <Text style={styles.cityCount}>
              {item.count} place{item.count !== 1 ? 's' : ''}
            </Text>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={Colors.GRAY}
            />
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.cityActivitiesContainer}>
            {item.places
              .filter(place => place.activity)
              .map(place => {
                const activityWithDetails = {
                  ...place.activity,
                  savedPlaceId: place.savedPlaceId,
                  source: place.source,
                  sourceUrl: place.sourceUrl,
                };
                return (
                  <ActivityCard
                    key={place.savedPlaceId}
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
                    initialIsFavorite={place.isFavorite === true}
                  />
                );
              })}
          </View>
        )}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.root}>
          {/* Map fills entire background */}
          {hasMapCoords ? (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              onMapReady={handleMapReady}
              showsUserLocation={false}
              showsMyLocationButton={false}
            >
              {citiesData.map((city, idx) =>
                city.lat != null && city.lng != null ? (
                  <Marker
                    key={city.name}
                    coordinate={{ latitude: city.lat, longitude: city.lng }}
                    onPress={() => handleToggleCity(city.name)}
                  >
                    <CityMarker label={MARKER_LABELS[idx] ?? '•'} />
                  </Marker>
                ) : null
              )}
            </MapView>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]}>
              <Ionicons name="map-outline" size={48} color={Colors.GRAY} />
              <Text style={styles.mapPlaceholderText}>Location data unavailable</Text>
            </View>
          )}

          {/* Floating back button over map */}
          <TouchableOpacity style={styles.backButton} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          {/* Floating favorites button (top right) */}
          <TouchableOpacity
            style={styles.favoritesFloatingButton}
            onPress={handleFavoritesButtonPress}
            activeOpacity={0.8}
          >
            <Feather name="heart" size={24} color={Colors.GRAY} />
          </TouchableOpacity>

          {/* Draggable bottom panel */}
          <Animated.View style={[styles.bottomCard, { height: panelHeightAnim }]}>
            {/* Drag handle — gesture target */}
            <GestureDetector gesture={panGesture}>
              <View style={styles.dragHandleArea}>
                <View style={styles.dragIndicator} />
              </View>
            </GestureDetector>

            {/* Country title */}
            <Text style={styles.headerTitle}>{countryName}</Text>

            {/* City list */}
            {citiesData.length > 0 ? (
              <FlatList
                data={citiesData}
                renderItem={renderCityItem}
                keyExtractor={item => item.name}
                contentContainerStyle={[
                  styles.listContent,
                  selectedActivitiesMap.size > 0 && { paddingBottom: 130 },
                ]}
                showsVerticalScrollIndicator={false}
                style={styles.flatList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="bookmark-outline" size={64} color={Colors.GRAY} />
                <Text style={styles.emptyText}>No saved cities in {countryName}</Text>
              </View>
            )}

            {/* Action buttons — visible when activities are selected */}
            {selectedActivitiesMap.size > 0 && (
              <View style={styles.actionButtonContainer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleAddToTrip}
                >
                  <Text style={styles.actionButtonText}>
                    Add Now to Trip
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mapPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  mapPlaceholderText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    marginTop: 8,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 15,
    zIndex: 10,
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
  favoritesFloatingButton: {
    position: 'absolute',
    top: 50,
    right: 15,
    zIndex: 10,
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
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  dragHandleArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  headerTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 30,
    color: '#1F2937',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 34,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cityLabelBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cityLabelText: {
    fontFamily: 'outfit-bold',
    fontSize: 13,
    color: Colors.PRIMARY,
  },
  cityName: {
    flex: 1,
    fontFamily: 'outfit-medium',
    fontSize: 17,
    color: '#1F2937',
  },
  cityRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cityCount: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
  },
  cityActivitiesContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  actionButtonContainer: {
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
  actionButton: {
    backgroundColor: '#F36406',
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
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
