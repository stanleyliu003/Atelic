import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../../constants/Colors';
import { CitySavedPlacesModal } from './CitySavedPlacesModal';

const { height: screenHeight } = Dimensions.get('window');
const CARD_HEIGHT = screenHeight * 0.48;
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

export function CountrySavedPlacesModal({ visible, onClose, countryName, places, onPlaceDeleted }) {
  const mapRef = useRef(null);
  const [localPlaces, setLocalPlaces] = useState(places);
  const [selectedCityData, setSelectedCityData] = useState(null);
  const [cityModalVisible, setCityModalVisible] = useState(false);

  useEffect(() => {
    setLocalPlaces(places);
  }, [places]);

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

  const handleMapReady = () => {
    const withCoords = citiesData.filter(c => c.lat != null && c.lng != null);
    if (withCoords.length === 0 || !mapRef.current) return;

    // For a single city, fitToCoordinates on one point zooms in maximally.
    // Create a minimum bounding box (~0.5° span) around the city so the zoom
    // level stays reasonable, then let fitToCoordinates handle the card offset.
    const SINGLE_CITY_SPAN = 0.25;
    const coords = withCoords.length === 1
      ? [
          { latitude: withCoords[0].lat + SINGLE_CITY_SPAN, longitude: withCoords[0].lng + SINGLE_CITY_SPAN },
          { latitude: withCoords[0].lat - SINGLE_CITY_SPAN, longitude: withCoords[0].lng - SINGLE_CITY_SPAN },
        ]
      : withCoords.map(c => ({ latitude: c.lat, longitude: c.lng }));

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: CARD_HEIGHT + 40, left: 60 },
      animated: false,
    });
  };

  const handleCityPress = (cityData) => {
    setSelectedCityData(cityData);
    setCityModalVisible(true);
  };

  const handleCloseCityModal = () => {
    setCityModalVisible(false);
    setSelectedCityData(null);
  };

  const handleCityPlaceDeleted = (deletedPlaceId) => {
    const deletedPlace = localPlaces.find(p => p.savedPlaceId === deletedPlaceId);
    const cityName = stripCountrySuffix(deletedPlace?.city) || selectedCityData?.name;

    setLocalPlaces(prev => prev.filter(p => p.savedPlaceId !== deletedPlaceId));
    setSelectedCityData(prev =>
      prev ? { ...prev, places: prev.places.filter(p => p.savedPlaceId !== deletedPlaceId) } : null
    );

    onPlaceDeleted?.(deletedPlaceId, cityName);
  };

  const renderCityItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.cityRow}
      onPress={() => handleCityPress(item)}
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
        <Ionicons name="chevron-forward" size={18} color={Colors.GRAY} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
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
                    onPress={() => handleCityPress(city)}
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

          {/* Floating back button over map — matches homeButton pattern */}
          <TouchableOpacity style={styles.backButton} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          {/* Bottom card with rounded top corners overlapping the map */}
          <View style={styles.bottomCard}>
            {/* Drag indicator */}
            <View style={styles.dragIndicatorContainer}>
              <View style={styles.dragIndicator} />
            </View>

            {/* Country title */}
            <Text style={styles.headerTitle}>{countryName}</Text>

            {/* City list */}
            {citiesData.length > 0 ? (
              <FlatList
                data={citiesData}
                renderItem={renderCityItem}
                keyExtractor={item => item.name}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                style={styles.flatList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="bookmark-outline" size={64} color={Colors.GRAY} />
                <Text style={styles.emptyText}>No saved cities in {countryName}</Text>
              </View>
            )}
          </View>

          {/* City subfolder modal */}
          {selectedCityData && (
            <CitySavedPlacesModal
              visible={cityModalVisible}
              onClose={handleCloseCityModal}
              cityName={selectedCityData.name}
              places={selectedCityData.places}
              onPlaceDeleted={handleCityPlaceDeleted}
              isCountry={false}
            />
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
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
  // Floating back button — mirrors homeButton in trip-view_main
  backButton: {
    position: 'absolute',
    top: 15,
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
  // Bottom card that overlaps the map with rounded top corners
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: CARD_HEIGHT,
    backgroundColor: Colors.WHITE,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  dragIndicatorContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
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
});
