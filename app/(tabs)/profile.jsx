import { Colors } from '../../constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams } from 'expo-router';
import { Image, StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Auth } from 'aws-amplify';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useCreateTrip } from '../../context/CreateTripContext';
import { listUserTripsFromCloud, retrieveTripFromCloud } from '../../src/services/lambdaService';

export default function Profile() {
  const params = useLocalSearchParams();
  const photoReferenceParam = params.photoReference || '';
  const dayCount = parseInt(params.dayCount, 10) || 1;
  const { activities, createdAt, selectedCity, dayActivities, restoreTripFromObject, setSelectedCity } = useCreateTrip();
  
  // Derive a fallback photo reference: first activity from day 1, else first wishlist activity
  const derivedPhotoReference = (() => {
    const day1Activities = dayActivities?.[1]?.activities;
    if (day1Activities && day1Activities.length > 0) {
      return day1Activities[0]?.photo_reference || '';
    }
    if (activities && activities.length > 0) {
      return activities[0]?.photo_reference || '';
    }
    return '';
  })();
  
  const photoReference = photoReferenceParam || derivedPhotoReference;

  const [fullName, setFullName] = useState('');
  const [userTrips, setUserTrips] = useState([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [isLoadingTrip, setIsLoadingTrip] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        const name = user.attributes?.name || '';
        const userID = user.attributes?.sub || user.username;
        setFullName(name);

        // Load user trips from cloud
        await loadUserTrips(userID);
      } catch (error) {
        console.error('[Profile] Error loading user data:', error);
        setFullName('');
        setTripsError('Failed to load user data');
      }
    };

    loadUserData();
  }, []);

  const loadUserTrips = async (userID) => {
    try {
      setIsLoadingTrips(true);
      setTripsError(null);

      const tripSummaries = await listUserTripsFromCloud(userID);
      setUserTrips(tripSummaries || []);
    } catch (error) {
      console.error('[Profile] Error loading trips:', error);
      setTripsError('Failed to load trips');
      setUserTrips([]);
    } finally {
      setIsLoadingTrips(false);
    }
  };

  const handleLoadTrip = async (tripId) => {
    try {
      setIsLoadingTrip(true);
      const user = await Auth.currentAuthenticatedUser();
      const userID = user.attributes?.sub || user.username;

      const tripDetails = await retrieveTripFromCloud(userID, tripId);

      if (tripDetails) {
        // Load trip data into context
        restoreTripFromObject(tripDetails);
        setSelectedCity(tripDetails.selectedCity);

        Alert.alert(
          'Trip Loaded',
          `Successfully loaded "${tripDetails.selectedCity}" trip`,
          [
            {
              text: 'View Trip',
              onPress: () => router.push('/trip-view/trip-view_main')
            },
            { text: 'OK' }
          ]
        );
      }
    } catch (error) {
      console.error('[Profile] Error loading trip:', error);
      Alert.alert('Error', 'Failed to load trip. Please try again.');
    } finally {
      setIsLoadingTrip(false);
      setSelectedTripId(null);
    }
  };


  const getDayCountText = () => {
    if (dayCount === 1) return '1 day';
    return `${dayCount} day`;
  };

  const getImageUrl = (photoReference) => {
    const { GOOGLE_PLACES_API_KEY } = require('../../src/constants/api');
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
  };

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Profile</Text>
        <FontAwesome name="user-circle" size={40} color="black" />
      </View>

      {/* Welcome Back Full Name */}
      {fullName ? (
        <Text style={{
          fontFamily: 'outfit',
          fontSize: 22,
          marginTop: 30,
          color: Colors.PRIMARY
        }}>Welcome back, {fullName}!</Text>
      ) : null}

      {/* Current Trip Summary (if params present) */}
      {(photoReference || params.dayCount) && (
        <TouchableOpacity
          style={styles.tripSummaryContainer}
          onPress={() => {
            router.push({
              pathname: '/trip-view/trip-view_main',
              params: { restoreTrip: 'true' }
            });
          }}
        >
          {photoReference ? (
            <Image
              source={{ uri: getImageUrl(photoReference) }}
              style={styles.tripSummaryImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.tripSummaryImagePlaceholder}>
              <FontAwesome name="user-circle" size={60} color={Colors.GRAY} />
            </View>
          )}
          <View style={styles.tripSummaryTextContainer}>
            <Text style={styles.tripSummaryText}>
              {getDayCountText()} Trip{selectedCity ? ` to ${selectedCity}` : ''}
            </Text>
            {createdAt && (
              <Text style={styles.tripSummaryDate}>
                {`Created on: ${new Date(createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* My Trips Section */}
      <View style={styles.myTripsSection}>
        <Text style={styles.sectionTitle}>My Trips</Text>

        {tripsError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{tripsError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={async () => {
                const user = await Auth.currentAuthenticatedUser();
                const userID = user.attributes?.sub || user.username;
                await loadUserTrips(userID);
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoadingTrips ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.PRIMARY} />
            <Text style={styles.loadingText}>Loading trips...</Text>
          </View>
        ) : userTrips.length > 0 ? (
          <ScrollView style={styles.tripsScrollView} showsVerticalScrollIndicator={false}>
            {userTrips.map((trip) => (
              <TouchableOpacity
                key={trip.tripId}
                style={[
                  styles.tripCard,
                  selectedTripId === trip.tripId && isLoadingTrip && styles.tripCardLoading
                ]}
                onPress={() => {
                  setSelectedTripId(trip.tripId);
                  handleLoadTrip(trip.tripId);
                }}
                disabled={isLoadingTrip}
              >
                <View style={styles.tripCardContent}>
                  {trip.tripPhotoReference ? (
                    <Image
                      source={{ uri: getImageUrl(trip.tripPhotoReference) }}
                      style={styles.tripCardImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.tripCardImagePlaceholder}>
                      <FontAwesome name="map-marker" size={30} color={Colors.GRAY} />
                    </View>
                  )}
                  <View style={styles.tripCardInfo}>
                    <Text style={styles.tripCardTitle}>
                      {trip.selectedCity || 'Unknown City'}
                    </Text>
                    <Text style={styles.tripCardDate}>
                      {trip.createdAt ? new Date(trip.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : 'No date'}
                    </Text>
                    <Text style={styles.tripCardLength}>
                      {trip.tripLength ? `${trip.tripLength} day${trip.tripLength > 1 ? 's' : ''}` : 'Unknown length'}
                    </Text>
                  </View>
                  {selectedTripId === trip.tripId && isLoadingTrip && (
                    <ActivityIndicator size="small" color={Colors.PRIMARY} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.noTripsContainer}>
            <FontAwesome name="suitcase" size={50} color={Colors.GRAY} />
            <Text style={styles.noTripsText}>No trips found</Text>
            <Text style={styles.noTripsSubtext}>Create your first trip to get started!</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 25,
    paddingTop: 55,
    backgroundColor: Colors.WHITE,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignContent: 'center',
    justifyContent: 'space-between',
    paddingTop: 25,
    marginBottom: 0,
  },
  headerText: {
    fontFamily: 'outfit-bold',
    fontSize: 35,
  },
  tripSummaryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 40,
    marginBottom: 30,
    borderRadius: 1,
  },
  tripSummaryImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginRight: 20,
  },
  tripSummaryImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripSummaryTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  tripSummaryText: {
    fontFamily: 'outfit-medium',
    marginTop: 25,
    fontSize: 22,
    color: Colors.PRIMARY,
  },
  tripSummaryDate: {
    fontFamily: 'outfit',
    fontSize: 15,
    color: Colors.GRAY,
    marginTop: 6,
  },
  myTripsSection: {
    marginTop: 30,
  },
  sectionTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 24,
    color: Colors.PRIMARY,
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#c62828',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: Colors.PRIMARY,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: Colors.WHITE,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
    marginTop: 10,
  },
  tripsScrollView: {
    maxHeight: 400,
  },
  tripCard: {
    backgroundColor: Colors.WHITE,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tripCardLoading: {
    opacity: 0.7,
  },
  tripCardContent: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
  },
  tripCardImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
  },
  tripCardImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripCardInfo: {
    flex: 1,
    marginRight: 15,
  },
  tripCardTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: Colors.PRIMARY,
    marginBottom: 4,
  },
  tripCardDate: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    marginBottom: 2,
  },
  tripCardLength: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
  },
  noTripsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noTripsText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: Colors.GRAY,
    marginTop: 15,
    marginBottom: 5,
  },
  noTripsSubtext: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    textAlign: 'center',
  },
});