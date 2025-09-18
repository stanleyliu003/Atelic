import { Colors } from '../../constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image, StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Auth } from 'aws-amplify';
import { useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useCreateTrip } from '../../context/CreateTripContext';
import { listUserTripsFromCloud, retrieveTripFromCloud } from '../../src/services/lambdaService';

export default function Profile() {
  const { restoreTripFromObject, setSelectedCity } = useCreateTrip();

  const [fullName, setFullName] = useState('');
  const [userTrips, setUserTrips] = useState([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [isLoadingTrip, setIsLoadingTrip] = useState(false);

  const loadUserData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Reload data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

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

        // Navigate directly to trip view
        router.push('/trip-view/trip-view_main');
      }
    } catch (error) {
      console.error('[Profile] Error loading trip:', error);
      Alert.alert('Error', 'Failed to load trip. Please try again.');
    } finally {
      setIsLoadingTrip(false);
      setSelectedTripId(null);
    }
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
                      Created {trip.createdAt ? new Date(trip.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : 'No date'}
                    </Text>
                    <Text style={styles.tripCardLength}>
                      {trip.tripLength != null ? `${trip.tripLength} day${trip.tripLength > 1 ? 's' : ''}` : 'Unknown length'}
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
    maxHeight: 2000,
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