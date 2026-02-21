import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import CalendarPicker from 'react-native-calendar-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../../constants/Colors';
import { useCreateTrip } from '../../../context/CreateTripContext';

const CITY_INDICATOR_COLORS = ['#FF8A65', '#4CAF50', '#AB47BC', '#FF7043', '#26A69A', '#F9A825'];

function datesInRange(startIso: string | null | undefined, endIso: string | null | undefined): Date[] {
  if (!startIso) return [];
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

const POPULAR_DESTINATIONS = [
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964 },
  { name: 'Barcelona', lat: 41.3851, lng: 2.1734 },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
  { name: 'Bali', lat: -8.3405, lng: 115.092 },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Lisbon', lat: 38.7223, lng: -9.1393 },
  { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
  { name: 'Cancún', lat: 21.1619, lng: -86.8515 },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
];

interface AddCityModalProps {
  visible: boolean;
  onClose: () => void;
  onCityAdded?: (cityId: string) => void;
}

export function AddCityModal({ visible, onClose, onCityAdded }: AddCityModalProps) {
  const { addCity, updateCityDates, setActiveCityId, startDate: tripStartDate, endDate: tripEndDate, cities } = useCreateTrip();

  const googlePlacesRef = useRef<any>(null);
  const [hasSelectedPlace, setHasSelectedPlace] = useState(false);
  const selectedCityRef = useRef<string | null>(null);
  const [pendingCity, setPendingCity] = useState<{
    name: string;
    lat: number | null;
    lng: number | null;
    placeId: string | null;
  } | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const resetState = () => {
    setHasSelectedPlace(false);
    setPendingCity(null);
    selectedCityRef.current = null;
    setShowCalendar(false);
    setStartDate(null);
    setEndDate(null);
    setIsAdding(false);
    setTimeout(() => {
      googlePlacesRef.current?.setAddressText('');
    }, 100);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDateChange = (date: Date, type: 'START_DATE' | 'END_DATE') => {
    if (type === 'START_DATE') {
      setStartDate(date);
      setEndDate(null);
    } else {
      setEndDate(date);
    }
  };

  const handleConfirm = () => {
    if (!pendingCity) return;
    setIsAdding(true);

    const newCityId = addCity({
      name: pendingCity.name,
      lat: pendingCity.lat,
      lng: pendingCity.lng,
      place_id: pendingCity.placeId,
    });

    if (newCityId) {
      const isoStart = startDate ? startDate.toISOString() : null;
      const isoEnd = endDate ? endDate.toISOString() : null;
      if (isoStart || isoEnd) {
        updateCityDates(newCityId, isoStart, isoEnd);
      }
      setActiveCityId(newCityId);
      onCityAdded?.(newCityId);
    }

    setIsAdding(false);
    resetState();
    onClose();
  };

  const handlePopularCity = (city: { name: string; lat: number; lng: number }) => {
    selectedCityRef.current = city.name;
    setPendingCity({ name: city.name, lat: city.lat, lng: city.lng, placeId: null });
    setHasSelectedPlace(true);
    googlePlacesRef.current?.setAddressText(city.name);
    Keyboard.dismiss();
  };

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Calendar initial month: jump to trip start date if set
  const calendarInitialDate = tripStartDate ? new Date(tripStartDate) : undefined;

  // customDatesStyles: trip bounds (light underline) then each existing city (colored underline)
  const citiesWithDates = (cities || []).filter((c: any) => c.startDate || c.endDate);
  const customDatesStyles = [
    // Trip bounds — subtle light-blue underline showing the overall trip window
    ...datesInRange(tripStartDate, tripEndDate).map(d => ({
      date: d,
      containerStyle: { borderBottomWidth: 2, borderBottomColor: '#BFDBFE', borderRadius: 0 },
    })),
    // Each existing city — colored underline (overrides trip bounds for those dates)
    ...citiesWithDates.flatMap((c: any, idx: number) => {
      const color = CITY_INDICATOR_COLORS[idx % CITY_INDICATOR_COLORS.length];
      return datesInRange(c.startDate, c.endDate).map(d => ({
        date: d,
        containerStyle: { borderBottomWidth: 3, borderBottomColor: color, borderRadius: 0 },
      }));
    }),
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      {/*
        Layout mirrors create_trip_1_city.jsx:
        - Pressable backdrop fills space above the sheet (flex: 1)
        - KeyboardAvoidingView wraps the sheet
        - TouchableWithoutFeedback inside sheet dismisses keyboard on tap
        - Search uses position:relative container + absolute icon (no renderLeftButton)
      */}
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Add a City</Text>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="close" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Search — mirrors create_trip_1_city pattern exactly */}
              <View style={styles.searchContainer}>
                <View style={styles.searchIconWrapper}>
                  <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                </View>
                <GooglePlacesAutocomplete
                  ref={googlePlacesRef}
                  placeholder="Search for a city…"
                  onPress={(data, details) => {
                    const lat = details?.geometry?.location?.lat ?? null;
                    const lng = details?.geometry?.location?.lng ?? null;
                    const placeId = data.place_id ?? null;
                    selectedCityRef.current = data.description;
                    setPendingCity({ name: data.description, lat, lng, placeId });
                    setHasSelectedPlace(true);
                    googlePlacesRef.current?.setAddressText(data.description);
                    Keyboard.dismiss();
                  }}
                  query={{
                    key: process.env.EXPO_PUBLIC_GOOGLE_MAP_KEY,
                    language: 'en',
                    types: '(regions)',
                  }}
                  fetchDetails
                  enablePoweredByContainer={false}
                  debounce={200}
                  styles={{
                    container: {
                      flex: 0,
                      zIndex: 1,
                    },
                    textInput: {
                      height: 50,
                      color: '#111827',
                      fontSize: 15,
                      fontFamily: 'outfit',
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 12,
                      backgroundColor: '#F9FAFB',
                      paddingLeft: 44,
                      paddingRight: 12,
                    },
                    listView: {
                      backgroundColor: 'white',
                      borderRadius: 12,
                      marginTop: 4,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      elevation: 4,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 6,
                    },
                    row: {
                      backgroundColor: 'white',
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                    },
                    description: {
                      fontFamily: 'outfit',
                      fontSize: 14,
                      color: '#374151',
                    },
                  }}
                  textInputProps={{
                    placeholderTextColor: '#9CA3AF',
                    autoCorrect: false,
                    autoComplete: 'off',
                    autoCapitalize: 'words',
                    onChangeText: (text) => {
                      if (text !== selectedCityRef.current) {
                        setHasSelectedPlace(false);
                        setPendingCity(null);
                      }
                    },
                  }}
                />
              </View>

              {/* Popular destinations — shown when nothing selected */}
              {!hasSelectedPlace && (
                <View style={styles.popularSection}>
                  <Text style={styles.popularLabel}>Popular Destinations</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={styles.popularScroll}
                  >
                    {POPULAR_DESTINATIONS.map((city) => (
                      <TouchableOpacity
                        key={city.name}
                        style={styles.popularChip}
                        onPress={() => handlePopularCity(city)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.popularChipText}>{city.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Date picker + confirm — shown once a city is picked */}
              {hasSelectedPlace && (
                <>
                  <TouchableOpacity
                    style={styles.dateRow}
                    onPress={() => setShowCalendar(!showCalendar)}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                    <Text style={styles.dateText}>
                      {startDate && endDate
                        ? `${formatDate(startDate)} → ${formatDate(endDate)}`
                        : startDate
                        ? `${formatDate(startDate)} → pick end`
                        : 'Add dates (optional)'}
                    </Text>
                    <Ionicons
                      name={showCalendar ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>

                  {showCalendar && (
                    <View style={styles.calendarWrapper}>
                      {/* Trip date range context row */}
                      {(tripStartDate || tripEndDate) && (
                        <View style={styles.tripDateBanner}>
                          <View style={styles.tripDateSwatch} />
                          <Text style={styles.tripDateBannerText}>
                            Trip:{' '}
                            {tripStartDate
                              ? new Date(tripStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : ''}
                            {tripStartDate && tripEndDate ? ' – ' : ''}
                            {tripEndDate
                              ? new Date(tripEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : ''}
                          </Text>
                        </View>
                      )}
                      <CalendarPicker
                        startFromMonday
                        allowRangeSelection
                        onDateChange={handleDateChange}
                        selectedStartDate={startDate}
                        selectedEndDate={endDate}
                        selectedRangeStyle={{ backgroundColor: '#E3F2FD' }}
                        selectedDayColor="#1976D2"
                        selectedDayTextColor="#fff"
                        todayBackgroundColor="transparent"
                        todayTextStyle={{ color: '#1976D2', fontWeight: '600' }}
                        textStyle={{ fontFamily: 'outfit', fontSize: 13 }}
                        customDatesStyles={customDatesStyles}
                        initialDate={calendarInitialDate}
                        width={320}
                      />
                      {/* Legend for existing city date ranges */}
                      {citiesWithDates.length > 0 && (
                        <View style={styles.legend}>
                          <Text style={styles.legendTitle}>Other cities on this trip:</Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.legendScroll}
                          >
                            {citiesWithDates.map((c: any, idx: number) => (
                              <View key={c.cityId} style={styles.legendItem}>
                                <View
                                  style={[
                                    styles.legendSwatch,
                                    { backgroundColor: CITY_INDICATOR_COLORS[idx % CITY_INDICATOR_COLORS.length] },
                                  ]}
                                />
                                <Text style={styles.legendText} numberOfLines={1}>{c.name}</Text>
                              </View>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.confirmButton, isAdding && styles.confirmButtonDisabled]}
                    onPress={handleConfirm}
                    disabled={isAdding}
                  >
                    {isAdding ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Add City</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // Fills all space above the sheet — no Touchable siblings over the sheet
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 44,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: 'outfit-semibold',
    color: '#111827',
  },
  // Mirrors create_trip_1_city searchContainer — position:relative, icon absolute inside
  searchContainer: {
    position: 'relative',
    marginBottom: 14,
    zIndex: 10,
  },
  searchIconWrapper: {
    position: 'absolute',
    left: 13,
    top: 15,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularSection: {
    marginBottom: 8,
  },
  popularLabel: {
    fontSize: 11,
    fontFamily: 'outfit-medium',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  popularScroll: {
    gap: 8,
    paddingRight: 8,
    paddingBottom: 4,
  },
  popularChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  popularChipText: {
    fontSize: 13,
    fontFamily: 'outfit-medium',
    color: '#0369A1',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  dateText: {
    flex: 1,
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#374151',
  },
  calendarWrapper: {
    alignItems: 'center',
    marginBottom: 14,
  },
  tripDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  tripDateSwatch: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#BFDBFE',
  },
  tripDateBannerText: {
    fontSize: 11,
    fontFamily: 'outfit-medium',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  legend: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  legendTitle: {
    fontSize: 11,
    fontFamily: 'outfit-medium',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  legendScroll: {
    gap: 14,
    paddingRight: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'outfit-medium',
    color: '#374151',
    maxWidth: 100,
  },
  confirmButton: {
    backgroundColor: '#1976D2',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'outfit-semibold',
  },
});
