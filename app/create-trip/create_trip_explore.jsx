import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { SearchBar } from '../../src/components/explore/SearchBar';
import { FilterChips } from '../../src/components/explore/FilterChips';
import { AutocompleteModal } from '../../src/components/explore/AutocompleteModal';
import { SearchResultsModal } from '../../src/components/explore/SearchResultsModal';
import { CategoryModal } from '../../src/components/explore/CategoryModal';

export default function create_trip_explore() {
  const router = useRouter();
  const navigation = useNavigation();
  const {
    selectedCity,
    cityCategories,
    setIsCreatingTrip,
    addToWishlist,
    searchActivities,
    generateActivitiesForCategory,
  } = useCreateTrip();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState([]);

  // Modal visibility state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Data state
  const [searchResultActivities, setSearchResultActivities] = useState([]);
  const [selectedSearchQuery, setSelectedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryActivities, setCategoryActivities] = useState([]);
  const [loadingCategoryActivities, setLoadingCategoryActivities] = useState(false);

  // Cache for category activities to persist across modal opens/closes
  const [categoryCache, setCategoryCache] = useState({});

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });

    setIsCreatingTrip(true);

    return () => {
      setIsCreatingTrip(false);
    };
  }, []);

  // ===== SEARCH FLOW HANDLERS =====

  const handleSearchFocus = () => {
    if (searchQuery.trim().length >= 2) {
      setShowAutocomplete(true);
    }
  };

  const handleSearchQueryChange = (text) => {
    setSearchQuery(text);
    if (text.trim().length >= 2) {
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleSuggestionSelect = async (suggestion) => {
    setShowAutocomplete(false);
    setSelectedSearchQuery(suggestion);

    try {
      // Fetch activities using the selected suggestion
      const activities = await searchActivities(suggestion, selectedFilters, []);
      setSearchResultActivities(activities);
      setShowSearchResults(true);
    } catch (error) {
      console.error('[Explore] Error fetching search results:', error);
      Alert.alert('Error', 'Failed to fetch search results. Please try again.');
    }
  };

  const handleSaveSearchResults = (selectedActivities) => {
    if (selectedActivities.length === 0) {
      setShowSearchResults(false);
      return;
    }

    const result = addToWishlist(selectedActivities);

    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResultActivities([]);

    // Show success message
    if (result.added > 0 && result.duplicates > 0) {
      Alert.alert(
        'Added to Wishlist',
        `${result.added} ${result.added === 1 ? 'place' : 'places'} added. ${result.duplicates} ${result.duplicates === 1 ? 'was' : 'were'} already in your wishlist.`
      );
    } else if (result.added > 0) {
      Alert.alert(
        'Added to Wishlist',
        `${result.added} ${result.added === 1 ? 'place' : 'places'} added to your wishlist.`
      );
    } else if (result.duplicates > 0) {
      Alert.alert(
        'Already in Wishlist',
        `All selected ${result.duplicates === 1 ? 'place is' : 'places are'} already in your wishlist.`
      );
    }
  };

  // ===== FILTER FLOW HANDLERS =====

  const handleFilterToggle = (filterId) => {
    setSelectedFilters((prev) => {
      if (prev.includes(filterId)) {
        return prev.filter((id) => id !== filterId);
      } else {
        return [...prev, filterId];
      }
    });
  };

  // ===== CATEGORY FLOW HANDLERS =====

  const handleCategoryPress = async (category) => {
    setSelectedCategory(category.category);
    setShowCategoryModal(true);

    // Check if we already have cached activities for this category
    if (categoryCache[category.category]) {
      setCategoryActivities(categoryCache[category.category]);
      return;
    }

    // If not cached, fetch new activities
    setCategoryActivities([]); // Clear previous activities immediately
    setLoadingCategoryActivities(true);

    try {
      // Generate activities for this category
      const activities = await generateActivitiesForCategory(category.category);
      if (activities && activities.length > 0) {
        setCategoryActivities(activities);
        // Cache the activities for this category
        setCategoryCache(prev => ({
          ...prev,
          [category.category]: activities
        }));
      } else {
        setCategoryActivities([]);
      }
    } catch (error) {
      console.error('[Explore] Error generating category activities:', error);
      Alert.alert('Error', 'Failed to load activities. Please try again.');
      setShowCategoryModal(false);
    } finally {
      setLoadingCategoryActivities(false);
    }
  };

  const handleSaveCategoryActivities = (selectedActivities) => {
    if (selectedActivities.length === 0) {
      setShowCategoryModal(false);
      return;
    }

    const result = addToWishlist(selectedActivities);

    setShowCategoryModal(false);
    setCategoryActivities([]);

    // Show success message
    if (result.added > 0 && result.duplicates > 0) {
      Alert.alert(
        'Added to Wishlist',
        `${result.added} ${result.added === 1 ? 'place' : 'places'} added. ${result.duplicates} ${result.duplicates === 1 ? 'was' : 'were'} already in your wishlist.`
      );
    } else if (result.added > 0) {
      Alert.alert(
        'Added to Wishlist',
        `${result.added} ${result.added === 1 ? 'place' : 'places'} added to your wishlist.`
      );
    } else if (result.duplicates > 0) {
      Alert.alert(
        'Already in Wishlist',
        `All selected ${result.duplicates === 1 ? 'place is' : 'places are'} already in your wishlist.`
      );
    }
  };

  // ===== NAVIGATION HANDLERS =====

  const handleWishlistPress = () => {
    router.push('/create-trip/wishlist_info');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.WHITE }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={60}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: Colors.WHITE }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={32} color="black" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleWishlistPress}
              style={styles.wishlistButton}
            >
              <Text style={styles.wishlistButtonText}>Wishlist</Text>
              <Ionicons name="list" size={24} color={Colors.PRIMARY} />
            </TouchableOpacity>
          </View>

          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Explore {selectedCity}</Text>
          </View>

          {/* Search Bar */}
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearchQueryChange}
            onFocus={handleSearchFocus}
            placeholder="Search activities..."
          />

          {/* Filter Chips */}
          <FilterChips
            selectedFilters={selectedFilters}
            onFilterToggle={handleFilterToggle}
          />

          {/* Category Grid */}
          <View style={styles.categoriesSection}>
            <Text style={styles.categoriesTitle}>Browse by Category</Text>
            {cityCategories && cityCategories.length > 0 ? (
              <View style={styles.categoriesGrid}>
                {cityCategories.map((category, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.categoryCard}
                    onPress={() => handleCategoryPress(category)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.categoryContent}>
                      {category.emoji && (
                        <View style={styles.emojiContainer}>
                          <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                        </View>
                      )}
                      <Text style={styles.categoryName}>{category.category}</Text>
                      <Text style={styles.categoryItems} numberOfLines={1}>
                        {category.category_items[0]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.PRIMARY} />
                <Text style={styles.loadingText}>
                  Loading categories for {selectedCity}...
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <AutocompleteModal
        visible={showAutocomplete}
        query={searchQuery}
        filters={selectedFilters}
        selectedCity={selectedCity}
        onSuggestionSelect={handleSuggestionSelect}
        onClose={() => setShowAutocomplete(false)}
        onFilterToggle={handleFilterToggle}
      />

      <SearchResultsModal
        visible={showSearchResults}
        query={selectedSearchQuery}
        activities={searchResultActivities}
        onSave={handleSaveSearchResults}
        onClose={() => setShowSearchResults(false)}
      />

      <CategoryModal
        visible={showCategoryModal}
        category={selectedCategory}
        activities={categoryActivities}
        loading={loadingCategoryActivities}
        onSave={handleSaveCategoryActivities}
        onClose={() => setShowCategoryModal(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 25,
    paddingTop: 40,
    backgroundColor: Colors.WHITE,
    minHeight: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 5,
  },
  wishlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#e8f4fd',
  },
  wishlistButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: Colors.PRIMARY,
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontFamily: 'outfit-bold',
    fontSize: 28,
    color: '#333',
    marginBottom: 5,
  },
  categoriesSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  categoriesTitle: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: '#1a1a1a',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryEmoji: {
    fontSize: 24,
    textAlign: 'center',
  },
  categoryName: {
    fontFamily: 'outfit-bold',
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  categoryItems: {
    fontFamily: 'outfit',
    fontSize: 10,
    color: '#666',
    lineHeight: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 5,
    marginTop: 15,
  },
});