import { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
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
import { getSearchAutocomplete } from '../../services/searchService';
import { useCreateTrip } from '../../../context/CreateTripContext';

/**
 * AddHotelStayModal Component
 * Modal for adding hotel/stay accommodations with search autocomplete
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {function} onClose - Callback to close modal
 */
export const AddHotelStayModal = ({ visible, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [checkInDate, setCheckInDate] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState(null);
  const [stayLength, setStayLength] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const checkInDateRef = useRef(null);

  // Get selected city from context
  const { selectedCity } = useCreateTrip();

  // Pan responder for swipe-down gesture to close calendar
  const calendarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderRelease: (evt, gestureState) => {
        // If swiped down more than 50 pixels, close the modal
        if (gestureState.dy > 50) {
          setIsCalendarOpen(false);
        }
      },
    })
  ).current;

  // Format date to "Sat Nov 18" format
  const formatDate = (date) => {
    if (!date) return '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayNumber = date.getDate();

    return `${dayName} ${monthName} ${dayNumber}`;
  };

  // Handle modal close
  const handleClose = () => {
    // Reset state when closing
    setSearchQuery('');
    setSuggestions([]);
    setSelectedPlace(null);
    setCheckInDate(null);
    setCheckOutDate(null);
    setStayLength(null);
    setError(null);
    onClose();
  };

  // Focus search input when modal opens
  useEffect(() => {
    if (visible && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  // Debounced fetch autocomplete suggestions
  useEffect(() => {
    const fetchSuggestions = async (query) => {
      if (!query || query.trim().length < 2) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      // Don't fetch suggestions if a place is already selected
      if (selectedPlace) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Filter for lodging/accommodation types
        const filters = ['lodging'];
        const results = await getSearchAutocomplete(selectedCity, query, filters);
        setSuggestions(results);
      } catch (err) {
        console.error('[AddHotelStayModal] Error fetching suggestions:', err);
        setError('Failed to load suggestions');
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    if (visible) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        fetchSuggestions(searchQuery);
      }, 300);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedCity, visible, selectedPlace]);

  // Handle search query change
  const handleQueryChange = (text) => {
    setSearchQuery(text);
    // Clear selected place when user starts typing
    if (selectedPlace && text !== selectedPlace.name) {
      setSelectedPlace(null);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion) => {
    setSelectedPlace(suggestion);
    setSearchQuery(suggestion.name);
    setSuggestions([]);
  };

  // Swipe down gesture to close
  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      // If swiped down more than 100px with sufficient velocity, close the modal
      if (event.translationY > 100 && event.velocityY > 0) {
        runOnJS(handleClose)();
      }
    });

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
            <Text style={styles.headerTitle}>Where are you staying?</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Search Section */}
          <View style={styles.searchSection}>

            {/* Search Bar */}
            <View style={styles.searchBarContainer}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={handleQueryChange}
                  placeholder="Search for hotels or lodging"
                  placeholderTextColor="#999"
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => handleQueryChange('')}
                    style={styles.clearButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Selected Place Address */}
            {selectedPlace && (
              <Text style={styles.selectedAddress}>{selectedPlace.address_info}</Text>
            )}
          </View>

          {/* Stay Duration Section - Only show when a place is selected */}
          {selectedPlace && (
            <View style={styles.stayDurationSection}>
              <Text style={styles.stayDurationTitle}>How long is your stay?</Text>

              {/* Date Selection Button */}
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setIsCalendarOpen(true)}
              >
                <View style={styles.dateButtonContent}>
                  <MaterialCommunityIcons name="calendar-clock-outline" size={24} color="black" />
                  <Text style={[styles.dateButtonText, !stayLength && styles.placeholderText]}>
                    {checkInDate && checkOutDate
                      ? `${formatDate(checkInDate)}   -   ${formatDate(checkOutDate)}`
                      : stayLength
                      ? `${stayLength} night${stayLength > 1 ? 's' : ''}`
                      : 'Select dates'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Suggestions List */}
          <ScrollView style={styles.suggestionsContainer} showsVerticalScrollIndicator={false}>
            {/* Loading State */}
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.PRIMARY} />
                <Text style={styles.loadingText}>Loading suggestions...</Text>
              </View>
            )}

            {/* Error State */}
            {!loading && error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#999" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Empty State */}
            {!loading && !error && suggestions.length === 0 && searchQuery.length >= 2 && !selectedPlace && (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No hotels found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </View>
            )}

            {/* Suggestions List */}
            {!loading && !error && suggestions.length > 0 && (
              <View style={styles.suggestionsList}>
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={suggestion.place_id || index}
                    style={styles.suggestionItem}
                    onPress={() => handleSuggestionSelect(suggestion)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.suggestionIconContainer}>
                      <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={20}
                        color="#444"
                      />
                    </View>
                    <View style={styles.suggestionTextContainer}>
                      <Text
                        style={styles.suggestionName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {suggestion.name}
                      </Text>
                      <Text
                        style={styles.suggestionAddress}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {suggestion.address_info}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
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
                allowRangeSelection={true}
                minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                maxDate={new Date(new Date().setFullYear(new Date().getFullYear() + 3))}
                todayBackgroundColor="#E8F4FD"
                todayTextStyle={{ color: '#27BFFF' }}
                selectedDayColor="#FFA53F"
                selectedDayTextColor="#FFFFFF"
                selectedStartDate={checkInDate}
                selectedEndDate={checkOutDate}
                enableSwipe={true}
                weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
                allowBackwardRangeSelect={true}
                onDateChange={(date, type) => {
                  if (type === 'END_DATE') {
                    // Only proceed if we have a valid date
                    if (!date) {
                      setCheckOutDate(null);
                      setStayLength(null);
                      return;
                    }

                    // Use the ref to get the latest check-in date value
                    const currentCheckInDate = checkInDateRef.current;

                    if (currentCheckInDate) {
                      // Calculate time difference in milliseconds
                      const timeDiff = date.getTime() - currentCheckInDate.getTime();

                      // Check if the selected check-out date is before the check-in date
                      if (timeDiff < 0) {
                        // Swap: the earlier date becomes check-in, later becomes check-out
                        const newCheckInDate = date;
                        const newCheckOutDate = currentCheckInDate;

                        // Recalculate stay length with swapped dates (inclusive of both dates)
                        const swappedTimeDiff = newCheckOutDate.getTime() - newCheckInDate.getTime();
                        const swappedNights = Math.floor(swappedTimeDiff / (1000 * 60 * 60 * 24)) + 1;

                        // Update ref, local state
                        checkInDateRef.current = newCheckInDate;
                        setCheckInDate(newCheckInDate);
                        setCheckOutDate(newCheckOutDate);
                        setStayLength(swappedNights);
                      } else {
                        // Normal forward selection - check-out date is after check-in date
                        const nights = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;

                        setCheckOutDate(date);
                        setStayLength(nights);
                      }
                    }
                  } else {
                    // Clear check-out date and stay length when selecting a new check-in date
                    checkInDateRef.current = date;
                    setCheckInDate(date);
                    setCheckOutDate(null);
                    setStayLength(null);
                  }
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
                { opacity: stayLength ? 1 : 0.3 }
              ]}
              onPress={() => {
                if (stayLength) {
                  setIsCalendarOpen(false);
                }
              }}
              disabled={!stayLength}
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
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchLabel: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  searchBarContainer: {
    marginBottom: 8,
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
  selectedAddress: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  stayDurationSection: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  stayDurationTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: '#333',
    marginBottom: 12,
  },
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
  suggestionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: '#999',
    marginTop: 15,
  },
  emptySubtext: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#ccc',
    marginTop: 5,
    textAlign: 'center',
  },
  suggestionsList: {
    paddingBottom: 20,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  suggestionIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTextContainer: {
    flex: 1,
    marginLeft: 4,
  },
  suggestionName: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: '#333',
  },
  suggestionAddress: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#999',
    marginTop: 2,
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
