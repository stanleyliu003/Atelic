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
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Colors } from '../../../constants/Colors';
import { FilterChips } from './FilterChips';
import { getSearchAutocomplete, searchActivities } from '../../services/searchService';
import { WishlistActivities } from '../trip-view/wishlist_activities';
import { ActivityDetailView } from '../trip-view/description_card';

/**
 * AutocompleteModal Component
 * Shows autocomplete suggestions as user types their search query
 * Includes filter chips and real-time suggestion updates
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {string} query - Initial search query
 * @param {string[]} filters - Selected filter IDs
 * @param {string} selectedCity - City being searched
 * @param {function} onSuggestionSelect - Callback when a suggestion is selected
 * @param {function} onClose - Callback to close modal
 * @param {function} onFilterToggle - Callback when a filter is toggled
 * @param {function} onQueryChange - Callback when search query changes in modal
 * @param {function} onSearchActivities - Callback to search for activities
 * @param {function} onSaveActivities - Callback to save selected activities
 * @param {Activity[]} wishlistActivities - Activities already in the wishlist for "On list" tag
 * @param {string} activeTab - Current active tab (e.g., 'wishlist', 'day1', 'day2')
 */
export const AutocompleteModal = ({
  visible,
  query,
  filters,
  selectedCity,
  onSuggestionSelect,
  onClose,
  onFilterToggle,
  onQueryChange,
  onSearchActivities,
  onSaveActivities,
  wishlistActivities = [],
  activeTab = 'wishlist',
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localQuery, setLocalQuery] = useState(query);
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  
  // Search results state
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  const [showingResults, setShowingResults] = useState(false);
  
  // Description card modal state
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showDescriptionCard, setShowDescriptionCard] = useState(false);

  // Handle close modal
  const handleCloseModal = () => {
    console.log('[AutocompleteModal] Close button pressed');
    console.log('[AutocompleteModal] Current localQuery:', localQuery);
    // Clear the search query when closing
    setLocalQuery('');
    if (onQueryChange) {
      console.log('[AutocompleteModal] Calling onQueryChange with empty string');
      onQueryChange('');
    }
    // Reset search results state
    setShowingResults(false);
    setSearchResults([]);
    setSelectedActivityIds([]);
    console.log('[AutocompleteModal] Calling onClose');
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
    
    // If user is editing and we're showing results, go back to suggestions
    if (showingResults && text !== localQuery) {
      setShowingResults(false);
      setSearchResults([]);
      setSelectedActivityIds([]);
    }
  };
  
  // Handle suggestion selection - now triggers search
  const handleSuggestionSelect = async (suggestion) => {
    setLocalQuery(suggestion);
    if (onQueryChange) {
      onQueryChange(suggestion);
    }
    
    // Start search
    setSearchLoading(true);
    setSearchError(null);
    setShowingResults(true);
    
    try {
      const activities = await onSearchActivities(suggestion, filters, []);
      setSearchResults(activities);
    } catch (error) {
      console.error('[AutocompleteModal] Error searching activities:', error);
      setSearchError('Failed to search activities. Please try again.');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle enter key press - triggers searchActivities (uses searchBarActivities Lambda)
  const handleEnterKeyPress = async () => {
    if (localQuery.trim().length < 2) {
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setShowingResults(true);

    try {
      // Get existing wishlist activity names to avoid duplicates
      const existingActivityNames = wishlistActivities.map(activity => activity.name).filter(Boolean);

      const result = await searchActivities(selectedCity, localQuery, filters, existingActivityNames);

      if (result && result.activities) {
        setSearchResults(result.activities);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('[AutocompleteModal] Search error:', error);
      setSearchError('Failed to search activities. Please try again.');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };
  
  // Handle activity selection
  const handleActivityToggle = (activityId) => {
    setSelectedActivityIds((prev) => {
      if (prev.includes(activityId)) {
        return prev.filter((id) => id !== activityId);
      } else {
        return [...prev, activityId];
      }
    });
  };
  
  // Handle save selected activities
  const handleSaveActivities = () => {
    const selectedActivities = searchResults.filter((activity) =>
      selectedActivityIds.includes(activity.place_id)
    );
    onSaveActivities(selectedActivities);
    
    // Reset state
    setSelectedActivityIds([]);
    setShowingResults(false);
    setSearchResults([]);
    setLocalQuery('');
    if (onQueryChange) {
      onQueryChange('');
    }
  };
  
  // Handle activity card tap to show description
  const handleActivityPress = (activity) => {
    setSelectedActivity(activity);
    setShowDescriptionCard(true);
  };
  
  // Handle closing description card
  const handleCloseDescriptionCard = () => {
    setShowDescriptionCard(false);
    setSelectedActivity(null);
  };

  // Swipe down gesture to close
  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      // If swiped down more than 100px with sufficient velocity, close the modal
      if (event.translationY > 100 && event.velocityY > 0) {
        runOnJS(handleCloseModal)();
      }
    });

  // Format tab name for display
  const getTabDisplayName = (tab) => {
    if (tab === 'wishlist') {
      return 'Wishlist';
    }
    if (tab.startsWith('day')) {
      const dayNumber = tab.replace('day', '');
      return `Day ${dayNumber}`;
    }
    return 'Wishlist';
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
                placeholder="Search activities..."
                placeholderTextColor="#999"
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                selectTextOnFocus={true}
                onSubmitEditing={() => {
                  if (localQuery.trim().length >= 2) {
                    handleEnterKeyPress();
                  }
                }}
              />
              {localQuery.length > 0 && (
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

          {/* Filter Chips - Only show when user has typed something and not showing results */}
          {localQuery.length > 0 && !showingResults && (
            <FilterChips selectedFilters={filters} onFilterToggle={onFilterToggle} />
          )}

          {/* Suggestions List */}
          <View style={styles.divider} />

          <ScrollView style={styles.suggestionsContainer} showsVerticalScrollIndicator={false}>
            {/* Show search results when available */}
            {showingResults ? (
              <>
                {/* Search Loading State */}
                {searchLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.PRIMARY} />
                    <Text style={styles.loadingText}>Searching for "{localQuery}"...</Text>
                  </View>
                )}

                {/* Search Error State */}
                {!searchLoading && searchError && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#999" />
                    <Text style={styles.errorText}>{searchError}</Text>
                  </View>
                )}

                {/* Search Results */}
                {!searchLoading && !searchError && (
                  <>
                    {searchResults.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <Ionicons name="location-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No results found</Text>
                        <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
                      </View>
                    ) : (
                      <View style={styles.resultsContainer}>
                        <Text style={styles.resultsHeader}>
                          {searchResults.length} {searchResults.length === 1 ? 'place' : 'places'} found for "{localQuery}"
                        </Text>
                        <WishlistActivities
                          activities={searchResults}
                          selectedActivities={selectedActivityIds}
                          onActivitySelect={handleActivityToggle}
                          onActivityDeselect={handleActivityToggle}
                          onDescriptionCardPress={handleActivityPress}
                          showSelectionIndicator={true}
                          wishlistActivities={wishlistActivities}
                        />
                      </View>
                    )}
                  </>
                )}
              </>
            ) : (
              /* Show autocomplete suggestions */
              <>
                {loading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.PRIMARY} />
                    <Text style={styles.loadingText}>Loading suggestions...</Text>
                  </View>
                )}

                {!loading && error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#999" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {!loading && !error && suggestions.length === 0 && localQuery.length >= 2 && (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyText}>No suggestions found</Text>
                  </View>
                )}

                {!loading && !error && suggestions.length > 0 && (
                  <View style={styles.suggestionsList}>
                    {suggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => handleSuggestionSelect(suggestion)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="search" size={20} color="#999" />
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                        <Ionicons name="arrow-forward" size={20} color="#ccc" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Save Button - Only show when activities are selected */}
          {showingResults && selectedActivityIds.length > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveActivities} activeOpacity={0.8}>
                <Text style={styles.saveButtonText}>
                Save to {getTabDisplayName(activeTab)}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </GestureHandlerRootView>
      </View>

      {/* Activity Description Card Modal */}
      {showDescriptionCard && selectedActivity && (
        <Modal visible={showDescriptionCard} animationType="slide" transparent={false}>
          <View style={styles.descriptionCardContainer}>
            <ActivityDetailView 
              activity={selectedActivity} 
              onClose={handleCloseDescriptionCard}
              variant="wishlist"
            />
          </View>
        </Modal>
      )}
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
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
  },
  suggestionsList: {
    paddingBottom: 20,
  },
  resultsContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  resultsHeader: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    paddingHorizontal: 10,
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
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  suggestionText: {
    flex: 1,
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#333',
  },
  descriptionCardContainer: {
    flex: 1,
    paddingTop: 70,
  },
});