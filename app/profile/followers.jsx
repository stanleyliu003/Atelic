import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { API, Auth } from 'aws-amplify';
import { Ionicons } from '@expo/vector-icons';
import { FollowersList } from '../../src/components/social/FollowersList';
import { Colors } from '../../constants/Colors';
import * as customQueries from '../../src/graphql/customQueries';
import * as customMutations from '../../src/graphql/customMutations';

export default function FollowersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const username = params.username;

  const [followers, setFollowers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextToken, setNextToken] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserFollowing, setCurrentUserFollowing] = useState(new Set());
  const [currentUsername, setCurrentUsername] = useState('');

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        const userName = user.attributes?.preferred_username || '';
        setCurrentUsername(userName);
      } catch (error) {
        console.error('[Followers] Error loading current user:', error);
      }
    };
    loadCurrentUser();
  }, []);

  const loadFollowers = useCallback(async (isRefresh = false) => {
    if (isLoading) return;

    const loadingStateSetter = isRefresh ? setIsRefreshing : setIsLoading;
    loadingStateSetter(true);

    try {
      const response = await API.graphql({
        query: customQueries.getFollowers,
        variables: {
          username: username,
          nextToken: isRefresh ? null : nextToken,
          limit: 20,
        },
      });

      const { followers: newFollowers, nextToken: newNextToken } = response.data.getFollowers;

      // Deduplicate by username
      if (isRefresh) {
        const uniqueFollowers = newFollowers.filter((user, index, self) =>
          index === self.findIndex((u) => u.username === user.username)
        );
        setFollowers(uniqueFollowers);
      } else {
        setFollowers((prev) => {
          const combined = [...prev, ...newFollowers];
          // Remove duplicates by username
          return combined.filter((user, index, self) =>
            index === self.findIndex((u) => u.username === user.username)
          );
        });
      }

      setNextToken(newNextToken);
      setHasMore(!!newNextToken);

      // Build set of users current user is following
      // TODO: Get actual current user's following list
      const followingSet = new Set();
      setCurrentUserFollowing(followingSet);
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      loadingStateSetter(false);
    }
  }, [isLoading, nextToken, username]);

  useEffect(() => {
    if (username) {
      loadFollowers(true);
    }
  }, [username]);

  const handleRefresh = useCallback(() => {
    loadFollowers(true);
  }, [loadFollowers]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      loadFollowers(false);
    }
  }, [hasMore, isLoading, loadFollowers]);

  const handleUserPress = useCallback((followUsername) => {
    if (followUsername === currentUsername) {
      // If clicking on own profile, go back to home/profile tab
      router.replace('/(tabs)/feed');
    } else {
      router.push(`/profile/${followUsername}`);
    }
  }, [router, currentUsername]);

  const handleFollowPress = useCallback(async (followUsername) => {
    const isFollowing = currentUserFollowing.has(followUsername);

    if (isFollowing) {
      // Show confirmation before unfollowing
      Alert.alert(
        'Unfollow',
        `Are you sure you want to unfollow @${followUsername}?`,
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
                    followerUsername: currentUsername,
                    targetUsername: followUsername,
                  },
                });

                setCurrentUserFollowing((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(followUsername);
                  return newSet;
                });
              } catch (error) {
                console.error('Error unfollowing user:', error);
                Alert.alert('Error', 'Failed to unfollow user. Please try again.');
              }
            },
          },
        ]
      );
    } else {
      // Follow - no confirmation needed
      try {
        await API.graphql({
          query: customMutations.followUser,
          variables: {
            followerUsername: currentUsername,
            targetUsername: followUsername,
          },
        });

        setCurrentUserFollowing((prev) => new Set(prev).add(followUsername));
      } catch (error) {
        console.error('Error following user:', error);
        Alert.alert('Error', 'Failed to follow user. Please try again.');
      }
    }
  }, [currentUserFollowing, currentUsername]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={Colors.BLACK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Followers</Text>
        <View style={styles.headerRight} />
      </View>

      <FollowersList
        followers={followers}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onRefresh={handleRefresh}
        onUserPress={handleUserPress}
        onFollowPress={handleFollowPress}
        currentUserFollowing={currentUserFollowing}
        currentUsername={currentUsername}
      />
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
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.BLACK,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
});
