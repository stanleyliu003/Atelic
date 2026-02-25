import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Auth, API } from 'aws-amplify';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import * as customQueries from '../../src/graphql/customQueries';
import * as customMutations from '../../src/graphql/customMutations';
import { getUserProfile, searchUsersPublic } from '../../src/graphql/queries';
import { listUserTripsFromCloud, retrieveTripFromCloud } from '../../src/services/lambdaService';
import { TripCarouselImage } from '../../src/components/profile/TripCarouselImage';
import { InitialsAvatar } from '../../src/components/common/InitialsAvatar';
import { useCreateTrip } from '../../context/CreateTripContext';
import Carousel from 'react-native-reanimated-carousel';
import { Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const CAROUSEL_WIDTH = screenWidth - 52;

// Calculate card dimensions for 2-column grid
const CARD_HORIZONTAL_PADDING = 20;
const CARD_GAP = 12;
const CARD_WIDTH = (screenWidth - (CARD_HORIZONTAL_PADDING * 2) - CARD_GAP) / 2;
const CARD_IMAGE_HEIGHT = CARD_WIDTH * 1.3; // Slightly taller aspect ratio

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const username = params.username;

  // Context for loading trips
  const { restoreTripFromObject, setSelectedCity, setCurrentUserRole } = useCreateTrip();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [isOpeningTrip, setIsOpeningTrip] = useState(false);
  const [loadingTripId, setLoadingTripId] = useState(null);

  // Profile data
  const [userProfile, setUserProfile] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [stats, setStats] = useState({
    countriesVisited: 0,
    citiesVisited: 0,
    totalTrips: 0,
    followersCount: 0,
    followingCount: 0,
  });
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  // Trips data
  const [userTrips, setUserTrips] = useState([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [canViewTrips, setCanViewTrips] = useState(false);
  const [carouselIndices, setCarouselIndices] = useState({});
  const [tripPhotoCounts, setTripPhotoCounts] = useState({});

  // Tab state for upcoming/past trips
  const [activeTab, setActiveTab] = useState('upcoming');

  // Separate trips into upcoming and past
  const { upcomingTrips, pastTrips } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = [];
    const past = [];

    userTrips.forEach(trip => {
      // If trip has end date, use that to determine if it's past
      if (trip.endDate) {
        const endDate = new Date(trip.endDate);
        if (endDate < today) {
          past.push(trip);
        } else {
          upcoming.push(trip);
        }
      } else if (trip.startDate) {
        // If only start date, use that
        const startDate = new Date(trip.startDate);
        if (startDate < today) {
          past.push(trip);
        } else {
          upcoming.push(trip);
        }
      } else {
        // No dates - treat as upcoming
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

    return { upcomingTrips: upcoming, pastTrips: past };
  }, [userTrips]);

  const displayedTrips = activeTab === 'upcoming' ? upcomingTrips : pastTrips;

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

  const loadProfile = useCallback(async () => {
    try {
      // Get current user
      const user = await Auth.currentAuthenticatedUser();
      const currentUserName = user.attributes?.preferred_username || '';
      setCurrentUsername(currentUserName);

      // Load target user's profile
      let profile = null;
      try {
        const profileResponse = await API.graphql({
          query: getUserProfile,
          variables: { username },
        });
        profile = profileResponse.data.getUserProfile;
      } catch (profileError) {
        // GraphQL may throw with partial errors but still have valid data
        if (profileError?.data?.getUserProfile) {
          profile = profileError.data.getUserProfile;
          console.log('[UserProfile] Retrieved profile from partial error response');
        } else {
          console.warn('[UserProfile] Error loading profile:', profileError);
        }
      }

      if (!profile) {
        setUserProfile(null);
        setIsLoading(false);
        return;
      }

      console.log('[UserProfile] Loaded profile data:', {
        username: profile.username,
        isPrivateAccount: profile.isPrivateAccount,
        followersCount: profile.followersCount,
        followingCount: profile.followingCount
      });

      setUserProfile(profile);

      // Load statistics
      let travelStats = {
        countriesVisited: 0,
        citiesVisited: 0,
        totalTrips: 0,
        tripsCompleted: 0,
        tripsUpcoming: 0,
      };
      try {
        const statsResponse = await API.graphql({
          query: customQueries.getUserStatistics,
          variables: { username },
        });
        travelStats = statsResponse.data.getUserStatistics || travelStats;
      } catch (statsError) {
        // GraphQL may throw with partial errors but still have valid data
        if (statsError?.data?.getUserStatistics) {
          travelStats = statsError.data.getUserStatistics;
          console.log('[UserProfile] Retrieved statistics from partial error response');
        } else {
          console.warn('[UserProfile] Error loading statistics:', statsError);
        }
      }

      console.log('[UserProfile] Loaded statistics:', travelStats);

      // Combine travel stats with follower/following counts from profile
      setStats({
        ...travelStats,
        followersCount: profile.followersCount || 0,
        followingCount: profile.followingCount || 0,
      });

      // Search for this user to get follow status
      let searchResults = [];
      try {
        const searchResponse = await API.graphql({
          query: searchUsersPublic,
          variables: {
            searchTerm: username,
            currentUsername: currentUserName,
          },
        });
        searchResults = (searchResponse.data.searchUsersPublic || []).filter(item => item != null);
      } catch (searchError) {
        // GraphQL may throw with partial errors but still have valid data
        if (searchError?.data?.searchUsersPublic) {
          searchResults = searchError.data.searchUsersPublic.filter(item => item != null);
        } else {
          console.warn('[UserProfile] Error in search:', searchError);
        }
      }
      const userInSearch = searchResults.find(u => u.username === username);

      console.log('[UserProfile] Search results for follow status:', {
        userInSearch,
        isFollowing: userInSearch?.isFollowing,
        hasPendingRequest: userInSearch?.hasPendingRequest,
        timestamp: new Date().toISOString()
      });

      if (userInSearch) {
        console.log('[UserProfile] Setting follow state:', {
          isFollowing: userInSearch.isFollowing || false,
          hasPendingRequest: userInSearch.hasPendingRequest || false
        });
        setIsFollowing(userInSearch.isFollowing || false);
        setHasPendingRequest(userInSearch.hasPendingRequest || false);
      } else {
        console.log('[UserProfile] User not found in search results, resetting follow state');
        setIsFollowing(false);
        setHasPendingRequest(false);
      }

      // Determine if viewer can see trips
      // Trips are ONLY visible to confirmed followers (regardless of public/private status)
      const isFollowingUser = userInSearch?.isFollowing || false;
      const canView = isFollowingUser;

      console.log('[UserProfile] Privacy check:', {
        isPrivateAccount: profile.isPrivateAccount,
        isFollowingUser,
        canView
      });

      setCanViewTrips(canView);

      // Check if viewing own profile
      const ownProfile = currentUserName && username &&
        currentUserName.toLowerCase() === username.toLowerCase();
      setIsOwnProfile(ownProfile);

      // Load trips if allowed (followers can see) OR if it's own profile
      if ((canView || ownProfile) && profile.userID) {
        await loadUserTrips(profile.userID, ownProfile);
        if (ownProfile) {
          setCanViewTrips(true); // Always can view own trips
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  const loadUserTrips = async (userID, isOwnProfile = false) => {
    setIsLoadingTrips(true);
    try {
      const tripSummaries = await listUserTripsFromCloud(userID);
      const allTrips = tripSummaries || [];

      // Debug: Log all trips and their isPublic values
      console.log('[UserProfile] All trips received:', allTrips.map(t => ({
        tripId: t.tripId,
        selectedCity: t.selectedCity,
        isPublic: t.isPublic,
        isPublicType: typeof t.isPublic,
        userRole: t.userRole
      })));
      console.log('[UserProfile] isOwnProfile:', isOwnProfile);

      let tripsToShow;
      if (isOwnProfile) {
        // When viewing own profile, show ALL trips
        tripsToShow = allTrips;
        console.log('[UserProfile] Showing all trips (own profile):', allTrips.length);
      } else {
        // Filter to only show PUBLIC trips when viewing another user's profile
        // Handle both boolean true and string 'true' in case of type mismatch
        tripsToShow = allTrips.filter(trip => trip.isPublic === true || trip.isPublic === 'true');
        console.log('[UserProfile] Public trips after filter:', tripsToShow.length);
      }

      // Separate owned and shared trips
      const owned = tripsToShow.filter(trip => trip.userRole === 'owner');
      const shared = tripsToShow.filter(trip => trip.userRole !== 'owner');

      setUserTrips(tripsToShow);
      console.log(`[UserProfile] Loaded ${owned.length} owned trips and ${shared.length} shared trips (from ${allTrips.length} total)`);
    } catch (error) {
      // Silently handle error - backend issue with user's trips
    } finally {
      setIsLoadingTrips(false);
    }
  };

  useEffect(() => {
    if (username) {
      loadProfile();
    }
  }, [username, loadProfile]);

  // Reload profile when screen comes into focus (e.g., after unfollowing)
  useFocusEffect(
    useCallback(() => {
      console.log('[UserProfile] Screen focused, reloading profile...');
      if (username) {
        loadProfile();
      }
    }, [username, loadProfile])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  const handleFollowPress = async () => {
    console.log('[UserProfile] Follow button pressed:', {
      currentUsername,
      targetUsername: username,
      isFollowing,
      hasPendingRequest,
      isPrivate: userProfile?.isPrivateAccount
    });

    if (isFollowing) {
      // Show confirmation before unfollowing
      Alert.alert(
        'Unfollow',
        `Are you sure you want to unfollow @${username}?`,
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
                console.log('[UserProfile] Unfollowing user...', {
                  followerUsername: currentUsername,
                  targetUsername: username
                });

                const unfollowResponse = await API.graphql({
                  query: customMutations.unfollowUser,
                  variables: {
                    followerUsername: currentUsername,
                    targetUsername: username,
                  },
                });

                const result = unfollowResponse.data.unfollowUser;
                console.log('[UserProfile] Unfollow response:', JSON.stringify(result, null, 2));

                if (!result.success) {
                  console.error('[UserProfile] Unfollow failed:', result.message);
                  Alert.alert('Error', result.message || 'Failed to unfollow user');
                  return;
                }

                if (result.status === 'not_following') {
                  console.warn('[UserProfile] Was not following this user');
                  return;
                }

                setIsFollowing(false);
                setCanViewTrips(false);
                setUserTrips([]);

                setStats(prevStats => ({
                  ...prevStats,
                  followersCount: Math.max(0, (prevStats.followersCount || 0) - 1)
                }));
              } catch (error) {
                console.error('[UserProfile] Error unfollowing user:', error);
                Alert.alert('Error', 'Failed to unfollow user. Please try again.');
              }
            },
          },
        ]
      );
      return;
    }

    if (hasPendingRequest) {
      // Cancel pending request - no confirmation needed
      try {
        console.log('[UserProfile] Canceling pending follow request');
        await API.graphql({
          query: customMutations.unfollowUser,
          variables: {
            followerUsername: currentUsername,
            targetUsername: username,
          },
        });

        console.log('[UserProfile] Follow request canceled');
        setHasPendingRequest(false);
      } catch (error) {
        console.error('[UserProfile] Error canceling request:', error);
        Alert.alert('Error', 'Failed to cancel request. Please try again.');
      }
      return;
    }

    // Follow or send request - no confirmation needed
    try {
      console.log('[UserProfile] Sending follow/request to:', username);
      const response = await API.graphql({
        query: customMutations.followUser,
        variables: {
          followerUsername: currentUsername,
          targetUsername: username,
        },
      });

      console.log('[UserProfile] Follow response:', response.data.followUser);
      const { status } = response.data.followUser;

      if (status === 'following') {
        console.log('[UserProfile] Now following user');
        setIsFollowing(true);
        setCanViewTrips(true);

        // Update follower count locally (increment by 1)
        setStats(prevStats => ({
          ...prevStats,
          followersCount: (prevStats.followersCount || 0) + 1
        }));

        // Load trips now that we're following
        if (userProfile?.userID) {
          await loadUserTrips(userProfile.userID);
        }
      } else if (status === 'requested' || status === 'pending' || status === 'already_requested') {
        console.log('[UserProfile] Follow request sent or already pending');
        setHasPendingRequest(true);
      }
    } catch (error) {
      console.error('[UserProfile] Error following user:', error);
      Alert.alert('Error', 'Failed to follow user. Please try again.');
    }
  };

  const handleFollowersPress = () => {
    router.push(`/profile/followers?username=${username}`);
  };

  const handleFollowingPress = () => {
    router.push(`/profile/following?username=${username}`);
  };

  const handleTripPress = async (trip) => {
    if (isOpeningTrip) return; // Prevent double-tap

    setIsOpeningTrip(true);
    setLoadingTripId(trip.tripId);
    try {
      // Get the trip owner's userID from the profile
      const ownerUserID = userProfile?.userID;
      if (!ownerUserID) {
        console.error('[UserProfile] Cannot load trip - no owner userID');
        Alert.alert('Error', 'Cannot load trip');
        return;
      }

      console.log('[UserProfile] Loading trip:', trip.tripId, 'for user:', ownerUserID);

      // Fetch full trip details from the cloud
      const tripDetails = await retrieveTripFromCloud(ownerUserID, trip.tripId);

      if (tripDetails) {
        // Get current user's ID (the person viewing, not the trip owner)
        const currentUser = await Auth.currentAuthenticatedUser();
        const currentUserID = currentUser.attributes?.sub;

        // Restore trip into context - pass CURRENT user's ID so their role is set correctly
        restoreTripFromObject(tripDetails, currentUserID);
        setSelectedCity(tripDetails.selectedCity);

        // Check if current user is a collaborator on this trip
        const isCollaborator = tripDetails.collaborators?.some(
          collab => collab.userID === currentUserID
        );

        // Only force viewer role if user is NOT a collaborator
        if (!isCollaborator) {
          console.log('[UserProfile] User is not a collaborator, setting viewer mode');
          setCurrentUserRole('viewer');
        } else {
          console.log('[UserProfile] User is a collaborator, keeping their role');
        }

        // Navigate to trip view
        router.push('/trip-view/trip-view_main');
      } else {
        Alert.alert('Error', 'Could not load trip details');
      }
    } catch (error) {
      console.error('[UserProfile] Error loading trip:', error);
      Alert.alert('Error', 'Failed to load trip. Please try again.');
    } finally {
      setIsOpeningTrip(false);
      setLoadingTripId(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.BLACK} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.ORANGE} />
        </View>
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.BLACK} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.BLACK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{username}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.ORANGE}
            colors={[Colors.ORANGE]}
          />
        }
      >
        {/* Instagram-style Profile Section */}
        <View style={styles.profileSection}>
          {/* Top Row: Photo + Stats */}
          <View style={styles.profileTopRow}>
            {/* Profile Photo */}
            <View style={styles.profilePhotoContainer}>
              <InitialsAvatar
                name={userProfile.fullName || username}
                profilePhotoUrl={userProfile.profilePhotoUrl}
                size={80}
              />
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{isOwnProfile ? (userTrips.length > 0 ? userTrips.length : stats.totalTrips) : userTrips.length}</Text>
                <Text style={styles.statLabel}>Trips</Text>
              </View>
              <TouchableOpacity
                style={styles.statItem}
                onPress={isFollowing ? handleFollowersPress : undefined}
                disabled={!isFollowing}
              >
                <Text style={styles.statNumber}>{stats.followersCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.statItem}
                onPress={isFollowing ? handleFollowingPress : undefined}
                disabled={!isFollowing}
              >
                <Text style={styles.statNumber}>{stats.followingCount}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Name and Username */}
          <View style={styles.nameSection}>
            <Text style={styles.fullName}>{userProfile.fullName}</Text>
            <View style={styles.usernameRow}>
              <Text style={styles.usernameText}>@{userProfile.username}</Text>
              {userProfile.isPrivateAccount && (
                <View style={styles.privateBadge}>
                  <Ionicons name="lock-closed" size={12} color="#6B7280" />
                  <Text style={styles.privateText}>Private</Text>
                </View>
              )}
            </View>
            {userProfile.bio && (
              <Text style={styles.bioText}>{userProfile.bio}</Text>
            )}
          </View>

          {/* Travel Stats - Compact */}
          <View style={styles.travelStatsRow}>
            <View style={styles.travelStatItem}>
              <Ionicons name="earth-outline" size={16} color={Colors.ORANGE} />
              <Text style={styles.travelStatText}>{isOwnProfile ? (userTrips.length > 0 ? calculatedCountries : stats.countriesVisited) : calculatedCountries} Countries</Text>
            </View>
            <View style={styles.travelStatDot} />
            <View style={styles.travelStatItem}>
              <Ionicons name="location-outline" size={16} color={Colors.ORANGE} />
              <Text style={styles.travelStatText}>{isOwnProfile ? (userTrips.length > 0 ? calculatedCities : stats.citiesVisited) : calculatedCities} Cities</Text>
            </View>
          </View>

          {/* Follow Button */}
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowing && styles.followingButton,
              hasPendingRequest && styles.requestedButton,
            ]}
            onPress={handleFollowPress}
          >
            <Text style={[
              styles.followButtonText,
              isFollowing && styles.followingButtonText,
              hasPendingRequest && styles.requestedButtonText,
            ]}>
              {hasPendingRequest ? 'Requested' : isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Trips Section */}
        {!canViewTrips ? (
          <View style={styles.privateMessageContainer}>
            <Ionicons name={userProfile.isPrivateAccount ? "lock-closed" : "person-add"} size={48} color={Colors.GRAY} />
            <Text style={styles.privateMessageTitle}>
              {userProfile.isPrivateAccount ? 'This Account is Private' : 'Follow to See Trips'}
            </Text>
            <Text style={styles.privateMessageText}>
              {userProfile.isPrivateAccount
                ? 'Follow this account to see their trips'
                : `Follow @${username} to see their trips`}
            </Text>
          </View>
        ) : (
          <View style={styles.tripsSection}>
            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'upcoming' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('upcoming')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'upcoming' && styles.activeTabText,
                ]}>
                  Upcoming Trips
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'past' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('past')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'past' && styles.activeTabText,
                ]}>
                  Past Trips
                </Text>
              </TouchableOpacity>
            </View>

            {isLoadingTrips ? (
              <View style={styles.loadingTripsContainer}>
                <ActivityIndicator size="large" color={Colors.ORANGE} />
              </View>
            ) : displayedTrips.length === 0 ? (
              <View style={styles.emptyTripsContainer}>
                <Ionicons
                  name={activeTab === 'upcoming' ? "airplane-outline" : "time-outline"}
                  size={48}
                  color={Colors.GRAY}
                />
                <Text style={styles.emptyTripsText}>
                  {activeTab === 'upcoming' ? 'No upcoming trips' : 'No past trips'}
                </Text>
              </View>
            ) : (
              <View style={styles.tripsGrid}>
                {displayedTrips.map((trip) => {
                  const photoReferences = Array.isArray(trip.tripPhotoReference)
                    ? trip.tripPhotoReference
                    : trip.tripPhotoReference
                    ? [trip.tripPhotoReference]
                    : [];

                  const hasPhotos = photoReferences.length > 0;
                  const photoCount = hasPhotos ? photoReferences.length : (tripPhotoCounts[trip.tripId] || 5);
                  const currentIndex = carouselIndices[trip.tripId] || 0;

                  // Determine display title
                  const displayTitle = trip.tripTitle || trip.selectedCity || 'Untitled Trip';

                  // Format date display (matching profile.jsx logic)
                  let dateDisplay = '';
                  if (trip.startDate && trip.endDate) {
                    const startDate = new Date(trip.startDate);
                    const endDate = new Date(trip.endDate);
                    const sameMonth = startDate.getMonth() === endDate.getMonth() &&
                                      startDate.getFullYear() === endDate.getFullYear();

                    if (sameMonth) {
                      // Same month: "Feb 11 - 13"
                      const startFormatted = startDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      });
                      const endDay = endDate.getDate();
                      dateDisplay = `${startFormatted} - ${endDay}`;
                    } else {
                      // Different months: "Feb 11 - Mar 2"
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
                      style={styles.tripCard}
                      onPress={() => handleTripPress(trip)}
                      activeOpacity={0.8}
                    >
                      {/* Trip Photo Carousel */}
                      <View style={styles.carouselContainer}>
                        <Carousel
                          loop={false}
                          width={CARD_WIDTH}
                          height={CARD_IMAGE_HEIGHT}
                          data={hasPhotos ? photoReferences : [{}, {}, {}, {}, {}]}
                          scrollAnimationDuration={300}
                          onSnapToItem={(index) =>
                            setCarouselIndices((prev) => ({
                              ...prev,
                              [trip.tripId]: index,
                            }))
                          }
                          renderItem={({ item, index }) => {
                            // Extract photo_reference and place_id from item object
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
                                  height: CARD_IMAGE_HEIGHT,
                                  width: CARD_WIDTH,
                                  borderTopLeftRadius: 12,
                                  borderTopRightRadius: 12
                                }}
                                onPhotoCountUpdate={
                                  !hasPhotos
                                    ? (count) =>
                                        setTripPhotoCounts((prev) => ({
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
                          <View style={styles.paginationDots}>
                            {Array.from({ length: Math.min(photoCount, 5) }, (_, dotIndex) => (
                              <View
                                key={dotIndex}
                                style={[
                                  styles.dot,
                                  currentIndex === dotIndex && styles.activeDot,
                                ]}
                              />
                            ))}
                          </View>
                        )}
                        {/* Loading overlay for this specific card */}
                        {loadingTripId === trip.tripId && (
                          <View style={styles.cardLoadingOverlay}>
                            <ActivityIndicator size="large" color={Colors.WHITE} />
                          </View>
                        )}
                      </View>

                      {/* Trip Info Section - Card Footer */}
                      <View style={styles.tripInfoSection}>
                        <Text style={styles.tripTitle} numberOfLines={1}>
                          {displayTitle}
                        </Text>
                        {dateDisplay ? (
                          <View style={styles.tripDateRow}>
                            <Ionicons name="calendar-outline" size={12} color={Colors.GRAY} />
                            <Text style={styles.tripDates} numberOfLines={1}>
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.LIGHT_GRAY,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'outfit-semibold',
    color: Colors.BLACK,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: Colors.GRAY,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  // Instagram-style Profile Section
  profileSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: Colors.WHITE,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePhotoContainer: {
    marginRight: 24,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.LIGHT_GRAY,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statNumber: {
    fontSize: 18,
    fontFamily: 'outfit-bold',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 13,
    fontFamily: 'outfit',
    color: '#6B7280',
    marginTop: 2,
  },
  nameSection: {
    marginBottom: 12,
  },
  fullName: {
    fontSize: 16,
    fontFamily: 'outfit-semibold',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameText: {
    fontSize: 14,
    fontFamily: 'outfit',
    color: '#6B7280',
    marginRight: 8,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  privateText: {
    fontSize: 11,
    fontFamily: 'outfit-medium',
    color: '#6B7280',
    marginLeft: 4,
  },
  bioText: {
    fontSize: 14,
    fontFamily: 'outfit',
    color: '#374151',
    marginTop: 8,
    lineHeight: 20,
  },
  travelStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  travelStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  travelStatText: {
    fontSize: 13,
    fontFamily: 'outfit-medium',
    color: '#6B7280',
    marginLeft: 4,
  },
  travelStatDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 12,
  },
  followButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 14,
    fontFamily: 'outfit-semibold',
    color: Colors.WHITE,
  },
  followingButton: {
    backgroundColor: Colors.ORANGE,
    borderWidth: 0,
  },
  followingButtonText: {
    color: Colors.WHITE,
  },
  requestedButton: {
    backgroundColor: '#F3F4F6',
  },
  requestedButtonText: {
    color: '#9CA3AF',
  },
  privateMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  privateMessageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.BLACK,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  privateMessageText: {
    fontSize: 16,
    color: Colors.GRAY,
    textAlign: 'center',
  },
  tripsSection: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 30,
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.WHITE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'outfit-medium',
    color: Colors.GRAY,
  },
  activeTabText: {
    color: '#1F2937',
  },
  loadingTripsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTripsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTripsText: {
    fontSize: 16,
    fontFamily: 'outfit',
    color: Colors.GRAY,
    marginTop: 12,
  },
  // 2-column grid layout
  tripsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tripCard: {
    width: CARD_WIDTH,
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
  carouselContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 2,
  },
  activeDot: {
    backgroundColor: Colors.WHITE,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tripInfoSection: {
    padding: 12,
    paddingTop: 10,
    backgroundColor: Colors.WHITE,
  },
  tripTitle: {
    fontSize: 15,
    fontFamily: 'outfit-medium',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  tripDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripDates: {
    fontSize: 12,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    marginLeft: 4,
  },
});
