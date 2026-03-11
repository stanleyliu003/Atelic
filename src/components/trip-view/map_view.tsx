import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { getMarkerColor } from '../../constants/mapColors';
import { Activity, TabType } from '../../types/activity.types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../../constants/Colors';

// Map category names to consistent icons
const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap | null => {
  const cat = category.toLowerCase();

  // Map common category names to icons
  if (cat.includes('academic') || cat.includes('university') || cat.includes('education') || cat.includes('school')) {
    return 'school-outline';
  }
  if (cat.includes('historic') || cat.includes('history') || cat.includes('heritage')) {
    return 'time-outline';
  }
  if (cat.includes('museum') || cat.includes('art') || cat.includes('gallery')) {
    return 'albums-outline';
  }
  if (cat.includes('food') || cat.includes('dining') || cat.includes('restaurant') || cat.includes('culinary')) {
    return 'restaurant-outline';
  }
  if (cat.includes('nightlife') || cat.includes('bar') || cat.includes('club')) {
    return 'beer-outline';
  }
  if (cat.includes('park') || cat.includes('garden') || cat.includes('nature') || cat.includes('green')) {
    return 'leaf-outline';
  }
  if (cat.includes('beach') || cat.includes('waterfront') || cat.includes('harbor') || cat.includes('coastal')) {
    return 'water-outline';
  }
  if (cat.includes('shopping') || cat.includes('market') || cat.includes('boutique') || cat.includes('retail')) {
    return 'bag-outline';
  }
  if (cat.includes('entertainment') || cat.includes('fun') || cat.includes('activity') || cat.includes('activities')) {
    return 'happy-outline';
  }
  if (cat.includes('sport') || cat.includes('athletic') || cat.includes('fitness')) {
    return 'trophy-outline';
  }
  if (cat.includes('cultural') || cat.includes('culture')) {
    return 'business-outline';
  }
  if (cat.includes('religious') || cat.includes('spiritual') || cat.includes('worship')) {
    return 'business-outline';
  }
  if (cat.includes('landmark') || cat.includes('iconic') || cat.includes('famous')) {
    return 'camera-outline';
  }
  if (cat.includes('view') || cat.includes('scenic') || cat.includes('panoramic') || cat.includes('overlook')) {
    return 'eye-outline';
  }
  if (cat.includes('coffee') || cat.includes('cafe') || cat.includes('brunch')) {
    return 'cafe-outline';
  }
  if (cat.includes('family') || cat.includes('kids') || cat.includes('children')) {
    return 'happy-outline';
  }
  if (cat.includes('outdoor') || cat.includes('adventure') || cat.includes('hiking')) {
    return 'footsteps-outline';
  }
  if (cat.includes('theater') || cat.includes('theatre') || cat.includes('performance') || cat.includes('show')) {
    return 'musical-notes-outline';
  }
  if (cat.includes('local') || cat.includes('neighborhood') || cat.includes('authentic')) {
    return 'home-outline';
  }
  if (cat.includes('romantic') || cat.includes('date') || cat.includes('couple')) {
    return 'heart-outline';
  }
  if (cat.includes('luxury') || cat.includes('upscale') || cat.includes('premium')) {
    return 'diamond-outline';
  }
  if (cat.includes('budget') || cat.includes('affordable') || cat.includes('cheap')) {
    return 'pricetag-outline';
  }

  return null; // No category match, will fall back to type-based icon
};

