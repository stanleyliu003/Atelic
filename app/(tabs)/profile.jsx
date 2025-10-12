import { Colors } from '../../constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { Auth, API } from 'aws-amplify';
import { useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useCreateTrip } from '../../context/CreateTripContext';
import { listUserTripsFromCloud, retrieveTripFromCloud } from '../../src/services/lambdaService';
import { deleteTrip } from '../../src/graphql/customMutations';
import { ShareTripModal } from '../../src/components/trip-view/collaboration';

export default function Profile() {
  const { restoreTripFromObject, setSelectedCity } = useCreateTrip();

  const [fullName, setFullName] = useState('');
  const [userTrips, setUserTrips] = useState([]);
  const [ownedTrips, setOwnedTrips] = useState([]);
  const [sharedTrips, setSharedTrips] = useState([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [isLoadingTrip, setIsLoadingTrip] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [menuVisible, setMenuVisible] = useState(null); // stores tripId of open menu
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [selectedTripForSharing, setSelectedTripForSharing] = useState(null);
  const [currentUserID, setCurrentUserID] = useState('');
  const [isLoadingTripData, setIsLoadingTripData] = useState(false);

  const loadUserData = useCallback(async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const name = user.attributes?.name || '';
      const userID = user.attributes?.sub || user.username;
      setFullName(name);
      setCurrentUserID(userID);

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
      const allTrips = tripSummaries || [];

      // Sort trips by creation date (newest first)
      const sortedTrips = allTrips.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA; // Descending order (newest first)
      });

      // Separate trips by user role
      const owned = sortedTrips.filter(trip => trip.userRole === 'owner');
      const shared = sortedTrips.filter(trip => trip.userRole === 'editor' || trip.userRole === 'viewer');

      setUserTrips(sortedTrips);
      setOwnedTrips(owned);
      setSharedTrips(shared);
    } catch (error) {
      console.error('[Profile] Error loading trips:', error);
      setTripsError('Failed to load trips');
      setUserTrips([]);
      setOwnedTrips([]);
      setSharedTrips([]);
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
        // Load trip data into context with currentUserID
        restoreTripFromObject(tripDetails, userID);
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

  const handleDeleteTrip = async (tripId) => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const userID = user.attributes?.sub || user.username;

      // Show confirmation dialog
      Alert.alert(
        'Delete Trip',
        'Are you sure you want to delete this trip? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                setMenuVisible(null); // Close menu
                setDeletingTripId(tripId);
                console.log('[Profile] Deleting trip:', { userID, tripID: tripId });

                const result = await API.graphql({
                  query: deleteTrip,
                  variables: { userID, tripID: tripId }
                });

                console.log('[Profile] Trip deleted successfully:', result);

                // Reload the trips list
                await loadUserTrips(userID);

              } catch (error) {
                console.error('[Profile] Error deleting trip:', error);
                Alert.alert('Error', 'Failed to delete trip. Please try again.');
              } finally {
                setDeletingTripId(null);
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('[Profile] Error getting user info:', error);
      Alert.alert('Error', 'Failed to get user information');
    }
  };

  // Handle invite collaborators button press
  const handleInviteCollaborators = async (tripId) => {
    try {
      setIsLoadingTripData(true);
      setMenuVisible(null); // Close the menu immediately

      const user = await Auth.currentAuthenticatedUser();
      const userID = user.attributes?.sub || user.username;

      // Fetch full trip data including collaborators
      const fullTripData = await retrieveTripFromCloud(userID, tripId);

      if (fullTripData) {
        setSelectedTripForSharing(fullTripData);
        setIsShareModalVisible(true);
      } else {
        Alert.alert('Error', 'Failed to load trip data. Please try again.');
      }
    } catch (error) {
      console.error('[Profile] Error loading trip for sharing:', error);
      Alert.alert('Error', 'Failed to load trip data. Please try again.');
    } finally {
      setIsLoadingTripData(false);
    }
  };

  // Handle collaborators update
  const handleCollaboratorsUpdate = (updatedCollaborators) => {
    // Update the selectedTripForSharing to reflect changes in the modal
    setSelectedTripForSharing(prevTrip =>
      prevTrip ? { ...prevTrip, collaborators: updatedCollaborators } : null
    );

    // Update the trip in the userTrips state (for future reference, though userTrips summaries don't show collaborators)
    setUserTrips(prevTrips =>
      prevTrips.map(trip =>
        trip.tripId === selectedTripForSharing?.tripId
          ? { ...trip, collaborators: updatedCollaborators }
          : trip
      )
    );
  };

  const getImageUrl = (photoReference) => {
    const { GOOGLE_PLACES_API_KEY } = require('../../src/constants/api');
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
  };

  const handleLogout = async () => {
    try {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try {
                await Auth.signOut();
                // Clear any stored user data
                setFullName('');
                setUserTrips([]);
                // Navigate to login/onboarding screen
                router.replace('/');
              } catch (error) {
                console.error('[Profile] Error signing out:', error);
                Alert.alert('Error', 'Failed to logout. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('[Profile] Error in logout handler:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Profile</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color={Colors.GRAY} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
          <FontAwesome name="user-circle" size={40} color="black" />
        </View>
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
        ) : (ownedTrips.length > 0 || sharedTrips.length > 0) ? (
          <ScrollView style={styles.tripsScrollView} showsVerticalScrollIndicator={true}>
            {/* My Trips Title - scrolls with content */}
            {ownedTrips.length > 0 && (
              <Text style={styles.sectionTitle}>My Trips</Text>
            )}

            {/* Owned Trips */}
            {ownedTrips.map((trip) => (
              <View
                key={`owned-${trip.tripId}`}
                style={[
                  styles.tripCard,
                  selectedTripId === trip.tripId && isLoadingTrip && styles.tripCardLoading
                ]}
              >
                <TouchableOpacity
                  style={styles.tripCardMainArea}
                  onPress={() => {
                    setSelectedTripId(trip.tripId);
                    handleLoadTrip(trip.tripId);
                  }}
                  disabled={isLoadingTrip || deletingTripId === trip.tripId}
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
                      <View style={styles.tripCardTitleRow}>
                        <Text style={styles.tripCardTitle}>
                          {trip.selectedCity || 'Unknown City'}
                        </Text>
                        {/* Menu button - show for owners or editors */}
                        {(trip.userRole === 'owner' || trip.userRole === 'editor') && (
                          <TouchableOpacity
                            style={styles.menuButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              setMenuVisible(trip.tripId);
                            }}
                            disabled={isLoadingTrip || deletingTripId === trip.tripId}
                          >
                            <FontAwesome name="ellipsis-h" size={16} color={Colors.GRAY} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.tripCardLength}>
                      {trip.createdAt ? new Date(trip.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : 'No date'}
                        {trip.tripLength != null ? ` - ${trip.tripLength} day trip` : 'Unknown length'}
                      </Text>
                      {selectedTripId === trip.tripId && isLoadingTrip && (
                        <ActivityIndicator size="small" color={Colors.PRIMARY} style={styles.loadingIndicator} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))}

            {/* Shared With Me Section Header */}
      {sharedTrips.length > 0 && (
              <Text style={styles.sharedTripsSectionTitle}>Shared With Me</Text>
            )}

            {/* Shared Trips */}
            {sharedTrips.map((trip) => (
              <View
                key={`shared-${trip.tripId}`}
                style={[
                  styles.tripCard,
                  selectedTripId === trip.tripId && isLoadingTrip && styles.tripCardLoading
                ]}
              >
                <TouchableOpacity
                  style={styles.tripCardMainArea}
                  onPress={() => {
                    setSelectedTripId(trip.tripId);
                    handleLoadTrip(trip.tripId);
                  }}
                  disabled={isLoadingTrip || deletingTripId === trip.tripId}
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
                        {trip.tripLength != null ? `${trip.tripLength} day trip` : 'Unknown length'}
                      </Text>
                    </View>
                      {selectedTripId === trip.tripId && isLoadingTrip && (
                        <ActivityIndicator size="small" color={Colors.PRIMARY} style={styles.loadingIndicator} />
                      )}
                  </View>
                </TouchableOpacity>

              </View>
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


      {/* Menu Modal */}
      <Modal
        visible={menuVisible !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMenuVisible(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(null)}
        >
          <View style={styles.modalSpacer} />
          <TouchableOpacity
            style={styles.menuModal}
            activeOpacity={1}
            onPress={() => {}} // Prevent closing when tapping inside modal
          >
            {/* Header with close button */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setMenuVisible(null)}
              >
                <Ionicons name="close" size={32} color={Colors.GRAY} />
              </TouchableOpacity>
            </View>

            {/* Menu Content */}
            <View style={styles.modalContent}>
              {/* Invite Collaborators */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  handleInviteCollaborators(menuVisible);
                }}
                disabled={isLoadingTripData}
              >
                {isLoadingTripData ? (
                  <>
                    <ActivityIndicator size="small" color="black" />
                    <Text style={styles.menuItemText}>Loading...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="share-outline" size={30} color={Colors.PRIMARY} />
                    <Text style={styles.menuItemText}>Share Trip</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Delete Trip - only show for owners */}
              {(() => {
                const currentTrip = userTrips.find(trip => trip.tripId === menuVisible);
                return currentTrip?.userRole === 'owner' ? (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuVisible(null);
                      handleDeleteTrip(menuVisible);
                    }}
                    disabled={deletingTripId === menuVisible}
                  >
                    {deletingTripId === menuVisible ? (
                      <>
                        <ActivityIndicator size="small" color="#FF4444" />
                        <Text style={[styles.menuItemText, { color: '#FF4444' }]}>Deleting...</Text>
                      </>
                    ) : (
                      <>
                        <FontAwesome name="trash" size={30} color="#FF4444" />
                        <Text style={[styles.menuItemText, { color: '#FF4444' }]}> Delete Trip</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null;
              })()}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Share Trip Modal */}
      {selectedTripForSharing && currentUserID && (
        <ShareTripModal
          visible={isShareModalVisible}
          onClose={() => {
            setIsShareModalVisible(false);
            setSelectedTripForSharing(null);
          }}
          tripId={selectedTripForSharing.tripId}
          collaborators={selectedTripForSharing.collaborators || []}
          currentUserRole={selectedTripForSharing.collaborators?.find(c => c.userID === currentUserID)?.role || 'owner'}
          currentUserID={currentUserID}
          selectedCity={selectedTripForSharing.selectedCity}
          onCollaboratorsUpdate={handleCollaboratorsUpdate}
        />
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  logoutText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    marginLeft: 6,
  },
  myTripsSection: {
    marginTop: 30,
    flex: 1,
  },
  sectionTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 28,
    color: Colors.PRIMARY,
    marginBottom: 20,
  },
  sharedTripsSectionTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 28,
    color: Colors.PRIMARY,
    marginBottom: 20,
    marginTop: 30,
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
    flex: 1,
  },
  tripCard: {
    backgroundColor: Colors.WHITE,
    borderRadius: 12,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  tripCardMainArea: {
    flex: 1,
  },
  tripCardLoading: {
    opacity: 0.7,
  },
  tripCardContent: {
    flexDirection: 'column',
  },
  tripCardImage: {
    width: '100%',
    height: 160,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  tripCardImagePlaceholder: {
    width: '100%',
    height: 160,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripCardInfo: {
    padding: 15,
    alignItems: 'flex-start',
  },
  tripCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  loadingIndicator: {
    marginTop: 10,
  },
  tripCardTitle: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: Colors.PRIMARY,
    flex: 1,
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
  sharedTripsSpacer: {
    marginTop: 20,
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
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  modalSpacer: {
    flex: 0.67, // Takes up 67% of screen, leaving 33% for modal
  },
  menuModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 0.33, // Takes up 33% of screen height
    paddingTop: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.GRAY,
    borderRadius: 2,
    opacity: 0.3,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginVertical: 4,
  },
  menuItemText: {
    fontFamily: 'outfit-medium',
    fontSize: 20,
    marginLeft: 12,
  },
});