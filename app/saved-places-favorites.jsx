import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API, Auth } from 'aws-amplify';
import { Colors } from '../constants/Colors';
import { ActivityCard } from '../src/components/trip-view/activity/activity_card';
import { ActivityDetailView } from '../src/components/trip-view/description_card';
import { getSavedPlacesDetailed } from '../src/graphql/customQueries';
import { toggleFavorite as toggleFavoriteMutation } from '../src/graphql/mutations';

const ADD_TO_TRIP_STORAGE_KEY = '@atelic/add_to_trip_activities';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEIGHT_STATES = [0.30, 0.65, 0.90];
const DEFAULT_HEIGHT_STATE = 1; // 0.65 default
const SNAP_THRESHOLD = 40;
const BUTTON_AREA_HEIGHT = 90;

function PlaceMarker({ number, isSelected }) {
  return (
    <View style={markerStyles.wrapper}>
      <View style={[markerStyles.container, isSelected && markerStyles.containerSelected]}>
        {isSelected
          ? <Text style={markerStyles.checkmark}>✓</Text>
          : <Text style={markerStyles.label}>{number}</Text>
        }
      </View>
      {isSelected && <View style={markerStyles.pin} />}
    </View>
  );
}

const markerStyles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  container: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F36406',
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
  containerSelected: {
    backgroundColor: Colors.BLACK,
    borderColor: 'white',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  label: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'outfit-bold',
    fontWeight: 'bold',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pin: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#16a34a',
    marginTop: -1,
  },
});