// Map activity types to appropriate icons - Subtle and refined
const getActivityIcon = (activity: Activity): keyof typeof Ionicons.glyphMap => {
  // PRIORITY 1: Check if activity has a category assigned (from category exploration)
  if (activity.category) {
    const categoryIcon = getCategoryIcon(activity.category);
    if (categoryIcon) {
      return categoryIcon;
    }
  }

  // PRIORITY 2: Check primary_type_display_name (Google's display name)
  if (activity.primary_type_display_name) {
    const displayIcon = getCategoryIcon(activity.primary_type_display_name);
    if (displayIcon) {
      return displayIcon;
    }
  }

  // PRIORITY 3: Fall back to Google Places types
  const primaryType = activity.primaryType?.toLowerCase();
  const types = activity.types?.map(t => t.toLowerCase()) || [];
  const allTypes = [primaryType, ...types].filter(Boolean);

  // Lodging
  if (activity.isLodging || allTypes.some(t => t?.includes('lodging') || t?.includes('hotel') || t?.includes('hostel') || t?.includes('accommodation'))) {
    return 'bed-outline';
  }

  // Food & Drink
  if (allTypes.some(t => t?.includes('restaurant') || t?.includes('dining') || t?.includes('food'))) {
    return 'restaurant-outline';
  }
  if (allTypes.some(t => t?.includes('cafe') || t?.includes('coffee') || t?.includes('brunch'))) {
    return 'cafe-outline';
  }
  if (allTypes.some(t => t?.includes('bar') || t?.includes('night_club') || t?.includes('nightlife') || t?.includes('pub'))) {
    return 'beer-outline';
  }
  if (allTypes.some(t => t?.includes('bakery') || t?.includes('dessert'))) {
    return 'ice-cream-outline';
  }

  // Cultural & Historic
  if (allTypes.some(t => t?.includes('museum') || t?.includes('art_gallery') || t?.includes('gallery'))) {
    return 'albums-outline';
  }
  if (allTypes.some(t => t?.includes('historic') || t?.includes('heritage') || t?.includes('monument') || t?.includes('memorial'))) {
    return 'time-outline';
  }
  if (allTypes.some(t => t?.includes('landmark') || t?.includes('tourist_attraction') || t?.includes('attraction'))) {
    return 'camera-outline';
  }
  if (allTypes.some(t => t?.includes('church') || t?.includes('cathedral') || t?.includes('mosque') || t?.includes('synagogue') || t?.includes('temple') || t?.includes('religious'))) {
    return 'business-outline';
  }

  // Nature & Outdoors
  if (allTypes.some(t => t?.includes('park') || t?.includes('garden') || t?.includes('green') || t?.includes('nature'))) {
    return 'leaf-outline';
  }
  if (allTypes.some(t => t?.includes('beach') || t?.includes('waterfront') || t?.includes('harbor') || t?.includes('bay'))) {
    return 'water-outline';
  }
  if (allTypes.some(t => t?.includes('hiking') || t?.includes('trail') || t?.includes('outdoor') || t?.includes('adventure'))) {
    return 'footsteps-outline';
  }
  if (allTypes.some(t => t?.includes('viewpoint') || t?.includes('scenic') || t?.includes('vista') || t?.includes('overlook'))) {
    return 'eye-outline';
  }

  // Entertainment & Activities
  if (allTypes.some(t => t?.includes('zoo') || t?.includes('aquarium') || t?.includes('wildlife'))) {
    return 'fish-outline';
  }
  if (allTypes.some(t => t?.includes('theater') || t?.includes('theatre') || t?.includes('performance') || t?.includes('show'))) {
    return 'musical-notes-outline';
  }
  if (allTypes.some(t => t?.includes('amusement') || t?.includes('theme_park') || t?.includes('fun'))) {
    return 'happy-outline';
  }
  if (allTypes.some(t => t?.includes('stadium') || t?.includes('sports') || t?.includes('arena'))) {
    return 'trophy-outline';
  }
  if (allTypes.some(t => t?.includes('spa') || t?.includes('wellness') || t?.includes('relaxation'))) {
    return 'flower-outline';
  }
  if (allTypes.some(t => t?.includes('cinema') || t?.includes('movie'))) {
    return 'film-outline';
  }

  // Shopping
  if (allTypes.some(t => t?.includes('shopping') || t?.includes('market') || t?.includes('store') || t?.includes('boutique'))) {
    return 'bag-outline';
  }
  if (allTypes.some(t => t?.includes('book') || t?.includes('library'))) {
    return 'book-outline';
  }

  // Transportation
  if (allTypes.some(t => t?.includes('airport') || t?.includes('flight'))) {
    return 'airplane-outline';
  }
  if (allTypes.some(t => t?.includes('train') || t?.includes('subway') || t?.includes('metro'))) {
    return 'train-outline';
  }
  if (allTypes.some(t => t?.includes('bus') || t?.includes('transit'))) {
    return 'bus-outline';
  }

  // Services
  if (allTypes.some(t => t?.includes('hospital') || t?.includes('medical') || t?.includes('health'))) {
    return 'medkit-outline';
  }
  if (allTypes.some(t => t?.includes('education') || t?.includes('university') || t?.includes('school'))) {
    return 'school-outline';
  }

  // Default icon for general points of interest
  return 'ellipse-outline';
};

