import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Switch,
  Linking,
  PanResponder,
  RefreshControl,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
// ScrollView from RNGH shares the same gesture system as the carousel,
// allowing failOffsetY on the carousel to properly yield vertical swipes to the scroll view.
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { API, Auth, Storage } from 'aws-amplify';
import { TripCarouselImage } from '../../src/components/profile/TripCarouselImage';
import { ShareTripModal } from '../../src/components/trip-view/collaboration';
import { FollowersList } from '../../src/components/social/FollowersList';
import { FollowingList } from '../../src/components/social/FollowingList';
import { Colors } from '../../constants/Colors';
import * as customQueries from '../../src/graphql/customQueries';
import * as customMutations from '../../src/graphql/customMutations';
import { getUserProfile, getUserStatistics } from '../../src/graphql/queries';
import { useCreateTrip } from '../../context/CreateTripContext';
import { listUserTripsFromCloud, retrieveTripFromCloud, deleteUserAccountFromCloud } from '../../src/services/lambdaService';
import { deleteTrip } from '../../src/graphql/customMutations';
import { removeCollaborator, createTrip } from '../../src/graphql/mutations';
import { clearAuthData } from '../../src/services/appGroupsService';
import awsmobile from '../../src/aws-exports';
import Carousel from 'react-native-reanimated-carousel';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { InitialsAvatar } from '../../src/components/common/InitialsAvatar';

const { width: screenWidth } = Dimensions.get('window');
const CAROUSEL_WIDTH = screenWidth - 52;

