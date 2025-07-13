import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { getMarkerColor } from '../../constants/mapColors';
import { Activity, TabType } from '../../types/activity.types';

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

  // Calculate the region to center on the first activity
  const getRegionForActivities = (): Region => {
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

  // Center the map on the first marker, or a default location if no markers exist
  const initialRegion: Region = useMemo(() => {
    return getRegionForActivities();
  }, []);

  // Animate to the first activity when activities or activeTab changes
  useEffect(() => {
    if (mapRef.current && dynamicMarkers.length > 0) {
      const newRegion = getRegionForActivities();
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
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: '33%',
    width: '100%',
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
});