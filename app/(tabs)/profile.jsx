import { Colors } from '../../constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Dimensions, RefreshControl, Linking, PanResponder, Image } from 'react-native';
import { Auth, API } from 'aws-amplify';
import { useEffect, useState, useRef } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useCreateTrip } from '../../context/CreateTripContext';
import { listUserTripsFromCloud, retrieveTripFromCloud, deleteUserAccountFromCloud } from '../../src/services/lambdaService';
import { deleteTrip } from '../../src/graphql/customMutations';
import { removeCollaborator } from '../../src/graphql/mutations';
import { ShareTripModal } from '../../src/components/trip-view/collaboration';
import Carousel from 'react-native-reanimated-carousel';
import { TripCarouselImage } from '../../src/components/profile/TripCarouselImage';
import { clearAuthData } from '../../src/services/appGroupsService';

export default function Profile() {
  const { restoreTripFromObject, setSelectedCity } = useCreateTrip();
  const params = useLocalSearchParams();
  const hasAutoLoadedRef = useRef(false);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
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
  const [carouselIndices, setCarouselIndices] = useState({}); // Track current index per trip
  const [tripPhotoCounts, setTripPhotoCounts] = useState({}); // Track photo count per trip
  const [refreshing, setRefreshing] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isDeleteAccountModalVisible, setIsDeleteAccountModalVisible] = useState(false);
  const [deleteAccountChecked, setDeleteAccountChecked] = useState(false);
  const [leavingTripId, setLeavingTripId] = useState(null);

  // PanResponder for swipe down to close settings modal
  const settingsPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only respond to vertical swipes (down)
      return Math.abs(gestureState.dy) > 5 && gestureState.dy > 0;
    },
    onPanResponderRelease: (_, gestureState) => {
      // Close modal if swiped down more than 50 pixels
      if (gestureState.dy > 50) {
        setIsSettingsModalVisible(false);
      }
    },
  });

  const loadUserData = useCallback(async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const name = user.attributes?.name || '';
      const userName = user.attributes?.preferred_username || '';
      // Use username (not sub) for consistency with collaborator storage
      // For Google OAuth users, username is like 'google_110194548211753772771'
      // For Apple OAuth users, username is like 'signinwithapple_000664.415e0f3e94404bee9a761c4921ebc4e2.2215'
      // For native users, username is their Cognito UUID
      const userID = user.username;

      console.log('[Profile] User loaded:', { userID, name, userName });

      setFullName(name);
      setUsername(userName);
      setCurrentUserID(userID);

      // Load user trips from cloud
      await loadUserTrips(userID);
    } catch (error) {
      console.error('[Profile] Error loading user data:', error);
      setFullName('');
      setUsername('');
      setTripsError('Failed to load user data');
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Reload data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset carousel indices and photo counts when coming back to this screen
      setCarouselIndices({});
      setTripPhotoCounts({});
      loadUserData();
    }, [loadUserData])
  );

  // Auto-load trip from notification
  useEffect(() => {
    const autoLoadTripFromNotification = async () => {
      // Only auto-load once per notification tap
      if (hasAutoLoadedRef.current) return;

      const { autoLoadTripId, fromNotification } = params;

      if (autoLoadTripId && fromNotification === 'true' && currentUserID) {
        hasAutoLoadedRef.current = true;
        console.log('[Profile] Auto-loading trip from notification:', autoLoadTripId);

        try {
          await handleLoadTrip(autoLoadTripId);
        } catch (error) {
          console.error('[Profile] Error auto-loading trip:', error);
          Alert.alert('Error', 'Failed to load the trip you were invited to.');
        }
      }
    };

    autoLoadTripFromNotification();
  }, [params, currentUserID]);


  const loadUserTrips = async (userID) => {
    try {
      setIsLoadingTrips(true);
      setTripsError(null);

      const tripSummaries = await listUserTripsFromCloud(userID);
      const allTrips = tripSummaries || [];

      // Normalize tripPhotoReference to an array of photo objects
      // Each entry will be of shape: { photo_reference: string | null, place_id: string | null }
      const normalizedTrips = allTrips.map(trip => {
        let photoRef = trip.tripPhotoReference;

        // If it's a stringified array, parse it into an array first
        if (typeof photoRef === 'string') {
          // Remove double brackets if present [[...]] -> [...]
          if (photoRef.startsWith('[[') && photoRef.endsWith(']]')) {
            photoRef = photoRef.slice(1, -1);
          }

          // Check if it looks like an array format [...]
          if (photoRef.startsWith('[') && photoRef.endsWith(']')) {
            // Remove brackets and split by comma
            const content = photoRef.slice(1, -1);
            if (content.trim()) {
              photoRef = content.split(',').map(item => item.trim());
            } else {
              photoRef = [];
            }
          } else {
            // Try standard JSON parse for properly quoted arrays
            try {
              const parsed = JSON.parse(photoRef);
              photoRef = Array.isArray(parsed) ? parsed : [photoRef];
            } catch (e) {
              // If parsing fails, treat it as a single photo reference string
              photoRef = [photoRef];
            }
          }
        } else if (!Array.isArray(photoRef)) {
          photoRef = photoRef ? [photoRef] : [];
        }

        // At this point, photoRef should be an array (strings and/or objects).
        // Convert each entry into a normalized object with photo_reference + place_id.
        const photoObjects = (photoRef || []).map(ref => {
          if (!ref) return null;

          // Already an object – normalize keys
          if (typeof ref === 'object') {
            return {
              photo_reference: ref.photo_reference || ref.photoRef || null,
              place_id: ref.place_id || null,
            };
          }

          if (typeof ref === 'string') {
            const trimmed = ref.trim();

            // If this is a JSON string, parse and normalize
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try {
                const parsed = JSON.parse(trimmed);
                return {
                  photo_reference: parsed.photo_reference || parsed.photoRef || null,
                  place_id: parsed.place_id || null,
                };
              } catch (e) {
                // Fall through to plain string handling
              }
            }

            // Plain string: treat as bare photo_reference with no place_id
            return {
              photo_reference: trimmed || null,
              place_id: null,
            };
          }

          return null;
        }).filter(Boolean);

        return {
          ...trip,
          tripPhotoReference: photoObjects,
        };
      });

      // Sort trips by start date (newest first, fallback to createdAt)
      const sortedTrips = normalizedTrips.sort((a, b) => {
        const dateA = new Date(a.startDate || a.createdAt || 0);
        const dateB = new Date(b.startDate || b.createdAt || 0);
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
      const userID = user.username;

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
      const userID = user.username;

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

  const handleLeaveTrip = (tripId) => {
    const currentTrip = userTrips.find(trip => trip.tripId === tripId);

    Alert.alert(
      'Leave Trip',
      currentTrip?.selectedCity
        ? `Are you sure you want to leave the trip "${currentTrip.selectedCity}"? You will no longer have access to this trip.`
        : 'Are you sure you want to leave this trip? You will no longer have access to it.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setLeavingTripId(tripId);
              console.log('[Profile] Leaving trip:', { tripId, currentUserID, username });

              // Fetch full trip data to get the collaborator entry for the current user
              const fullTripData = await retrieveTripFromCloud(currentUserID, tripId);
              const collaborators = fullTripData?.collaborators || [];

              const currentCollaborator = collaborators.find(
                (c) => c.userID === currentUserID
              );

              const collaboratorUsername =
                currentCollaborator?.username || username;

              if (!collaboratorUsername) {
                console.warn('[Profile] No collaborator username found for current user when leaving trip');
                Alert.alert('Error', 'Unable to determine your collaborator entry for this trip.');
                setLeavingTripId(null);
                return;
              }

              const result = await API.graphql({
                query: removeCollaborator,
                variables: {
                  tripId,
                  username: collaboratorUsername,
                },
              });

              console.log('[Profile] Leave trip result:', result);

              // Refresh trips from backend so UI updates automatically
              if (currentUserID) {
                await loadUserTrips(currentUserID);
              }
            } catch (error) {
              console.error('[Profile] Error leaving trip:', error);
              Alert.alert('Error', 'Failed to leave trip. Please try again.');
            } finally {
              setLeavingTripId(null);
            }
          }
        }
      ]
    );
  };

  // Handle invite collaborators button press
  const handleInviteCollaborators = async (tripId) => {
    try {
      setIsLoadingTripData(true);
      setMenuVisible(null); // Close the menu immediately

      const user = await Auth.currentAuthenticatedUser();
      const userID = user.username;

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCarouselIndices({});
    setTripPhotoCounts({});
    await loadUserData();
    setRefreshing(false);
  }, [loadUserData]);

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
                await Auth.signOut({ global: false });
                // Clear App Groups auth data for Share Extension
                clearAuthData();
                console.log('[Profile] Cleared auth data from App Groups');
                // Clear any stored user data
                setFullName('');
                setUsername('');
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

  const handleOpenLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open this link');
      }
    } catch (error) {
      console.error('[Profile] Error opening link:', error);
      Alert.alert('Error', 'Failed to open link');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // Re-authenticate user for security
      const user = await Auth.currentAuthenticatedUser();
      const userID = user.username;

      console.log('[Profile] Delete account initiated for user:', userID);

      // Close the modal first
      setIsDeleteAccountModalVisible(false);
      setDeleteAccountChecked(false);

      // Navigate to deleting account screen
      router.push('/authorization/deleting-account');

      try {
        // Call the account deletion API
        const deletionResult = await deleteUserAccountFromCloud(userID);
        
        console.log('[Profile] Account deletion result:', deletionResult);

        if (deletionResult.success) {
          // Sign out the user
          await Auth.signOut({ global: false });
          
          // Clear App Groups auth data for Share Extension
          clearAuthData();
          console.log('[Profile] Cleared auth data from App Groups (account deletion)');

          // Clear user data
          setFullName('');
          setUsername('');
          setUserTrips([]);
          setOwnedTrips([]);
          setSharedTrips([]);

          // Navigate to login screen with flag to show success message
          router.replace('/?deleted=1');

          // Log detailed breakdown for debugging
          console.log('[Profile] Account deletion details:', {
            ownedTripsDeleted: deletionResult.ownedTripsDeleted,
            sharedTripsRemoved: deletionResult.sharedTripsRemoved,
            totalTripsAffected: deletionResult.deletedTripsCount,
            errors: deletionResult.errors
          });
          
          // Do not show alert here; login screen will show final notice
        } else {
          throw new Error(deletionResult.message || 'Account deletion failed');
        }
      } catch (deletionError) {
        console.error('[Profile] Account deletion failed:', deletionError);
        
        // On error, return to profile and show modal again
        setIsDeleteAccountModalVisible(true);
        setDeleteAccountChecked(true);
        router.back();
      }
    } catch (error) {
      console.error('[Profile] Error in delete account handler:', error);
      
      // Reset modal state
      setIsDeleteAccountModalVisible(false);
      setDeleteAccountChecked(false);
    }
  };

  // Update in-memory trip photo references when a carousel image fetches a fresh
  // photo_reference or determines that a photo is unusable.
  // - If newPhotoRef is a non-empty string, we update that slide's photo_reference.
  // - If newPhotoRef is null, we remove that slide entirely.
  const handleTripCarouselPhotoUpdate = (tripId, photoIndex, newPhotoRef) => {
    const updatePhotos = (trips) =>
      trips.map(trip => {
        if (trip.tripId !== tripId || !Array.isArray(trip.tripPhotoReference)) {
          return trip;
        }

        let updatedPhotos;

        if (newPhotoRef === null) {
          // Remove this photo from the trip's carousel
          updatedPhotos = trip.tripPhotoReference.filter((_, idx) => idx !== photoIndex);
        } else {
          // Refresh this photo_reference in place
          updatedPhotos = trip.tripPhotoReference.map((ref, idx) => {
            if (idx !== photoIndex || !ref) return ref;

            if (typeof ref === 'object') {
              return {
                ...ref,
                photo_reference: newPhotoRef,
              };
            }

            // Fallback – normalize to object shape
            return {
              photo_reference: newPhotoRef,
              place_id: null,
            };
          });
        }

        return {
          ...trip,
          tripPhotoReference: updatedPhotos,
        };
      });

    setUserTrips(prev => updatePhotos(prev));
    setOwnedTrips(prev => updatePhotos(prev));
    setSharedTrips(prev => updatePhotos(prev));
  };

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Profile</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setIsSettingsModalVisible(true)}
          >
            <Ionicons name="settings-outline" size={28} color={Colors.GRAY} />
          </TouchableOpacity>
        </View>
      </View>

      {/* My Trips Section */}
      <View style={styles.myTripsSection}>
        {tripsError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{tripsError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={async () => {
                const user = await Auth.currentAuthenticatedUser();
                const userID = user.username;
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
        ) : (
          <ScrollView
            style={styles.tripsScrollView}
            showsVerticalScrollIndicator={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.PRIMARY}
                colors={[Colors.PRIMARY]}
              />
            }
          >
            {/* Welcome Back Username - always show when we have the username */}
            {username ? (
              <Text style={styles.welcomeText}>Welcome back, {username}</Text>
            ) : null}
            
            {(ownedTrips.length > 0 || sharedTrips.length > 0) ? (
              <>
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
                  activeOpacity={1}
                >
                  <View style={styles.tripCardContent}>
                    {trip.selectedCity ? (
                      <View style={styles.carouselContainer}>
                        <Carousel
                          loop={false}
                          width={350}
                          height={170}
                          data={trip.tripPhotoReference && trip.tripPhotoReference.length > 0
                            ? trip.tripPhotoReference
                            : [{}, {}, {}, {}, {}]} // Default 5 empty objects for Unsplash
                          scrollAnimationDuration={300}
                          defaultIndex={0}
                          onSnapToItem={(index) =>
                            setCarouselIndices(prev => ({ ...prev, [trip.tripId]: index }))
                          }
                          renderItem={({ item, index }) => (
                            <TripCarouselImage
                              photo_reference={item?.photo_reference}
                              place_id={item?.place_id}
                              cityName={trip.selectedCity}
                              photoIndex={index}
                              style={styles.tripCardImage}
                              onPhotoRefUpdate={(newRef) =>
                                handleTripCarouselPhotoUpdate(trip.tripId, index, newRef)
                              }
                              onPhotoCountUpdate={(count) =>
                                setTripPhotoCounts(prev => ({ ...prev, [trip.tripId]: count }))
                              }
                            />
                          )}
                        />
                        {(() => {
                          const photoCount = tripPhotoCounts[trip.tripId] || 5;
                          // Only show dots if there's more than 1 photo
                          if (trip.tripPhotoReference?.length === 1 || photoCount === 1) {
                            return null;
                          }
                          return (
                            <View style={styles.paginationDots}>
                              {Array.from({ length: photoCount }, (_, index) => (
                                <View
                                  key={index}
                                  style={[
                                    styles.dot,
                                    (carouselIndices[trip.tripId] || 0) === index && styles.activeDot
                                  ]}
                                />
                              ))}
                            </View>
                          );
                        })()}
                      </View>
                    ) : (
                      <Image
                        source={require('../../assets/images/default_trip.jpg')}
                        style={styles.tripCardImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.tripCardInfo}>
                      <View style={styles.tripCardTitleRow}>
                        <Text style={styles.tripCardTitle}>
                          {trip.selectedCity || 'Unknown City'}
                        </Text>
                        {/* Show loading indicator in place of menu button when loading this trip */}
                        {selectedTripId === trip.tripId && isLoadingTrip ? (
                          <ActivityIndicator size="small" color={Colors.PRIMARY} style={styles.menuButton} />
                        ) : (
                          /* Menu button - show for all users */
                          <TouchableOpacity
                            style={styles.menuButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              setMenuVisible(trip.tripId);
                            }}
                            disabled={isLoadingTrip || deletingTripId === trip.tripId}
                          >
                            <FontAwesome6 name="ellipsis" size={24} color={Colors.GRAY} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.tripCardLength}>
                        {(() => {
                          if (trip.startDate && trip.endDate) {
                            const startDate = new Date(trip.startDate);
                            const endDate = new Date(trip.endDate);
                            const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
                            
                            if (sameMonth) {
                              // Same month/year: "Jan 15 - 20, 2025"
                              const startFormatted = startDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric'
                              });
                              const endDay = endDate.getDate();
                              const year = endDate.getFullYear();
                              return `${startFormatted} - ${endDay}, ${year}`;
                            } else if (startDate.getFullYear() === endDate.getFullYear()) {
                              // Different month but same year: "Dec 28 - Jan 7, 2026"
                              const startFormatted = startDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric'
                              });
                              const endFormatted = endDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric'
                              });
                              const year = endDate.getFullYear();
                              return `${startFormatted} - ${endFormatted}, ${year}`;
                            } else {
                              // Different month/year: "Dec 28, 2025 - Jan 7, 2026"
                              const startFormatted = startDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                              const endFormatted = endDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                              return `${startFormatted} - ${endFormatted}`;
                            }
                          } else if (trip.startDate) {
                            // Only start date
                            return new Date(trip.startDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            });
                          } else if (trip.endDate) {
                            // Only end date
                            return new Date(trip.endDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            });
                          } else {
                            // No dates - show trip duration
                            return trip.tripLength != null ? `${trip.tripLength} day trip` : 'Unknown length';
                          }
                        })()}
                      </Text>
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
                  activeOpacity={1}
                >
                  <View style={styles.tripCardContent}>
                    {trip.selectedCity ? (
                      <View style={styles.carouselContainer}>
                        <Carousel
                          loop={false}
                          width={350}
                          height={170}
                          data={trip.tripPhotoReference && trip.tripPhotoReference.length > 0
                            ? trip.tripPhotoReference
                            : [{}, {}, {}, {}, {}]} // Default 5 empty objects for Unsplash
                          scrollAnimationDuration={300}
                          defaultIndex={0}
                          onSnapToItem={(index) =>
                            setCarouselIndices(prev => ({ ...prev, [`shared-${trip.tripId}`]: index }))
                          }
                          renderItem={({ item, index }) => (
                            <TripCarouselImage
                              photo_reference={item?.photo_reference}
                              place_id={item?.place_id}
                              cityName={trip.selectedCity}
                              photoIndex={index}
                              style={styles.tripCardImage}
                              onPhotoRefUpdate={(newRef) =>
                                handleTripCarouselPhotoUpdate(trip.tripId, index, newRef)
                              }
                              onPhotoCountUpdate={(count) =>
                                setTripPhotoCounts(prev => ({ ...prev, [`shared-${trip.tripId}`]: count }))
                              }
                            />
                          )}
                        />
                        {(() => {
                          const photoCount = tripPhotoCounts[`shared-${trip.tripId}`] || 5;
                          // Only show dots if there's more than 1 photo
                          if (trip.tripPhotoReference?.length === 1 || photoCount === 1) {
                            return null;
                          }
                          return (
                            <View style={styles.paginationDots}>
                              {Array.from({ length: photoCount }, (_, index) => (
                                <View
                                  key={index}
                                  style={[
                                    styles.dot,
                                    (carouselIndices[`shared-${trip.tripId}`] || 0) === index && styles.activeDot
                                  ]}
                                />
                              ))}
                            </View>
                          );
                        })()}
                      </View>
                    ) : (
                      <Image
                        source={require('../../assets/images/default_trip.jpg')}
                        style={styles.tripCardImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.tripCardInfo}>
                      <View style={styles.tripCardTitleRow}>
                        <Text style={styles.tripCardTitle}>
                          {trip.selectedCity || 'Unknown City'}
                        </Text>
                        {/* Show loading indicator in place of menu button when loading this trip */}
                        {selectedTripId === trip.tripId && isLoadingTrip ? (
                          <ActivityIndicator size="small" color={Colors.PRIMARY} style={styles.menuButton} />
                        ) : (
                          /* Menu button - show for all users */
                          <TouchableOpacity
                            style={styles.menuButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              setMenuVisible(trip.tripId);
                            }}
                            disabled={isLoadingTrip || deletingTripId === trip.tripId}
                          >
                            <FontAwesome6 name="ellipsis" size={24} color={Colors.GRAY} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.tripCardLength}>
                        {(() => {
                          const referenceDate = trip.startDate ? new Date(trip.startDate) : (trip.createdAt ? new Date(trip.createdAt) : null);
                          
                          if (referenceDate && trip.endDate) {
                            const endDate = new Date(trip.endDate);
                            const sameMonth = referenceDate.getMonth() === endDate.getMonth() && referenceDate.getFullYear() === endDate.getFullYear();
                            
                            if (sameMonth) {
                              // Same month/year: "Jan 15 - 20, 2025"
                              const startFormatted = referenceDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric'
                              });
                              const endDay = endDate.getDate();
                              const year = endDate.getFullYear();
                              return `${startFormatted} - ${endDay}, ${year}`;
                            } else if (referenceDate.getFullYear() === endDate.getFullYear()) {
                              // Different month but same year: "Dec 28 - Jan 7, 2026"
                              const startFormatted = referenceDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric'
                              });
                              const endFormatted = endDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric'
                              });
                              const year = endDate.getFullYear();
                              return `${startFormatted} - ${endFormatted}, ${year}`;
                            } else {
                              // Different month/year: "Dec 28, 2025 - Jan 7, 2026"
                              const startFormatted = referenceDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                              const endFormatted = endDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                              return `${startFormatted} - ${endFormatted}`;
                            }
                          } else if (referenceDate) {
                            // Only reference date (startDate or createdAt)
                            return referenceDate.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            });
                          } else if (trip.endDate) {
                            // Only end date
                            return new Date(trip.endDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            });
                          } else {
                            // No dates - show trip duration
                            return trip.tripLength != null ? `${trip.tripLength} day trip` : 'Unknown length';
                          }
                        })()}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

              </View>
            ))}
              </>
            ) : (
              <View style={styles.noTripsContainer}>
                <FontAwesome name="suitcase" size={50} color={Colors.GRAY} />
                <Text style={styles.noTripsText}>No trips found</Text>
              </View>
            )}
          </ScrollView>
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
              {/* Invite Collaborators / Share Trip */}
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

              {/* Leave Trip - only for editors and viewers */}
              {(() => {
                const currentTrip = userTrips.find(trip => trip.tripId === menuVisible);
                const canLeave = currentTrip && currentTrip.userRole && currentTrip.userRole !== 'owner';
                if (!canLeave) return null;

                return (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuVisible(null);
                      handleLeaveTrip(currentTrip.tripId);
                    }}
                    disabled={leavingTripId === currentTrip.tripId}
                  >
                    {leavingTripId === currentTrip.tripId ? (
                      <>
                        <ActivityIndicator size="small" color="#FF4444" />
                        <Text style={[styles.menuItemText, { color: '#FF4444' }]}>Leaving...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="log-out-outline" size={30} color="#FF4444" />
                        <Text style={[styles.menuItemText, { color: '#FF4444' }]}>Leave Trip</Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })()}

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

      {/* Settings Modal */}
      <Modal
        visible={isSettingsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsSettingsModalVisible(false)}
        >
          <View style={styles.settingsModalSpacer} />
          <TouchableOpacity
            style={styles.settingsModal}
            activeOpacity={1}
            onPress={() => {}} // Prevent closing when tapping inside modal
          >
            {/* Swipeable Handle */}
            <View style={styles.settingsModalHandleContainer} {...settingsPanResponder.panHandlers}>
              <View style={styles.settingsModalHandle} />
            </View>

            {/* Header with close button */}
            <View style={styles.modalHeader}>
              <Text style={styles.settingsModalTitle}>Settings</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsSettingsModalVisible(false)}
              >
                <Ionicons name="close" size={32} color={Colors.GRAY} />
              </TouchableOpacity>
            </View>

            {/* Settings Content */}
            <View style={styles.modalContent}>
              {/* Privacy Policy */}
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => {
                  setIsSettingsModalVisible(false);
                  handleOpenLink('https://atelictravel.com/privacy-policy/');
                }}
              >
                <Ionicons name="shield-outline" size={24} color={Colors.PRIMARY} />
                <Text style={styles.settingsMenuItemText}>Privacy Policy</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.GRAY} />
              </TouchableOpacity>

              {/* Terms of Service */}
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => {
                  setIsSettingsModalVisible(false);
                  handleOpenLink('https://atelictravel.com/terms-of-service/');
                }}
              >
                <Ionicons name="document-text-outline" size={24} color={Colors.PRIMARY} />
                <Text style={styles.settingsMenuItemText}>Terms of Service</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.GRAY} />
              </TouchableOpacity>

              {/* Help & Support */}
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => {
                  setIsSettingsModalVisible(false);
                  handleOpenLink('https://atelictravel.com/contact-us/');
                }}
              >
                <Ionicons name="help-circle-outline" size={24} color={Colors.PRIMARY} />
                <Text style={styles.settingsMenuItemText}>Help & Support</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.GRAY} />
              </TouchableOpacity>

              {/* Logout */}
              <TouchableOpacity
                style={[styles.settingsMenuItem, styles.logoutMenuItem]}
                onPress={() => {
                  setIsSettingsModalVisible(false);
                  handleLogout();
                }}
              >
                <Ionicons name="log-out-outline" size={24} color="#FF4444" />
                <Text style={[styles.settingsMenuItemText, { color: '#FF4444' }]}>Logout</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.GRAY} />
              </TouchableOpacity>

              {/* Delete Account */}
              <TouchableOpacity
                style={[styles.settingsMenuItem]}
                onPress={() => {
                  setIsSettingsModalVisible(false);
                  setIsDeleteAccountModalVisible(true);
                }}
              >
                <Ionicons name="trash-outline" size={24} color="#FF4444" />
                <Text style={[styles.settingsMenuItemText, { color: '#FF4444' }]}>Delete Account</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.GRAY} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={isDeleteAccountModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsDeleteAccountModalVisible(false);
          setDeleteAccountChecked(false);
        }}
      >
        <TouchableOpacity
          style={styles.deleteAccountModalOverlay}
          activeOpacity={1}
          onPress={() => {
            setIsDeleteAccountModalVisible(false);
            setDeleteAccountChecked(false);
          }}
        >
          <TouchableOpacity
            style={styles.deleteAccountModal}
            activeOpacity={1}
            onPress={() => {}} // Prevent closing when tapping inside modal
          >
            {/* Header with title and close button */}
            <View style={styles.deleteAccountHeader}>
              <Text style={styles.deleteAccountTitle}>Delete account</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setIsDeleteAccountModalVisible(false);
                  setDeleteAccountChecked(false);
                }}
              >
                <Ionicons name="close" size={32} color={Colors.GRAY} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.deleteAccountContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.deleteAccountWarningText}>
                Deleting your account will permanently remove your information, trip plans, and other documents associated with your account. This information cannot be restored.
              </Text>

              <Text style={styles.deleteAccountConfirmText}>
                Are you sure you want to delete your account?
              </Text>

              {/* Checkbox */}
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setDeleteAccountChecked(!deleteAccountChecked)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, deleteAccountChecked && styles.checkboxChecked]}>
                  {deleteAccountChecked && (
                    <Ionicons name="checkmark" size={18} color={Colors.WHITE} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  Yes, I want to permanently delete my Atelic account.
                </Text>
              </TouchableOpacity>

              {/* Delete My Account Button */}
              <TouchableOpacity
                style={[
                  styles.deleteAccountButton,
                  !deleteAccountChecked && styles.deleteAccountButtonDisabled
                ]}
                onPress={handleDeleteAccount}
                disabled={!deleteAccountChecked}
              >
                <Text style={styles.deleteAccountButtonText}>Delete my account</Text>
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.cancelDeleteButton}
                onPress={() => {
                  setIsDeleteAccountModalVisible(false);
                  setDeleteAccountChecked(false);
                }}
              >
                <Text style={styles.cancelDeleteButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.WHITE,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2.84,
  },
  settingsText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    marginLeft: 6,
  },
  myTripsSection: {
    marginTop: 30,
    flex: 1,
  },
  welcomeText: {
    fontFamily: 'outfit',
    fontSize: 22,
    marginBottom: 30,
    color: Colors.PRIMARY,
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
    height: 170,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  tripCardImagePlaceholder: {
    width: '100%',
    height: 170,
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
  tripCardTitle: {
    fontFamily: 'outfit-medium',
    fontSize: 20,
    color: Colors.PRIMARY,
    flex: 1,
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
  carouselContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: Colors.WHITE,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  settingsModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 0.6, // Takes up 45% of screen height (increased from 40%)
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
  settingsModalHandleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingsModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.GRAY,
    borderRadius: 2,
    opacity: 0.3,
  },
  settingsModalTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 32,
    color: Colors.PRIMARY,
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginVertical: 4,
    justifyContent: 'space-between',
  },
  settingsMenuItemText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    flex: 1,
    marginLeft: 12,
    color: Colors.PRIMARY,
  },
  logoutMenuItem: {
    marginTop: 3,
  },
  settingsModalSpacer: {
    flex: 0.55, // Takes up 55% of screen, leaving 45% for modal (decreased from 67%)
  },
  deleteAccountModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteAccountModal: {
    backgroundColor: Colors.WHITE,
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  deleteAccountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deleteAccountTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 24,
    color: Colors.PRIMARY,
    textAlign: 'center',
    flex: 1,
  },
  deleteAccountContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  deleteAccountWarningText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    lineHeight: 24,
    marginBottom: 20,
  },
  deleteAccountConfirmText: {
    marginTop: 15,
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: Colors.PRIMARY,
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.GRAY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.PRIMARY,
    borderColor: Colors.PRIMARY,
  },
  checkboxLabel: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.PRIMARY,
    flex: 1,
    lineHeight: 22,
  },
  deleteAccountButton: {
    backgroundColor: '#FF4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteAccountButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  deleteAccountButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: Colors.WHITE,
  },
  cancelDeleteButton: {
    backgroundColor: Colors.WHITE,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cancelDeleteButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: Colors.PRIMARY,
  },
});