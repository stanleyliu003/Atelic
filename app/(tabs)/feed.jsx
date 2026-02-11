import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { API, Auth } from 'aws-amplify';
import { FeedList } from '../../src/components/feed/FeedList';
import { ProfileHeader } from '../../src/components/profile/ProfileHeader';
import { ProfileStats } from '../../src/components/profile/ProfileStats';
import { TripCarouselImage } from '../../src/components/profile/TripCarouselImage';
import { ShareTripModal } from '../../src/components/trip-view/collaboration';
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
      console.error('[Feed] Error loading statistics:', error);
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
      console.error('[Feed] Error loading profile:', error);
    }
  }, [loadUserStatistics]);

  const loadUserTrips = async (userID) => {
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
    } catch (error) {
      console.error('[Feed] Error loading trips:', error);
      setTripsError('Failed to load trips');
    } finally {
      setIsLoadingTrips(false);
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
            style={styles.settingsButton}
            onPress={() => setIsSettingsModalVisible(true)}
          >
            <Ionicons name="settings-outline" size={28} color={Colors.GRAY} />
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

            <View style={styles.modalContent}>
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
        onRequestClose={() => setIsProfileModalVisible(false)}
      >
        <View style={styles.profileModalContainer}>
          {/* Header */}
          <View style={styles.profileModalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsProfileModalVisible(false)}
            >
              <Ionicons name="close" size={32} color={Colors.GRAY} />
            </TouchableOpacity>
            <Text style={styles.profileModalTitle}>Profile</Text>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                setIsProfileModalVisible(false);
                setIsSettingsModalVisible(true);
              }}
            >
              <Ionicons name="settings-outline" size={28} color={Colors.GRAY} />
            </TouchableOpacity>
          </View>

          {/* Profile Content */}
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
            {/* Profile Header and Stats */}
            {username && (
              <>
                <ProfileHeader
                  username={username}
                  fullName={fullName}
                  profilePhotoUrl={profilePhotoUrl}
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
          </ScrollView>
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
    gap: 15,
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
    shadowOpacity: 0.1,
    shadowRadius: 2.84,
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
    flex: 0.6,
    paddingTop: 8,
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
    flex: 0.55,
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
    paddingHorizontal: 25,
    paddingTop: 20,
  },
});
