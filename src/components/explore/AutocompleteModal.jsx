import { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Colors } from '../../../constants/Colors';
import { getSearchAutocomplete, getPlaceDetails } from '../../services/searchService';
import { useCreateTrip } from '../../../context/CreateTripContext';
import Feather from '@expo/vector-icons/Feather';
import { WishlistActivities } from '../trip-view/wishlist_activities';
import { ActivityDetailView } from '../trip-view/description_card';
import { AddHotelStayModal } from './AddHotelStayModal';
import { AddFlightModal } from './AddFlightModal';

/**
 * AutocompleteModal Component - Refactored for Direct Place Selection
 *
 * NEW FLOW:
 * 1. User types → sees 5 specific place suggestions (not generic queries)
 * 2. User clicks suggestion → place is immediately added → modal closes
 *
 * REMOVED:
 * - Search results intermediate screen
 * - "Generate More" button
 * - Multi-select functionality
 * - Activity selection state management
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {string} query - Initial search query
 * @param {string[]} filters - Selected filter IDs
 * @param {string} selectedCity - City being searched
 * @param {function} onClose - Callback to close modal
 * @param {function} onFilterToggle - Callback when a filter is toggled
 * @param {function} onQueryChange - Callback when search query changes in modal
 * @param {function} onSaveActivities - Callback to save selected activity (single activity array) or move wishlist activities (newActivities, wishlistActivityIds)
 * @param {function} onAddingPlaceChange - Optional callback to notify parent when a place is being added
 * @param {boolean} showAddingPlaceLoading - Whether to show "Adding place..." loading state when selecting a place
 * @param {Activity[]} wishlistActivities - Activities in the wishlist to display
 * @param {string} activeTab - Current active tab (to show "Save to Day X" or "Save to Wishlist")
 */
