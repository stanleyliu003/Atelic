import { Colors } from '../../constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams } from 'expo-router';
import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Auth } from 'aws-amplify';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useCreateTrip } from '../../context/CreateTripContext';
import { listUserTripsFromCloud, retrieveTripFromCloud } from '../../src/services/lambdaService';

export default function Profile() {
  const params = useLocalSearchParams();
  const photoReferenceParam = params.photoReference || '';
  const dayCount = parseInt(params.dayCount, 10) || 1;
  const { activities, createdAt, selectedCity, dayActivities } = useCreateTrip();
  
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

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get current user info
        const user = await Auth.currentAuthenticatedUser();
        const name = user.attributes?.name || '';
        const userID = user.attributes?.sub || user.username;

        setFullName(name);

        console.log('[Profile] Current userID:', userID);

        // Test getTripIDs Lambda call
        console.log('[Profile] Calling getTripIDs Lambda...');
        const tripSummaries = await listUserTripsFromCloud(userID);

        console.log('[Profile] getTripIDs Lambda Response:', tripSummaries);
        console.log('[Profile] Number of trips found:', tripSummaries?.length || 0);

        // Log each trip summary
        if (tripSummaries && tripSummaries.length > 0) {
          tripSummaries.forEach((trip, index) => {
            console.log(`[Profile] Trip ${index + 1}:`, {
              tripId: trip.tripId,
              selectedCity: trip.selectedCity,
              tripPhotoReference: trip.tripPhotoReference,
              createdAt: trip.createdAt
            });
          });
        } else {
          console.log('[Profile] No trips found for user');
        }

        setUserTrips(tripSummaries || []);

        // Test getUserTrips Lambda with the first trip (if any exist)
        if (tripSummaries && tripSummaries.length > 0) {
          const firstTrip = tripSummaries[0];
          console.log(`[Profile] Testing getUserTrips Lambda with tripID: ${firstTrip.tripId}`);

          try {
            const tripDetails = await retrieveTripFromCloud(userID, firstTrip.tripId);
            console.log('[Profile] getUserTrips Lambda Response:', tripDetails);
            console.log('[Profile] Trip details structure:', {
              tripId: tripDetails?.tripId,
              selectedCity: tripDetails?.selectedCity,
              tripPhotoReference: tripDetails?.tripPhotoReference,
              createdAt: tripDetails?.createdAt,
              tripLength: tripDetails?.tripLength,
              daysCount: tripDetails?.days?.length || 0,
              wishlistCount: tripDetails?.wishlist?.length || 0
            });

            // Log first day activities if they exist
            if (tripDetails?.days && tripDetails.days.length > 0) {
              const firstDay = tripDetails.days[0];
              console.log('[Profile] First day details:', {
                dayNumber: firstDay.dayNumber,
                activitiesCount: firstDay.activities?.length || 0,
                hasPolyline: !!firstDay.encodedPolyline
              });

              // Log first activity if it exists
              if (firstDay.activities && firstDay.activities.length > 0) {
                const firstActivity = firstDay.activities[0];
                console.log('[Profile] First activity details:', {
                  name: firstActivity.name,
                  city: firstActivity.city,
                  photo_reference: firstActivity.photo_reference,
                  place_id: firstActivity.place_id
                });
              }
            }

          } catch (getUserTripsError) {
            console.error('[Profile] Error testing getUserTrips Lambda:', getUserTripsError);
          }
        } else {
          console.log('[Profile] No trips found to test getUserTrips Lambda');
        }

      } catch (error) {
        console.error('[Profile] Error loading user data or trips:', error);
        setFullName('');
        setUserTrips([]);
      }
    };

    loadUserData();
  }, []);

  // Find the activity with the matching photo_reference
  const activity = activities.find((a) => a.photo_reference === photoReference);

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

      {/* Trip Summary (if params present) */}
      {(photoReference || params.dayCount) && (
        <TouchableOpacity
          style={styles.tripSummaryContainer}
          onPress={() => {
            // Navigate back to trip-view_main with a restore flag
            // This will trigger the useEffect in trip-view_main to restore the trip
            // from the context or storage.
            router.push({
              pathname: '/trip-view/trip-view_main',
              params: { restoreTrip: 'true' }
            });
          }}
        >
          {/* Top left quadrant image */}
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
});