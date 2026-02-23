import { useEffect, useState, useRef, useMemo } from 'react';
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import CalendarPicker from 'react-native-calendar-picker';
import { Colors } from '../../../constants/Colors';
import { getSearchAutocomplete, getPlaceDetails } from '../../services/searchService';
import { useCreateTrip } from '../../../context/CreateTripContext';
import { ActivityCard } from '../trip-view/activity/activity_card';
import { ActivityDetailView } from '../trip-view/description_card';
import AddHotelTimeModal from './add_hotel_time_modal';


/**
 * AddHotelStayModal Component
 * Modal for adding hotel/stay accommodations with search autocomplete
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {function} onClose - Callback to close modal
 * @param {function} onAddLodging - Callback when adding lodging to trip (receives hotel data)
 */
export const AddHotelStayModal = ({ visible, onClose, onAddLodging, initialDayNumber}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);
  const [checkInDate, setCheckInDate] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState(null);
  const [stayLength, setStayLength] = useState(null);
  const { startDate: tripStartDate } = useCreateTrip();
  const [checkInTime, setCheckInTime] = useState('15:00'); // Default 3:00 PM
  const [checkOutTime, setCheckOutTime] = useState('11:00'); // Default 11:00 AM
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showCheckInTimeModal, setShowCheckInTimeModal] = useState(false);
  const [showCheckOutTimeModal, setShowCheckOutTimeModal] = useState(false);
  const [checkInButtonLayout, setCheckInButtonLayout] = useState(null);
  const [checkOutButtonLayout, setCheckOutButtonLayout] = useState(null);
  const [stayType, setStayType] = useState('hotel'); // 'hotel' | 'airbnb' | 'custom_address'
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const checkInDateRef = useRef(null);
  const checkInButtonRef = useRef(null);
  const checkOutButtonRef = useRef(null);

  // Get selected city and trip dates from context
  const { selectedCity, startDate, endDate } = useCreateTrip();

  //initial check in day to set default to when user opens calender
  useEffect(() => {
    if (!initialDayNumber || !tripStartDate) return;
  
    const date = new Date(tripStartDate);
    date.setDate(date.getDate() + (initialDayNumber - 1));
    date.setHours(0, 0, 0, 0);
  
    checkInDateRef.current = date;
    setCheckInDate(date);
  }, [initialDayNumber, tripStartDate]);
  

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

  // Format time to 12-hour format (e.g., "15:00" -> "3:00 PM")
  const formatTime = (time24) => {
    if (!time24) return '';
    const [hourStr, minute] = time24.split(':');
    const hour24 = parseInt(hourStr, 10);
    const isPM = hour24 >= 12;
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    return `${hour12}:${minute} ${isPM ? 'PM' : 'AM'}`;
  };

  // Format date to "1/15" format (without year)
  const formatShortDate = (date) => {
    if (!date) return '';
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
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
    setStayType('hotel');
    setCheckInTime('15:00'); // Reset to default 3:00 PM
    setCheckOutTime('11:00'); // Reset to default 11:00 AM
    setError(null);
    onClose();
  };

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
        // Google Autocomplete API only supports these lodging types: 'lodging', 'campground', 'rv_park'
        // 'lodging' is a broad category that includes hotels, motels, B&Bs, hostels, inns, etc.
        // Note: Does NOT include regular addresses (like Airbnb addresses)
        const filters = ['lodging', 'campground', 'rv_park'];
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
  const handleSuggestionSelect = async (suggestion) => {
    setSearchQuery(suggestion.name);
    setSuggestions([]);

    // Fetch full place details using the place_id
    if (suggestion.place_id) {
      setLoadingPlaceDetails(true);
      try {
        const fullPlaceDetails = await getPlaceDetails(suggestion.place_id, selectedCity);
        setSelectedPlace(fullPlaceDetails);
        console.log('[AddHotelStayModal] Fetched full place details:', fullPlaceDetails);
      } catch (err) {
        console.error('[AddHotelStayModal] Error fetching place details:', err);
        setError('Failed to load hotel details');
        // Fallback to basic suggestion data
        setSelectedPlace(suggestion);
      } finally {
        setLoadingPlaceDetails(false);
      }
    } else {
      // No place_id available, use basic suggestion data
      setSelectedPlace(suggestion);
    }
  };

  // Handle card press to open description modal
  const handleCardPress = () => {
    setShowDescriptionModal(true);
  };

  // Handle adding lodging to trip
  const handleAddLodging = () => {
    if (!selectedPlace || !checkInDate || !checkOutDate || !stayLength) {
      return; // Don't allow adding without complete information
    }

    // Prepare hotel activity with lodging flags
    const hotelActivity = {
      ...selectedPlace,
      // Add lodging-specific flags and metadata
      primaryType: 'lodging',
      isLodging: true,
      lodgingCheckIn: checkInDate.toISOString(),
      lodgingCheckOut: checkOutDate.toISOString(),
      lodgingTime: {
        checkIn: checkInTime,
        checkOut: checkOutTime,
      },
    };

    // Prepare lodging data
    const lodgingData = {
      hotel: hotelActivity,
      checkInDate,
      checkOutDate,
      stayLength,
      checkInTime,
      checkOutTime,
    };

    // Call parent callback
    if (onAddLodging) {
      onAddLodging(lodgingData);
    }

    // Close modal and reset
    handleClose();
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
            <Text style={styles.headerTitle}></Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Stay Duration Section - Always show */}
          <View style={styles.stayDurationSection}>
            <Text style={styles.stayDurationTitle}>How long is your stay?</Text>

            {/* Date Selection Button */}
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {setIsCalendarOpen(true)}}
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

          {/* Stay Type Selector - Only show after dates are selected */}
          {stayLength && (
            <View style={styles.stayTypeSection}>
              <Text style={styles.stayTypeTitle}>Select your lodging</Text>
              <View style={styles.stayTypeOptionsRow}>
                <TouchableOpacity
                  style={[styles.stayTypeOption, stayType === 'hotel' && styles.stayTypeOptionSelected]}
                  onPress={() => setStayType('hotel')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stayTypeOptionText, stayType === 'hotel' && styles.stayTypeOptionTextSelected]}>
                    Hotel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stayTypeOption, stayType === 'airbnb' && styles.stayTypeOptionSelected]}
                  onPress={() => {
                    setStayType('airbnb');
                    setSelectedPlace(null);
                    setSearchQuery('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stayTypeOptionText, stayType === 'airbnb' && styles.stayTypeOptionTextSelected]}>
                    Airbnb
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stayTypeOption, stayType === 'custom_address' && styles.stayTypeOptionSelected]}
                  onPress={() => {
                    setStayType('custom_address');
                    setSelectedPlace(null);
                    setSearchQuery('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stayTypeOptionText, stayType === 'custom_address' && styles.stayTypeOptionTextSelected]}>
                    Address
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Search Section - Only show when Hotel is selected (uses getPlaceDetails) */}
          {stayLength && stayType === 'hotel' && (
            <View style={styles.searchSection}>
              <Text style={styles.searchSectionTitle}>Where are you staying?</Text>

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

            </View>
          )}

          {/* AirBnB / Custom Address - Coming soon placeholder */}
          {stayLength && stayType !== 'hotel' && (
            <View style={styles.comingSoonContainer}>
              <MaterialCommunityIcons
                name={stayType === 'airbnb' ? 'home-city-outline' : 'map-marker-plus-outline'}
                size={40}
                color="#ccc"
              />
              <Text style={styles.comingSoonText}>
                {stayType === 'airbnb' ? 'AirBnB' : 'Custom Address'} coming soon
              </Text>
              <Text style={styles.comingSoonSubtext}>
                Switch to Hotel to add your stay for now
              </Text>
            </View>
          )}

          {/* Selected Place Activity Card - Hotel only */}
          {stayType === 'hotel' && (selectedPlace || loadingPlaceDetails) && (
            <View style={styles.selectedPlaceContainer}>
              {loadingPlaceDetails ? (
                <View style={styles.loadingPlaceDetailsContainer}>
                  <ActivityIndicator size="small" color={Colors.PRIMARY} />
                  <Text style={styles.loadingPlaceDetailsText}>Loading hotel details...</Text>
                </View>
              ) : selectedPlace ? (
                <ActivityCard
                  activity={selectedPlace}
                  disabled={false}
                  hideNotesButton={true}
                  isLastActivity={true}
                  onDescriptionCardPress={handleCardPress}
                />
              ) : null}
            </View>
          )}

          {/* Check-in and Check-out Time Buttons Row - Show below activity card when dates selected (Hotel only) */}
          {stayType === 'hotel' && selectedPlace && !loadingPlaceDetails && stayLength && (
            <View style={styles.timeButtonsSection}>
              <View style={styles.timeButtonsRow}>
                {/* Check-in Time Button */}
                <TouchableOpacity
                  ref={checkInButtonRef}
                  style={[styles.dateButton, styles.halfWidthButton]}
                  onPress={() => {
                    checkInButtonRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
                      setCheckInButtonLayout({ x: pageX, y: pageY, width, height });
                      setShowCheckInTimeModal(true);
                    });
                  }}
                >
                  <View style={styles.timeButtonColumn}>
                    <Text style={styles.timeButtonLabel}>
                      Check-in {checkInDate ? `(${formatShortDate(checkInDate)})` : ''}
                    </Text>
                    <View style={styles.timeButtonContent}>
                      <Ionicons name="time-outline" size={20} color="black" />
                      <Text style={styles.timeButtonText}>
                        {formatTime(checkInTime)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Check-out Time Button */}
                <TouchableOpacity
                  ref={checkOutButtonRef}
                  style={[styles.dateButton, styles.halfWidthButton]}
                  onPress={() => {
                    checkOutButtonRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
                      setCheckOutButtonLayout({ x: pageX, y: pageY, width, height });
                      setShowCheckOutTimeModal(true);
                    });
                  }}
                >
                  <View style={styles.timeButtonColumn}>
                    <Text style={styles.timeButtonLabel}>
                      Check-out {checkOutDate ? `(${formatShortDate(checkOutDate)})` : ''}
                    </Text>
                    <View style={styles.timeButtonContent}>
                      <Ionicons name="time-outline" size={20} color="black" />
                      <Text style={styles.timeButtonText}>
                        {formatTime(checkOutTime)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Suggestions List - Only show for Hotel when no place is selected or being loaded */}
          {stayType === 'hotel' && !selectedPlace && !loadingPlaceDetails && (
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
              {!loading && !error && suggestions.length === 0 && searchQuery.length >= 2 && (
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
                      <MaterialIcons name="bed" size={20} color="#444" />
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
          )}

          {/* Add Lodging Button - Show when Hotel selected with place, dates, and times */}
          {stayType === 'hotel' && selectedPlace && checkInDate && checkOutDate && stayLength && (
            <View style={styles.addLodgingButtonContainer}>
              <TouchableOpacity
                style={styles.addLodgingButton}
                onPress={handleAddLodging}
                activeOpacity={0.8}
              >
                <Text style={styles.addLodgingButtonText}>Add lodging</Text>
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
                allowRangeSelection={true}
                minDate={startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0))}
                maxDate={endDate ? new Date(endDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 3))}
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

                    if (currentCheckInDate && type !== 'START_DATE') {
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

      {/* Activity Detail Modal */}
      {showDescriptionModal && selectedPlace && (
        <Modal visible={showDescriptionModal} animationType="slide" transparent={true}>
          <View style={styles.descriptionModalOverlay}>
            <View style={styles.descriptionModalContent}>
              <ActivityDetailView
                activity={selectedPlace}
                onClose={() => setShowDescriptionModal(false)}
                variant="wishlist"
                showDragIndicator={true}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Check-in Time Modal */}
      <AddHotelTimeModal
        visible={showCheckInTimeModal}
        onClose={() => setShowCheckInTimeModal(false)}
        initialTime={checkInTime}
        onSave={(time) => {
          setCheckInTime(time);
        }}
        buttonLayout={checkInButtonLayout}
      />

      {/* Check-out Time Modal */}
      <AddHotelTimeModal
        visible={showCheckOutTimeModal}
        onClose={() => setShowCheckOutTimeModal(false)}
        initialTime={checkOutTime}
        onSave={(time) => {
          setCheckOutTime(time);
        }}
        buttonLayout={checkOutButtonLayout}
      />
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
    marginBottom: 0,
  },
  searchSectionTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: '#333',
    marginBottom: 12,
  },
  searchLabel: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  helperText: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    lineHeight: 16,
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
  selectedPlaceContainer: {
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 5,
  },
  loadingPlaceDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingPlaceDetailsText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
  },
  stayDurationSection: {
    paddingHorizontal: 20,
    marginTop: 0,
    marginBottom: 20,
  },
  stayTypeSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  stayTypeTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: '#333',
    marginBottom: 12,
  },
  stayTypeOptionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  stayTypeOption: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stayTypeOptionSelected: {
    backgroundColor: Colors.PRIMARY || '#FFA53F',
    borderColor: Colors.PRIMARY || '#FFA53F',
  },
  stayTypeOptionText: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#666',
  },
  stayTypeOptionTextSelected: {
    color: Colors.WHITE,
  },
  comingSoonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    gap: 8,
  },
  comingSoonText: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: '#666',
  },
  comingSoonSubtext: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#999',
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
  timeButton: {
    marginTop: 12,
  },
  timeButtonsSection: {
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 10,
  },
  timeButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  halfWidthButton: {
    flex: 1,
    height: 70,
  },
  timeButtonColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  timeButtonLabel: {
    fontFamily: 'outfit-medium',
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeButtonText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#1a1a1a',
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
  // Description Modal Styles
  descriptionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  descriptionModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '90%',
    height: '90%',
  },
  // Add Lodging Button Styles
  addLodgingButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: Colors.WHITE,
  },
  addLodgingButton: {
    marginTop: 30,
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
  addLodgingButtonText: {
    color: '#FFFFFF',
    fontFamily: 'outfit-bold',
    fontSize: 18,
  },
});
