import { Colors } from '../../constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Dimensions, RefreshControl, Linking, PanResponder, Image, Switch } from 'react-native';
import { Auth, API, Storage } from 'aws-amplify';
import { useEffect, useState, useRef } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useCreateTrip } from '../../context/CreateTripContext';
import { listUserTripsFromCloud, retrieveTripFromCloud, deleteUserAccountFromCloud } from '../../src/services/lambdaService';
import { deleteTrip } from '../../src/graphql/customMutations';
import { removeCollaborator, updateUserProfile, createTrip } from '../../src/graphql/mutations';
import { ShareTripModal } from '../../src/components/trip-view/collaboration';
import { TripCarouselImage } from '../../src/components/profile/TripCarouselImage';
import { clearAuthData } from '../../src/services/appGroupsService';
import Carousel from 'react-native-reanimated-carousel';
import { ProfileHeader } from '../../src/components/profile/ProfileHeader';
import { ProfileStats } from '../../src/components/profile/ProfileStats';
import * as customQueries from '../../src/graphql/customQueries';
import * as customMutations from '../../src/graphql/customMutations';
import { getUserProfile } from '../../src/graphql/queries';

const { width: screenWidth } = Dimensions.get('window');
const CAROUSEL_WIDTH = screenWidth - 52; // 25px padding each side + 1px border each side

