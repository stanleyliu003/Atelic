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
import { FollowingList } from '../../src/components/social/FollowingList';
import { Colors } from '../../constants/Colors';
import * as customQueries from '../../src/graphql/customQueries';
import * as customMutations from '../../src/graphql/customMutations';

export default function FollowingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const username = params.username;

  const [following, setFollowing] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextToken, setNextToken] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentUsername, setCurrentUsername] = useState('');

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        const userName = user.attributes?.preferred_username || '';
        setCurrentUsername(userName);
      } catch (error) {
        console.error('[Following] Error loading current user:', error);
      }
    };
    loadCurrentUser();
  }, []);

  const loadFollowing = useCallback(async (isRefresh = false) => {
    if (isLoading) return;

    const loadingStateSetter = isRefresh ? setIsRefreshing : setIsLoading;
    loadingStateSetter(true);

    try {
      const response = await API.graphql({
        query: customQueries.getFollowing,
        variables: {
          username: username,
          nextToken: isRefresh ? null : nextToken,
          limit: 20,
        },
      });

      const { following: newFollowing, nextToken: newNextToken } = response.data.getFollowing;

      // Deduplicate by username
      if (isRefresh) {
        const uniqueFollowing = newFollowing.filter((user, index, self) =>
          index === self.findIndex((u) => u.username === user.username)
        );
        setFollowing(uniqueFollowing);
      } else {
        setFollowing((prev) => {
          const combined = [...prev, ...newFollowing];
          // Remove duplicates by username
          return combined.filter((user, index, self) =>
            index === self.findIndex((u) => u.username === user.username)
          );
        });
      }

      setNextToken(newNextToken);
      setHasMore(!!newNextToken);
    } catch (error) {
      console.error('Error loading following:', error);
    } finally {
      loadingStateSetter(false);
    }
  }, [isLoading, nextToken, username]);

  useEffect(() => {
    if (username) {
      loadFollowing(true);
    }
  }, [username]);

  const handleRefresh = useCallback(() => {
    loadFollowing(true);
  }, [loadFollowing]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      loadFollowing(false);
    }
  }, [hasMore, isLoading, loadFollowing]);

  const handleUserPress = useCallback((followingUsername) => {
    router.push(`/profile/${followingUsername}`);
  }, [router]);

  const handleUnfollowPress = useCallback(async (followingUsername) => {
    Alert.alert(
      'Unfollow',
      `Are you sure you want to unfollow @${followingUsername}?`,
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
                  targetUsername: followingUsername,
                },
              });

              // Remove from local state
              setFollowing((prev) =>
                prev.filter((user) => user.username !== followingUsername)
              );
            } catch (error) {
              console.error('Error unfollowing user:', error);
              Alert.alert('Error', 'Failed to unfollow user. Please try again.');
            }
          },
        },
      ]
    );
  }, [currentUsername]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.BLACK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Following</Text>
        <View style={styles.headerRight} />
      </View>

      <FollowingList
        following={following}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onRefresh={handleRefresh}
        onUserPress={handleUserPress}
        onUnfollowPress={handleUnfollowPress}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.LIGHT_GRAY,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.BLACK,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
});
