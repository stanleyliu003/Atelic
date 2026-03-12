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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import CalendarPicker from 'react-native-calendar-picker';
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
    return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
  };

  // Handle modal close
  const handleClose = useCallback(() => {
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

  const handleAirlineQueryChange = (text: string) => {
    setAirlineQuery(text);
    if (selectedAirline) {
      setSelectedAirline(null);
      setFlightNumber('');
      setFlightInfo(null);
    }
    setError(null);
  };

  const handleAirlineSelect = (airline: Airline) => {
    setSelectedAirline(airline);
    setAirlineQuery(`${airline.name} · ${airline.iata}`);
    setAirlineSuggestions([]);
    setFlightNumber(airline.iata);
    setError(null);
    setTimeout(() => {
      flightNumberInputRef.current?.focus();
    }, 100);
  };

  const handleFlightNumberChange = (text: string) => {
    if (!selectedAirline) return;
    const formatted = text.toUpperCase().replace(/[-\s]/g, '');
    if (!formatted.startsWith(selectedAirline.iata)) {
      setFlightNumber(selectedAirline.iata);
      return;
    }
    setFlightNumber(formatted);
    setFlightInfo(null);
    setError(null);
  };

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

  const resetForm = useCallback(() => {
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
  }, []);

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

  const handleAddFlightAndAnother = () => {
    if (!flightInfo) return;
    const reservation = createFlightReservation(flightInfo, {
      confirmationNumber: confirmationNumber || undefined,
      seatNumber: seatNumber || undefined,
    });
    if (onAddFlight) {
      onAddFlight(reservation);
    }
    resetForm();
  };

  const swipeGesture = Gesture.Pan().onEnd((event) => {
    if (event.translationY > 100 && event.velocityY > 0) {
      runOnJS(handleClose)();
    }
  });

  const getStatusBadgeStyle = (status: string) => {
    const color = getFlightStatusColor(status);
    return {
      backgroundColor: color + '15',
      borderColor: color + '40',
    };
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <GestureHandlerRootView style={styles.modalContainer}>
          {/* Drag Indicator */}
          <GestureDetector gesture={swipeGesture}>
            <View style={styles.dragIndicatorContainer}>
              <View style={styles.dragIndicator} />
            </View>
          </GestureDetector>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add Flight</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.closeButtonCircle}>
                <Ionicons name="close" size={16} color="#8E8E93" />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Date Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Date</Text>
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setIsCalendarOpen(true)}
                activeOpacity={0.6}
              >
                <View style={styles.dateSelectorContent}>
                  <Ionicons name="calendar-outline" size={18} color={flightDate ? '#1C1C1E' : '#C7C7CC'} />
                  <Text style={flightDate ? styles.dateText : styles.datePlaceholder}>
                    {flightDate ? formatDateDisplay(flightDate) : 'Select flight date'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </TouchableOpacity>
            </View>

            {/* Airline Search Section */}
            {flightDate && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Airline</Text>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color="#8E8E93" />
                  <TextInput
                    ref={airlineInputRef}
                    style={styles.searchInput}
                    value={airlineQuery}
                    onChangeText={handleAirlineQueryChange}
                    placeholder="Search airline (e.g., American, AA)"
                    placeholderTextColor="#C7C7CC"
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
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#C7C7CC" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Airline Suggestions */}
                {airlineSuggestions.length > 0 && !selectedAirline && (
                  <View style={styles.suggestionsList}>
                    {airlineSuggestions.map((airline) => (
                      <TouchableOpacity
                        key={airline.id}
                        style={styles.suggestionItem}
                        onPress={() => handleAirlineSelect(airline)}
                        activeOpacity={0.5}
                      >
                        <View style={styles.suggestionIcon}>
                          <Ionicons name="airplane" size={14} color="#F36406" />
                        </View>
                        <Text style={styles.suggestionName} numberOfLines={1}>
                          {airline.name}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color="#D1D1D6" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Flight Number Section */}
            {flightDate && selectedAirline && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Flight Number</Text>
                <View style={styles.flightNumberRow}>
                  <View style={[styles.searchBar, { flex: 1 }]}>
                    <TextInput
                      ref={flightNumberInputRef}
                      style={styles.searchInput}
                      value={flightNumber}
                      onChangeText={handleFlightNumberChange}
                      placeholder="e.g., AA100"
                      placeholderTextColor="#C7C7CC"
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
                      <Text style={styles.searchButtonText}>Search</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Flight Details Card */}
            {flightInfo && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Flight Details</Text>
                <View style={styles.flightCard}>
                  {/* Flight Header */}
                  <View style={styles.flightHeader}>
                    <View style={styles.flightHeaderLeft}>
                      <View style={styles.airlineIconContainer}>
                        <Ionicons name="airplane" size={18} color="#F36406" />
                      </View>
                      <View>
                        <Text style={styles.flightNumber}>{flightInfo.flightNumber}</Text>
                        <Text style={styles.airlineName}>{flightInfo.airline.name}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, getStatusBadgeStyle(flightInfo.status.text)]}>
                      <Text style={[styles.statusText, { color: getFlightStatusColor(flightInfo.status.text) }]}>
                        {flightInfo.status.text}
                      </Text>
                    </View>
                  </View>

                  {/* Flight Route */}
                  <View style={styles.routeContainer}>
                    <View style={styles.airportInfo}>
                      <Text style={styles.airportCode}>{flightInfo.origin.code}</Text>
                      <Text style={styles.airportCity} numberOfLines={1}>{flightInfo.origin.city}</Text>
                      <Text style={styles.flightTime}>
                        {formatFlightTime(flightInfo.schedule.departureScheduled)}
                      </Text>
                      {flightInfo.origin.terminal && (
                        <Text style={styles.terminalGate}>Terminal {flightInfo.origin.terminal}</Text>
                      )}
                      {flightInfo.origin.gate && (
                        <Text style={styles.terminalGate}>Gate {flightInfo.origin.gate}</Text>
                      )}
                    </View>

                    <View style={styles.routeArrow}>
                      <View style={styles.routeArrowLine} />
                      <Ionicons name="airplane" size={14} color="#F36406" />
                      <View style={styles.routeArrowLine} />
                    </View>

                    <View style={[styles.airportInfo, styles.airportInfoRight]}>
                      <Text style={styles.airportCode}>{flightInfo.destination.code}</Text>
                      <Text style={styles.airportCity} numberOfLines={1}>{flightInfo.destination.city}</Text>
                      <Text style={styles.flightTime}>
                        {formatFlightTime(flightInfo.schedule.arrivalScheduled)}
                      </Text>
                      {flightInfo.destination.terminal && (
                        <Text style={styles.terminalGate}>Terminal {flightInfo.destination.terminal}</Text>
                      )}
                      {flightInfo.destination.gate && (
                        <Text style={styles.terminalGate}>Gate {flightInfo.destination.gate}</Text>
                      )}
                    </View>
                  </View>

                  {/* Flight Date + Aircraft */}
                  <View style={styles.flightDateRow}>
                    <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
                    <Text style={styles.flightDateText}>
                      {formatFlightDate(flightInfo.schedule.departureScheduled)}
                    </Text>
                    {flightInfo.aircraft?.type && (
                      <>
                        <Text style={styles.flightDateSep}>·</Text>
                        <Text style={styles.flightDateText}>{flightInfo.aircraft.type}</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Optional Details */}
            {flightInfo && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Optional Details</Text>
                <View style={styles.optionalRow}>
                  <View style={styles.optionalInputWrap}>
                    <Text style={styles.optionalLabel}>Confirmation #</Text>
                    <TextInput
                      style={styles.optionalInput}
                      value={confirmationNumber}
                      onChangeText={setConfirmationNumber}
                      placeholder="ABC123"
                      placeholderTextColor="#C7C7CC"
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.optionalInputWrap}>
                    <Text style={styles.optionalLabel}>Seat</Text>
                    <TextInput
                      style={styles.optionalInput}
                      value={seatNumber}
                      onChangeText={setSeatNumber}
                      placeholder="12A"
                      placeholderTextColor="#C7C7CC"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Loading State */}
            {loading && !flightInfo && (
              <View style={styles.centeredState}>
                <ActivityIndicator size="small" color="#F36406" />
                <Text style={styles.stateText}>Searching for flight...</Text>
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Bottom Action Bar */}
          {flightInfo && (
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.addAnotherButton}
                onPress={handleAddFlightAndAnother}
                activeOpacity={0.8}
              >
                <Text style={styles.addAnotherButtonText}>Add & Add Another</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddFlight}
                activeOpacity={0.8}
              >
                <Text style={styles.addButtonText}>Add Flight</Text>
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
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContent}>
            <View {...calendarPanResponder.panHandlers} style={styles.calendarHandleContainer}>
              <View style={styles.calendarHandle} />
            </View>

            <View style={styles.calendarContainer}>
              <CalendarPicker
                startFromMonday={false}
                allowRangeSelection={false}
                minDate={startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0))}
                maxDate={endDate ? new Date(endDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 3))}
                todayBackgroundColor="#EFF6FF"
                todayTextStyle={{ color: '#3B82F6' }}
                selectedDayColor="#F36406"
                selectedDayTextColor="#FFFFFF"
                selectedStartDate={flightDate}
                enableSwipe={true}
                weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
                onDateChange={(date) => {
                  setFlightDate(date);
                }}
                width={340}
                textStyle={{
                  fontFamily: 'outfit',
                  fontSize: 15,
                  color: '#1C1C1E',
                }}
                monthTitleStyle={{
                  fontFamily: 'outfit-bold',
                  fontSize: 18,
                  color: '#1C1C1E',
                }}
                yearTitleStyle={{
                  fontFamily: 'outfit-bold',
                  fontSize: 18,
                  color: '#1C1C1E',
                }}
                dayLabelsWrapper={{
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                }}
                previousComponent={
                  <Ionicons name="chevron-back" size={20} color="#8E8E93" />
                }
                nextComponent={
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                }
              />
            </View>

            <TouchableOpacity
              style={[styles.calendarConfirmButton, { opacity: flightDate ? 1 : 0.3 }]}
              onPress={() => {
                if (flightDate) setIsCalendarOpen(false);
              }}
              disabled={!flightDate}
              activeOpacity={0.8}
            >
              <Text style={styles.calendarConfirmText}>
                {flightDate ? `Confirm · ${formatDateDisplay(flightDate)}` : 'Select a date'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ─── Modal Shell ─────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '92%',
  },
  dragIndicatorContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragIndicator: {
    width: 36,
    height: 5,
    backgroundColor: '#E5E5EA',
    borderRadius: 2.5,
  },

  // ─── Header ──────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  headerTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 17,
    color: '#1C1C1E',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
  },
  closeButtonCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Scroll Content ──────────────────────────────────
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },

  // ─── Sections ────────────────────────────────────────
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: 'outfit-medium',
    fontSize: 13,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },

  // ─── Date Selector ───────────────────────────────────
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: {
    fontFamily: 'outfit-medium',
    fontSize: 15,
    color: '#1C1C1E',
  },
  datePlaceholder: {
    fontFamily: 'outfit',
    fontSize: 15,
    color: '#C7C7CC',
  },

  // ─── Search Bar ──────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'outfit',
    fontSize: 15,
    color: '#1C1C1E',
    padding: 0,
  },

  // ─── Suggestions ─────────────────────────────────────
  suggestionsList: {
    marginTop: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    gap: 12,
  },
  suggestionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionName: {
    fontFamily: 'outfit-medium',
    fontSize: 15,
    color: '#1C1C1E',
    flex: 1,
  },

  // ─── Flight Number ───────────────────────────────────
  flightNumberRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#D1D1D6',
  },
  searchButtonText: {
    fontFamily: 'outfit-bold',
    fontSize: 15,
    color: '#FFFFFF',
  },

  // ─── Error ───────────────────────────────────────────
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  errorText: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#FF3B30',
  },

  // ─── Flight Card ─────────────────────────────────────
  flightCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 16,
  },
  flightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  flightHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  airlineIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightNumber: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: '#1C1C1E',
  },
  airlineName: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#8E8E93',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: 'outfit-medium',
    fontSize: 11,
  },

  // ─── Route ───────────────────────────────────────────
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  airportInfo: {
    flex: 1,
  },
  airportInfoRight: {
    alignItems: 'flex-end',
  },
  airportCode: {
    fontFamily: 'outfit-bold',
    fontSize: 24,
    color: '#1C1C1E',
  },
  airportCity: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 1,
  },
  flightTime: {
    fontFamily: 'outfit-medium',
    fontSize: 15,
    color: '#1C1C1E',
    marginTop: 6,
  },
  terminalGate: {
    fontFamily: 'outfit',
    fontSize: 11,
    color: '#F36406',
    marginTop: 2,
  },
  routeArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 6,
    gap: 4,
  },
  routeArrowLine: {
    width: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D1D1D6',
  },

  // ─── Flight Date ─────────────────────────────────────
  flightDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  flightDateText: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#8E8E93',
  },
  flightDateSep: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#D1D1D6',
  },

  // ─── Optional Details ────────────────────────────────
  optionalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionalInputWrap: {
    flex: 1,
  },
  optionalLabel: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 6,
  },
  optionalInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'outfit-medium',
    fontSize: 15,
    color: '#1C1C1E',
  },

  // ─── States ──────────────────────────────────────────
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  stateText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#8E8E93',
  },

  // ─── Bottom Bar ──────────────────────────────────────
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  addButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontFamily: 'outfit-bold',
    fontSize: 16,
  },

  // ─── Calendar Modal ──────────────────────────────────
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  calendarContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  calendarHandleContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  calendarHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
  },
  calendarContainer: {
    height: 292,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarConfirmButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarConfirmText: {
    color: '#FFFFFF',
    fontFamily: 'outfit-bold',
    fontSize: 16,
  },
});

export default AddFlightModal;
