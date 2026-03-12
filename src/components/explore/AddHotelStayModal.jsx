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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import CalendarPicker from 'react-native-calendar-picker';
import { getSearchAutocomplete, getPlaceDetails } from '../../services/searchService';
import { useCreateTrip } from '../../../context/CreateTripContext';
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
export const AddHotelStayModal = ({ visible, onClose, onAddLodging, existingHotel, tripHotels = [], onEditHotel }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);
  const [checkInDate, setCheckInDate] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState(null);
  const [stayLength, setStayLength] = useState(null);
  const [checkInTime, setCheckInTime] = useState('15:00'); // Default 3:00 PM
  const [checkOutTime, setCheckOutTime] = useState('11:00'); // Default 11:00 AM
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showCheckInTimeModal, setShowCheckInTimeModal] = useState(false);
  const [showCheckOutTimeModal, setShowCheckOutTimeModal] = useState(false);
  const [checkInButtonLayout, setCheckInButtonLayout] = useState(null);
  const [checkOutButtonLayout, setCheckOutButtonLayout] = useState(null);
  const [stayType, setStayType] = useState('hotel'); // 'hotel' | 'airbnb' | 'custom_address'
  const [addedHotels, setAddedHotels] = useState([]); // Track hotels added in this session
  const [isAddingAnother, setIsAddingAnother] = useState(false); // Track if user clicked "Add another"
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const checkInDateRef = useRef(null);
  const checkInButtonRef = useRef(null);
  const checkOutButtonRef = useRef(null);

  // Get selected city and trip dates from context
  const { selectedCity, startDate, endDate } = useCreateTrip();

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

  // Reset form for adding another hotel
  const resetForm = () => {
    setSearchQuery('');
    setSuggestions([]);
    setSelectedPlace(null);
    setCheckInDate(null);
    setCheckOutDate(null);
    setStayLength(null);
    setStayType('hotel');
    setCheckInTime('15:00');
    setCheckOutTime('11:00');
    setError(null);
  };

  // Handle modal close
  const handleClose = () => {
    resetForm();
    setAddedHotels([]);
    setIsAddingAnother(false);
    onClose();
  };

  // Pre-populate form when editing an existing hotel
  useEffect(() => {
    if (visible && existingHotel) {
      setSelectedPlace(existingHotel);
      setSearchQuery(existingHotel.name || '');
      setStayType('hotel');

      if (existingHotel.lodgingCheckIn) {
        const ciDate = new Date(existingHotel.lodgingCheckIn);
        setCheckInDate(ciDate);
        checkInDateRef.current = ciDate;
      }
      if (existingHotel.lodgingCheckOut) {
        const coDate = new Date(existingHotel.lodgingCheckOut);
        setCheckOutDate(coDate);
      }
      if (existingHotel.lodgingCheckIn && existingHotel.lodgingCheckOut) {
        const ci = new Date(existingHotel.lodgingCheckIn);
        const co = new Date(existingHotel.lodgingCheckOut);
        const nights = Math.floor((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24));
        setStayLength(nights);
      }
      if (existingHotel.lodgingTime?.checkIn) {
        setCheckInTime(existingHotel.lodgingTime.checkIn);
      }
      if (existingHotel.lodgingTime?.checkOut) {
        setCheckOutTime(existingHotel.lodgingTime.checkOut);
      }
    } else if (visible && !existingHotel) {
      // Reset form and focus search input when adding a new hotel
      resetForm();
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [visible, existingHotel]);

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

    // Prepare hotel activity with lodging flags (clear context/notes to prevent stale inheritance)
    const hotelActivity = {
      ...selectedPlace,
      notes: undefined,
      lodgingContext: undefined,
      primaryType: 'lodging',
      isLodging: true,
      lodgingCheckIn: checkInDate.toISOString(),
      lodgingCheckOut: checkOutDate.toISOString(),
      lodgingTime: {
        checkIn: checkInTime,
        checkOut: checkOutTime,
      },
    };

    // isEdit true when editing existing hotel (first save), false when adding genuinely new hotels
    const lodgingData = {
      hotel: hotelActivity,
      checkInDate,
      checkOutDate,
      stayLength,
      checkInTime,
      checkOutTime,
      isEdit: existingHotel && !isAddingAnother,
    };

    // Track added hotel for display
    setAddedHotels(prev => [...prev, {
      name: selectedPlace.name,
      checkIn: formatDate(checkInDate),
      checkOut: formatDate(checkOutDate),
      nights: stayLength,
    }]);

    // Call parent callback
    if (onAddLodging) {
      onAddLodging(lodgingData);
    }

    // Reset form for adding another hotel (don't close)
    resetForm();
    setIsAddingAnother(true);
  };

  // Handle adding lodging and closing the modal
  const handleAddLodgingAndClose = () => {
    if (!selectedPlace || !checkInDate || !checkOutDate || !stayLength) {
      return;
    }

    const hotelActivity = {
      ...selectedPlace,
      notes: undefined,
      lodgingContext: undefined,
      primaryType: 'lodging',
      isLodging: true,
      lodgingCheckIn: checkInDate.toISOString(),
      lodgingCheckOut: checkOutDate.toISOString(),
      lodgingTime: {
        checkIn: checkInTime,
        checkOut: checkOutTime,
      },
    };

    const lodgingData = {
      hotel: hotelActivity,
      checkInDate,
      checkOutDate,
      stayLength,
      checkInTime,
      checkOutTime,
      isEdit: existingHotel && !isAddingAnother,
    };

    if (onAddLodging) {
      onAddLodging(lodgingData);
    }

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

  // Determine modal title
  const modalTitle = isAddingAnother || addedHotels.length > 0
    ? 'Add Another Hotel'
    : existingHotel ? 'Hotel Stay' : 'Add Hotel Stay';

  // Whether the form is complete and ready to save
  const canSave = stayType === 'hotel' && selectedPlace && checkInDate && checkOutDate && stayLength;

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <GestureHandlerRootView style={styles.modalContainer}>
          {/* Drag Handle */}
          <GestureDetector gesture={swipeGesture}>
            <View style={styles.dragIndicatorContainer}>
              <View style={styles.dragIndicator} />
            </View>
          </GestureDetector>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{modalTitle}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.closeButtonCircle}>
                <Ionicons name="close" size={16} color="#8E8E93" />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Existing Trip Hotels */}
            {tripHotels.length > 0 && !existingHotel && (
              <View style={styles.existingHotelsSection}>
                <Text style={styles.sectionLabel}>Your Stays</Text>
                {tripHotels.map((hotel, index) => {
                  const ciDate = hotel.lodgingCheckIn ? formatDate(new Date(hotel.lodgingCheckIn)) : null;
                  const coDate = hotel.lodgingCheckOut ? formatDate(new Date(hotel.lodgingCheckOut)) : null;
                  const ciTime = hotel.lodgingTime?.checkIn ? formatTime(hotel.lodgingTime.checkIn) : null;
                  const coTime = hotel.lodgingTime?.checkOut ? formatTime(hotel.lodgingTime.checkOut) : null;
                  let nights = 0;
                  if (hotel.lodgingCheckIn && hotel.lodgingCheckOut) {
                    nights = Math.max(0, Math.round((new Date(hotel.lodgingCheckOut).getTime() - new Date(hotel.lodgingCheckIn).getTime()) / (1000 * 60 * 60 * 24)));
                  }
                  return (
                    <TouchableOpacity
                      key={hotel.instanceId || hotel.place_id || index}
                      style={styles.ehCard}
                      onPress={() => onEditHotel?.(hotel)}
                      activeOpacity={0.7}
                    >
                      {/* Header: icon + name + nights pill */}
                      <View style={styles.ehHeader}>
                        <View style={styles.ehIconWrap}>
                          <MaterialIcons name="bed" size={18} color="#FFF" />
                        </View>
                        <Text style={styles.ehName} numberOfLines={2}>{hotel.name}</Text>
                        {nights > 0 && (
                          <View style={styles.ehNightsPill}>
                            <Ionicons name="moon-outline" size={12} color="#6366F1" />
                            <Text style={styles.ehNightsText}>{nights}n</Text>
                          </View>
                        )}
                      </View>

                      {/* Two-column check-in / check-out */}
                      <View style={styles.ehDatesRow}>
                        <View style={styles.ehDateSide}>
                          <Text style={styles.ehDateLabel}>CHECK-IN</Text>
                          <Text style={styles.ehDateValue}>{ciDate || '—'}</Text>
                          {ciTime && <Text style={styles.ehTimeValue}>{ciTime}</Text>}
                        </View>
                        <View style={styles.ehDateCenter}>
                          <View style={styles.ehDateLine} />
                          <View style={styles.ehDateConnectorIcon}>
                            <Ionicons name="chevron-forward" size={10} color="#6366F1" />
                          </View>
                          <View style={styles.ehDateLine} />
                        </View>
                        <View style={[styles.ehDateSide, { alignItems: 'flex-end' }]}>
                          <Text style={styles.ehDateLabel}>CHECK-OUT</Text>
                          <Text style={styles.ehDateValue}>{coDate || '—'}</Text>
                          {coTime && <Text style={styles.ehTimeValue}>{coTime}</Text>}
                        </View>
                      </View>

                      {/* Tap to edit hint */}
                      <View style={styles.ehEditHint}>
                        <Ionicons name="create-outline" size={12} color="#AEAEB2" />
                        <Text style={styles.ehEditHintText}>Tap to edit</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Added Hotels Summary (just added in this session) */}
            {addedHotels.length > 0 && (
              <View style={styles.addedHotelsSection}>
                {addedHotels.map((hotel, index) => (
                  <View key={index} style={styles.addedHotelItem}>
                    <View style={styles.addedHotelCheckIcon}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                    <View style={styles.addedHotelInfo}>
                      <Text style={styles.addedHotelName} numberOfLines={1}>{hotel.name}</Text>
                      <Text style={styles.addedHotelDates}>
                        {hotel.checkIn} → {hotel.checkOut} · {hotel.nights}n
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Section divider when there are existing hotels */}
            {tripHotels.length > 0 && !existingHotel && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Add New Stay</Text>
              </View>
            )}

            {/* Dates Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Dates</Text>
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setIsCalendarOpen(true)}
                activeOpacity={0.6}
              >
                <View style={styles.dateSelectorContent}>
                  <Ionicons name="calendar-outline" size={18} color={checkInDate ? '#6366F1' : '#C7C7CC'} />
                  {checkInDate && checkOutDate ? (
                    <View style={styles.dateRangeDisplay}>
                      <Text style={styles.dateText}>
                        {formatDate(checkInDate)}
                      </Text>
                      <Ionicons name="arrow-forward" size={14} color="#C7C7CC" />
                      <Text style={styles.dateText}>
                        {formatDate(checkOutDate)}
                      </Text>
                      {stayLength && (
                        <View style={styles.nightsPill}>
                          <Text style={styles.nightsPillText}>{stayLength}n</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.datePlaceholder}>Select check-in & check-out</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </TouchableOpacity>
            </View>

            {/* Search Section */}
            {stayLength && stayType === 'hotel' && (!existingHotel || isAddingAnother) && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Hotel</Text>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color="#8E8E93" />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={handleQueryChange}
                    placeholder="Search hotels, resorts, lodging..."
                    placeholderTextColor="#C7C7CC"
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => handleQueryChange('')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#C7C7CC" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Selected Hotel Card */}
            {stayType === 'hotel' && (selectedPlace || loadingPlaceDetails) && (
              <View style={styles.sectionContainer}>
                {!(!existingHotel || isAddingAnother) && (
                  <Text style={styles.sectionLabel}>Hotel</Text>
                )}
                {loadingPlaceDetails ? (
                  <View style={styles.loadingPlaceContainer}>
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text style={styles.loadingPlaceText}>Finding hotel details...</Text>
                  </View>
                ) : selectedPlace ? (
                  <View style={styles.selectedHotelCard}>
                    <View style={styles.selectedHotelIconBg}>
                      <MaterialIcons name="bed" size={18} color="#6366F1" />
                    </View>
                    <View style={styles.selectedHotelInfo}>
                      <Text style={styles.selectedHotelName} numberOfLines={1}>{selectedPlace.name}</Text>
                      <View style={styles.selectedHotelMeta}>
                        {selectedPlace.rating && (
                          <Text style={styles.selectedHotelRating}>
                            ★ {selectedPlace.rating}
                          </Text>
                        )}
                        {selectedPlace.formatted_address && (
                          <Text style={styles.selectedHotelAddress} numberOfLines={1}>
                            {selectedPlace.formatted_address}
                          </Text>
                        )}
                      </View>
                    </View>
                    {(!existingHotel || isAddingAnother) && (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedPlace(null);
                          setSearchQuery('');
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#C7C7CC" />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </View>
            )}

            {/* Time Section */}
            {stayType === 'hotel' && selectedPlace && !loadingPlaceDetails && stayLength && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Times</Text>
                <View style={styles.timeRow}>
                  <TouchableOpacity
                    ref={checkInButtonRef}
                    style={styles.timeCard}
                    onPress={() => {
                      checkInButtonRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
                        setCheckInButtonLayout({ x: pageX, y: pageY, width, height });
                        setShowCheckInTimeModal(true);
                      });
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.timeCardLabel}>Check-in</Text>
                    <Text style={styles.timeCardValue}>{formatTime(checkInTime)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    ref={checkOutButtonRef}
                    style={styles.timeCard}
                    onPress={() => {
                      checkOutButtonRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
                        setCheckOutButtonLayout({ x: pageX, y: pageY, width, height });
                        setShowCheckOutTimeModal(true);
                      });
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.timeCardLabel}>Check-out</Text>
                    <Text style={styles.timeCardValue}>{formatTime(checkOutTime)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Suggestions List */}
            {stayType === 'hotel' && !selectedPlace && !loadingPlaceDetails && (
              <>
                {loading && (
                  <View style={styles.centeredState}>
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text style={styles.stateText}>Searching...</Text>
                  </View>
                )}

                {!loading && error && (
                  <View style={styles.centeredState}>
                    <Ionicons name="alert-circle-outline" size={36} color="#C7C7CC" />
                    <Text style={styles.stateText}>{error}</Text>
                  </View>
                )}

                {!loading && !error && suggestions.length === 0 && searchQuery.length >= 2 && (
                  <View style={styles.centeredState}>
                    <Ionicons name="search-outline" size={36} color="#C7C7CC" />
                    <Text style={styles.stateTextBold}>No results</Text>
                    <Text style={styles.stateText}>Try a different search term</Text>
                  </View>
                )}

                {!loading && !error && suggestions.length > 0 && (
                  <View style={styles.suggestionsList}>
                    {suggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={suggestion.place_id || index}
                        style={styles.suggestionItem}
                        onPress={() => handleSuggestionSelect(suggestion)}
                        activeOpacity={0.5}
                      >
                        <View style={styles.suggestionIcon}>
                          <MaterialIcons name="bed" size={16} color="#6366F1" />
                        </View>
                        <View style={styles.suggestionText}>
                          <Text style={styles.suggestionName} numberOfLines={1}>
                            {suggestion.name}
                          </Text>
                          <Text style={styles.suggestionAddress} numberOfLines={1}>
                            {suggestion.address_info}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color="#D1D1D6" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Bottom Action Bar */}
          {canSave && (
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddLodgingAndClose}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>
                  {existingHotel && !isAddingAnother ? 'Save Changes' : 'Add to Trip'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addAnotherButton}
                onPress={handleAddLodging}
                activeOpacity={0.6}
              >
                <Ionicons name="add" size={16} color="#6366F1" />
                <Text style={styles.addAnotherButtonText}>Add another hotel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Done button when hotels have been added and form is empty */}
          {addedHotels.length > 0 && !canSave && (
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>Done</Text>
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
          <View style={styles.calendarSheet}>
            <View {...calendarPanResponder.panHandlers} style={styles.calendarHandleBar}>
              <View style={styles.calendarHandle} />
            </View>

            <Text style={styles.calendarTitle}>Select Dates</Text>

            {/* Selected range summary */}
            {checkInDate && checkOutDate && stayLength && (
              <View style={styles.calendarSummary}>
                <Text style={styles.calendarSummaryText}>
                  {formatDate(checkInDate)} → {formatDate(checkOutDate)}
                </Text>
                <View style={styles.nightsPill}>
                  <Text style={styles.nightsPillText}>{stayLength}n</Text>
                </View>
              </View>
            )}

            <View style={styles.calendarContainer}>
              <CalendarPicker
                startFromMonday={false}
                allowRangeSelection={true}
                minDate={startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0))}
                maxDate={endDate ? new Date(endDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 3))}
                todayBackgroundColor="transparent"
                todayTextStyle={{ color: '#6366F1', fontFamily: 'outfit-bold' }}
                selectedDayColor="#6366F1"
                selectedDayTextColor="#FFFFFF"
                selectedRangeStyle={{ backgroundColor: '#EDE9FE' }}
                selectedStartDate={checkInDate}
                selectedEndDate={checkOutDate}
                enableSwipe={true}
                weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
                allowBackwardRangeSelect={true}
                onDateChange={(date, type) => {
                  if (type === 'END_DATE') {
                    if (!date) {
                      setCheckOutDate(null);
                      setStayLength(null);
                      return;
                    }
                    const currentCheckInDate = checkInDateRef.current;
                    if (currentCheckInDate) {
                      const timeDiff = date.getTime() - currentCheckInDate.getTime();
                      if (timeDiff < 0) {
                        const newCheckInDate = date;
                        const newCheckOutDate = currentCheckInDate;
                        const swappedTimeDiff = newCheckOutDate.getTime() - newCheckInDate.getTime();
                        const swappedNights = Math.floor(swappedTimeDiff / (1000 * 60 * 60 * 24));
                        checkInDateRef.current = newCheckInDate;
                        setCheckInDate(newCheckInDate);
                        setCheckOutDate(newCheckOutDate);
                        setStayLength(swappedNights);
                      } else {
                        const nights = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                        setCheckOutDate(date);
                        setStayLength(nights);
                      }
                    }
                  } else {
                    checkInDateRef.current = date;
                    setCheckInDate(date);
                    setCheckOutDate(null);
                    setStayLength(null);
                  }
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
              style={[styles.calendarConfirmButton, !stayLength && styles.calendarConfirmDisabled]}
              onPress={() => { if (stayLength) setIsCalendarOpen(false); }}
              disabled={!stayLength}
              activeOpacity={0.8}
            >
              <Text style={[styles.calendarConfirmText, !stayLength && styles.calendarConfirmTextDisabled]}>
                {stayLength ? `Confirm · ${stayLength} ${stayLength === 1 ? 'night' : 'nights'}` : 'Select dates'}
              </Text>
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
    flex: 1,
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
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
  nightsPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  nightsPillText: {
    fontFamily: 'outfit-bold',
    fontSize: 11,
    color: '#6366F1',
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

  // ─── Selected Hotel Card ─────────────────────────────
  selectedHotelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  selectedHotelIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedHotelInfo: {
    flex: 1,
  },
  selectedHotelName: {
    fontFamily: 'outfit-bold',
    fontSize: 15,
    color: '#1C1C1E',
  },
  selectedHotelMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  selectedHotelRating: {
    fontFamily: 'outfit-medium',
    fontSize: 13,
    color: '#6366F1',
  },
  selectedHotelAddress: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#8E8E93',
    flex: 1,
  },

  // ─── Loading Place ───────────────────────────────────
  loadingPlaceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  loadingPlaceText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#8E8E93',
  },

  // ─── Time Cards ──────────────────────────────────────
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  timeCardLabel: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  timeCardValue: {
    fontFamily: 'outfit-bold',
    fontSize: 17,
    color: '#1C1C1E',
  },

  // ─── States (loading, error, empty) ──────────────────
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
    textAlign: 'center',
  },
  stateTextBold: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: '#8E8E93',
  },

  // ─── Suggestions ─────────────────────────────────────
  suggestionsList: {
    paddingHorizontal: 20,
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
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    fontFamily: 'outfit-medium',
    fontSize: 15,
    color: '#1C1C1E',
  },
  suggestionAddress: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 1,
  },

  // ─── Bottom Action Bar ───────────────────────────────
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  saveButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontFamily: 'outfit-bold',
    fontSize: 16,
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
    marginTop: 4,
  },
  addAnotherButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#6366F1',
  },

  // ─── Existing Trip Hotels ────────────────────────────
  existingHotelsSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  ehCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0EEFF',
  },
  ehHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  ehIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ehName: {
    flex: 1,
    fontFamily: 'outfit-semibold',
    fontSize: 16,
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  ehNightsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0EEFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  ehNightsText: {
    fontFamily: 'outfit-semibold',
    fontSize: 13,
    color: '#6366F1',
  },
  ehDatesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F7FF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  ehDateSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  ehDateLabel: {
    fontFamily: 'outfit-medium',
    fontSize: 10,
    color: '#AEAEB2',
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  ehDateValue: {
    fontFamily: 'outfit-bold',
    fontSize: 15,
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
  ehTimeValue: {
    fontFamily: 'outfit-semibold',
    fontSize: 13,
    color: '#6366F1',
    marginTop: 3,
  },
  ehDateCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 16,
    gap: 3,
    flexDirection: 'row',
  },
  ehDateConnectorIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EEEDFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ehDateLine: {
    width: 12,
    height: 1.5,
    backgroundColor: '#E0DDFC',
    borderRadius: 1,
  },
  ehEditHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
  },
  ehEditHintText: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#AEAEB2',
  },

  // ─── Added Hotels Summary ────────────────────────────
  addedHotelsSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  addedHotelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  addedHotelCheckIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedHotelInfo: {
    flex: 1,
  },
  addedHotelName: {
    fontFamily: 'outfit-bold',
    fontSize: 14,
    color: '#1C1C1E',
  },
  addedHotelDates: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },

  // ─── Calendar Modal ──────────────────────────────────
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  calendarSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  calendarHandleBar: {
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  calendarHandle: {
    width: 36,
    height: 5,
    backgroundColor: '#E5E5EA',
    borderRadius: 2.5,
  },
  calendarTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 17,
    color: '#1C1C1E',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  calendarSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  calendarSummaryText: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#8E8E93',
  },
  calendarContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarConfirmButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarConfirmDisabled: {
    backgroundColor: '#F2F2F7',
  },
  calendarConfirmText: {
    color: '#FFFFFF',
    fontFamily: 'outfit-bold',
    fontSize: 16,
  },
  calendarConfirmTextDisabled: {
    color: '#C7C7CC',
  },

  // ─── Description Modal ───────────────────────────────
  descriptionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  descriptionModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    height: '90%',
  },
});
