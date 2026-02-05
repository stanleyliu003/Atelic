import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Auth, API } from 'aws-amplify';
import { Ionicons } from '@expo/vector-icons';
import { ProfileHeader } from '../../src/components/profile/ProfileHeader';
import { ProfileStats } from '../../src/components/profile/ProfileStats';
import { Colors } from '../../constants/Colors';
import * as customQueries from '../../src/graphql/customQueries';
import * as customMutations from '../../src/graphql/customMutations';

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const username = params.username;

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');

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

  const loadProfile = useCallback(async () => {
    try {
      // Get current user
      const user = await Auth.currentAuthenticatedUser();
      const currentUserName = user.attributes?.preferred_username || '';
      setCurrentUsername(currentUserName);

      // Load target user's profile
      // TODO: Implement getUserProfile query
      // const profile = await getUserProfile(username);
      // setUserProfile(profile);

      // Placeholder profile data
      setUserProfile({
        username: username,
        fullName: username,
        profilePhotoUrl: null,
        bio: null,
        isPrivate: false,
      });

      // Load statistics
      const statsResponse = await API.graphql({
        query: customQueries.getUserStatistics,
        variables: { username },
      });
      setStats(statsResponse.data.getUserStatistics);

      // Check follow status
      // TODO: Implement checkFollowStatus query
      setIsFollowing(false);
      setHasPendingRequest(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (username) {
      loadProfile();
    }
  }, [username, loadProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  const handleFollowPress = async () => {
    try {
      if (isFollowing) {
        // Unfollow
        await API.graphql({
          query: customMutations.unfollowUser,
          variables: {
            followerUsername: currentUsername,
            targetUsername: username,
          },
        });
        setIsFollowing(false);
      } else if (hasPendingRequest) {
        // Cancel request (not implemented in backend yet)
        Alert.alert('Request Pending', 'Your follow request is pending approval');
      } else {
        // Follow or send request
        const response = await API.graphql({
          query: customMutations.followUser,
          variables: {
            followerUsername: currentUsername,
            targetUsername: username,
          },
        });

        const { status } = response.data.followUser;
        if (status === 'following') {
          setIsFollowing(true);
        } else if (status === 'pending') {
          setHasPendingRequest(true);
        }
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleFollowersPress = () => {
    router.push(`/profile/followers?username=${username}`);
  };

  const handleFollowingPress = () => {
    router.push(`/profile/following?username=${username}`);
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
        <ProfileHeader
          username={userProfile.username}
          fullName={userProfile.fullName}
          profilePhotoUrl={userProfile.profilePhotoUrl}
          bio={userProfile.bio}
          isOwnProfile={false}
          isPrivate={userProfile.isPrivate}
          isFollowing={isFollowing}
          hasPendingRequest={hasPendingRequest}
          onFollowPress={handleFollowPress}
        />

        <ProfileStats
          countriesVisited={stats.countriesVisited}
          citiesVisited={stats.citiesVisited}
          totalTrips={stats.totalTrips}
          followersCount={stats.followersCount}
          followingCount={stats.followingCount}
          onFollowersPress={handleFollowersPress}
          onFollowingPress={handleFollowingPress}
        />

        {/* Trips Section */}
        {userProfile.isPrivate && !isFollowing ? (
          <View style={styles.privateMessageContainer}>
            <Ionicons name="lock-closed" size={48} color={Colors.GRAY} />
            <Text style={styles.privateMessageTitle}>This Account is Private</Text>
            <Text style={styles.privateMessageText}>
              Follow this account to see their trips
            </Text>
          </View>
        ) : (
          <View style={styles.tripsSection}>
            {/* TODO: Add trips list here */}
            <Text style={styles.comingSoonText}>Trips list coming soon</Text>
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
    fontWeight: 'bold',
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
    padding: 16,
  },
  comingSoonText: {
    fontSize: 16,
    color: Colors.GRAY,
    textAlign: 'center',
    paddingVertical: 40,
  },
});