export default function Profile() {
  const { restoreTripFromObject, setSelectedCity } = useCreateTrip();
  const params = useLocalSearchParams();
  const hasAutoLoadedRef = useRef(false);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [userTrips, setUserTrips] = useState([]);
  const [ownedTrips, setOwnedTrips] = useState([]);
  const [sharedTrips, setSharedTrips] = useState([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
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
  const [togglingVisibilityTripId, setTogglingVisibilityTripId] = useState(null);

  // Social features state
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const [profilePhotoKey, setProfilePhotoKey] = useState(Date.now()); // Cache-busting key for image reload
  const [bio, setBio] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [countriesVisited, setCountriesVisited] = useState(0);
  const [citiesVisited, setCitiesVisited] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

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

      // Load pending requests count
      if (userName) {
        await loadPendingRequestsCount(userName);
      }
    } catch (error) {
      console.error('[Profile] Error loading user data:', error);
      setFullName('');
      setUsername('');
      setTripsError('Failed to load user data');
    }
  }, [loadPendingRequestsCount]);

  // Helper function to resolve S3 keys to signed URLs
  const resolveProfilePhotoUrl = async (url) => {
    if (!url) return null;

    // If it's already a valid HTTP URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Otherwise, treat it as an S3 key (with or without 's3://' prefix)
    const s3Key = url.startsWith('s3://') ? url.replace('s3://', '') : url;

    try {
      console.log('[Profile] Resolving S3 key:', s3Key);
      // Get a signed URL that's valid for 1 hour (3600 seconds)
      const signedUrl = await Storage.get(s3Key, {
        level: 'public',
        expires: 3600
      });
      // Verify we got a valid HTTP URL back
      if (signedUrl && (signedUrl.startsWith('http://') || signedUrl.startsWith('https://'))) {
        return signedUrl;
      }
      console.error('[Profile] Storage.get returned invalid URL');
      return null;
    } catch (error) {
      console.error('[Profile] Error getting signed URL:', error);
      return null;
    }
  };

  const loadUserProfile = useCallback(async (userName) => {
    if (!userName) return;

    try {
      const response = await API.graphql({
        query: getUserProfile,
        variables: { username: userName },
      });

      const profile = response.data.getUserProfile;
      if (profile) {
        // Resolve S3 key to signed URL if needed
        const resolvedPhotoUrl = await resolveProfilePhotoUrl(profile.profilePhotoUrl);
        setProfilePhotoUrl(resolvedPhotoUrl);
        // Update cache-busting key to force image reload
        setProfilePhotoKey(Date.now());
        setBio(profile.bio);
        setIsPrivate(profile.isPrivateAccount || false);
        setFollowersCount(profile.followersCount || 0);
        setFollowingCount(profile.followingCount || 0);
        setCountriesVisited(profile.countriesVisited || 0);
        setCitiesVisited(profile.citiesVisited || 0);
      }
    } catch (error) {
      console.error('[Profile] Error loading profile:', error);
    }
  }, []);

  const loadUserStatistics = useCallback(async (userName) => {
    if (!userName) return;

    try {
      const response = await API.graphql({
        query: customQueries.getUserStatistics,
        variables: { username: userName },
      });

      const stats = response.data.getUserStatistics;
      setCountriesVisited(stats.countriesVisited || 0);
      setCitiesVisited(stats.citiesVisited || 0);
    } catch (error) {
      console.error('[Profile] Error loading statistics:', error);
    }
  }, []);

  const loadPendingRequestsCount = useCallback(async (userName) => {
    if (!userName) return;

    try {
      console.log('[Profile] Loading pending requests for:', userName);
      const response = await API.graphql({
        query: customQueries.getFollowRequests,
        variables: { targetUsername: userName, limit: 100 },
      });

      console.log('[Profile] Follow requests response:', JSON.stringify(response.data.getFollowRequests, null, 2));
      const requests = response.data.getFollowRequests?.requests || [];
      console.log('[Profile] Pending requests count:', requests.length);
      setPendingRequestsCount(requests.length);
    } catch (error) {
      console.error('[Profile] Error loading pending requests count:', error);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    if (username) {
      loadUserProfile(username);
    }
  }, [username, loadUserProfile]);

  // Reload data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[Profile] useFocusEffect triggered - reloading trips, profile and statistics');
      // Reset carousel indices and photo counts when coming back to this screen
      setCarouselIndices({});
      setTripPhotoCounts({});
      loadUserData();
      // Reload profile and statistics to reflect latest data
      if (username) {
        loadUserProfile(username);
        loadUserStatistics(username);
        loadPendingRequestsCount(username);
      }
    }, [username, loadUserProfile, loadUserStatistics, loadPendingRequestsCount])
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
      console.log('[Profile] Received trip summaries:', JSON.stringify(tripSummaries?.map(t => ({
        tripId: t.tripId,
        tripTitle: t.tripTitle,
        selectedCity: t.selectedCity
      })), null, 2));
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

      console.log('[Profile] 📥 Retrieved trip details:');
      console.log('[Profile] Trip ID:', tripDetails?.tripId);
      console.log('[Profile] Trip Title:', tripDetails?.tripTitle);
      console.log('[Profile] Selected City:', tripDetails?.selectedCity);
      console.log('[Profile] Trip Title type:', typeof tripDetails?.tripTitle);

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

  // Toggle trip visibility on profile
  const handleToggleVisibility = async (tripId) => {
    try {
      const currentTrip = userTrips.find(trip => trip.tripId === tripId);
      if (!currentTrip) {
        console.error('[Profile] Trip not found:', tripId);
        return;
      }

      const newIsPublic = !currentTrip.isPublic;
      setTogglingVisibilityTripId(tripId);
      console.log('[Profile] Toggling trip visibility:', { tripId, from: currentTrip.isPublic, to: newIsPublic });

      // Fetch full trip data
      const fullTripData = await retrieveTripFromCloud(currentUserID, tripId);
      if (!fullTripData) {
        throw new Error('Could not retrieve trip data');
      }

      // Helper function to sanitize activity objects for GraphQL
      const sanitizeActivity = (activity) => {
        if (!activity) return null;
        const { __typename, lastModified, modifiedBy, lastReordered, category, ...rest } = activity;
        // Ensure required String! fields have values (with type checking)
        rest.place_id = typeof rest.place_id === 'string' && rest.place_id.trim() !== '' ? rest.place_id : 'unknown_place';
        rest.name = typeof rest.name === 'string' && rest.name.trim() !== '' ? rest.name : 'Unknown Place';
        // Remove __typename from nested objects too
        if (rest.regular_opening_hours) {
          const { __typename: ohTypename, ...ohRest } = rest.regular_opening_hours;
          rest.regular_opening_hours = ohRest;
          if (rest.regular_opening_hours.periods) {
            rest.regular_opening_hours.periods = rest.regular_opening_hours.periods.map(p => {
              const { __typename: pTypename, ...pRest } = p || {};
              if (pRest.open) {
                const { __typename: openTypename, ...openRest } = pRest.open;
                pRest.open = openRest;
              }
              if (pRest.close) {
                const { __typename: closeTypename, ...closeRest } = pRest.close;
                pRest.close = closeRest;
              }
              return pRest;
            });
          }
        }
        if (rest.reviews) {
          rest.reviews = rest.reviews.map(r => {
            const { __typename: rTypename, ...rRest } = r || {};
            return rRest;
          });
        }
        return rest;
      };

      // Prepare trip data with updated isPublic
      const tripData = {
        tripId: fullTripData.tripId,
        userID: currentUserID,
        tripTitle: fullTripData.tripTitle || null,
        days: (fullTripData.days || []).map(day => ({
          dayNumber: day.dayNumber,
          activities: (day.activities || []).map(sanitizeActivity).filter(Boolean),
          encodedPolyline: day.encodedPolyline || null,
        })),
        wishlist: (fullTripData.wishlist || []).map(sanitizeActivity).filter(Boolean),
        tripLength: fullTripData.tripLength,
        selectedCity: fullTripData.selectedCity,
        tripPhotoReference: fullTripData.tripPhotoReference || [],
        createdAt: fullTripData.createdAt,
        startDate: fullTripData.startDate || null,
        endDate: fullTripData.endDate || null,
        cityCategories: (fullTripData.cityCategories || []).map(c => {
          if (!c) return null;
          const { __typename, ...rest } = c;
          // category is String! - must have valid value
          if (typeof rest.category !== 'string' || rest.category.trim() === '') return null;
          rest.category_items = Array.isArray(rest.category_items) ? rest.category_items.filter(i => typeof i === 'string' && i.trim() !== '') : [];
          return rest;
        }).filter(Boolean),
        recentSearches: (fullTripData.recentSearches || []).map(rs => {
          if (!rs) return null;
          const { __typename, ...rest } = rs;
          // place_id, name, timestamp are String! - must have valid values
          if (typeof rest.place_id !== 'string' || rest.place_id.trim() === '') return null;
          if (typeof rest.name !== 'string' || rest.name.trim() === '') return null;
          rest.timestamp = typeof rest.timestamp === 'string' && rest.timestamp.trim() !== '' ? rest.timestamp : new Date().toISOString();
          return rest;
        }).filter(Boolean),
        collaborators: (fullTripData.collaborators || []).map(c => {
          if (!c) return null;
          const { __typename, ...rest } = c;
          // Ensure required String! fields have values (with type checking)
          rest.email = typeof rest.email === 'string' && rest.email.trim() !== '' ? rest.email : 'unknown@email.com';
          rest.fullName = typeof rest.fullName === 'string' && rest.fullName.trim() !== '' ? rest.fullName : 'Unknown User';
          rest.username = typeof rest.username === 'string' && rest.username.trim() !== '' ? rest.username : 'unknown';
          rest.userID = typeof rest.userID === 'string' && rest.userID.trim() !== '' ? rest.userID : 'unknown_user';
          // addedBy is String! - use fullName as fallback
          rest.addedBy = typeof rest.addedBy === 'string' && rest.addedBy.trim() !== '' ? rest.addedBy : (rest.fullName || 'system');
          return rest;
        }).filter(Boolean),
        version: (fullTripData.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        lastUpdatedBy: username || 'unknown',
        // Include deletedSavedPlaceIds, filtering out any null/empty values
        deletedSavedPlaceIds: Array.isArray(fullTripData.deletedSavedPlaceIds)
          ? fullTripData.deletedSavedPlaceIds.filter(id => typeof id === 'string' && id.trim() !== '')
          : [],
        isPublic: newIsPublic
      };

      // Save updated trip
      await API.graphql({
        query: createTrip,
        variables: { input: tripData }
      });

      console.log('[Profile] Trip visibility updated successfully');

      // Update local state immediately for responsive UI
      setUserTrips(prevTrips =>
        prevTrips.map(trip =>
          trip.tripId === tripId ? { ...trip, isPublic: newIsPublic } : trip
        )
      );

    } catch (error) {
      console.error('[Profile] Error toggling trip visibility:', error);
      Alert.alert('Error', 'Failed to update trip visibility. Please try again.');
    } finally {
      setTogglingVisibilityTripId(null);
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

  // Social feature handlers
  const handleFollowersPress = () => {
    router.push(`/profile/followers?username=${username}`);
  };

  const handleFollowingPress = () => {
    router.push(`/profile/following?username=${username}`);
  };

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  const handlePrivacyToggle = async (newPrivacyValue) => {
    try {
      await API.graphql({
        query: customMutations.updateUserPrivacy,
        variables: {
          username: username,
          isPrivate: newPrivacyValue,
        },
      });
      setIsPrivate(newPrivacyValue);
      Alert.alert(
        'Privacy Updated',
        newPrivacyValue
          ? 'Your account is now private. New followers will need your approval.'
          : 'Your account is now public. Anyone can follow you and view your trips.'
      );
    } catch (error) {
      console.error('[Profile] Error updating privacy:', error);
      Alert.alert('Error', 'Failed to update privacy settings. Please try again.');
    }
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
                await Auth.signOut({ global: false });
                // Clear App Groups auth data for Share Extension
                const cleared = clearAuthData();
                console.log('[Profile] Auth data clear result (Logout):', cleared ? '✅ Cleared' : '⚠️ Not available');
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
          const cleared = clearAuthData();
          console.log('[Profile] Auth data clear result (Account deletion):', cleared ? '✅ Cleared' : '⚠️ Not available');

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
          {/* Follow Requests Button - Always visible */}
          <TouchableOpacity
            style={styles.followRequestsButton}
            onPress={() => {
              console.log('[Profile] Follow Requests button pressed, count:', pendingRequestsCount);
              router.push('/profile/follow-requests');
            }}
          >
            <Ionicons name="people-outline" size={28} color={Colors.GRAY} />
            {pendingRequestsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequestsCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Settings Button */}
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
            {/* Profile Header and Stats */}
            {username && (
              <>
                <ProfileHeader
                  username={username}
                  fullName={fullName}
                  profilePhotoUrl={profilePhotoUrl}
                  profilePhotoKey={profilePhotoKey}
                  bio={bio}
                  isOwnProfile={true}
                  isPrivate={isPrivate}
                  onEditPress={handleEditProfile}
                />
                <ProfileStats
                  countriesVisited={countriesVisited}
                  citiesVisited={citiesVisited}
                  totalTrips={ownedTrips.length + sharedTrips.length}
                  followersCount={followersCount}
                  followingCount={followingCount}
                  onFollowersPress={handleFollowersPress}
                  onFollowingPress={handleFollowingPress}
                />
              </>
            )}

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
                          width={CAROUSEL_WIDTH}
                          height={180}
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
                          {trip.tripTitle || trip.selectedCity || 'Unknown Trip'}
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
                            hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
                            disabled={isLoadingTrip || deletingTripId === trip.tripId}
                          >
                            <FontAwesome6 name="ellipsis" size={24} color={Colors.GRAY} />
                          </TouchableOpacity>
                        )}
                      </View>
                      {trip.tripTitle && trip.selectedCity && (
                        <Text style={styles.tripCardSubtitle}>{trip.selectedCity}</Text>
                      )}
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
                          width={CAROUSEL_WIDTH}
                          height={180}
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
                          {trip.tripTitle || trip.selectedCity || 'Unknown Trip'}
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
                            hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
                            disabled={isLoadingTrip || deletingTripId === trip.tripId}
                          >
                            <FontAwesome6 name="ellipsis" size={24} color={Colors.GRAY} />
                          </TouchableOpacity>
                        )}
                      </View>
                      {trip.tripTitle && trip.selectedCity && (
                        <Text style={styles.tripCardSubtitle}>{trip.selectedCity}</Text>
                      )}
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

              {/* Visible on Profile Toggle - only for owners */}
              {(() => {
                const currentTrip = userTrips.find(trip => trip.tripId === menuVisible);
                if (currentTrip?.userRole !== 'owner') return null;

                const isToggling = togglingVisibilityTripId === menuVisible;
                const isCurrentlyPublic = currentTrip.isPublic === true;

                return (
                  <View style={styles.menuItemWithToggle}>
                    <View style={styles.menuItemToggleContent}>
                      <Ionicons
                        name={isCurrentlyPublic ? "eye-outline" : "eye-off-outline"}
                        size={30}
                        color={Colors.PRIMARY}
                      />
                      <Text style={styles.menuItemText}>Visible on Profile</Text>
                    </View>
                    {isToggling ? (
                      <ActivityIndicator size="small" color={Colors.PRIMARY} />
                    ) : (
                      <Switch
                        value={isCurrentlyPublic}
                        onValueChange={() => handleToggleVisibility(menuVisible)}
                        trackColor={{ false: '#D1D5DB', true: '#FFA53F' }}
                        thumbColor={isCurrentlyPublic ? '#FFFFFF' : '#f4f3f4'}
                        ios_backgroundColor="#D1D5DB"
                      />
                    )}
                  </View>
                );
              })()}

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
            <ScrollView style={styles.modalContent}>
              {/* Account Privacy Toggle */}
              <View style={styles.settingsMenuItem}>
                <Ionicons name="eye-off-outline" size={24} color={Colors.PRIMARY} style={styles.settingsIcon} />
                <View style={styles.settingsMenuItemTextContainer}>
                  <Text style={styles.settingsMenuItemTextTitle}>Private Account</Text>
                  <Text style={styles.settingsMenuItemSubtext}>Require approval for new followers</Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={handlePrivacyToggle}
                  trackColor={{ false: Colors.LIGHT_GRAY, true: Colors.ORANGE_LIGHT }}
                  thumbColor={isPrivate ? Colors.ORANGE : Colors.WHITE}
                  ios_backgroundColor={Colors.LIGHT_GRAY}
                />
              </View>

              {/* Privacy Policy */}
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => {
                  setIsSettingsModalVisible(false);
                  handleOpenLink('https://atelictravel.com/privacy-policy/');
                }}
              >
                <Ionicons name="shield-outline" size={24} color={Colors.PRIMARY} style={styles.settingsIcon} />
                <View style={styles.settingsMenuItemTextContainer}>
                  <Text style={styles.settingsMenuItemTextTitle}>Privacy Policy</Text>
                </View>
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
                <Ionicons name="document-text-outline" size={24} color={Colors.PRIMARY} style={styles.settingsIcon} />
                <View style={styles.settingsMenuItemTextContainer}>
                  <Text style={styles.settingsMenuItemTextTitle}>Terms of Service</Text>
                </View>
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
                <Ionicons name="help-circle-outline" size={24} color={Colors.PRIMARY} style={styles.settingsIcon} />
                <View style={styles.settingsMenuItemTextContainer}>
                  <Text style={styles.settingsMenuItemTextTitle}>Help & Support</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.GRAY} />
              </TouchableOpacity>

              {/* Apply as Admin */}
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => {
                  setIsSettingsModalVisible(false);
                  setTimeout(() => {
                  Alert.prompt(
                    'Apply as Admin',
                    'Enter the 4-digit admin passcode:',
                    async (passcode) => {
                      if (passcode === '2000') {
                        try {
                          const user = await Auth.currentAuthenticatedUser();
                          const prefUsername = user.attributes?.preferred_username || user.username;
                          await API.graphql({
                            query: updateUserProfile,
                            variables: {
                              username: prefUsername,
                              action: 'UPDATE_ADMIN_PERMISSION',
                              tripData: JSON.stringify({ admin_permission: true })
                            }
                          });
                          Alert.alert('Success', 'Admin permission granted.');
                        } catch (error) {
                          console.error('[Profile] Error setting admin permission:', error);
                          Alert.alert('Error', 'Failed to update admin permission.');
                        }
                      } else {
                        Alert.alert('Invalid Code', 'The passcode you entered is incorrect.');
                      }
                    },
                    'secure-text'
                  );
                  }, 500);
                }}
              >
                <Ionicons name="key-outline" size={24} color={Colors.PRIMARY} style={styles.settingsIcon} />
                <View style={styles.settingsMenuItemTextContainer}>
                  <Text style={styles.settingsMenuItemTextTitle}>Apply as Admin</Text>
                </View>
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
                <Ionicons name="log-out-outline" size={24} color="#FF4444" style={styles.settingsIcon} />
                <View style={styles.settingsMenuItemTextContainer}>
                  <Text style={[styles.settingsMenuItemTextTitle, { color: '#FF4444' }]}>Logout</Text>
                </View>
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
                <Ionicons name="trash-outline" size={24} color="#FF4444" style={styles.settingsIcon} />
                <View style={styles.settingsMenuItemTextContainer}>
                  <Text style={[styles.settingsMenuItemTextTitle, { color: '#FF4444' }]}>Delete Account</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.GRAY} />
              </TouchableOpacity>
            </ScrollView>
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
  followRequestsButton: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 8,
    backgroundColor: Colors.ORANGE,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.WHITE,
    fontSize: 12,
    fontWeight: 'bold',
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
    borderRadius: 16,
    marginBottom: 30,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    height: 180,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tripCardImagePlaceholder: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripCardInfo: {
    padding: 16,
    paddingTop: 14,
    alignItems: 'flex-start',
  },
  tripCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 2,
  },
  tripCardTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 20,
    color: '#1a1a1a',
    flex: 1,
  },
  tripCardSubtitle: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  tripCardLength: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#9CA3AF',
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
    paddingBottom: 40,
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
  menuItemWithToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginVertical: 4,
  },
  menuItemToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carouselContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: Colors.WHITE,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  settingsModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 0.73,
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
  },
  settingsIconContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    width: 24,
  },
  settingsMenuItemText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    flex: 1,
    marginLeft: 12,
    color: Colors.PRIMARY,
  },
  settingsMenuItemTextTitle: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: Colors.PRIMARY,
  },
  settingsMenuItemTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  settingsMenuItemSubtext: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    marginTop: 2,
  },
  logoutMenuItem: {
    marginTop: 3,
  },
  settingsModalSpacer: {
    flex: 0.42,
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