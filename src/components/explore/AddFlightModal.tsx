import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import CalendarPicker from 'react-native-calendar-picker';
import { Colors } from '../../../constants/Colors';
import {
  searchAirlines,
  getFlightInfo,
  parseFlightNumber,
  isValidFlightIdent,
  createFlightReservation,
  formatFlightTime,
  formatFlightDate,
  getFlightStatusColor,
} from '../../services/flightService';
import type { Airline, FlightInfo, FlightReservation } from '../../types/flight.types';
import { useCreateTrip } from '../../../context/CreateTripContext';

/**
 * AddFlightModal Component
 * Modal for adding flight reservations with airline autocomplete and flight search
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {function} onClose - Callback to close modal
 * @param {function} onAddFlight - Callback when adding flight to trip (receives FlightReservation)
 */

interface AddFlightModalProps {
  visible: boolean;
  onClose: () => void;
  onAddFlight?: (flight: FlightReservation) => void;
}

export const AddFlightModal: React.FC<AddFlightModalProps> = ({
  visible,
  onClose,
  onAddFlight,
}) => {
  // Get trip dates from context
  const { startDate, endDate } = useCreateTrip();

  // Date selection state
  const [flightDate, setFlightDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Airline search state
  const [airlineQuery, setAirlineQuery] = useState('');
  const [airlineSuggestions, setAirlineSuggestions] = useState<Airline[]>([]);
  const [selectedAirline, setSelectedAirline] = useState<Airline | null>(null);

  // Flight search state
  const [flightNumber, setFlightNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flightInfo, setFlightInfo] = useState<FlightInfo | null>(null);

  // Optional details
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [seatNumber, setSeatNumber] = useState('');

  // Refs
  const airlineInputRef = useRef<TextInput>(null);
  const flightNumberInputRef = useRef<TextInput>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pan responder for swipe-down gesture to close calendar
  const calendarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 50) {
          setIsCalendarOpen(false);
        }
      },
    })
  ).current;

  // Format date to "Sat Nov 18" format
  const formatDateDisplay = (date: Date | null): string => {
    if (!date) return '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayNumber = date.getDate();

    return `${dayName} ${monthName} ${dayNumber}`;
  };

  // Handle modal close
  const handleClose = useCallback(() => {
    // Reset all state when closing
    setFlightDate(null);
    setAirlineQuery('');
    setAirlineSuggestions([]);
    setSelectedAirline(null);
    setFlightNumber('');
    setFlightInfo(null);
    setConfirmationNumber('');
    setSeatNumber('');
    setError(null);
    setLoading(false);
    onClose();
  }, [onClose]);

  // Focus airline input when modal opens
  useEffect(() => {
    if (visible && airlineInputRef.current) {
      setTimeout(() => {
        airlineInputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  // Debounced airline search
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!airlineQuery || airlineQuery.length < 1 || selectedAirline) {
      setAirlineSuggestions([]);
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const results = searchAirlines(airlineQuery);
      setAirlineSuggestions(results);
    }, 150);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [airlineQuery, selectedAirline]);

  // Handle airline query change
  const handleAirlineQueryChange = (text: string) => {
    setAirlineQuery(text);
    // Clear selected airline when user types
    if (selectedAirline) {
      setSelectedAirline(null);
      setFlightNumber('');
      setFlightInfo(null);
    }
    setError(null);
  };

  // Handle airline selection
  const handleAirlineSelect = (airline: Airline) => {
    setSelectedAirline(airline);
    setAirlineQuery(`${airline.name} · ${airline.iata}`);
    setAirlineSuggestions([]);
    setFlightNumber(airline.iata); // Pre-fill with airline code
    setError(null);

    // Focus on flight number input
    setTimeout(() => {
      flightNumberInputRef.current?.focus();
    }, 100);
  };

  // Handle flight number change
  const handleFlightNumberChange = (text: string) => {
    if (!selectedAirline) {
      return;
    }

    // Auto-format: remove spaces and dashes, uppercase
    const formatted = text.toUpperCase().replace(/[-\s]/g, '');

    // Ensure the IATA code prefix is always present and can't be removed
    if (!formatted.startsWith(selectedAirline.iata)) {
      // If user tries to delete the prefix, restore it
      setFlightNumber(selectedAirline.iata);
      return;
    }

    setFlightNumber(formatted);
    setFlightInfo(null);
    setError(null);
  };

  // Search for flight
  const handleSearchFlight = async () => {
    Keyboard.dismiss();

    if (!flightDate) {
      setError('Please select a flight date');
      return;
    }

    if (!flightNumber) {
      setError('Please enter a flight number');
      return;
    }

    if (!isValidFlightIdent(flightNumber)) {
      setError('Invalid format. Use airline code + number (e.g., AA100)');
      return;
    }

    setLoading(true);
    setError(null);
    setFlightInfo(null);

    try {
      const info = await getFlightInfo(flightNumber, flightDate);
      setFlightInfo(info);
    } catch (err: any) {
      console.error('[AddFlightModal] Error fetching flight:', err);
      setError(err.message || 'Failed to fetch flight information');
    } finally {
      setLoading(false);
    }
  };

  // Handle adding flight to trip
  const handleAddFlight = () => {
    if (!flightInfo) return;

    const reservation = createFlightReservation(flightInfo, {
      confirmationNumber: confirmationNumber || undefined,
      seatNumber: seatNumber || undefined,
    });

    if (onAddFlight) {
      onAddFlight(reservation);
    }

    handleClose();
  };

  // Swipe down gesture to close
  const swipeGesture = Gesture.Pan().onEnd((event) => {
    if (event.translationY > 100 && event.velocityY > 0) {
      runOnJS(handleClose)();
    }
  });

  // Get status badge color
  const getStatusBadgeStyle = (status: string) => {
    const color = getFlightStatusColor(status);
    return {
      backgroundColor: color + '20', // 20% opacity
      borderColor: color,
    };
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <GestureHandlerRootView style={styles.modalContainer}>
          {/* Swipeable Drag Indicator */}
          <GestureDetector gesture={swipeGesture}>
            <View style={styles.dragIndicatorContainer}>
              <View style={styles.dragIndicator} />
            </View>
          </GestureDetector>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>When are you flying?</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Flight Date Section */}
            <View style={styles.searchSection}>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setIsCalendarOpen(true)}
              >
                <View style={styles.dateButtonContent}>
                  <MaterialCommunityIcons name="calendar-clock-outline" size={24} color="black" />
                  <Text style={[styles.dateButtonText, !flightDate && styles.placeholderText]}>
                    {flightDate ? formatDateDisplay(flightDate) : 'Select flight date'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Airline Search Section - Only show when date is selected */}
            {flightDate && (
              <View style={styles.searchSection}>
              <Text style={styles.sectionLabel}>Which airline are you flying?</Text>
              <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                  ref={airlineInputRef}
                  style={styles.searchInput}
                  value={airlineQuery}
                  onChangeText={handleAirlineQueryChange}
                  placeholder="Search airline (e.g., American, AA)"
                  placeholderTextColor="#999"
                  returnKeyType="next"
                  autoCorrect={false}
                />
                {airlineQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setAirlineQuery('');
                      setSelectedAirline(null);
                      setFlightNumber('');
                      setFlightInfo(null);
                    }}
                    style={styles.clearButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Airline Suggestions */}
              {airlineSuggestions.length > 0 && !selectedAirline && (
                <View style={styles.suggestionsContainer}>
                  {airlineSuggestions.map((airline) => (
                    <TouchableOpacity
                      key={airline.id}
                      style={styles.suggestionItem}
                      onPress={() => handleAirlineSelect(airline)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.suggestionIconContainer}>
                        <Ionicons name="airplane" size={18} color="#444" />
                      </View>
                      <View style={styles.suggestionTextContainer}>
                        <Text style={styles.suggestionName} numberOfLines={1}>
                          {airline.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            )}

            {/* Flight Number Section - Only show when airline is selected */}
            {flightDate && selectedAirline && (
              <View style={styles.searchSection}>
                <Text style={styles.sectionLabel}>Flight number</Text>
                <View style={styles.flightNumberRow}>
                  <View style={[styles.searchBar, styles.flightNumberInput]}>
                    <TextInput
                      ref={flightNumberInputRef}
                      style={styles.searchInput}
                      value={flightNumber}
                      onChangeText={handleFlightNumberChange}
                      placeholder="e.g., AA100"
                      placeholderTextColor="#999"
                      returnKeyType="search"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      onSubmitEditing={handleSearchFlight}
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.searchButton,
                      (!flightNumber || loading) && styles.searchButtonDisabled,
                    ]}
                    onPress={handleSearchFlight}
                    disabled={!flightNumber || loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="search" size={22} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Error Message */}
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Flight Details Card */}
            {flightInfo && (
              <View style={styles.flightCardContainer}>
                <View style={styles.flightCard}>
                  {/* Flight Header */}
                  <View style={styles.flightHeader}>
                    <View style={styles.flightHeaderLeft}>
                      <View style={styles.airlineIconContainer}>
                        <Ionicons name="airplane" size={24} color="#F36406" />
                      </View>
                      <View>
                        <Text style={styles.flightNumber}>{flightInfo.flightNumber}</Text>
                        <Text style={styles.airlineName}>{flightInfo.airline.name}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        getStatusBadgeStyle(flightInfo.status.text),
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getFlightStatusColor(flightInfo.status.text) },
                        ]}
                      >
                        {flightInfo.status.text}
                      </Text>
                    </View>
                  </View>

                  {/* Flight Route */}
                  <View style={styles.routeContainer}>
                    {/* Departure */}
                    <View style={styles.airportInfo}>
                      <Text style={styles.airportCode}>{flightInfo.origin.code}</Text>
                      <Text style={styles.airportCity} numberOfLines={1}>
                        {flightInfo.origin.city}
                      </Text>
                      <Text style={styles.flightTime}>
                        {formatFlightTime(flightInfo.schedule.departureScheduled)}
                      </Text>
                      {flightInfo.origin.terminal && (
                        <Text style={styles.terminalGate}>
                          Terminal {flightInfo.origin.terminal}
                        </Text>
                      )}
                      {flightInfo.origin.gate && (
                        <Text style={styles.terminalGate}>Gate {flightInfo.origin.gate}</Text>
                      )}
                    </View>

                    {/* Arrival */}
                    <View style={[styles.airportInfo, styles.airportInfoRight]}>
                      <Text style={styles.airportCode}>{flightInfo.destination.code}</Text>
                      <Text style={styles.airportCity} numberOfLines={1}>
                        {flightInfo.destination.city}
                      </Text>
                      <Text style={styles.flightTime}>
                        {formatFlightTime(flightInfo.schedule.arrivalScheduled)}
                      </Text>
                      {flightInfo.destination.terminal && (
                        <Text style={styles.terminalGate}>
                          Terminal {flightInfo.destination.terminal}
                        </Text>
                      )}
                      {flightInfo.destination.gate && (
                        <Text style={styles.terminalGate}>
                          Gate {flightInfo.destination.gate}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Flight Date */}
                  <View style={styles.flightDateContainer}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.flightDate}>
                      {formatFlightDate(flightInfo.schedule.departureScheduled)}
                    </Text>
                    {flightInfo.aircraft?.type && (
                      <>
                        <Text style={styles.dateSeparator}>•</Text>
                        <Text style={styles.aircraftType}>{flightInfo.aircraft.type}</Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Optional Details */}
                <View style={styles.optionalDetailsSection}>
                  <Text style={styles.optionalDetailsTitle}>Optional Details</Text>

                  <View style={styles.optionalInputRow}>
                    <View style={styles.optionalInputContainer}>
                      <Text style={styles.optionalInputLabel}>Confirmation #</Text>
                      <TextInput
                        style={styles.optionalInput}
                        value={confirmationNumber}
                        onChangeText={setConfirmationNumber}
                        placeholder="ABC123"
                        placeholderTextColor="#999"
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={styles.optionalInputContainer}>
                      <Text style={styles.optionalInputLabel}>Seat</Text>
                      <TextInput
                        style={styles.optionalInput}
                        value={seatNumber}
                        onChangeText={setSeatNumber}
                        placeholder="12A"
                        placeholderTextColor="#999"
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Loading State - Only show when actively searching */}
            {loading && !flightInfo && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.PRIMARY} />
                <Text style={styles.loadingText}>Searching for flight...</Text>
              </View>
            )}


            {/* Bottom padding for scroll */}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Add Flight Button - Show when flight info is available */}
          {flightInfo && (
            <View style={styles.addFlightButtonContainer}>
              <TouchableOpacity
                style={styles.addFlightButton}
                onPress={handleAddFlight}
                activeOpacity={0.8}
              >
                <Text style={styles.addFlightButtonText}>Add Flight</Text>
              </TouchableOpacity>
            </View>
          )}
        </GestureHandlerRootView>
      </View>

      {/* Calendar Modal */}
      <Modal
        visible={isCalendarOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCalendarOpen(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContent}>
            {/* Top Handle - Swipeable */}
            <View {...calendarPanResponder.panHandlers} style={styles.calendarModalHandleContainer}>
              <View style={styles.calendarModalHandle} />
            </View>

            {/* Calendar View */}
            <View style={styles.calendarContainer}>
              <CalendarPicker
                startFromMonday={false}
                allowRangeSelection={false}
                minDate={startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0))}
                maxDate={endDate ? new Date(endDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 3))}
                todayBackgroundColor="#E8F4FD"
                todayTextStyle={{ color: '#27BFFF' }}
                selectedDayColor="#FFA53F"
                selectedDayTextColor="#FFFFFF"
                selectedStartDate={flightDate}
                enableSwipe={true}
                weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
                onDateChange={(date) => {
                  setFlightDate(date);
                }}
                width={350}
                textStyle={{
                  fontFamily: 'outfit',
                  fontSize: 16,
                }}
                monthTitleStyle={{
                  fontFamily: 'outfit-bold',
                  fontSize: 24,
                  color: '#1a1a1a',
                }}
                yearTitleStyle={{
                  fontFamily: 'outfit-bold',
                  fontSize: 24,
                  color: '#1a1a1a',
                }}
                dayLabelsWrapper={{
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                }}
                previousComponent={
                  <Ionicons name="chevron-back" size={24} color="#666666" />
                }
                nextComponent={
                  <Ionicons name="chevron-forward" size={24} color="#666666" />
                }
              />
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              style={[
                styles.calendarConfirmButton,
                { opacity: flightDate ? 1 : 0.3 }
              ]}
              onPress={() => {
                if (flightDate) {
                  setIsCalendarOpen(false);
                }
              }}
              disabled={!flightDate}
            >
              <Text style={styles.calendarConfirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.WHITE,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: '85%',
  },
  dragIndicatorContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingTop: 30,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  headerTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 20,
    color: '#333',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: 'outfit-bold',
    fontSize: 20,
    color: '#333',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    height: 55,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionName: {
    fontFamily: 'outfit',
    fontSize: 15,
    color: '#333',
  },
  flightNumberRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flightNumberInput: {
    flex: 1,
  },
  searchButton: {
    width: 55,
    height: 55,
    borderRadius: 20,
    backgroundColor: '#F36406',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F36406',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  searchButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 5,
    gap: 6,
  },
  errorText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#DC2626',
  },
  flightCardContainer: {
    marginTop: 10,
  },
  flightCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  flightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  flightHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  airlineIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightNumber: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: '#333',
  },
  airlineName: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: 'outfit-medium',
    fontSize: 12,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  airportInfo: {
    flex: 1,
  },
  airportInfoRight: {
    alignItems: 'flex-end',
  },
  airportCode: {
    fontFamily: 'outfit-bold',
    fontSize: 28,
    color: '#333',
  },
  airportCity: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  flightTime: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: '#333',
    marginTop: 8,
  },
  terminalGate: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#F36406',
    marginTop: 4,
  },

  flightDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  flightDate: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#666',
  },
  dateSeparator: {
    color: '#ccc',
    marginHorizontal: 4,
  },
  aircraftType: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#666',
  },
  optionalDetailsSection: {
    marginTop: 20,
  },
  optionalDetailsTitle: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  optionalInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionalInputContainer: {
    flex: 1,
  },
  optionalInputLabel: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  optionalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontFamily: 'outfit-medium',
    fontSize: 15,
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#666',
    marginTop: 15,
  },
  addFlightButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: Colors.WHITE,
  },
  addFlightButton: {
    backgroundColor: '#F36406',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addFlightButtonText: {
    color: '#FFFFFF',
    fontFamily: 'outfit-bold',
    fontSize: 18,
  },
  // Date button styles
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderWidth: 0,
    borderRadius: 20,
    backgroundColor: 'white',
    height: 55,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButtonText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#1a1a1a',
  },
  placeholderText: {
    color: '#999999',
  },
  // Calendar Modal Styles
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  calendarModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  calendarModalHandleContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  calendarModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  calendarContainer: {
    height: 292,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarConfirmButton: {
    backgroundColor: '#F36406',
    borderRadius: 25,
    paddingVertical: 16,
    marginTop: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarConfirmButtonText: {
    color: '#FFFFFF',
    fontFamily: 'outfit-bold',
    fontSize: 18,
  },
});

export default AddFlightModal;

