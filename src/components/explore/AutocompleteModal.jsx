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
import { Colors } from '../../../constants/Colors';
import { FilterChips } from './FilterChips';
import { getSearchAutocomplete } from '../../services/searchService';

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
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localQuery, setLocalQuery] = useState(query);
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);

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
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Search in {selectedCity}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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

          {/* Filter Chips */}
          <FilterChips selectedFilters={filters} onFilterToggle={onFilterToggle} />

          {/* Suggestions List */}
          <View style={styles.divider} />

          <ScrollView style={styles.suggestionsContainer} showsVerticalScrollIndicator={false}>
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
                    onPress={() => onSuggestionSelect(suggestion)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="search" size={20} color="#999" />
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                    <Ionicons name="arrow-forward" size={20} color="#ccc" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
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
    height: '75%',
    paddingTop: 20,
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
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#999',
    marginTop: 10,
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
  suggestionText: {
    flex: 1,
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#333',
  },
});