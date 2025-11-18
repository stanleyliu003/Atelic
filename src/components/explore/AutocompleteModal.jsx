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
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Colors } from '../../../constants/Colors';
import { FilterChips } from './FilterChips';
import { getSearchAutocomplete, getPlaceDetails } from '../../services/searchService';
import { useCreateTrip } from '../../../context/CreateTripContext';
import Feather from '@expo/vector-icons/Feather';

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
 * @param {function} onSaveActivities - Callback to save selected activity (single activity array)
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
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localQuery, setLocalQuery] = useState(query);
  const [addingPlace, setAddingPlace] = useState(false);
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);

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
    // Reset suggestions
    setSuggestions([]);
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
        const results = await getSearchAutocomplete(selectedCity, searchQuery, filters);
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
      setAddingPlace(true);
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

      // Close modal and reset
      handleCloseModal();
    } catch (err) {
      console.error('[AutocompleteModal] Error adding place:', err);
      setError('Failed to add place. Please try again.');
    } finally {
      setAddingPlace(false);
    }
  };

  // Handle recent search selection - reuse the same logic as suggestion select
  const handleRecentSearchSelect = async (recentSearch) => {
    await handleSuggestionSelect(recentSearch);
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
                placeholder="Search for places..."
                placeholderTextColor="#999"
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

          {/* Filter Chips */}
          {localQuery.length > 0 && !addingPlace && (
            <FilterChips selectedFilters={filters} onFilterToggle={onFilterToggle} />
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

            {/* Empty State - Start typing - Only show if no recent searches */}
            {!addingPlace && !loading && !error && localQuery.length < 2 && recentSearches.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>Search for places</Text>
                <Text style={styles.emptySubtext}>Type at least 2 characters to see suggestions</Text>
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
        </GestureHandlerRootView>
      </View>
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
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.PRIMARY,
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
  recentTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 14,
    color: '#999',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