interface MapViewProps {
  activities: Activity[];
  activeTab: TabType;
  routeCoordinates?: { latitude: number, longitude: number }[];
  routeLoading?: boolean;
  selectedActivities?: string[]; // Add selected activities prop
  onMarkerPress?: (activity: Activity) => void; // Add callback for marker press
  selectedMarker?: string | null; // Add selected marker prop
  // Collaboration props
  onShareTrip?: () => void;
  allActivities?: Activity[]; // All activities from the trip (wishlist + all days)
  // Selected city's coordinates for initial centering when there are no activities yet
  selectedCityLocation?: { lat: number; lng: number } | null;
  // Overview mode: Multiple day polylines with colors
  dayPolylines?: Array<{ dayNumber: number; coordinates: { latitude: number; longitude: number }[]; color: string }>;
  // Map of activity instanceId to day number for overview mode coloring
  activityDayMap?: Map<string, number>;
  // Route data for distance labels
  routeData?: {
    legs: Array<{
      distance?: number; // in meters
      duration?: string;
    }>;
  };
}

// Distance label component (like in the reference screenshot)
const DistanceLabel = ({
  distance,
  color
}: {
  distance: string;
  color: string;
}) => (
  <View style={[styles.distanceLabel, { backgroundColor: color }]}>
    <Text style={styles.distanceLabelText}>{distance}</Text>
  </View>
);

// Custom marker component - Numbers for regular activities, icons for special types
const MarkerComponent = ({
  number,
  iconName,
  color,
  isSelected,
  isMarkerSelected,
  isLodging,
  distance
}: {
  number: number;
  iconName: keyof typeof Ionicons.glyphMap;
  color: string;
  isSelected: boolean;
  isMarkerSelected: boolean;
  isLodging?: boolean;
  distance?: string;
}) => (
  <View style={styles.markerWrapper}>
    <View style={styles.markerShadow}>
      <View style={[
        styles.markerContainer,
        {
          backgroundColor: isMarkerSelected ? '#1F2937' : (isSelected ? '#1F2937' : color),
        }
      ]}>
        {isSelected ? (
          <Ionicons name="checkmark" size={15} color="white" />
        ) : isLodging ? (
          <Ionicons name="home" size={16} color="white" />
        ) : (
          <Text style={styles.markerNumber}>{number}</Text>
        )}
      </View>
    </View>
  </View>
);

