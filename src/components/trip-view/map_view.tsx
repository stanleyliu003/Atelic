import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { getMarkerColor } from '../../constants/mapColors';
import { Activity, TabType } from '../../types/activity.types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../../constants/Colors';

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
}

// Custom numbered marker component with selection state
const NumberedMarker = ({ 
  number, 
  color, 
  isSelected,
  isMarkerSelected 
}: { 
  number: number; 
  color: string; 
  isSelected: boolean;
  isMarkerSelected: boolean;
}) => (
  <View style={[
    styles.markerContainer, 
    { 
      backgroundColor: isMarkerSelected ? '#000000' : (isSelected ? '#000000' : color),
    }
  ]}>
    {isSelected ? (
      <Text style={styles.checkmarkText}>✓</Text>
    ) : (
      <Text style={styles.markerText}>{number}</Text>
    )}
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
  onShareTrip
}: MapViewProps) {
  const mapRef = useRef<MapView>(null);

  // Get the marker color based on the active tab
  const markerColor = getMarkerColor(activeTab);

  // Handle invite collaborators button press
  const handleInviteCollaborators = () => {
    onShareTrip?.();
  };

  // Prepare markers
  const dynamicMarkers = useMemo(() => {
    if (!activities || activities.length === 0) {
      return [];
    }
    return activities
      .filter((activity: Activity) => activity.lat != null && activity.lng != null)
      .map((activity: Activity, idx: number) => ({
        key: activity.place_id || `${activity.lat},${activity.lng},${idx}`,
        coordinate: {
          latitude: activity.lat!,
          longitude: activity.lng!,
        },
        title: activity.name,
        index: idx + 1, // 1-based index for display
        color: markerColor,
        isSelected: activity.place_id ? selectedActivities.includes(activity.place_id) : false,
        isMarkerSelected: activity.place_id === selectedMarker,
        activity: activity, // Include full activity object for callback
      }));
  }, [activities, markerColor, selectedActivities, selectedMarker]);

  // Calculate the region to show all markers with proper bounds
  const getRegionForActivities = (): Region => {
    if (dynamicMarkers.length === 0) {
      // Default fallback location (you might want to use user's location or city center)
      return {
        latitude: 39.95,
        longitude: -75.16,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Extract all coordinates
    const coordinates = dynamicMarkers.map(marker => marker.coordinate);
    
    // Calculate bounding box
    const latitudes = coordinates.map(coord => coord.latitude);
    const longitudes = coordinates.map(coord => coord.longitude);
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    
    // Calculate the center point
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Calculate the span of coordinates
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    
    // Add padding - use percentage-based padding for better scaling
    const paddingFactor = 0.3; // 30% padding around the bounds
    const minDelta = 0.005; // Minimum zoom level for very close markers
    
    // Calculate deltas with padding, ensuring minimum zoom
    let latitudeDelta = Math.max(latSpan * (1 + paddingFactor), minDelta) * 2;
    let longitudeDelta = Math.max(lngSpan * (1 + paddingFactor), minDelta) * 2;
    
    // Adjust for map aspect ratio (70% height means it's wider than tall)
    // For a 70% height map, we might want to adjust the latitude delta slightly
    const mapAspectRatio = 1 / 0.7; // width/height ratio
    const coordinateAspectRatio = longitudeDelta / latitudeDelta;
    
    // If coordinates are more spread horizontally than the map aspect ratio suggests,
    // we might need to adjust the latitude delta to maintain proper centering
    if (coordinateAspectRatio > mapAspectRatio) {
      latitudeDelta = longitudeDelta / mapAspectRatio;
    }
    
    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta,
      longitudeDelta,
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
  }, [activeTab, dynamicMarkers]);

  // Animate to show all activities when activities or activeTab changes
  useEffect(() => {
    if (mapRef.current && dynamicMarkers.length > 0) {
      const newRegion = getInitialRegion();
      mapRef.current.animateToRegion(newRegion, 1000); // 1 second animation
    }
  }, [activities, activeTab, dynamicMarkers]);

  // Updated useEffect for selected marker zoom
  useEffect(() => {
    if (mapRef.current && selectedMarker) {
      const selectedMarkerData = dynamicMarkers.find(marker => marker.activity.place_id === selectedMarker);
      if (selectedMarkerData) {
        const zoomRegion = getRegionForSelectedMarker(selectedMarkerData.coordinate);
        mapRef.current.animateToRegion(zoomRegion, 800);
      }
    }
  }, [selectedMarker, dynamicMarkers]);

  return (
    <View style={styles.mapContainer}>
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
            <NumberedMarker 
              number={marker.index} 
              color={marker.color} 
              isSelected={marker.isSelected}
              isMarkerSelected={marker.isMarkerSelected}
            />
          </Marker>
        ))}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={markerColor}
            strokeWidth={5}
          />
        )}
      </MapView>
      
      {/* Invite collaborators button overlay */}
      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleInviteCollaborators}
        activeOpacity={0.7}
      >
        <Ionicons name="share-outline" size={30} color={Colors.PRIMARY} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: '70%',
    width: '100%',
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'outfit-bold',
  },
  checkmarkText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'outfit-bold',
    fontWeight: 'bold',
  },
  shareButton: {
    position: 'absolute',
    top: 63,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});