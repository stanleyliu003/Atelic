import { Colors } from '../../constants/Colors';
import { API } from 'aws-amplify';
import { Auth } from 'aws-amplify';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSavedPlacesDetailed } from '../../src/graphql/customQueries';
import { CitySavedPlacesModal } from '../../src/components/saved-places/CitySavedPlacesModal';
import { CityCard } from '../../src/components/saved-places/CityCard';
import { SavedPlacesSearchBar } from '../../src/components/saved-places/SavedPlacesSearchBar';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function SavedPlaces() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cities, setCities] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [allSavedPlaces, setAllSavedPlaces] = useState([]);
  const [carouselIndices, setCarouselIndices] = useState({}); // Track current index per city
  const [cityPhotoCounts, setCityPhotoCounts] = useState({}); // Track photo count per city
  const [searchQuery, setSearchQuery] = useState('');
  // Start at page 8 for onboarding flow, or skip to 14 if returning from IG_Demo
  const [emptyStatePage, setEmptyStatePage] = useState(
    searchParams.skipOnboarding === 'true' ? 14 : 8
  );
  // Track Instagram share processing status (timer-based)
  const [isShareProcessing, setIsShareProcessing] = useState(false);

  // Filter cities based on search query
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) {
      return cities;
    }
    const query = searchQuery.toLowerCase().trim();
    return cities.filter((cityData) =>
      cityData.city?.toLowerCase().includes(query)
    );
  }, [cities, searchQuery]);

  const fetchSavedPlaces = useCallback(async () => {
    try {
      setError(null);
      const user = await Auth.currentAuthenticatedUser();
      const userID = user.attributes.sub; // Use Cognito sub (matches what's stored in DynamoDB)

      console.log('[SavedPlaces] Fetching saved places for userID:', userID);

      const result = await API.graphql({
        query: getSavedPlacesDetailed,
        variables: { userID },
      });

      const data = result.data.getSavedPlaces;
      console.log('[SavedPlaces] Received data:', {
        totalCount: data.totalCount,
        citiesCount: data.cities?.length || 0,
      });

      // Log country information for verification
      if (data.cities && data.cities.length > 0) {
        console.log('[SavedPlaces] Cities with country info:', 
          data.cities.map(c => ({ city: c.city, country: c.country, count: c.count }))
        );
      }

      setCities(data.cities || []);
      setTotalCount(data.totalCount || 0);
      setAllSavedPlaces(data.savedPlaces || []);
    } catch (err) {
      console.error('[SavedPlaces] Error fetching saved places:', err);
      setError(err.message || 'Failed to load saved places');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedPlaces();
  }, [fetchSavedPlaces]);

  // Handle Instagram share timer when navigating from Share Extension
  // The Share Extension passes shareStartTime in the deep link query params
  useEffect(() => {
    const shareStartTime = searchParams.shareStartTime;

    if (!shareStartTime) {
      return;
    }

    const startTime = parseInt(shareStartTime, 10);
    const now = Date.now();

    // Ignore if timestamp is too old (> 60 seconds)
    if (now - startTime > 60000) {
      console.log('[SavedPlaces] Share timestamp too old, ignoring');
      return;
    }

    setIsShareProcessing(true);

    // Calculate remaining wait time (14 seconds from start)
    const elapsedMs = now - startTime;
    const remainingMs = Math.max(14000 - elapsedMs, 1000); // At least 1 second

    console.log('[SavedPlaces] Instagram share detected, waiting', remainingMs, 'ms before refresh');

    // Set timer to refresh after remaining time
    const timer = setTimeout(() => {
      console.log('[SavedPlaces] Share timer complete, refreshing saved places');
      setIsShareProcessing(false);
      fetchSavedPlaces();
    }, remainingMs);

    // Cleanup: clears timer if effect re-runs or component unmounts
    return () => clearTimeout(timer);
  }, [searchParams.shareStartTime, fetchSavedPlaces]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCarouselIndices({});
    setCityPhotoCounts({});
    fetchSavedPlaces();
  }, [fetchSavedPlaces]);

  const handleCityPress = (city) => {
    setSelectedCity(city);
    setCityModalVisible(true);
  };

  const handleCloseCityModal = () => {
    setCityModalVisible(false);
    setSelectedCity(null);
  };

  const handleInstagramPress = async () => {
    const instagramUrl = 'https://www.instagram.com';
    try {
      // Try to open Instagram app first
      const canOpenApp = await Linking.canOpenURL('instagram://');
      if (canOpenApp) {
        await Linking.openURL('instagram://');
      } else {
        // Fall back to web browser
        await Linking.openURL(instagramUrl);
      }
    } catch (error) {
      console.error('[SavedPlaces] Error opening Instagram:', error);
      // Final fallback to web URL
      Linking.openURL(instagramUrl);
    }
  };

  // Get places for the selected city
  const getPlacesForCity = (cityName) => {
    const filtered = allSavedPlaces.filter((place) => place.city === cityName);
    console.log(`[SavedPlaces] Filtered ${filtered.length} places for city: ${cityName}`);
    if (filtered.length > 0) {
      console.log('[SavedPlaces] Sample place structure:', JSON.stringify(filtered[0], null, 2));
    }
    return filtered;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Saved Places</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.PRIMARY} />
          <Text style={styles.loadingText}>Loading saved places...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Saved Places</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.GRAY} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchSavedPlaces}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved Places</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.PRIMARY}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        {cities.length > 0 && (
          <SavedPlacesSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        )}

        {/* Instagram Share Processing Indicator */}
        {isShareProcessing && (
          <View style={styles.processingBanner}>
            <ActivityIndicator size="small" color={Colors.PRIMARY} />
            <Text style={styles.processingText}>Saving places from Instagram...</Text>
          </View>
        )}

        {cities.length === 0 && emptyStatePage === 8 ? (
          /* Page 8: Instagram Capture */
          <View style={styles.emptyOnboardingContainer}>
            <Text style={styles.onboardingTitle}>Save spots from Instagram!</Text>
            <View style={styles.instagramImageContainer}>
              <Image
                source={require('../../assets/Instagram_Capture.png')}
                style={styles.onboardingInstagramImage}
                resizeMode="cover"
              />
            </View>
          </View>
        ) : cities.length === 0 && emptyStatePage > 13 ? (
          /* Normal empty state after onboarding */
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color={Colors.GRAY} />
            <Text style={styles.emptyTitle}>No Saved Places Yet</Text>
            <Text style={styles.emptySubtitle}>
              Share Instagram travel posts to Atelic to save places here
            </Text>
            <TouchableOpacity
              style={styles.instagramButton}
              onPress={handleInstagramPress}
              activeOpacity={0.7}
            >
              <Image
                source={require('../../assets/IG_Logo.png')}
                style={styles.instagramLogo}
                resizeMode="contain"
              />
              <Text style={styles.instagramButtonText}>Open Instagram</Text>
            </TouchableOpacity>
          </View>
        ) : filteredCities.length === 0 ? (
          <View style={styles.noResultsContainer}>
            <Ionicons name="search-outline" size={48} color={Colors.GRAY} />
            <Text style={styles.noResultsText}>No cities match "{searchQuery}"</Text>
          </View>
        ) : (
          <View style={styles.citiesGrid}>
            {filteredCities.map((cityData, index) => {
              // Calculate dimensions for 2-column layout with 1.5x vertical aspect ratio
              const cardWidth = (screenWidth - 60) * 0.5; // 49% width with reduced spacing
              const imageHeight = cardWidth * 1.5; // 1.5x vertical height

              return (
                <CityCard
                  key={`${cityData.city}-${index}`}
                  cityData={cityData}
                  cardWidth={cardWidth}
                  imageHeight={imageHeight}
                  onPress={() => handleCityPress(cityData)}
                  onPhotoCountUpdate={(city, count) =>
                    setCityPhotoCounts(prev => ({ ...prev, [city]: count }))
                  }
                  photoCount={cityPhotoCounts[cityData.city] || 5}
                  currentCarouselIndex={carouselIndices[cityData.city] || 0}
                  onCarouselIndexChange={(city, idx) =>
                    setCarouselIndices(prev => ({ ...prev, [city]: idx }))
                  }
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Fixed button at bottom for page 8 */}
      {cities.length === 0 && emptyStatePage === 8 && (
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity
            onPress={() => router.push('/IG_Demo')}
            style={styles.onboardingButton}
          >
            <Text style={styles.onboardingButtonText}>Try it now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* City Saved Places Modal */}
      {selectedCity && (
        <CitySavedPlacesModal
          visible={cityModalVisible}
          onClose={handleCloseCityModal}
          cityName={selectedCity.city}
          places={getPlacesForCity(selectedCity.city)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
  },
  header: {
    paddingHorizontal: 25,
    paddingTop: 55,
    paddingBottom: 15,
    backgroundColor: Colors.WHITE,
  },
  headerTitle: {
    marginTop: 25,
    fontFamily: 'outfit-bold',
    fontSize: 33,
    color: '#1F2937',
  },
  headerSubtitle: {
    fontFamily: 'outfit',
    fontSize: 15,
    color: Colors.GRAY,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: Colors.WHITE,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: 'outfit-medium',
    fontSize: 20,
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: 'outfit',
    fontSize: 15,
    color: Colors.GRAY,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  citiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  processingText: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#9A3412',
    marginLeft: 10,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  noResultsText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
    textAlign: 'center',
    marginTop: 12,
  },
  instagramButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  instagramLogo: {
    width: 28,
    height: 28,
    marginRight: 12,
  },
  instagramButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: '#1F2937',
  },
  // Onboarding styles for empty state
  emptyOnboardingContainer: {
    flex: 1,
    paddingTop: 20,
  },
  onboardingTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 32,
    color: '#1F2937',
    textAlign: 'center',
  },
  instagramImageContainer: {
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingInstagramImage: {
    width: screenWidth - 40,
    height: (screenWidth - 40) * 1.3,
    borderRadius: 20,
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.WHITE,
    padding: 25,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  onboardingButton: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F36406',
  },
  onboardingButtonText: {
    color: Colors.WHITE,
    textAlign: 'center',
    fontFamily: 'outfit-medium',
    fontSize: 17,
  },
});