// Card dimensions for 2-column grid in profile modal
const PROFILE_CARD_HORIZONTAL_PADDING = 20;
const PROFILE_CARD_GAP = 12;
const PROFILE_CARD_WIDTH = (screenWidth - (PROFILE_CARD_HORIZONTAL_PADDING * 2) - PROFILE_CARD_GAP) / 2;
const PROFILE_CARD_IMAGE_HEIGHT = PROFILE_CARD_WIDTH * 1.3;

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { restoreTripFromObject, setSelectedCity } = useCreateTrip();
  const params = useLocalSearchParams();
  const hasAutoLoadedRef = useRef(false);
  const carouselTouchStartRef = useRef(null); // {x, y} of touch start for gesture direction logging

  // User states
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [currentUserID, setCurrentUserID] = useState('');

  // Profile state
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const [bio, setBio] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);

  // Edit profile state
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [countriesVisited, setCountriesVisited] = useState(0);
  const [citiesVisited, setCitiesVisited] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Trips state
  const [userTrips, setUserTrips] = useState([]);
  const [ownedTrips, setOwnedTrips] = useState([]);
  const [sharedTrips, setSharedTrips] = useState([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [hasLoadedTrips, setHasLoadedTrips] = useState(false);
  const [tripsError, setTripsError] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [isLoadingTrip, setIsLoadingTrip] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [leavingTripId, setLeavingTripId] = useState(null);
  const [togglingVisibilityTripId, setTogglingVisibilityTripId] = useState(null);
  const [carouselIndices, setCarouselIndices] = useState({});
  const [tripPhotoCounts, setTripPhotoCounts] = useState({});

  // Feed state
  const [feedTrips, setFeedTrips] = useState([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [nextToken, setNextToken] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(null);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [selectedTripForSharing, setSelectedTripForSharing] = useState(null);
  const [isLoadingTripData, setIsLoadingTripData] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isDeleteAccountModalVisible, setIsDeleteAccountModalVisible] = useState(false);
  const [deleteAccountChecked, setDeleteAccountChecked] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [profileModalView, setProfileModalView] = useState('profile'); // 'profile', 'followers', 'following', 'edit'
  const [profileActiveTab, setProfileActiveTab] = useState('upcoming');

  // Followers/Following state for embedded views
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [pendingFollowRequests, setPendingFollowRequests] = useState(new Set()); // Track pending requests
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [profileCarouselIndices, setProfileCarouselIndices] = useState({});
  const [profileTripPhotoCounts, setProfileTripPhotoCounts] = useState({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Image upload configuration
  // Profile photos are stored as base64 data URLs for simplicity
  // Max size after compression: ~100KB base64

  // Separate trips into upcoming and past for profile modal
  const { profileUpcomingTrips, profilePastTrips } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = [];
    const past = [];

    userTrips.forEach(trip => {
      if (trip.endDate) {
        const endDate = new Date(trip.endDate);
        if (endDate < today) {
          past.push(trip);
        } else {
          upcoming.push(trip);
        }
      } else if (trip.startDate) {
        const startDate = new Date(trip.startDate);
        if (startDate < today) {
          past.push(trip);
        } else {
          upcoming.push(trip);
        }
      } else {
        upcoming.push(trip);
      }
    });

    // Sort upcoming by start date (earliest first)
    upcoming.sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate) - new Date(b.startDate);
    });

    // Sort past by end date (most recent first)
    past.sort((a, b) => {
      const dateA = a.endDate || a.startDate;
      const dateB = b.endDate || b.startDate;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateB) - new Date(dateA);
    });

    return { profileUpcomingTrips: upcoming, profilePastTrips: past };
  }, [userTrips]);

  const profileDisplayedTrips = profileActiveTab === 'upcoming' ? profileUpcomingTrips : profilePastTrips;

  // Calculate countries and cities from loaded trips
  const { calculatedCountries, calculatedCities } = useMemo(() => {
    const countries = new Set();
    const cities = new Set();

    userTrips.forEach(trip => {
      if (trip.selectedCity) {
        cities.add(trip.selectedCity);
        // Extract country from city format: "Paris, France" or "New York, NY, USA"
        const cityParts = trip.selectedCity.split(',');
        if (cityParts.length > 1) {
          const country = cityParts[cityParts.length - 1].trim();
          countries.add(country);
        }
      }
    });

    return { calculatedCountries: countries.size, calculatedCities: cities.size };
  }, [userTrips]);

  // Profile photo upload functions
  const requestPhotoPermission = async (type) => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  };

  const uploadImageToHost = async (imageUri) => {
    try {
      // Refresh credentials to ensure valid AWS session
      const user = await Auth.currentAuthenticatedUser({ bypassCache: true });
      const userId = user.username;

      // Force refresh the user session to get fresh credentials
      const session = await Auth.currentSession();
      console.log('[uploadImageToHost] Session valid:', session.isValid());

      const timestamp = Date.now();
      const filename = `profile-photos/${userId}/profile-${timestamp}.jpg`;

      // Read the image file
      const imageResponse = await fetch(imageUri);
      const blob = await imageResponse.blob();

      console.log('[uploadImageToHost] Uploading to S3:', filename);

      // Upload to S3 using Amplify Storage
      const result = await Storage.put(filename, blob, {
        contentType: 'image/jpeg',
        level: 'public',
      });

      console.log('[uploadImageToHost] Upload successful:', result.key);

      // Return just the S3 key - the resolveProfilePhotoUrl function will convert it to a signed URL
      console.log('[uploadImageToHost] S3 Key:', result.key);
      return result.key;
    } catch (error) {
      console.error('Image upload error:', error);
      // If it's an auth error, try to re-authenticate
      if (error.code === 'InvalidAccessKeyId' || error.message?.includes('InvalidAccessKeyId')) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please sign out and sign in again.',
          [{ text: 'OK' }]
        );
      }
      throw error;
    }
  };

  const updateProfilePhotoInBackend = async (newPhotoUrl) => {
    try {
      await API.graphql({
        query: customMutations.updateUserProfilePhoto,
        variables: {
          username: username,
          action: 'UPDATE_PROFILE_INFO',
          tripData: JSON.stringify({
            profilePhotoUrl: newPhotoUrl,
          }),
        },
      });
    } catch (error) {
      // GraphQL may throw with partial errors but mutation still succeeds
      // Check if data was returned (indicates success despite errors)
      if (error?.data?.updateUserProfile) {
        // Mutation succeeded, ignore the partial error
        return;
      }
      console.error('Error updating profile photo:', error);
      throw error;
    }
  };

  const pickProfileImage = async (source) => {
    try {
      const hasPermission = await requestPhotoPermission(source);
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          `Please allow access to your ${source === 'camera' ? 'camera' : 'photo library'} in Settings.`
        );
        return;
      }

      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      };

      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets[0]) {
        setIsUploadingPhoto(true);
        try {
          // Upload image to hosting service - returns S3 key prefixed with 's3://'
          const s3Key = await uploadImageToHost(result.assets[0].uri);
          await updateProfilePhotoInBackend(s3Key);
          // Resolve the S3 key to a signed URL for immediate display
          const resolvedUrl = await resolveProfilePhotoUrl(s3Key);
          setProfilePhotoUrl(resolvedUrl);
        } catch (error) {
          console.error('Profile photo update error:', error);
        } finally {
          setIsUploadingPhoto(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const removeProfilePhoto = async () => {
    try {
      setIsUploadingPhoto(true);
      await updateProfilePhotoInBackend(null);
      setProfilePhotoUrl(null);
    } catch (error) {
      console.error('Error removing profile photo:', error);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

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
      console.log('[resolveProfilePhotoUrl] Resolving S3 key:', s3Key);
      // Get a signed URL that's valid for 1 hour (3600 seconds)
      const signedUrl = await Storage.get(s3Key, {
        level: 'public',
        expires: 3600
      });
      console.log('[resolveProfilePhotoUrl] Got signed URL:', signedUrl?.substring(0, 100));
      // Verify we got a valid HTTP URL back
      if (signedUrl && (signedUrl.startsWith('http://') || signedUrl.startsWith('https://'))) {
        return signedUrl;
      }
      console.error('[resolveProfilePhotoUrl] Storage.get returned invalid URL:', signedUrl);
      return null;
    } catch (error) {
      console.error('[resolveProfilePhotoUrl] Error getting signed URL:', error);
      return null;
    }
  };

  const handleChangeProfilePhoto = () => {
    const hasPhoto = !!profilePhotoUrl;

    const buttons = [
      { text: 'Take Photo', onPress: () => pickProfileImage('camera') },
      { text: 'Choose from Library', onPress: () => pickProfileImage('library') },
    ];

    if (hasPhoto) {
      buttons.push({ text: 'Remove Photo', onPress: removeProfilePhoto, style: 'destructive' });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Change Profile Photo', 'Choose an option', buttons);
  };

  // Load user data
  const loadUserData = useCallback(async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const name = user.attributes?.name || '';
      const userName = user.attributes?.preferred_username || '';
      const userID = user.username;

      setFullName(name);
      setUsername(userName);
      setCurrentUserID(userID);

      await loadUserTrips(userID);
      await loadUserProfile(userName);
    } catch (error) {
      console.error('[Feed] Error loading user data:', error);
    }
  }, []);

  const loadUserStatistics = useCallback(async (userName) => {
    if (!userName) return;

    try {
      const response = await API.graphql({
        query: getUserStatistics,
        variables: { username: userName },
      });

      const stats = response.data.getUserStatistics;
      if (stats) {
        setCountriesVisited(stats.countriesVisited || 0);
        setCitiesVisited(stats.citiesVisited || 0);
      }
    } catch (error) {
      // GraphQL may throw with partial errors but still have valid data
      if (error?.data?.getUserStatistics) {
        const stats = error.data.getUserStatistics;
        setCountriesVisited(stats.countriesVisited || 0);
        setCitiesVisited(stats.citiesVisited || 0);
      } else {
        console.warn('[Feed] Error loading statistics:', error);
      }
    }
  }, []);

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
        setBio(profile.bio);
        setIsPrivate(profile.isPrivateAccount || false);
        setFollowersCount(profile.followersCount || 0);
        setFollowingCount(profile.followingCount || 0);
        setCountriesVisited(profile.countriesVisited || 0);
        setCitiesVisited(profile.citiesVisited || 0);
      }

      // Load statistics separately to calculate from trips
      await loadUserStatistics(userName);
    } catch (error) {
      // GraphQL may throw with partial errors but still have valid data
      if (error?.data?.getUserProfile) {
        const profile = error.data.getUserProfile;
        // Resolve S3 key to signed URL if needed
        const resolvedPhotoUrl = await resolveProfilePhotoUrl(profile.profilePhotoUrl);
        setProfilePhotoUrl(resolvedPhotoUrl);
        setBio(profile.bio);
        setIsPrivate(profile.isPrivateAccount || false);
        setFollowersCount(profile.followersCount || 0);
        setFollowingCount(profile.followingCount || 0);
        setCountriesVisited(profile.countriesVisited || 0);
        setCitiesVisited(profile.citiesVisited || 0);
        // Still load statistics
        await loadUserStatistics(userName);
      } else {
        console.warn('[Feed] Error loading profile:', error);
      }
    }
  }, [loadUserStatistics]);

  const loadPendingRequestsCount = useCallback(async (userName) => {
    if (!userName) return;

    try {
      const response = await API.graphql({
        query: customQueries.getFollowRequests,
        variables: {
          targetUsername: userName,
          limit: 100,
        },
      });

      const requests = response.data?.getFollowRequests?.requests || [];
      setPendingRequestsCount(requests.length);
    } catch (error) {
      // Try to extract from partial error
      const requests = error?.data?.getFollowRequests?.requests || [];
      setPendingRequestsCount(requests.length);
    }
  }, []);

  const loadUserTrips = async (userID, retryCount = 0) => {
    const maxRetries = 2;

    try {
      // Only show loading spinner if we haven't loaded trips before
      if (!hasLoadedTrips) {
        setIsLoadingTrips(true);
      }
      setTripsError(null);

      const tripSummaries = await listUserTripsFromCloud(userID);
      const allTrips = tripSummaries || [];

      // Normalize trip photo references (same logic as profile.jsx)
      const normalizedTrips = allTrips.map(trip => {
        let photoRef = trip.tripPhotoReference;

        if (typeof photoRef === 'string') {
          if (photoRef.startsWith('[[') && photoRef.endsWith(']]')) {
            photoRef = photoRef.slice(1, -1);
          }

          if (photoRef.startsWith('[') && photoRef.endsWith(']')) {
            const content = photoRef.slice(1, -1);
            if (content.trim()) {
              photoRef = content.split(',').map(item => item.trim());
            } else {
              photoRef = [];
            }
          } else {
            try {
              const parsed = JSON.parse(photoRef);
              photoRef = Array.isArray(parsed) ? parsed : [photoRef];
            } catch (e) {
              photoRef = [photoRef];
            }
          }
        } else if (!Array.isArray(photoRef)) {
          photoRef = photoRef ? [photoRef] : [];
        }

        const photoObjects = (photoRef || []).map(ref => {
          if (!ref) return null;

          if (typeof ref === 'object') {
            return {
              photo_reference: ref.photo_reference || ref.photoRef || null,
              place_id: ref.place_id || null,
            };
          }

          if (typeof ref === 'string') {
            const trimmed = ref.trim();

            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try {
                const parsed = JSON.parse(trimmed);
                return {
                  photo_reference: parsed.photo_reference || parsed.photoRef || null,
                  place_id: parsed.place_id || null,
                };
              } catch (e) {}
            }

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

      const sortedTrips = normalizedTrips.sort((a, b) => {
        const dateA = new Date(a.startDate || a.createdAt || 0);
        const dateB = new Date(b.startDate || b.createdAt || 0);
        return dateB - dateA;
      });

      const owned = sortedTrips.filter(trip => trip.userRole === 'owner');
      const shared = sortedTrips.filter(trip => trip.userRole === 'editor' || trip.userRole === 'viewer');

      setUserTrips(sortedTrips);
      setOwnedTrips(owned);
      setSharedTrips(shared);
      setHasLoadedTrips(true);
      setIsLoadingTrips(false);
    } catch (error) {
      // Try to extract partial data if available
      if (error?.data?.getTripIDs) {
        const allTrips = error.data.getTripIDs || [];
        const owned = allTrips.filter(trip => trip.userRole === 'owner');
        const shared = allTrips.filter(trip => trip.userRole === 'editor' || trip.userRole === 'viewer');
        setUserTrips(allTrips);
        setOwnedTrips(owned);
        setSharedTrips(shared);
        setIsLoadingTrips(false);
      } else if (retryCount < maxRetries) {
        // Retry after a short delay
        console.log(`[Feed] Retrying trip load (attempt ${retryCount + 2}/${maxRetries + 1})...`);
        setTimeout(() => {
          loadUserTrips(userID, retryCount + 1);
        }, 1000 * (retryCount + 1)); // 1s, 2s delay
        // Keep loading state true during retry
      } else {
        // Only log if we couldn't recover any data after all retries
        console.log('[Feed] Error loading trips after retries:', error?.message || 'Unknown error');
        setTripsError('Failed to load trips. Pull down to refresh.');
        setIsLoadingTrips(false);
      }
    }
  };

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isLoadingFeed || !username) return;

    setIsLoadingFeed(true);

    try {
      const response = await API.graphql({
        query: customQueries.getFeed,
        variables: {
          username: username,
          nextToken: isRefresh ? null : nextToken,
          limit: 10,
        },
      });

      const { trips: newTrips, nextToken: newNextToken } = response.data.getFeed;

      if (isRefresh) {
        setFeedTrips(newTrips);
      } else {
        setFeedTrips((prev) => [...prev, ...newTrips]);
      }

      setNextToken(newNextToken);
      setHasMore(!!newNextToken);
    } catch (error) {
      console.error('[Feed] Error loading feed:', error);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [isLoadingFeed, nextToken, username]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useFocusEffect(
    useCallback(() => {
      setCarouselIndices({});
      setTripPhotoCounts({});
      loadUserData();
      // Refresh pending requests count when screen focuses
      if (username) {
        loadPendingRequestsCount(username);
      }
    }, [username, loadPendingRequestsCount])
  );

  // Load pending follow requests count when username is available
  useEffect(() => {
    if (username) {
      loadPendingRequestsCount(username);
    }
  }, [username, loadPendingRequestsCount]);

  // Auto-load trip from notification
  useEffect(() => {
    const autoLoadTripFromNotification = async () => {
      if (hasAutoLoadedRef.current) return;

      const { autoLoadTripId, fromNotification } = params;

      if (autoLoadTripId && fromNotification === 'true' && currentUserID) {
        hasAutoLoadedRef.current = true;

        try {
          await handleLoadTrip(autoLoadTripId);
        } catch (error) {
          console.error('[Feed] Error auto-loading trip:', error);
          Alert.alert('Error', 'Failed to load the trip you were invited to.');
        }
      }
    };

    autoLoadTripFromNotification();
  }, [params, currentUserID]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCarouselIndices({});
    setTripPhotoCounts({});
    await loadUserData();
    if (username) {
      await loadFeed(true);
      loadPendingRequestsCount(username);
    }
    setRefreshing(false);
  }, [loadUserData, username, loadPendingRequestsCount]);

  const handleLoadTrip = async (tripId) => {
    try {
      setIsLoadingTrip(true);
      const user = await Auth.currentAuthenticatedUser();
      const userID = user.username;

      const tripDetails = await retrieveTripFromCloud(userID, tripId);

      if (tripDetails) {
        restoreTripFromObject(tripDetails, userID);
        setSelectedCity(tripDetails.selectedCity);
        router.push('/trip-view/trip-view_main');
      }
    } catch (error) {
      console.error('[Feed] Error loading trip:', error);
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

      Alert.alert(
        'Delete Trip',
        'Are you sure you want to delete this trip? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                setMenuVisible(null);
                setDeletingTripId(tripId);

                await API.graphql({
                  query: deleteTrip,
                  variables: { userID, tripID: tripId }
                });

                await loadUserTrips(userID);
              } catch (error) {
                console.error('[Feed] Error deleting trip:', error);
                Alert.alert('Error', 'Failed to delete trip. Please try again.');
              } finally {
                setDeletingTripId(null);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('[Feed] Error getting user info:', error);
      Alert.alert('Error', 'Failed to get user information');
    }
  };

  // Toggle trip visibility on profile
  const handleToggleVisibility = async (tripId) => {
    try {
      const currentTrip = userTrips.find(trip => trip.tripId === tripId);
      if (!currentTrip) {
        console.error('[Feed] Trip not found:', tripId);
        return;
      }

      const newIsPublic = !currentTrip.isPublic;
      setTogglingVisibilityTripId(tripId);
      console.log('[Feed] Toggling trip visibility:', { tripId, from: currentTrip.isPublic, to: newIsPublic });

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

      console.log('[Feed] Trip visibility updated successfully');

      // Update local state immediately for responsive UI
      setUserTrips(prevTrips =>
        prevTrips.map(trip =>
          trip.tripId === tripId ? { ...trip, isPublic: newIsPublic } : trip
        )
      );

    } catch (error) {
      console.error('[Feed] Error toggling trip visibility:', error);
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
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setLeavingTripId(tripId);

              const fullTripData = await retrieveTripFromCloud(currentUserID, tripId);
              const collaborators = fullTripData?.collaborators || [];

              const currentCollaborator = collaborators.find(
                (c) => c.userID === currentUserID
              );

              const collaboratorUsername = currentCollaborator?.username || username;

              if (!collaboratorUsername) {
                Alert.alert('Error', 'Unable to determine your collaborator entry for this trip.');
                setLeavingTripId(null);
                return;
              }

              await API.graphql({
                query: removeCollaborator,
                variables: { tripId, username: collaboratorUsername },
              });

              if (currentUserID) {
                await loadUserTrips(currentUserID);
              }
            } catch (error) {
              console.error('[Feed] Error leaving trip:', error);
              Alert.alert('Error', 'Failed to leave trip. Please try again.');
            } finally {
              setLeavingTripId(null);
            }
          }
        }
      ]
    );
  };

  const handleInviteCollaborators = async (tripId) => {
    try {
      setIsLoadingTripData(true);
      setMenuVisible(null);

      const user = await Auth.currentAuthenticatedUser();
      const userID = user.username;

      const fullTripData = await retrieveTripFromCloud(userID, tripId);

      if (fullTripData) {
        setSelectedTripForSharing(fullTripData);
        setIsShareModalVisible(true);
      } else {
        Alert.alert('Error', 'Failed to load trip data. Please try again.');
      }
    } catch (error) {
      console.error('[Feed] Error loading trip for sharing:', error);
      Alert.alert('Error', 'Failed to load trip data. Please try again.');
    } finally {
      setIsLoadingTripData(false);
    }
  };

  const handleCollaboratorsUpdate = (updatedCollaborators) => {
    setSelectedTripForSharing(prevTrip =>
      prevTrip ? { ...prevTrip, collaborators: updatedCollaborators } : null
    );

    setUserTrips(prevTrips =>
      prevTrips.map(trip =>
        trip.tripId === selectedTripForSharing?.tripId
          ? { ...trip, collaborators: updatedCollaborators }
          : trip
      )
    );
  };

  const handleTripCarouselPhotoUpdate = (tripId, photoIndex, newPhotoRef) => {
    const updatePhotos = (trips) =>
      trips.map(trip => {
        if (trip.tripId !== tripId || !Array.isArray(trip.tripPhotoReference)) {
          return trip;
        }

        let updatedPhotos;

        if (newPhotoRef === null) {
          updatedPhotos = trip.tripPhotoReference.filter((_, idx) => idx !== photoIndex);
        } else {
          updatedPhotos = trip.tripPhotoReference.map((ref, idx) => {
            if (idx !== photoIndex || !ref) return ref;

            if (typeof ref === 'object') {
              return { ...ref, photo_reference: newPhotoRef };
            }

            return { photo_reference: newPhotoRef, place_id: null };
          });
        }

        return { ...trip, tripPhotoReference: updatedPhotos };
      });

    setUserTrips(prev => updatePhotos(prev));
    setOwnedTrips(prev => updatePhotos(prev));
    setSharedTrips(prev => updatePhotos(prev));
  };

  const loadFollowersList = useCallback(async () => {
    if (!username) return;
    setIsLoadingFollowers(true);
    try {
      const response = await API.graphql({
        query: customQueries.getFollowers,
        variables: { username, limit: 50 },
      });
      const { followers } = response.data.getFollowers;
      // Deduplicate by username
      const uniqueFollowers = followers.filter((user, index, self) =>
        index === self.findIndex((u) => u.username === user.username)
      );
      // Resolve S3 keys to signed URLs for profile photos
      const followersWithResolvedPhotos = await Promise.all(
        uniqueFollowers.map(async (user) => ({
          ...user,
          profilePhotoUrl: await resolveProfilePhotoUrl(user.profilePhotoUrl)
        }))
      );
      setFollowersList(followersWithResolvedPhotos);
    } catch (error) {
      if (error?.data?.getFollowers?.followers) {
        const followers = error.data.getFollowers.followers.filter((user, index, self) =>
          index === self.findIndex((u) => u.username === user.username)
        );
        // Resolve S3 keys to signed URLs for profile photos
        const followersWithResolvedPhotos = await Promise.all(
          followers.map(async (user) => ({
            ...user,
            profilePhotoUrl: await resolveProfilePhotoUrl(user.profilePhotoUrl)
          }))
        );
        setFollowersList(followersWithResolvedPhotos);
      } else {
        console.warn('[Feed] Error loading followers:', error);
      }
    } finally {
      setIsLoadingFollowers(false);
    }
  }, [username]);

  const loadFollowingList = useCallback(async () => {
    if (!username) return;
    setIsLoadingFollowing(true);
    try {
      const response = await API.graphql({
        query: customQueries.getFollowing,
        variables: { username, limit: 50 },
      });
      const { following } = response.data.getFollowing;
      // Deduplicate by username
      const uniqueFollowing = following.filter((user, index, self) =>
        index === self.findIndex((u) => u.username === user.username)
      );
      // Resolve S3 keys to signed URLs for profile photos
      const followingWithResolvedPhotos = await Promise.all(
        uniqueFollowing.map(async (user) => ({
          ...user,
          profilePhotoUrl: await resolveProfilePhotoUrl(user.profilePhotoUrl)
        }))
      );
      setFollowingList(followingWithResolvedPhotos);
      // Clear pending requests for users that are now following
      const followingUsernames = new Set(followingWithResolvedPhotos.map(u => u.username));
      setPendingFollowRequests(prev => {
        const newSet = new Set(prev);
        followingUsernames.forEach(u => newSet.delete(u));
        return newSet;
      });
    } catch (error) {
      if (error?.data?.getFollowing?.following) {
        const following = error.data.getFollowing.following.filter((user, index, self) =>
          index === self.findIndex((u) => u.username === user.username)
        );
        // Resolve S3 keys to signed URLs for profile photos
        const followingWithResolvedPhotos = await Promise.all(
          following.map(async (user) => ({
            ...user,
            profilePhotoUrl: await resolveProfilePhotoUrl(user.profilePhotoUrl)
          }))
        );
        setFollowingList(followingWithResolvedPhotos);
      } else {
        console.warn('[Feed] Error loading following:', error);
      }
    } finally {
      setIsLoadingFollowing(false);
    }
  }, [username]);

  const handleFollowersPress = () => {
    setProfileModalView('followers');
    loadFollowersList();
    // Always load following list to know who we're following (in case requests were accepted)
    loadFollowingList();
  };

  const handleFollowingPress = () => {
    setProfileModalView('following');
    loadFollowingList();
  };

  const handleBackToProfile = () => {
    setProfileModalView('profile');
  };

  const handleFollowerUserPress = (targetUsername) => {
    if (targetUsername === username) {
      // If clicking on own profile, just go back to profile view
      setProfileModalView('profile');
    } else {
      // Navigate to other user's profile
      setIsProfileModalVisible(false);
      setProfileModalView('profile');
      router.push(`/profile/${targetUsername}`);
    }
  };

  const handleUnfollowFromList = async (targetUsername) => {
    Alert.alert(
      'Unfollow',
      `Are you sure you want to unfollow @${targetUsername}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.graphql({
                query: customMutations.unfollowUser,
                variables: {
                  followerUsername: username,
                  targetUsername: targetUsername,
                },
              });
              // Remove from following list
              setFollowingList(prev => prev.filter(u => u.username !== targetUsername));
              // Update following count
              setFollowingCount(prev => Math.max(0, prev - 1));
            } catch (error) {
              console.error('[Feed] Error unfollowing:', error);
              Alert.alert('Error', 'Failed to unfollow user');
            }
          },
        },
      ]
    );
  };

  const handleFollowFromFollowersList = async (targetUsername, isCurrentlyFollowing, hasPendingRequest) => {
    if (isCurrentlyFollowing) {
      // Show confirmation before unfollowing
      Alert.alert(
        'Unfollow',
        `Are you sure you want to unfollow @${targetUsername}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Unfollow',
            style: 'destructive',
            onPress: async () => {
              try {
                await API.graphql({
                  query: customMutations.unfollowUser,
                  variables: {
                    followerUsername: username,
                    targetUsername: targetUsername,
                  },
                });
                // Remove from following list
                setFollowingList(prev => prev.filter(u => u.username !== targetUsername));
                setFollowingCount(prev => Math.max(0, prev - 1));
              } catch (error) {
                console.error('[Feed] Error unfollowing:', error);
                Alert.alert('Error', 'Failed to unfollow user');
              }
            },
          },
        ]
      );
    } else if (hasPendingRequest) {
      // Cancel pending request - no confirmation needed
      try {
        await API.graphql({
          query: customMutations.unfollowUser,
          variables: {
            followerUsername: username,
            targetUsername: targetUsername,
          },
        });
        // Remove from pending requests
        setPendingFollowRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUsername);
          return newSet;
        });
      } catch (error) {
        console.error('[Feed] Error canceling request:', error);
        Alert.alert('Error', 'Failed to cancel request');
      }
    } else {
      // Follow - no confirmation needed
      try {
        const response = await API.graphql({
          query: customMutations.followUser,
          variables: {
            followerUsername: username,
            targetUsername: targetUsername,
          },
        });

        const { status } = response.data.followUser;
        console.log('[Feed] Follow response status:', status);

        // Check if actually following (public account) or just requested (private account)
        if (status === 'following') {
          // Only add to following list if actually following
          const userToFollow = followersList.find(u => u.username === targetUsername);
          if (userToFollow) {
            setFollowingList(prev => {
              if (prev.some(u => u.username === targetUsername)) {
                return prev;
              }
              return [...prev, userToFollow];
            });
          }
          setFollowingCount(prev => prev + 1);
          // Remove from pending if it was there
          setPendingFollowRequests(prev => {
            const newSet = new Set(prev);
            newSet.delete(targetUsername);
            return newSet;
          });
        } else if (status === 'pending' || status === 'requested' || status === 'already_requested') {
          // Add to pending requests set
          setPendingFollowRequests(prev => new Set(prev).add(targetUsername));
        }
      } catch (error) {
        console.error('[Feed] Error following:', error);
        Alert.alert('Error', 'Failed to follow user');
      }
    }
  };

  const handleEditProfile = () => {
    console.log('[Feed] handleEditProfile called');
    setEditFullName(fullName);
    setEditBio(bio || '');
    setProfileModalView('edit');
  };

  const handleSaveProfile = async () => {
    if (!editFullName.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }

    setIsSavingProfile(true);
    try {
      // Update Cognito user attributes
      const user = await Auth.currentAuthenticatedUser();
      await Auth.updateUserAttributes(user, {
        name: editFullName.trim(),
      });

      // Update fullName, bio, and profile photo in UserProfilesStorage
      await API.graphql({
        query: customMutations.updateUserProfile,
        variables: {
          username: username,
          action: 'UPDATE_PROFILE_INFO',
          tripData: JSON.stringify({
            fullName: editFullName.trim() || null,
            bio: editBio.trim() || null,
            profilePhotoUrl: profilePhotoUrl || null,
          }),
        },
      });

      // Update local state
      setFullName(editFullName.trim());
      setBio(editBio.trim() || null);

      setProfileModalView('profile');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePrivacyToggle = async (newPrivacyValue) => {
    try {
      await API.graphql({
        query: customMutations.updateUserPrivacy,
        variables: { username: username, isPrivate: newPrivacyValue },
      });
      setIsPrivate(newPrivacyValue);
      Alert.alert(
        'Privacy Updated',
        newPrivacyValue
          ? 'Your account is now private. New followers will need your approval.'
          : 'Your account is now public. Anyone can follow you and view your trips.'
      );
    } catch (error) {
      console.error('[Feed] Error updating privacy:', error);
      Alert.alert('Error', 'Failed to update privacy settings. Please try again.');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await Auth.signOut({ global: false });
              clearAuthData();
              setFullName('');
              setUsername('');
              setUserTrips([]);
              router.replace('/');
            } catch (error) {
              console.error('[Feed] Error signing out:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
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
      console.error('[Feed] Error opening link:', error);
      Alert.alert('Error', 'Failed to open link');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const userID = user.username;

      setIsDeleteAccountModalVisible(false);
      setDeleteAccountChecked(false);

      router.push('/authorization/deleting-account');

      try {
        const deletionResult = await deleteUserAccountFromCloud(userID);

        if (deletionResult.success) {
          await Auth.signOut({ global: false });
          clearAuthData();
          setFullName('');
          setUsername('');
          setUserTrips([]);
          setOwnedTrips([]);
          setSharedTrips([]);
          router.replace('/?deleted=1');
        } else {
          throw new Error(deletionResult.message || 'Account deletion failed');
        }
      } catch (deletionError) {
        console.error('[Feed] Account deletion failed:', deletionError);
        setIsDeleteAccountModalVisible(true);
        setDeleteAccountChecked(true);
        router.back();
      }
    } catch (error) {
      console.error('[Feed] Error in delete account handler:', error);
      setIsDeleteAccountModalVisible(false);
      setDeleteAccountChecked(false);
    }
  };

  const settingsPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > 5 && gestureState.dy > 0;
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 50) {
        setIsSettingsModalVisible(false);
      }
    },
  });

  const handleFeedTripPress = useCallback((tripId) => {
    router.push(`/trip-view/trip-view_main?tripId=${tripId}`);
  }, [router]);

  const handleFeedProfilePress = useCallback((username) => {
    router.push(`/profile/${username}`);
  }, [router]);

  const handleLoadMoreFeed = useCallback(() => {
    if (hasMore && !isLoadingFeed) {
      loadFeed(false);
    }
  }, [hasMore, isLoadingFeed, loadFeed]);

  const renderTripCard = (trip, keyPrefix = '') => {
    // Get formatted date range
    const getDateRange = () => {
      const referenceDate = trip.startDate ? new Date(trip.startDate) : null;
      if (referenceDate && trip.endDate) {
        const endDate = new Date(trip.endDate);
        const sameMonth = referenceDate.getMonth() === endDate.getMonth() &&
                          referenceDate.getFullYear() === endDate.getFullYear();
        if (sameMonth) {
          return `${referenceDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.getDate()}`;
        }
        return `${referenceDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      }
      if (referenceDate) {
        return referenceDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return null;
    };

    const dateRange = getDateRange();
    const cityName = trip.selectedCity?.split(',')[0] || '';
    const tripName = trip.tripTitle || cityName || 'Untitled Trip';

    return (
      <TouchableOpacity
        key={`${keyPrefix}${trip.tripId}`}
        style={[
          styles.tripCard,
          selectedTripId === trip.tripId && isLoadingTrip && styles.tripCardLoading
        ]}
        onPress={() => {
          setSelectedTripId(trip.tripId);
          handleLoadTrip(trip.tripId);
        }}
        disabled={isLoadingTrip || deletingTripId === trip.tripId}
        activeOpacity={0.95}
      >
        {/* Full-bleed Image */}
        {trip.selectedCity ? (
          <View style={styles.tripCardImageContainer}>
            <Carousel
              loop={false}
              width={screenWidth - 48}
              height={240}
              data={trip.tripPhotoReference && trip.tripPhotoReference.length > 0
                ? trip.tripPhotoReference
                : [{}, {}, {}, {}, {}]}
              scrollAnimationDuration={300}
              defaultIndex={0}
              onSnapToItem={(index) =>
                setCarouselIndices(prev => ({ ...prev, [`${keyPrefix}${trip.tripId}`]: index }))
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
                    setTripPhotoCounts(prev => ({ ...prev, [`${keyPrefix}${trip.tripId}`]: count }))
                  }
                />
              )}
            />
          </View>
        ) : (
          <Image
            source={require('../../assets/images/default_trip.jpg')}
            style={styles.tripCardImage}
            resizeMode="cover"
          />
        )}

        {/* Menu Button - Top Right */}
        <TouchableOpacity
          style={styles.tripCardMenuButton}
          onPress={(e) => {
            e.stopPropagation();
            setMenuVisible(trip.tripId);
          }}
          hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
          disabled={isLoadingTrip || deletingTripId === trip.tripId}
        >
          {selectedTripId === trip.tripId && isLoadingTrip ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="ellipsis-horizontal" size={16} color="#fff" />
          )}
        </TouchableOpacity>

        {/* Pagination Dots - Top Center */}
        {(() => {
          const photoCount = tripPhotoCounts[`${keyPrefix}${trip.tripId}`] || 5;
          if (trip.tripPhotoReference?.length === 1 || photoCount === 1) {
            return null;
          }
          return (
            <View style={styles.tripCardPaginationDots}>
              {Array.from({ length: photoCount }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.tripCardDot,
                    (carouselIndices[`${keyPrefix}${trip.tripId}`] || 0) === index && styles.tripCardDotActive
                  ]}
                />
              ))}
            </View>
          );
        })()}

        {/* Info Overlay - Bottom */}
        <View style={styles.tripCardOverlay}>
          <View style={styles.tripCardTextContainer}>
            <Text style={styles.tripCardTitle} numberOfLines={1}>{tripName}</Text>
            {dateRange && (
              <Text style={styles.tripCardDate}>{dateRange}</Text>
            )}
          </View>
          <View style={styles.tripCardArrowButton}>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{ transform: [{ rotate: '-45deg' }] }} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = fullName?.split(' ')[0] || username?.split(' ')[0] || '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.profileIconButton}
            onPress={() => setIsProfileModalVisible(true)}
          >
            <InitialsAvatar
              name={fullName || username}
              profilePhotoUrl={profilePhotoUrl}
              size={48}
            />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.headerName} numberOfLines={1}>{firstName || 'Traveler'}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.push('/(tabs)/explore')}
          >
            <Ionicons name="search" size={22} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.push('/profile/follow-requests')}
          >
            <Ionicons name="people" size={22} color="#1a1a1a" />
            {pendingRequestsCount > 0 && (
              <View style={styles.notificationDot} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F36406"
            colors={['#F36406']}
          />
        }
      >
        {/* My Trips Section */}
        {(isLoadingTrips || !hasLoadedTrips) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F36406" />
            <Text style={styles.loadingText}>Loading your trips...</Text>
          </View>
        ) : (
          <>
            {ownedTrips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>My Trips</Text>
                  <Text style={styles.tripCount}>{ownedTrips.length}</Text>
                </View>
                {ownedTrips.map(trip => renderTripCard(trip, 'owned-'))}
              </View>
            )}

            {sharedTrips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Shared With Me</Text>
                  <Text style={styles.tripCount}>{sharedTrips.length}</Text>
                </View>
                {sharedTrips.map(trip => renderTripCard(trip, 'shared-'))}
              </View>
            )}

            {hasLoadedTrips && ownedTrips.length === 0 && sharedTrips.length === 0 && (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons name="airplane" size={48} color="#F36406" />
                </View>
                <Text style={styles.emptyStateTitle}>No trips yet</Text>
                <Text style={styles.emptyStateSubtitle}>Start planning your next adventure</Text>
                <TouchableOpacity
                  style={styles.emptyStateCta}
                  onPress={() => router.push('/(tabs)/create_new_trip')}
                >
                  <Text style={styles.emptyStateCtaText}>Create Trip</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* Bottom spacing for floating tab bar */}
            <View style={{ height: 100 }} />
          </>
        )}

      </ScrollView>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMenuVisible(null)}
      >
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={styles.menuOverlayTap}
            activeOpacity={1}
            onPress={() => setMenuVisible(null)}
          />
          <View style={[styles.menuSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            {/* Handle */}
            <View style={styles.menuHandle} />

            {/* Menu Items */}
            <View style={styles.menuOptionsContainer}>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => handleInviteCollaborators(menuVisible)}
                disabled={isLoadingTripData}
              >
                <View style={styles.menuOptionIcon}>
                  <Ionicons name="people" size={22} color="#1a1a1a" />
                </View>
                <Text style={styles.menuOptionText}>
                  {isLoadingTripData ? 'Loading...' : 'Share Trip'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
              </TouchableOpacity>

              {/* Visible on Profile Toggle - only for owners */}
              {(() => {
                const currentTrip = userTrips.find(trip => trip.tripId === menuVisible);
                if (currentTrip?.userRole !== 'owner') return null;

                const isToggling = togglingVisibilityTripId === menuVisible;
                const isCurrentlyPublic = currentTrip.isPublic === true;

                return (
                  <View style={styles.menuOptionToggle}>
                    <View style={styles.menuOptionLeft}>
                      <View style={styles.menuOptionIcon}>
                        <Ionicons name={isCurrentlyPublic ? "eye" : "eye-off"} size={22} color="#1a1a1a" />
                      </View>
                      <Text style={styles.menuOptionText}>Show on Profile</Text>
                    </View>
                    {isToggling ? (
                      <ActivityIndicator size="small" color="#F36406" />
                    ) : (
                      <Switch
                        value={isCurrentlyPublic}
                        onValueChange={() => handleToggleVisibility(menuVisible)}
                        trackColor={{ false: '#E5E5EA', true: '#F36406' }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#E5E5EA"
                      />
                    )}
                  </View>
                );
              })()}

              {(() => {
                const currentTrip = userTrips.find(trip => trip.tripId === menuVisible);
                const canLeave = currentTrip && currentTrip.userRole && currentTrip.userRole !== 'owner';
                if (!canLeave) return null;

                return (
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => {
                      setMenuVisible(null);
                      handleLeaveTrip(currentTrip.tripId);
                    }}
                    disabled={leavingTripId === currentTrip.tripId}
                  >
                    <View style={[styles.menuOptionIcon, styles.menuOptionIconDanger]}>
                      <Ionicons name="exit" size={22} color="#FF3B30" />
                    </View>
                    <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>
                      {leavingTripId === currentTrip.tripId ? 'Leaving...' : 'Leave Trip'}
                    </Text>
                  </TouchableOpacity>
                );
              })()}

              {(() => {
                const currentTrip = userTrips.find(trip => trip.tripId === menuVisible);
                return currentTrip?.userRole === 'owner' ? (
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => {
                      setMenuVisible(null);
                      handleDeleteTrip(menuVisible);
                    }}
                    disabled={deletingTripId === menuVisible}
                  >
                    <View style={[styles.menuOptionIcon, styles.menuOptionIconDanger]}>
                      <Ionicons name="trash" size={22} color="#FF3B30" />
                    </View>
                    <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>
                      {deletingTripId === menuVisible ? 'Deleting...' : 'Delete Trip'}
                    </Text>
                  </TouchableOpacity>
                ) : null;
              })()}
            </View>
          </View>
        </View>
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
            onPress={() => {}}
          >
            <View style={styles.settingsModalHandleContainer} {...settingsPanResponder.panHandlers}>
              <View style={styles.settingsModalHandle} />
            </View>

            <View style={styles.modalHeader}>
              <Text style={styles.settingsModalTitle}>Settings</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsSettingsModalVisible(false)}
              >
                <Ionicons name="close" size={32} color={Colors.GRAY} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.settingsScrollView}
              contentContainerStyle={styles.settingsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.settingsMenuItem}>
                <Ionicons name="eye-off-outline" size={24} color={Colors.PRIMARY} />
                <View style={styles.settingsMenuItemTextContainer}>
                  <Text style={styles.settingsMenuItemTextTitle}>Private Account</Text>
                  <Text style={styles.settingsMenuItemSubtext}>
                    Require approval for new followers
                  </Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={handlePrivacyToggle}
                  trackColor={{ false: Colors.LIGHT_GRAY, true: Colors.ORANGE_LIGHT }}
                  thumbColor={isPrivate ? Colors.ORANGE : Colors.WHITE}
                  ios_backgroundColor={Colors.LIGHT_GRAY}
                />
              </View>

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
                              query: customMutations.updateUserProfile,
                              variables: {
                                username: prefUsername,
                                action: 'UPDATE_ADMIN_PERMISSION',
                                tripData: JSON.stringify({ admin_permission: true }),
                              },
                            });
                            Alert.alert('Success', 'Admin permission granted.');
                          } catch (error) {
                            console.error('[Feed] Error setting admin permission:', error);
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
                <Ionicons name="key-outline" size={24} color={Colors.PRIMARY} />
                <Text style={styles.settingsMenuItemText}>Apply as Admin</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.GRAY} />
              </TouchableOpacity>

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
            onPress={() => {}}
          >
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

            <ScrollView style={styles.deleteAccountContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.deleteAccountWarningText}>
                Deleting your account will permanently remove your information, trip plans, and other documents associated with your account. This information cannot be restored.
              </Text>

              <Text style={styles.deleteAccountConfirmText}>
                Are you sure you want to delete your account?
              </Text>

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

      {/* Profile Modal */}
      <Modal
        visible={isProfileModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (profileModalView !== 'profile') {
            handleBackToProfile();
          } else {
            setIsProfileModalVisible(false);
          }
        }}
      >
        <View style={styles.profileModalContainer}>
          {/* Header */}
          <View style={styles.profileModalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                if (profileModalView !== 'profile') {
                  setProfileModalView('profile');
                } else {
                  setIsProfileModalVisible(false);
                }
              }}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={Colors.BLACK}
              />
            </TouchableOpacity>
            <Text style={styles.profileModalTitle}>
              {profileModalView === 'followers' ? 'Followers' :
               profileModalView === 'following' ? 'Following' :
               profileModalView === 'edit' ? 'Edit Profile' :
               username ? `@${username}` : 'Profile'}
            </Text>
            {profileModalView === 'edit' ? (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color={Colors.ORANGE} />
                ) : (
                  <Text style={{ color: Colors.ORANGE, fontSize: 16, fontFamily: 'outfit-medium' }}>Save</Text>
                )}
              </TouchableOpacity>
            ) : profileModalView === 'profile' ? (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => {
                  setIsProfileModalVisible(false);
                  setIsSettingsModalVisible(true);
                }}
              >
                <Ionicons name="settings-outline" size={24} color={Colors.GRAY} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* Profile Content - Instagram Style */}
          {profileModalView === 'profile' && (
          <ScrollView
            style={styles.profileModalScrollView}
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
            {username && (
              <View style={styles.profileSection}>
                {/* Top Row: Photo + Stats */}
                <View style={styles.profileTopRow}>
                  {/* Profile Photo */}
                  <TouchableOpacity
                    style={styles.profilePhotoContainer}
                    onPress={handleChangeProfilePhoto}
                    disabled={isUploadingPhoto}
                  >
                    <InitialsAvatar
                      name={fullName || username}
                      profilePhotoUrl={profilePhotoUrl}
                      size={80}
                    />
                    {isUploadingPhoto ? (
                      <View style={styles.profilePhotoUploadingOverlay}>
                        <ActivityIndicator size="small" color={Colors.WHITE} />
                      </View>
                    ) : (
                      <View style={styles.profilePhotoCameraIcon}>
                        <Ionicons name="camera" size={14} color={Colors.WHITE} />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Stats Row */}
                  <View style={styles.profileStatsRow}>
                    <View style={styles.profileStatItem}>
                      <Text style={styles.profileStatNumber}>{ownedTrips.length + sharedTrips.length}</Text>
                      <Text style={styles.profileStatLabel}>Trips</Text>
                    </View>
                    <TouchableOpacity style={styles.profileStatItem} onPress={handleFollowersPress}>
                      <Text style={styles.profileStatNumber}>{followersCount}</Text>
                      <Text style={styles.profileStatLabel}>Followers</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.profileStatItem} onPress={handleFollowingPress}>
                      <Text style={styles.profileStatNumber}>{followingCount}</Text>
                      <Text style={styles.profileStatLabel}>Following</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Name and Username */}
                <View style={styles.profileNameSection}>
                  <Text style={styles.profileFullName}>{fullName}</Text>
                  <View style={styles.profileUsernameRow}>
                    <Text style={styles.profileUsernameText}>@{username}</Text>
                    {isPrivate && (
                      <View style={styles.profilePrivateBadge}>
                        <Ionicons name="lock-closed" size={12} color="#6B7280" />
                        <Text style={styles.profilePrivateText}>Private</Text>
                      </View>
                    )}
                  </View>
                  {bio && (
                    <Text style={styles.profileBioText}>{bio}</Text>
                  )}
                </View>

                {/* Travel Stats - Compact */}
                <View style={styles.profileTravelStatsRow}>
                  <View style={styles.profileTravelStatItem}>
                    <Ionicons name="earth-outline" size={16} color={Colors.ORANGE} />
                    <Text style={styles.profileTravelStatText}>{userTrips.length > 0 ? calculatedCountries : countriesVisited} Countries</Text>
                  </View>
                  <View style={styles.profileTravelStatDot} />
                  <View style={styles.profileTravelStatItem}>
                    <Ionicons name="location-outline" size={16} color={Colors.ORANGE} />
                    <Text style={styles.profileTravelStatText}>{userTrips.length > 0 ? calculatedCities : citiesVisited} Cities</Text>
                  </View>
                </View>

                {/* Edit Profile Button */}
                <TouchableOpacity
                  style={styles.editProfileButton}
                  onPress={handleEditProfile}
                >
                  <Text style={styles.editProfileButtonText}>Edit Profile</Text>
                </TouchableOpacity>

                {/* Trips Section */}
                <View style={styles.profileTripsSection}>
                  {/* Tab Selector */}
                  <View style={styles.profileTabContainer}>
                    <TouchableOpacity
                      style={[
                        styles.profileTab,
                        profileActiveTab === 'upcoming' && styles.profileActiveTab,
                      ]}
                      onPress={() => setProfileActiveTab('upcoming')}
                    >
                      <Text style={[
                        styles.profileTabText,
                        profileActiveTab === 'upcoming' && styles.profileActiveTabText,
                      ]}>
                        Upcoming Trips
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.profileTab,
                        profileActiveTab === 'past' && styles.profileActiveTab,
                      ]}
                      onPress={() => setProfileActiveTab('past')}
                    >
                      <Text style={[
                        styles.profileTabText,
                        profileActiveTab === 'past' && styles.profileActiveTabText,
                      ]}>
                        Past Trips
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isLoadingTrips ? (
                    <View style={styles.profileLoadingTripsContainer}>
                      <ActivityIndicator size="large" color={Colors.ORANGE} />
                    </View>
                  ) : profileDisplayedTrips.length === 0 ? (
                    <View style={styles.profileEmptyTripsContainer}>
                      <Ionicons
                        name={profileActiveTab === 'upcoming' ? "airplane-outline" : "time-outline"}
                        size={48}
                        color={Colors.GRAY}
                      />
                      <Text style={styles.profileEmptyTripsText}>
                        {profileActiveTab === 'upcoming' ? 'No upcoming trips' : 'No past trips'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.profileTripsGrid}>
                      {profileDisplayedTrips.map((trip) => {
                        const photoReferences = Array.isArray(trip.tripPhotoReference)
                          ? trip.tripPhotoReference
                          : trip.tripPhotoReference
                          ? [trip.tripPhotoReference]
                          : [];

                        const hasPhotos = photoReferences.length > 0;
                        const photoCount = hasPhotos ? photoReferences.length : (profileTripPhotoCounts[trip.tripId] || 5);
                        const currentIndex = profileCarouselIndices[trip.tripId] || 0;
                        const displayTitle = trip.tripTitle || trip.selectedCity || 'Untitled Trip';

                        // Format date display
                        let dateDisplay = '';
                        if (trip.startDate && trip.endDate) {
                          const startDate = new Date(trip.startDate);
                          const endDate = new Date(trip.endDate);
                          const sameMonth = startDate.getMonth() === endDate.getMonth() &&
                                            startDate.getFullYear() === endDate.getFullYear();

                          if (sameMonth) {
                            const startFormatted = startDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            });
                            const endDay = endDate.getDate();
                            dateDisplay = `${startFormatted} - ${endDay}`;
                          } else {
                            const startFormatted = startDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            });
                            const endFormatted = endDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            });
                            dateDisplay = `${startFormatted} - ${endFormatted}`;
                          }
                        } else if (trip.startDate) {
                          dateDisplay = new Date(trip.startDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          });
                        }

                        return (
                          <TouchableOpacity
                            key={trip.tripId}
                            style={styles.profileTripCard}
                            onPress={() => {
                              setIsProfileModalVisible(false);
                              setSelectedTripId(trip.tripId);
                              handleLoadTrip(trip.tripId);
                            }}
                            activeOpacity={0.8}
                          >
                            {/* Trip Photo Carousel */}
                            <View style={styles.profileCardCarouselContainer}>
                              <Carousel
                                loop={false}
                                width={PROFILE_CARD_WIDTH}
                                height={PROFILE_CARD_IMAGE_HEIGHT}
                                data={hasPhotos ? photoReferences : [{}, {}, {}, {}, {}]}
                                scrollAnimationDuration={300}
                                onSnapToItem={(index) =>
                                  setProfileCarouselIndices((prev) => ({
                                    ...prev,
                                    [trip.tripId]: index,
                                  }))
                                }
                                renderItem={({ item, index }) => {
                                  const photoRef = hasPhotos
                                    ? (typeof item === 'string' ? item : item?.photo_reference)
                                    : undefined;
                                  const placeId = hasPhotos
                                    ? (typeof item === 'object' ? item?.place_id : undefined)
                                    : undefined;

                                  return (
                                    <TripCarouselImage
                                      photo_reference={photoRef}
                                      place_id={placeId}
                                      cityName={trip.selectedCity}
                                      photoIndex={index}
                                      shouldLoad={true}
                                      style={{
                                        height: PROFILE_CARD_IMAGE_HEIGHT,
                                        width: PROFILE_CARD_WIDTH,
                                        borderTopLeftRadius: 12,
                                        borderTopRightRadius: 12
                                      }}
                                      onPhotoCountUpdate={
                                        !hasPhotos
                                          ? (count) =>
                                              setProfileTripPhotoCounts((prev) => ({
                                                ...prev,
                                                [trip.tripId]: count,
                                              }))
                                          : undefined
                                      }
                                    />
                                  );
                                }}
                              />
                              {photoCount > 1 && (
                                <View style={styles.profileCardPaginationDots}>
                                  {Array.from({ length: Math.min(photoCount, 5) }, (_, dotIndex) => (
                                    <View
                                      key={dotIndex}
                                      style={[
                                        styles.profileCardDot,
                                        currentIndex === dotIndex && styles.profileCardActiveDot,
                                      ]}
                                    />
                                  ))}
                                </View>
                              )}
                            </View>

                            {/* Trip Info Section */}
                            <View style={styles.profileCardTripInfo}>
                              <Text style={styles.profileCardTripTitle} numberOfLines={1}>
                                {displayTitle}
                              </Text>
                              {dateDisplay ? (
                                <View style={styles.profileCardTripDateRow}>
                                  <Ionicons name="calendar-outline" size={12} color={Colors.GRAY} />
                                  <Text style={styles.profileCardTripDates} numberOfLines={1}>
                                    {dateDisplay}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
          )}

          {/* Followers List View */}
          {profileModalView === 'followers' && (
            <FollowersList
              followers={followersList}
              isLoading={isLoadingFollowers}
              isRefreshing={false}
              hasMore={false}
              onLoadMore={() => {}}
              onRefresh={loadFollowersList}
              onUserPress={handleFollowerUserPress}
              onFollowPress={handleFollowFromFollowersList}
              currentUserFollowing={new Set(followingList.map(u => u.username))}
              pendingRequests={pendingFollowRequests}
              currentUsername={username}
            />
          )}

          {/* Following List View */}
          {profileModalView === 'following' && (
            <FollowingList
              following={followingList}
              isLoading={isLoadingFollowing}
              isRefreshing={false}
              hasMore={false}
              onLoadMore={() => {}}
              onRefresh={loadFollowingList}
              onUserPress={handleFollowerUserPress}
              onUnfollowPress={handleUnfollowFromList}
              currentUsername={username}
            />
          )}

          {/* Edit Profile View */}
          {profileModalView === 'edit' && (
            <ScrollView
              style={styles.editProfileContainer}
              contentContainerStyle={styles.editProfileScrollContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
            >
              {/* Profile Photo */}
              <View style={styles.editProfilePhotoSection}>
                <TouchableOpacity onPress={handleChangeProfilePhoto} disabled={isUploadingPhoto}>
                  <View style={styles.editProfilePhotoWrapper}>
                    <InitialsAvatar
                      name={fullName || username}
                      profilePhotoUrl={profilePhotoUrl}
                      size={100}
                    />
                    {isUploadingPhoto ? (
                      <View style={styles.editProfilePhotoOverlay}>
                        <ActivityIndicator size="large" color={Colors.WHITE} />
                      </View>
                    ) : (
                      <View style={styles.editProfileCameraIcon}>
                        <Ionicons name="camera" size={20} color={Colors.WHITE} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleChangeProfilePhoto} disabled={isUploadingPhoto}>
                  <Text style={styles.editProfileChangePhotoText}>
                    {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form Fields */}
              <View style={styles.editProfileForm}>
                {/* Username (Read-only) */}
                <View style={styles.editProfileField}>
                  <Text style={styles.editProfileLabel}>Username</Text>
                  <View style={styles.editProfileReadOnly}>
                    <Text style={styles.editProfileReadOnlyText}>@{username}</Text>
                  </View>
                </View>

                {/* Full Name */}
                <View style={styles.editProfileField}>
                  <Text style={styles.editProfileLabel}>Full Name</Text>
                  <TextInput
                    style={styles.editProfileInput}
                    value={editFullName}
                    onChangeText={setEditFullName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Bio */}
                <View style={styles.editProfileField}>
                  <Text style={styles.editProfileLabel}>Bio</Text>
                  <TextInput
                    style={[styles.editProfileInput, styles.editProfileBioInput]}
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Write something about yourself..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  profileIconButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#9CA3AF',
    letterSpacing: 0.3,
  },
  headerName: {
    fontFamily: 'outfit-bold',
    fontSize: 24,
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F36406',
    borderWidth: 2,
    borderColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 16,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 22,
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  tripCount: {
    fontFamily: 'outfit-semibold',
    fontSize: 13,
    color: '#fff',
    backgroundColor: '#1a1a1a',
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    lineHeight: 26,
    overflow: 'hidden',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    fontFamily: 'outfit-medium',
    fontSize: 15,
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(243, 100, 6, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 22,
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontFamily: 'outfit',
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 28,
  },
  emptyStateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F36406',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#F36406',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyStateCtaText: {
    fontFamily: 'outfit-semibold',
    fontSize: 16,
    color: '#fff',
  },
  // Trip Card Styles
  tripCard: {
    borderRadius: 24,
    marginBottom: 20,
    height: 240,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  tripCardLoading: {
    opacity: 0.7,
  },
  tripCardImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tripCardImage: {
    width: '100%',
    height: 240,
    borderRadius: 24,
  },
  tripCardMenuButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripCardPaginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
  },
  tripCardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 3,
  },
  tripCardDotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tripCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 60,
    // Gradient background for text readability
    backgroundColor: 'transparent',
  },
  tripCardTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  tripCardTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 24,
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tripCardDate: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tripCardArrowButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F36406',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F36406',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  // Keep old styles for compatibility with other components
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
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
  // Menu Sheet Styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  menuOverlayTap: {
    flex: 1,
  },
  menuSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  menuHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  menuSheetTitle: {
    fontFamily: 'outfit-semibold',
    fontSize: 20,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 24,
  },
  menuOptionsContainer: {
    gap: 0,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  menuOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuOptionIconDanger: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  menuOptionText: {
    fontFamily: 'outfit-medium',
    fontSize: 17,
    color: '#1a1a1a',
    flex: 1,
  },
  menuOptionTextDanger: {
    color: '#FF3B30',
  },
  menuOptionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderRadius: 12,
  },
  menuOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  // Keep old modal styles for other modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  modalSpacer: {
    flex: 0.6,
  },
  menuModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 0.4,
    paddingTop: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
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
  settingsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
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
  settingsModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 0.65,
    paddingTop: 8,
    paddingBottom: 40,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
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
    flex: 0.35,
  },
  settingsScrollView: {
    flex: 1,
  },
  settingsScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
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
    shadowOffset: { width: 0, height: 2 },
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cancelDeleteButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: Colors.PRIMARY,
  },
  profileModalContainer: {
    flex: 1,
    backgroundColor: Colors.WHITE,
    paddingTop: 55,
  },
  profileModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  profileModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.PRIMARY,
    flex: 1,
    textAlign: 'center',
  },
  profileModalScrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  // Instagram-style Profile Section
  profileSection: {
    paddingBottom: 20,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePhotoContainer: {
    marginRight: 24,
    position: 'relative',
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.LIGHT_GRAY,
  },
  profilePhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhotoCameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.WHITE,
  },
  profilePhotoUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileStatsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  profileStatItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  profileStatNumber: {
    fontSize: 18,
    fontFamily: 'outfit-bold',
    color: '#1a1a1a',
  },
  profileStatLabel: {
    fontSize: 13,
    fontFamily: 'outfit',
    color: '#6B7280',
    marginTop: 2,
  },
  profileNameSection: {
    marginBottom: 12,
  },
  profileFullName: {
    fontSize: 16,
    fontFamily: 'outfit-bold',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  profileUsernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileUsernameText: {
    fontSize: 14,
    fontFamily: 'outfit',
    color: '#6B7280',
    marginRight: 8,
  },
  profilePrivateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  profilePrivateText: {
    fontSize: 11,
    fontFamily: 'outfit-medium',
    color: '#6B7280',
    marginLeft: 4,
  },
  profileBioText: {
    fontSize: 14,
    fontFamily: 'outfit',
    color: '#374151',
    marginTop: 8,
    lineHeight: 20,
  },
  profileTravelStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileTravelStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileTravelStatText: {
    fontSize: 13,
    fontFamily: 'outfit-medium',
    color: '#6B7280',
    marginLeft: 4,
  },
  profileTravelStatDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 12,
  },
  editProfileButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editProfileButtonText: {
    fontSize: 14,
    fontFamily: 'outfit-semibold',
    color: '#1a1a1a',
  },
  // Profile Modal Trips Section
  profileTripsSection: {
    paddingTop: 20,
    paddingBottom: 30,
  },
  profileTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  profileTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  profileActiveTab: {
    backgroundColor: Colors.WHITE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileTabText: {
    fontSize: 14,
    fontFamily: 'outfit-medium',
    color: Colors.GRAY,
  },
  profileActiveTabText: {
    color: '#1F2937',
  },
  profileLoadingTripsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  profileEmptyTripsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  profileEmptyTripsText: {
    fontSize: 16,
    fontFamily: 'outfit',
    color: Colors.GRAY,
    marginTop: 12,
  },
  profileTripsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  profileTripCard: {
    width: PROFILE_CARD_WIDTH,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.WHITE,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  profileCardCarouselContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  profileCardPaginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  profileCardDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 2,
  },
  profileCardActiveDot: {
    backgroundColor: Colors.WHITE,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  profileCardTripInfo: {
    padding: 12,
    paddingTop: 10,
    backgroundColor: Colors.WHITE,
  },
  profileCardTripTitle: {
    fontSize: 15,
    fontFamily: 'outfit-medium',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  profileCardTripDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCardTripDates: {
    fontSize: 12,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    marginLeft: 4,
  },
  // Edit Profile Styles
  editProfileContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  editProfileScrollContent: {
    paddingBottom: 150,
  },
  editProfilePhotoSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  editProfilePhotoWrapper: {
    position: 'relative',
  },
  editProfilePhotoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editProfileCameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.ORANGE,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.WHITE,
  },
  editProfileChangePhotoText: {
    color: Colors.ORANGE,
    fontSize: 16,
    fontFamily: 'outfit-medium',
    marginTop: 12,
  },
  editProfileForm: {
    paddingTop: 8,
  },
  editProfileField: {
    marginBottom: 20,
  },
  editProfileLabel: {
    fontSize: 14,
    fontFamily: 'outfit-medium',
    color: Colors.GRAY,
    marginBottom: 8,
  },
  editProfileInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'outfit',
    color: Colors.BLACK,
    backgroundColor: '#F9FAFB',
  },
  editProfileBioInput: {
    height: 100,
    paddingTop: 12,
  },
  editProfileReadOnly: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editProfileReadOnlyText: {
    fontSize: 16,
    fontFamily: 'outfit',
    color: '#6B7280',
  },
});
