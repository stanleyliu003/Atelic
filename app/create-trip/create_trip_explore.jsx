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
import { CategoryModal } from '../../src/components/explore/CategoryModal';

export default function create_trip_explore() {
  const router = useRouter();
  const navigation = useNavigation();
  const {
    selectedCity,
    cityCategories,
    setIsCreatingTrip,
    addToWishlist,
    removeActivities,
    generateActivitiesForCategory,
    categoryActivities: contextCategoryActivities,
    setCategoryActivities: setContextCategoryActivities,
    activities,
  } = useCreateTrip();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState([]);

  // Modal visibility state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  
  // Debug: Log when showAutocomplete changes
  useEffect(() => {
  }, [showAutocomplete]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loadingCategoryActivities, setLoadingCategoryActivities] = useState(false);
  const [loadingMoreCategoryActivities, setLoadingMoreCategoryActivities] = useState(false);

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

  const handleSearchPress = () => {
    // Open autocomplete modal when search bar is pressed
    setShowAutocomplete(true);
  };

  const handleSearchQueryChange = (text) => {
    setSearchQuery(text);
    // Modal stays open regardless of text length - only closes via close button
  };

  // Handle saving activities from AutocompleteModal (new direct flow)
  const handleSaveSearchResults = (selectedActivities) => {
    // Add newly selected activity (single place from autocomplete)
    if (selectedActivities.length > 0) {
      addToWishlist(selectedActivities);
    }

    // Modal auto-closes in AutocompleteModal component
    setShowAutocomplete(false);
    setSearchQuery('');
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

    // Check if we already have cached activities for this category in context
    if (contextCategoryActivities[category.category] && contextCategoryActivities[category.category].length > 0) {
      // Activities already exist in context, no need to fetch
      return;
    }

    // If not cached, fetch new activities
    setLoadingCategoryActivities(true);

    try {
      // Generate activities for this category (this updates context's categoryActivities)
      const activities = await generateActivitiesForCategory(category.category);
      // No need to set local state - activities are stored in context
    } catch (error) {
      console.error('[Explore] Error generating category activities:', error);
      Alert.alert('Error', 'Failed to load activities. Please try again.');
      setShowCategoryModal(false);
    } finally {
      setLoadingCategoryActivities(false);
    }
  };

  const handleSaveCategoryActivities = (selectedActivities, deselectedWishlistActivityIds = []) => {
    // Remove deselected wishlist activities
    if (deselectedWishlistActivityIds.length > 0) {
      removeActivities(deselectedWishlistActivityIds);
    }

    // Add newly selected activities
    if (selectedActivities.length > 0) {
      addToWishlist(selectedActivities);
    }

    setShowCategoryModal(false);
  };

  const handleGenerateMoreCategoryActivities = async (categoryName) => {
    setLoadingMoreCategoryActivities(true);

    try {
      // Generate more activities for this category (updates context automatically)
      await generateActivitiesForCategory(categoryName);
      // Context already handles appending new activities to existing ones
    } catch (error) {
      // Check if this is a limit reached error
      if (error.message && error.message.includes('Activity generation limit reached')) {
        Alert.alert(
          'Activity Limit Reached',
          `Generation limit reached for ${categoryName} category.`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        // Show generic error for other types of errors
        Alert.alert(
          'Error',
          `Failed to generate more activities for ${categoryName}. Please try again.`,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } finally {
      setLoadingMoreCategoryActivities(false);
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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: Colors.WHITE }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.push('/create-trip/create_trip_1_city')}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={32} color="black" />
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
            onPress={handleSearchPress}
            placeholder="Search activities..."
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

      {/* Load Wishlist Button - Fixed at bottom */}
      <View style={styles.loadWishlistButtonContainer}>
        <TouchableOpacity
          onPress={handleWishlistPress}
          style={styles.loadWishlistButton}
        >
          <Text style={styles.loadWishlistButtonText}>
            Load Wishlist ({activities?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <AutocompleteModal
        visible={showAutocomplete}
        query={searchQuery}
        filters={selectedFilters}
        selectedCity={selectedCity}
        onClose={() => {
          setShowAutocomplete(false);
        }}
        onFilterToggle={handleFilterToggle}
        onQueryChange={handleSearchQueryChange}
        onSaveActivities={handleSaveSearchResults}
        showAddingPlaceLoading={false}
      />

      <CategoryModal
        visible={showCategoryModal}
        category={selectedCategory}
        activities={contextCategoryActivities[selectedCategory] || []}
        loading={loadingCategoryActivities}
        loadingMore={loadingMoreCategoryActivities}
        onSave={handleSaveCategoryActivities}
        onClose={() => setShowCategoryModal(false)}
        onGenerateMore={handleGenerateMoreCategoryActivities}
        wishlistActivities={activities}
        dayActivities={[]}
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 5,
  },
  loadWishlistButtonContainer: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    backgroundColor: Colors.WHITE,
    paddingHorizontal: 25,
    paddingTop: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loadWishlistButton: {
    padding: 15,
    backgroundColor: '#F36406',
    borderRadius: 15,
  },
  loadWishlistButtonText: {
    color: Colors.WHITE,
    textAlign: 'center',
    fontFamily: 'outfit-bold',
    fontSize: 17,
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
    fontFamily: 'outfit-bold',
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