export const AutocompleteModal = ({
  visible,
  query,
  filters,
  selectedCity,
  onClose,
  onFilterToggle,
  onQueryChange,
  onSaveActivities,
  onAddingPlaceChange,
  showAddingPlaceLoading = true,
  wishlistActivities = [],
  activeTab = 'wishlist',
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localQuery, setLocalQuery] = useState(query);
  const [addingPlace, setAddingPlace] = useState(false);
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const [selectedWishlistActivities, setSelectedWishlistActivities] = useState([]);
  const [selectedActivityForDetail, setSelectedActivityForDetail] = useState(null);
  const [showActivityDetail, setShowActivityDetail] = useState(false);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [showFlightModal, setShowFlightModal] = useState(false);

  // Get recent searches from context
  const { recentSearches, addToRecentSearches } = useCreateTrip();

  // Handle close modal
  const handleCloseModal = () => {
    console.log('[AutocompleteModal] Closing modal');
    // Clear the search query when closing
    setLocalQuery('');
    if (onQueryChange) {
      onQueryChange('');
    }
    // Reset suggestions and selections
    setSuggestions([]);
    setSelectedWishlistActivities([]);
    onClose();
  };

  // Update local query when prop changes
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Focus search input when modal opens
  useEffect(() => {
    if (visible && searchInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  // Debounced fetch autocomplete suggestions
  useEffect(() => {
    const fetchSuggestions = async (searchQuery) => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // If no specific filters are selected by the user, default to 'establishment' for general places
        // This ensures we get all types of places (restaurants, attractions, etc.) but not random addresses
        const searchFilters = filters && filters.length > 0 ? filters : ['establishment'];
        const results = await getSearchAutocomplete(selectedCity, searchQuery, searchFilters);
        setSuggestions(results);
        console.log('[AutocompleteModal] Received suggestions:', results);
      } catch (err) {
        console.error('[AutocompleteModal] Error fetching suggestions:', err);
        setError('Failed to load suggestions');
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    if (visible) {
      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set new timeout for debouncing (300ms)
      debounceTimeoutRef.current = setTimeout(() => {
        fetchSuggestions(localQuery);
      }, 300);
    }

    // Cleanup timeout on unmount
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [localQuery, filters, selectedCity, visible]);

  // Handle local query change
  const handleQueryChange = (text) => {
    setLocalQuery(text);
    // Also update parent component's query if callback is provided
    if (onQueryChange) {
      onQueryChange(text);
    }
  };

  // Handle suggestion selection - NEW: directly add place
  const handleSuggestionSelect = async (suggestion) => {
    try {
      if (onAddingPlaceChange) {
        onAddingPlaceChange(true);
      }
      if (showAddingPlaceLoading) {
        setAddingPlace(true);
      } else {
        // For flows like create_trip_explore, close modal immediately on selection
        handleCloseModal();
      }
      setError(null);

      console.log('[AutocompleteModal] Selected suggestion:', suggestion);

      // Call getPlaceDetails to get full activity data
      const activity = await getPlaceDetails(suggestion.place_id, selectedCity);

      console.log('[AutocompleteModal] Got place details:', activity);

      // Add to recent searches BEFORE saving
      addToRecentSearches({
        place_id: suggestion.place_id,
        name: suggestion.name,
        address_info: suggestion.address_info
      });

      // Immediately save the activity
      if (onSaveActivities) {
        onSaveActivities([activity], []);
      }

      // Close modal and reset (for flows where we kept it open)
      if (showAddingPlaceLoading) {
        handleCloseModal();
      }
    } catch (err) {
      console.error('[AutocompleteModal] Error adding place:', err);
      setError('Failed to add place. Please try again.');
    } finally {
      if (onAddingPlaceChange) {
        onAddingPlaceChange(false);
      }
      if (showAddingPlaceLoading) {
        setAddingPlace(false);
      }
    }
  };

  // Handle recent search selection - reuse the same logic as suggestion select
  const handleRecentSearchSelect = async (recentSearch) => {
    await handleSuggestionSelect(recentSearch);
  };

  // Handle wishlist activity selection
  const handleWishlistActivitySelect = (activityId) => {
    setSelectedWishlistActivities(prev => [...prev, activityId]);
  };

  // Handle wishlist activity deselection
  const handleWishlistActivityDeselect = (activityId) => {
    setSelectedWishlistActivities(prev => prev.filter(id => id !== activityId));
  };

  // Handle save wishlist activities to current tab
  const handleSaveWishlistActivities = () => {
    if (selectedWishlistActivities.length === 0) return;

    // Get the actual activity objects
    const activitiesToMove = wishlistActivities.filter(activity =>
      selectedWishlistActivities.includes(activity.instanceId || activity.place_id)
    );

    // Call the save callback with activities and their IDs to remove from wishlist
    if (onSaveActivities) {
      onSaveActivities(activitiesToMove, selectedWishlistActivities);
    }

    // Reset and close
    setSelectedWishlistActivities([]);
    handleCloseModal();
  };

  // Handle activity card press to show description
  const handleActivityCardPress = (activity) => {
    setSelectedActivityForDetail(activity);
    setShowActivityDetail(true);
  };

  // Handle close activity detail
  const handleCloseActivityDetail = () => {
    setShowActivityDetail(false);
    setSelectedActivityForDetail(null);
  };

  // Handle adding lodging from hotel modal
  const handleAddLodging = (lodgingData) => {
    console.log('[AutocompleteModal] Adding lodging:', lodgingData);

    // Close hotel modal first
    setShowHotelModal(false);

    // Pass the lodging data to parent via onSaveActivities
    // The parent will handle adding it to the appropriate days
    if (onSaveActivities) {
      onSaveActivities([], [], lodgingData);
    }

    // Close the autocomplete modal
    handleCloseModal();
  };

  // Handle adding flight from flight modal
  const handleAddFlight = (flightData) => {
    console.log('[AutocompleteModal] Adding flight:', flightData);

    // Close flight modal first
    setShowFlightModal(false);

    // Pass the flight data to parent via onSaveActivities
    // The parent will handle adding it to the trip
    if (onSaveActivities) {
      onSaveActivities([], [], null, flightData);
    }

    // Close the autocomplete modal
    handleCloseModal();
  };

  // Swipe down gesture to close
  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      // If swiped down more than 100px with sufficient velocity, close the modal
      if (event.translationY > 100 && event.velocityY > 0) {
        runOnJS(handleCloseModal)();
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
            <Text style={styles.headerTitle}>Search in {selectedCity}</Text>
            <TouchableOpacity onPress={handleCloseModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Editable Search Bar */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={localQuery}
                onChangeText={handleQueryChange}
                placeholder="Search here"
                placeholderTextColor="#5E5E5E"
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                selectTextOnFocus={true}
                editable={!addingPlace}
              />
              {localQuery.length > 0 && !addingPlace && (
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

          {/* Hotel/Stay and Flight Buttons - Only show when search query is empty */}
          {localQuery.length === 0 && (
            <View style={styles.hotelButtonContainer}>
              <TouchableOpacity
                style={styles.hotelButton}
                onPress={() => setShowHotelModal(true)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="bed" size={24} color="black" />
                <Text style={styles.hotelButtonText}>Add Hotel/Stay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.hotelButton}
                onPress={() => setShowFlightModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="airplane" size={24} color="black" />
                <Text style={styles.hotelButtonText}>Add Flight</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Suggestions List */}
          <ScrollView style={styles.suggestionsContainer} showsVerticalScrollIndicator={false}>
            {/* Recent Searches Section - Show when query is empty and not loading */}
            {!addingPlace && !loading && localQuery.length === 0 && recentSearches.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>Recent</Text>
                {recentSearches.map((recentSearch, index) => (
                  <TouchableOpacity
                    key={recentSearch.place_id || index}
                    style={styles.suggestionItem}
                    onPress={() => handleRecentSearchSelect(recentSearch)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.suggestionIconContainer}>
                      <Ionicons name="time-outline" size={20} color="#444" />
                    </View>
                    <View style={styles.suggestionTextContainer}>
                      <Text
                        style={styles.suggestionName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {recentSearch.name}
                      </Text>
                      <Text
                        style={styles.suggestionAddress}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {recentSearch.address_info}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Wishlist Activities Section - Show when query is empty, not on wishlist tab, and wishlist has activities */}
            {!addingPlace && !loading && localQuery.length === 0 && activeTab !== 'wishlist' && wishlistActivities.length > 0 && (
              <View style={styles.wishlistSection}>
                <Text style={styles.recentTitle}>Wishlist</Text>
                <WishlistActivities
                  activities={wishlistActivities}
                  selectedActivities={selectedWishlistActivities}
                  onActivitySelect={handleWishlistActivitySelect}
                  onActivityDeselect={handleWishlistActivityDeselect}
                  onDescriptionCardPress={handleActivityCardPress}
                  showSelectionIndicator={true}
                  scrollable={false}
                />
              </View>
            )}

            {/* Adding Place Loading State */}
            {addingPlace && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.PRIMARY} />
                <Text style={styles.loadingText}>Adding place...</Text>
              </View>
            )}

            {/* Autocomplete Loading State */}
            {!addingPlace && loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.PRIMARY} />
                <Text style={styles.loadingText}>Loading suggestions...</Text>
              </View>
            )}

            {/* Error State */}
            {!addingPlace && !loading && error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#999" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Empty State - No suggestions found */}
            {!addingPlace && !loading && !error && suggestions.length === 0 && localQuery.length >= 2 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No places found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </View>
            )}

            {/* Suggestions List */}
            {!addingPlace && !loading && !error && suggestions.length > 0 && (
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

          {/* Save Button - Only show when wishlist activities are selected */}
          {selectedWishlistActivities.length > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveWishlistActivities} activeOpacity={0.8}>
                <Text style={styles.saveButtonText}>
                  Save
                  to {activeTab === 'wishlist' ? 'Wishlist' : `Day ${activeTab.replace('day', '')}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </GestureHandlerRootView>
      </View>

      {/* Activity Detail View Modal */}
      {showActivityDetail && selectedActivityForDetail && (
        <Modal visible={showActivityDetail} animationType="slide" transparent={true}>
          <View style={styles.detailModalOverlay}>
            <View style={styles.detailModalContainer}>
              <ActivityDetailView
                activity={selectedActivityForDetail}
                onClose={handleCloseActivityDetail}
                variant="wishlist"
                showDragIndicator={true}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Add Hotel/Stay Modal */}
      <AddHotelStayModal
        visible={showHotelModal}
        onClose={() => setShowHotelModal(false)}
        onAddLodging={handleAddLodging}
      />

      {/* Add Flight Modal */}
      <AddFlightModal
        visible={showFlightModal}
        onClose={() => setShowFlightModal(false)}
        onAddFlight={handleAddFlight}
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
    height: '90%',
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContainer: {
    backgroundColor: Colors.WHITE,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: '90%',
    paddingHorizontal: 0,
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
  searchBarContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
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
  hotelButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 10,
  },
  hotelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  hotelButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 12,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginTop: 10,
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
  recentSection: {
    marginBottom: 20,
  },
  wishlistSection: {
    marginBottom: 20,
  },
  recentTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 14,
    color: '#999',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: Colors.WHITE,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F36406',
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: Colors.WHITE,
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
});
