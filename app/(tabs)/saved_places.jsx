import { Colors } from '../../constants/Colors';
import { API } from 'aws-amplify';
import { Auth } from 'aws-amplify';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSavedPlaces } from '../../src/graphql/queries';
import { CitySavedPlacesModal } from '../../src/components/saved-places/CitySavedPlacesModal';
import Ionicons from '@expo/vector-icons/Ionicons';
import Carousel from 'react-native-reanimated-carousel';
import { TripCarouselImage } from '../../src/components/profile/TripCarouselImage';

const { width: screenWidth } = Dimensions.get('window');

export default function SavedPlaces() {
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

  const fetchSavedPlaces = useCallback(async () => {
    try {
      setError(null);
      const user = await Auth.currentAuthenticatedUser();
      const userID = user.attributes.sub; // Use Cognito sub (matches what's stored in DynamoDB)

      console.log('[SavedPlaces] Fetching saved places for userID:', userID);

      const result = await API.graphql({
        query: getSavedPlaces,
        variables: { userID },
      });

      const data = result.data.getSavedPlaces;
      console.log('[SavedPlaces] Received data:', {
        totalCount: data.totalCount,
        citiesCount: data.cities?.length || 0,
      });

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
        {cities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color={Colors.GRAY} />
            <Text style={styles.emptyTitle}>No Saved Places Yet</Text>
            <Text style={styles.emptySubtitle}>
              Share Instagram travel posts to Atelic to save places here
            </Text>
          </View>
        ) : (
          <View style={styles.citiesGrid}>
            {cities.map((cityData, index) => {
              // Calculate dimensions for 2-column layout with 1.5x vertical aspect ratio
              const cardWidth = (screenWidth - 60) * 0.5; // 49% width with reduced spacing
              const imageHeight = cardWidth * 1.5; // 1.5x vertical height

              return (
                <TouchableOpacity
                  key={`${cityData.city}-${index}`}
                  style={[styles.cityCard, { width: cardWidth }]}
                  onPress={() => handleCityPress(cityData)}
                  activeOpacity={0.8}
                >
                  <View style={styles.carouselContainer}>
                    <Carousel
                      loop={false}
                      width={cardWidth}
                      height={imageHeight}
                      data={[{}, {}, {}, {}, {}]} // Default 5 empty objects for Unsplash
                      scrollAnimationDuration={300}
                      defaultIndex={0}
                      onSnapToItem={(carouselIndex) =>
                        setCarouselIndices(prev => ({ 
                          ...prev, 
                          [cityData.city]: carouselIndex 
                        }))
                      }
                      renderItem={({ item, index: carouselIndex }) => (
                        <TripCarouselImage
                          cityName={cityData.city}
                          photoIndex={carouselIndex}
                          style={[styles.cityCardImage, { height: imageHeight }]}
                          onPhotoCountUpdate={(count) =>
                            setCityPhotoCounts(prev => ({ 
                              ...prev, 
                              [cityData.city]: count 
                            }))
                          }
                        />
                      )}
                    />
                    {(() => {
                      const photoCount = cityPhotoCounts[cityData.city] || 5;
                      // Only show dots if there's more than 1 photo
                      if (photoCount === 1) {
                        return null;
                      }
                      return (
                        <View style={styles.paginationDots}>
                          {Array.from({ length: photoCount }, (_, dotIndex) => (
                            <View
                              key={dotIndex}
                              style={[
                                styles.dot,
                                (carouselIndices[cityData.city] || 0) === dotIndex && styles.activeDot
                              ]}
                            />
                          ))}
                        </View>
                      );
                    })()}
                  </View>
                  <View style={styles.cityCardInfo}>
                    <Text style={styles.cityName} numberOfLines={1}>
                      {cityData.city}
                    </Text>
                    <Text style={styles.cityCount}>
                      {cityData.count} place{cityData.count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

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
  cityCard: {
    backgroundColor: Colors.WHITE,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  carouselContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cityCardImage: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: Colors.WHITE,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cityCardInfo: {
    padding: 12,
    alignItems: 'flex-start',
  },
  cityName: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
  },
  cityCount: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: Colors.GRAY,
  },
});
