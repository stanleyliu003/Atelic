import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { API, Auth } from 'aws-amplify';
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
import { removeCollaborator } from '../../src/graphql/mutations';
import { clearAuthData } from '../../src/services/appGroupsService';
import Carousel from 'react-native-reanimated-carousel';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

const { width: screenWidth } = Dimensions.get('window');
const CAROUSEL_WIDTH = screenWidth - 52;

// Card dimensions for 2-column grid in profile modal
const PROFILE_CARD_HORIZONTAL_PADDING = 20;
const PROFILE_CARD_GAP = 12;
const PROFILE_CARD_WIDTH = (screenWidth - (PROFILE_CARD_HORIZONTAL_PADDING * 2) - PROFILE_CARD_GAP) / 2;
const PROFILE_CARD_IMAGE_HEIGHT = PROFILE_CARD_WIDTH * 1.3;

export default function FeedScreen() {
  const router = useRouter();
  const { restoreTripFromObject, setSelectedCity } = useCreateTrip();
  const params = useLocalSearchParams();
  const hasAutoLoadedRef = useRef(false);

  // User state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [currentUserID, setCurrentUserID] = useState('');

  // Profile state
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const [bio, setBio] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [countriesVisited, setCountriesVisited] = useState(0);
  const [citiesVisited, setCitiesVisited] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Trips state
  const [userTrips, setUserTrips] = useState([]);
  const [ownedTrips, setOwnedTrips] = useState([]);
  const [sharedTrips, setSharedTrips] = useState([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [isLoadingTrip, setIsLoadingTrip] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [leavingTripId, setLeavingTripId] = useState(null);
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
  const [profileModalView, setProfileModalView] = useState('profile'); // 'profile', 'followers', 'following'
  const [profileActiveTab, setProfileActiveTab] = useState('upcoming');

  // Followers/Following state for embedded views
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
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
      // Upload to free image host (0x0.st)
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'photo.jpg';

      formData.append('file', {
        uri: imageUri,
        name: filename,
        type: 'image/jpeg',
      });

      const response = await fetch('https://0x0.st', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const imageUrl = await response.text();
      return imageUrl.trim();
    } catch (error) {
      console.error('Image upload error:', error);
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
        authMode: 'AMAZON_COGNITO_USER_POOLS',
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
          // Upload image to hosting service
          const imageUrl = await uploadImageToHost(result.assets[0].uri);
          await updateProfilePhotoInBackend(imageUrl);
          setProfilePhotoUrl(imageUrl);
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
        setProfilePhotoUrl(profile.profilePhotoUrl);
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
        setProfilePhotoUrl(profile.profilePhotoUrl);
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

  const loadUserTrips = async (userID, retryCount = 0) => {
    const maxRetries = 2;

    try {
      setIsLoadingTrips(true);
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
    }, [])
  );

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
    }
    setRefreshing(false);
  }, [loadUserData, username]);

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
      setFollowersList(uniqueFollowers);
    } catch (error) {
      if (error?.data?.getFollowers?.followers) {
        const followers = error.data.getFollowers.followers.filter((user, index, self) =>
          index === self.findIndex((u) => u.username === user.username)
        );
        setFollowersList(followers);
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
      setFollowingList(uniqueFollowing);
    } catch (error) {
      if (error?.data?.getFollowing?.following) {
        const following = error.data.getFollowing.following.filter((user, index, self) =>
          index === self.findIndex((u) => u.username === user.username)
        );
        setFollowingList(following);
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
    // Also load following list to know who we're following
    if (followingList.length === 0) {
      loadFollowingList();
    }
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
  };

  const handleFollowFromFollowersList = async (targetUsername, isCurrentlyFollowing) => {
    try {
      if (isCurrentlyFollowing) {
        // Unfollow
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
      } else {
        // Follow
        await API.graphql({
          query: customMutations.followUser,
          variables: {
            followerUsername: username,
            targetUsername: targetUsername,
          },
        });
        // Find the user in followers list and add to following list
        const userToFollow = followersList.find(u => u.username === targetUsername);
        if (userToFollow) {
          setFollowingList(prev => [...prev, userToFollow]);
        }
        setFollowingCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('[Feed] Error following/unfollowing:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleEditProfile = () => {
    setIsProfileModalVisible(false);
    router.push('/edit-profile');
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

  const renderTripCard = (trip, keyPrefix = '') => (
    <View
      key={`${keyPrefix}${trip.tripId}`}
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
              {(() => {
                const photoCount = tripPhotoCounts[`${keyPrefix}${trip.tripId}`] || 5;
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
                          (carouselIndices[`${keyPrefix}${trip.tripId}`] || 0) === index && styles.activeDot
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
              {selectedTripId === trip.tripId && isLoadingTrip ? (
                <ActivityIndicator size="small" color={Colors.PRIMARY} style={styles.menuButton} />
              ) : (
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
                    const startFormatted = referenceDate.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    });
                    const endDay = endDate.getDate();
                    const year = endDate.getFullYear();
                    return `${startFormatted} - ${endDay}, ${year}`;
                  } else if (referenceDate.getFullYear() === endDate.getFullYear()) {
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
                  return referenceDate.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                } else if (trip.endDate) {
                  return new Date(trip.endDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                } else {
                  return trip.tripLength != null ? `${trip.tripLength} day trip` : 'Unknown length';
                }
              })()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.profileIconButton}
            onPress={() => setIsProfileModalVisible(true)}
          >
            {profilePhotoUrl ? (
              <Image
                source={{ uri: profilePhotoUrl }}
                style={styles.profileIcon}
              />
            ) : (
              <View style={styles.profileIconPlaceholder}>
                <FontAwesome name="user" size={20} color={Colors.GRAY} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.headerText}>Home</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => router.push('/(tabs)/explore')}
          >
            <Ionicons name="search-outline" size={26} color={Colors.GRAY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.friendRequestsButton}
            onPress={() => router.push('/profile/follow-requests')}
          >
            <Ionicons name="people-outline" size={26} color={Colors.GRAY} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
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
        {/* My Trips Section */}
        {isLoadingTrips ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.PRIMARY} />
            <Text style={styles.loadingText}>Loading trips...</Text>
          </View>
        ) : (
          <>
            {ownedTrips.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>My Trips</Text>
                {ownedTrips.map(trip => renderTripCard(trip, 'owned-'))}
              </>
            )}

            {sharedTrips.length > 0 && (
              <>
                <Text style={styles.sharedTripsSectionTitle}>Shared With Me</Text>
                {sharedTrips.map(trip => renderTripCard(trip, 'shared-'))}
              </>
            )}

            {ownedTrips.length === 0 && sharedTrips.length === 0 && (
              <View style={styles.noTripsContainer}>
                <FontAwesome name="suitcase" size={50} color={Colors.GRAY} />
                <Text style={styles.noTripsText}>No trips found</Text>
              </View>
            )}
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(null)}
        >
          <View style={styles.modalSpacer} />
          <TouchableOpacity
            style={styles.menuModal}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setMenuVisible(null)}
              >
                <Ionicons name="close" size={32} color={Colors.GRAY} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleInviteCollaborators(menuVisible)}
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
                  <Text style={styles.settingsMenuItemText}>Private Account</Text>
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
                name={profileModalView !== 'profile' ? 'arrow-back' : 'close'}
                size={profileModalView !== 'profile' ? 28 : 32}
                color={Colors.GRAY}
              />
            </TouchableOpacity>
            <Text style={styles.profileModalTitle}>
              {profileModalView === 'followers' ? 'Followers' :
               profileModalView === 'following' ? 'Following' : 'Profile'}
            </Text>
            {profileModalView === 'profile' ? (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => {
                  setIsProfileModalVisible(false);
                  setIsSettingsModalVisible(true);
                }}
              >
                <Ionicons name="settings-outline" size={28} color={Colors.GRAY} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerPlaceholder} />
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
                    {profilePhotoUrl ? (
                      <Image
                        source={{ uri: profilePhotoUrl }}
                        style={styles.profilePhoto}
                      />
                    ) : (
                      <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder]}>
                        <FontAwesome name="user" size={32} color={Colors.GRAY} />
                      </View>
                    )}
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
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 25,
    paddingTop: 55,
    backgroundColor: Colors.WHITE,
  },
  header: {
    flexDirection: 'row',
    alignContent: 'center',
    justifyContent: 'space-between',
    paddingTop: 25,
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  headerText: {
    fontFamily: 'outfit-bold',
    fontSize: 35,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.WHITE,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2.84,
  },
  friendRequestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.WHITE,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2.84,
  },
  profileIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.LIGHT_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.WHITE,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
  },
  headerPlaceholder: {
    width: 52,
    height: 44,
  },
  scrollView: {
    flex: 1,
    marginTop: 30,
  },
  sectionTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 28,
    color: Colors.PRIMARY,
    marginBottom: 20,
    marginTop: 10,
  },
  sharedTripsSectionTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 28,
    color: Colors.PRIMARY,
    marginBottom: 20,
    marginTop: 30,
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
  noTripsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noTripsText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: Colors.GRAY,
    marginTop: 15,
  },
  tripCard: {
    backgroundColor: Colors.WHITE,
    borderRadius: 16,
    marginBottom: 30,
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
  tripCardInfo: {
    padding: 16,
    paddingTop: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  modalSpacer: {
    flex: 0.67,
  },
  menuModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 0.33,
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
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileModalTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 28,
    color: Colors.PRIMARY,
  },
  profileModalScrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
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
});