export function TripMapView({
  activities,
  activeTab,
  routeCoordinates = [],
  routeLoading = false,
  selectedActivities = [], // Add default value
  onMarkerPress, // Add callback prop
  selectedMarker = null, // Add selected marker prop
  onShareTrip,
  allActivities = [],
  selectedCityLocation = null,
  dayPolylines = [],
  activityDayMap,
  routeData,
}: MapViewProps) {
  const mapRef = useRef<MapView>(null);

  // Get the marker color based on the active tab (used for single day view)
  const markerColor = getMarkerColor(activeTab);

  // Prepare markers
  const dynamicMarkers = useMemo(() => {
    if (!activities || activities.length === 0) {
      return [];
    }

    // Helper to format distance
    const formatDistance = (meters: number): string => {
      if (meters < 1000) {
        return `${Math.round(meters)}m`;
      }
      return `${(meters / 1000).toFixed(1)}km`;
    };

    // Log lodging activities for debugging
    const lodgingActivities = activities.filter(a => a.isLodging);
    if (lodgingActivities.length > 0) {
      console.log('[TripMapView] Found lodging activities:', lodgingActivities.map(a => ({ name: a.name, isLodging: a.isLodging })));
    }

    return activities
      .filter((activity: Activity) => activity.lat != null && activity.lng != null)
      .map((activity: Activity, idx: number) => {
        // In overview mode with activityDayMap, use day-specific color
        let color = markerColor;
        if (activityDayMap && activity.instanceId) {
          const dayNumber = activityDayMap.get(activity.instanceId);
          if (dayNumber !== undefined) {
            color = getMarkerColor(`day${dayNumber}` as TabType);
          }
        }

        // Get distance from previous activity (only for day view, not overview)
        let distance: string | undefined;
        if (routeData && routeData.legs && idx > 0 && !activityDayMap) {
          const leg = routeData.legs[idx - 1]; // Previous leg leading to this marker
          if (leg && leg.distance) {
            distance = formatDistance(leg.distance);
          }
        }

        // Use distinct color for hotels
        const isHotel = activity.isLodging === true || activity.primaryType === 'lodging';
        const finalColor = isHotel ? '#6B7280' : color; // Gray for hotels

        // Calculate activity number (excluding hotels) - starts from 1
        const activityNumber = activities
          .slice(0, idx + 1)
          .filter(a => !(a.isLodging === true || a.primaryType === 'lodging'))
          .length;

        return {
          key: `${activeTab}-${idx}-${activity.instanceId || activity.place_id || `${activity.lat},${activity.lng}`}`,
          coordinate: {
            latitude: activity.lat!,
            longitude: activity.lng!,
          },
          title: activity.name,
          number: activityNumber, // 1-based numbering excluding hotels
          iconName: getActivityIcon(activity), // Keep for potential future use
          color: finalColor,
          isSelected: activity.instanceId ? selectedActivities.includes(activity.instanceId) : false,
          isMarkerSelected: activity.instanceId === selectedMarker,
          isLodging: isHotel,
          distance,
          activity: activity, // Include full activity object for callback
        };
      });
  }, [activities, markerColor, selectedActivities, selectedMarker, activityDayMap, routeData]);

  // Calculate the region to show all markers with proper bounds
  const getRegionForActivities = (): Region => {
    if (dynamicMarkers.length === 0) {
      // If no activities on current tab, prefer centering on the selected city's coordinates
      if (selectedCityLocation && selectedCityLocation.lat != null && selectedCityLocation.lng != null) {
        return {
          latitude: selectedCityLocation.lat,
          longitude: selectedCityLocation.lng,
          latitudeDelta: 0.1, // Zoomed out 2x (was 0.05)
          longitudeDelta: 0.1, // Zoomed out 2x (was 0.05)
        };
      }

      // If we don't have a selected city location, fall back to first activity with coordinates from all activities
      const firstActivityWithCoords = allActivities.find(
        (activity: Activity) => activity.lat != null && activity.lng != null
      );

      if (firstActivityWithCoords) {
        return {
          latitude: firstActivityWithCoords.lat!,
          longitude: firstActivityWithCoords.lng!,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
      }

      // Default to Philadelphia only if no activities exist at all
      return {
        latitude: 39.95,
        longitude: -75.16,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    if (dynamicMarkers.length === 1) {
      return {
        latitude: dynamicMarkers[0].coordinate.latitude,
        longitude: dynamicMarkers[0].coordinate.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Calculate bounds for multiple markers
    const latitudes = dynamicMarkers.map(marker => marker.coordinate.latitude);
    const longitudes = dynamicMarkers.map(marker => marker.coordinate.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const latDelta = (maxLat - minLat) * 1.7;
    const lngDelta = (maxLng - minLng) * 1.7;

    const minDelta = 0.01;
    const finalLatDelta = Math.max(latDelta, minDelta);
    const finalLngDelta = Math.max(lngDelta, minDelta);

    return {
      latitude: (minLat + maxLat) / 2 - finalLatDelta * 0.1,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: finalLatDelta,
      longitudeDelta: finalLngDelta,
    };
  };

  // Simplified region calculation for selected marker
  const getRegionForSelectedMarker = (selectedCoordinate: { latitude: number; longitude: number }): Region => {
    // Use a reasonable zoom level for individual markers
    const zoomDelta = 0.008; // Adjust this value based on your needs
    
    return {
      latitude: selectedCoordinate.latitude,
      longitude: selectedCoordinate.longitude,
      latitudeDelta: zoomDelta,
      longitudeDelta: zoomDelta,
    };
  };

  // Use different region calculation based on tab type
  const getInitialRegion = (): Region => {
    // For all tabs (wishlist and day tabs), show all markers
    return getRegionForActivities();
  };

  // Center the map on the first marker, or a default location if no markers exist
  const initialRegion: Region = useMemo(() => {
    return getInitialRegion();
  }, [activeTab, dynamicMarkers, allActivities, selectedCityLocation]);

  // Split polyline into segments at hotel boundaries for multi-colored routes
  const polylineSegments = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length < 2 || !activities || dayPolylines) {
      return null; // Only for single day view, not overview
    }

    // Find hotel indices
    const hotelIndices: number[] = [];
    activities.forEach((activity, idx) => {
      const isHotel = activity.isLodging === true || activity.primaryType === 'lodging';
      if (isHotel) {
        hotelIndices.push(idx);
      }
    });

    console.log('[TripMapView] Hotel indices:', hotelIndices, 'Total activities:', activities.length);

    // If no hotels or only one hotel, return null (use single polyline)
    if (hotelIndices.length <= 1) {
      console.log('[TripMapView] Not enough hotels for segmentation, using single polyline');
      return null;
    }

    // Define color palette for segments between hotels
    const segmentColors = [
      '#007AFF', // Blue
      '#34C759', // Green
      '#FF9500', // Orange
      '#AF52DE', // Purple
      '#FF2D55', // Pink
      '#5AC8FA', // Teal
    ];

    // Split route into segments between consecutive hotels
    const segments: Array<{ coordinates: { latitude: number; longitude: number }[]; color: string }> = [];

    for (let i = 0; i < hotelIndices.length - 1; i++) {
      const startIdx = hotelIndices[i];
      const endIdx = hotelIndices[i + 1];

      // Extract coordinates for this segment
      // Note: routeCoordinates might have more points than activities due to waypoints
      // For simplicity, we'll try to slice based on activity indices
      const segmentCoords = routeCoordinates.slice(startIdx, endIdx + 1);

      console.log(`[TripMapView] Segment ${i}: from hotel at idx ${startIdx} to hotel at idx ${endIdx}, ${segmentCoords.length} coords`);

      if (segmentCoords.length > 1) {
        segments.push({
          coordinates: segmentCoords,
          color: segmentColors[i % segmentColors.length],
        });
      }
    }

    console.log('[TripMapView] Created', segments.length, 'polyline segments');
    return segments.length > 0 ? segments : null;
  }, [routeCoordinates, activities, dayPolylines]);

  // Animate to show all activities when activities, activeTab, or height state changes
  useEffect(() => {
    if (mapRef.current && dynamicMarkers.length > 0) {
      const newRegion = getInitialRegion();
      mapRef.current.animateToRegion(newRegion, 1000); // 1 second animation
    }
  }, [activities, activeTab, dynamicMarkers, selectedCityLocation]);

  // Updated useEffect for selected marker zoom
  useEffect(() => {
    if (mapRef.current && selectedMarker) {
      const selectedMarkerData = dynamicMarkers.find(marker => marker.activity.instanceId === selectedMarker);
      if (selectedMarkerData) {
        const latitudeDelta = 0.01;
        const zoomRegion = {
          latitude: selectedMarkerData.coordinate.latitude - latitudeDelta * 0.1,
          longitude: selectedMarkerData.coordinate.longitude,
          latitudeDelta: latitudeDelta,
          longitudeDelta: 0.01,
        };
        mapRef.current.animateToRegion(zoomRegion, 800);
      }
    }
  }, [selectedMarker, dynamicMarkers]);

  return (
    <View style={[styles.mapContainer, { flex: 1 }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {dynamicMarkers.map(marker => (
          <Marker
            key={marker.key}
            coordinate={marker.coordinate}
            onPress={() => onMarkerPress?.(marker.activity)}
          >
            <MarkerComponent
              number={marker.number}
              iconName={marker.iconName}
              color={marker.color}
              isSelected={marker.isSelected}
              isMarkerSelected={marker.isMarkerSelected}
              isLodging={marker.isLodging}
              distance={marker.distance}
            />
          </Marker>
        ))}
        {/* Overview mode: Show all day polylines with different colors */}
        {dayPolylines && dayPolylines.length > 0 ? (
          dayPolylines.map(({ dayNumber, coordinates, color }) => (
            coordinates.length > 1 && (
              <Polyline
                key={`day-${dayNumber}`}
                coordinates={coordinates}
                strokeColor={color}
                strokeWidth={3}
              />
            )
          ))
        ) : polylineSegments ? (
          /* Day tab mode with multiple hotels: Show segmented polylines with different colors */
          polylineSegments.map((segment, idx) => (
            <Polyline
              key={`segment-${idx}`}
              coordinates={segment.coordinates}
              strokeColor={segment.color}
              strokeWidth={4}
            />
          ))
        ) : (
          /* Day tab mode: Show single polyline for active day */
          routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={markerColor}
              strokeWidth={4}
            />
          )
        )}
      </MapView>
      
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  markerWrapper: {
    alignItems: 'center',
  },
  distanceLabel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  distanceLabelText: {
    color: 'white',
    fontSize: 11,
    fontFamily: 'outfit-semibold',
    fontWeight: '600',
  },
  markerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  markerContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'white',
  },
  markerNumber: {
    color: 'white',
    fontSize: 15,
    fontFamily: 'outfit-bold',
    fontWeight: 'bold',
  },
});