export default function SavedPlacesFavorites() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);

  const [favoritesItems, setFavoritesItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [descriptionCardVisible, setDescriptionCardVisible] = useState(false);
  const [currentHeightState, setCurrentHeightState] = useState(DEFAULT_HEIGHT_STATE);

  // Animated value for smooth panel height transitions
  const panelHeightAnim = useRef(
    new Animated.Value(SCREEN_HEIGHT * HEIGHT_STATES[DEFAULT_HEIGHT_STATE])
  ).current;

  // Shared value for access inside gesture worklets
  const heightStateShared = useSharedValue(DEFAULT_HEIGHT_STATE);

  useEffect(() => {
    loadFavorites();
  }, []);

  // Animate panel to new height when state changes
  useEffect(() => {
    Animated.spring(panelHeightAnim, {
      toValue: SCREEN_HEIGHT * HEIGHT_STATES[currentHeightState],
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
      mass: 0.8,
    }).start();
  }, [currentHeightState]);

  const loadFavorites = async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const result = await API.graphql({
        query: getSavedPlacesDetailed,
        variables: { userID: user.username },
      });
      const allPlaces = result.data?.getSavedPlaces?.savedPlaces ?? [];
      setFavoritesItems(allPlaces.filter(p => p.isFavorite === true));
    } catch (e) {
      console.error('[SavedPlacesFavorites] Error loading favorites:', e);
    }
  };

  const sections = useMemo(() => {
    const cityMap = new Map();
    favoritesItems.forEach((item, index) => {
      const city = item.city || item.country || 'Unknown';
      if (!cityMap.has(city)) cityMap.set(city, []);
      cityMap.get(city).push({ ...item, globalIndex: index });
    });
    return Array.from(cityMap.entries()).map(([title, data]) => ({ title, data }));
  }, [favoritesItems]);

  const placeCoords = useMemo(() =>
    favoritesItems
      .map(item => ({ lat: item.activity?.lat, lng: item.activity?.lng }))
      .filter(c => c.lat != null && c.lng != null),
    [favoritesItems]
  );

  const hasMapCoords = placeCoords.length > 0;

  // Re-fit map whenever height state or coordinates change
  useEffect(() => {
    if (!mapRef.current || placeCoords.length === 0) return;
    const bottomPad = SCREEN_HEIGHT * HEIGHT_STATES[currentHeightState] + 30;
    const coords = placeCoords.map(c => ({ latitude: c.lat, longitude: c.lng }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: bottomPad, left: 60 },
      animated: true,
    });
  }, [currentHeightState, placeCoords]);

  const handleMapReady = useCallback(() => {
    if (!mapRef.current || placeCoords.length === 0) return;
    const bottomPad = SCREEN_HEIGHT * HEIGHT_STATES[currentHeightState] + 30;
    const coords = placeCoords.length === 1
      ? [
          { latitude: placeCoords[0].lat + 0.12, longitude: placeCoords[0].lng + 0.12 },
          { latitude: placeCoords[0].lat - 0.12, longitude: placeCoords[0].lng - 0.12 },
        ]
      : placeCoords.map(c => ({ latitude: c.lat, longitude: c.lng }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: bottomPad, left: 60 },
      animated: false,
    });
  }, [placeCoords, currentHeightState]);

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

  const getActivityId = useCallback((item) => {
    const activity = item.activity;
    return activity?.instanceId || activity?.place_id || `idx-${item.globalIndex}`;
  }, []);

  const handleItemPress = useCallback((item) => {
    const id = getActivityId(item);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [getActivityId]);

  const handleRemoveFavorite = async (globalIndex) => {
    const removedItem = favoritesItems[globalIndex];
    if (!removedItem) return;
    const removedId = getActivityId(removedItem);
    // Optimistic UI update
    setFavoritesItems(prev => prev.filter((_, i) => i !== globalIndex));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(removedId);
      return next;
    });
    try {
      const user = await Auth.currentAuthenticatedUser();
      await API.graphql({
        query: toggleFavoriteMutation,
        variables: { userID: user.username, savedPlaceId: removedItem.savedPlaceId, isFavorite: false },
      });
    } catch (e) {
      console.error('[SavedPlacesFavorites] Error removing favorite:', e);
      loadFavorites(); // revert on failure
    }
  };

  const handleAddToTrip = async () => {
    if (selectedIds.size === 0) return;
    const selectedItems = favoritesItems.filter(item => selectedIds.has(getActivityId(item)));
    const activities = selectedItems.map(item => item.activity).filter(Boolean);
    try {
      await AsyncStorage.setItem(ADD_TO_TRIP_STORAGE_KEY, JSON.stringify(activities));
      // Un-favorite each selected item in the cloud
      const user = await Auth.currentAuthenticatedUser();
      await Promise.all(
        selectedItems.map(item =>
          API.graphql({
            query: toggleFavoriteMutation,
            variables: { userID: user.username, savedPlaceId: item.savedPlaceId, isFavorite: false },
          })
        )
      );
      router.push('/add-to-trip');
    } catch (e) {
      console.error('[SavedPlacesFavorites] Error adding to trip:', e);
    }
  };

  const handleDescriptionCardPress = (activity) => {
    setSelectedActivity(activity);
    setDescriptionCardVisible(true);
  };

  const handleDescriptionCardClose = () => {
    setDescriptionCardVisible(false);
    setSelectedActivity(null);
  };

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }) => {
    const activity = item.activity;
    if (!activity) return null;
    const id = getActivityId(item);
    const isSelected = selectedIds.has(id);
    // Attach savedPlaceId to activity so ActivityCard can call toggleFavorite
    const activityWithPlaceId = { ...activity, savedPlaceId: item.savedPlaceId };
    return (
      <ActivityCard
        activity={activityWithPlaceId}
        isSelected={isSelected}
        onPress={() => handleItemPress(item)}
        onDescriptionCardPress={() => handleDescriptionCardPress(activity)}
        onSwipeDelete={() => handleRemoveFavorite(item.globalIndex)}
        hideNotesButton={true}
        hideRouteInfo={true}
        deleteSavedPlace={true}
        showSelectionIndicator={true}
        useInlineSelectionLayout={true}
        index={item.globalIndex}
        showFavoritesButton={true}
        initialIsFavorite={true}
        onFavoritesToggle={() => {
          setFavoritesItems(prev => prev.filter(f => f.savedPlaceId !== item.savedPlaceId));
          setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(getActivityId(item));
            return next;
          });
        }}
      />
    );
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Map fills the entire screen background */}
      {hasMapCoords ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          onMapReady={handleMapReady}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {favoritesItems.map((item, idx) => {
            if (item.activity?.lat == null || item.activity?.lng == null) return null;
            const id = item.activity?.instanceId || item.activity?.place_id || `idx-${idx}`;
            const isSelected = selectedIds.has(id);
            return (
              <Marker
                key={`favorites-marker-${idx}`}
                coordinate={{ latitude: item.activity.lat, longitude: item.activity.lng }}
                tracksViewChanges={isSelected}
              >
                <PlaceMarker number={idx + 1} isSelected={isSelected} />
              </Marker>
            );
          })}
        </MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]}>
          <Ionicons name="map-outline" size={48} color={Colors.GRAY} />
          <Text style={styles.mapPlaceholderText}>No location data available</Text>
        </View>
      )}

      {/* Floating back button */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 10 }]}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={24} color="#1F2937" />
      </TouchableOpacity>

      {/* Draggable bottom panel */}
      <Animated.View style={[styles.panel, { height: panelHeightAnim }]}>
        {/* Drag handle — gesture target */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.dragHandleArea}>
            <View style={styles.dragIndicator} />
          </View>
        </GestureDetector>

        {favoritesItems.length > 0 ? (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => `favorites-item-${item.globalIndex ?? index}`}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            style={styles.sectionList}
          />
        ) : (
          <View style={styles.emptyWrapper}>
            <View style={styles.listHeaderContainer}>
              <Text style={styles.cardTitle}>My Favorites</Text>
            </View>
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={48} color={Colors.GRAY} />
              <Text style={styles.emptyText}>Your favorites is empty</Text>
              <Text style={styles.emptySubtext}>Add places from your saved cities</Text>
            </View>
          </View>
        )}

        {/* Add Now to Trip — visible at the bottom of the panel only when items are selected */}
        {selectedIds.size > 0 && (
          <View style={[styles.bottomButtonContainer, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={styles.addToTripButton}
              onPress={handleAddToTrip}
            >
              <Text style={styles.addToTripButtonText}>
                {`Add Now to Trip (${selectedIds.size})`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Description Card Modal */}
      <Modal
        visible={descriptionCardVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleDescriptionCardClose}
      >
        <SafeAreaView style={styles.descriptionModalContainer}>
          <View style={styles.descriptionModalWrapper}>
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
    backgroundColor: '#E8ECF0',
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
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
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
  listHeaderContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  cardTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 32,
    color: '#1F2937',
  },
  sectionList: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: 'white',
    gap: 8,
  },
  sectionHeaderText: {
    fontFamily: 'outfit-bold',
    fontSize: 25,
    marginTop: 10,
    marginBottom: 13,
    color: '#1a1a1a',
  },
  emptyWrapper: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: '#374151',
    marginTop: 12,
  },
  emptySubtext: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    marginTop: 6,
  },
  bottomButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  addToTripButton: {
    backgroundColor: '#F36406',
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToTripButtonText: {
    color: 'white',
    fontFamily: 'outfit-bold',
    fontSize: 17,
  },
  descriptionModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  descriptionModalWrapper: {
    flex: 1,
    marginHorizontal: 10,
  },
});
