import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { getMarkerColor } from '../../constants/mapColors';
import { Activity, TabType } from '../../types/activity.types';
import AntDesign from '@expo/vector-icons/AntDesign';

interface MapViewProps {
  activities: Activity[];
  activeTab: TabType;
  routeCoordinates?: { latitude: number, longitude: number }[];
  routeLoading?: boolean;
  selectedActivities?: string[]; // Add selected activities prop
}

// Custom numbered marker component with selection state
const NumberedMarker = ({ 
  number, 
  color, 
  isSelected 
}: { 
  number: number; 
  color: string; 
  isSelected: boolean;
}) => (
  <View style={[
    styles.markerContainer, 
    { 
      backgroundColor: isSelected ? '#000000' : color,
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
  selectedActivities = [] // Add default value
}: MapViewProps) {
  const mapRef = useRef<MapView>(null);

  // Get the marker color based on the active tab
  const markerColor = getMarkerColor(activeTab);

  // Handle invite collaborators button press
  const handleInviteCollaborators = () => {
    Alert.alert(
      'Invite Collaborators',
      'Feature Coming Soon',
      [{ text: 'OK', style: 'default' }]
    );
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
      }));
  }, [activities, markerColor, selectedActivities]);

  // Calculate the region to show all markers
  const getRegionForActivities = (): Region => {
    if (dynamicMarkers.length === 0) {
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

    const latDelta = (maxLat - minLat) * 1.44; // Add 44% padding (20% more than before)
    const lngDelta = (maxLng - minLng) * 1.44; // Add 44% padding (20% more than before)

    // Ensure minimum delta values for zoom
    const minDelta = 0.01;
    const finalLatDelta = Math.max(latDelta, minDelta);
    const finalLngDelta = Math.max(lngDelta, minDelta);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: finalLatDelta,
      longitudeDelta: finalLngDelta,
    };
  };

  // Calculate the region to center on the first activity
  const getRegionForSingleActivity = (): Region => {
    if (dynamicMarkers.length > 0) {
      return {
        latitude: dynamicMarkers[0].coordinate.latitude,
        longitude: dynamicMarkers[0].coordinate.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: 39.95,
      longitude: -75.16,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
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
            title={marker.title}
          >
            <NumberedMarker 
              number={marker.index} 
              color={marker.color} 
              isSelected={marker.isSelected}
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
        <AntDesign name="adduser" size={24} color="black" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: '40%',
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
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});