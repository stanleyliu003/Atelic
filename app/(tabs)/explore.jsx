import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { API, Auth, Storage } from 'aws-amplify';
import { UserSearchBar } from '../../src/components/explore/UserSearchBar';
import { UserCard } from '../../src/components/explore/UserCard';
import { Colors } from '../../constants/Colors';
import * as customMutations from '../../src/graphql/customMutations';

export default function ExploreScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        const userName = user.attributes?.preferred_username || '';
        setCurrentUsername(userName);
      } catch (error) {
        console.error('[Explore] Error loading current user:', error);
      }
    };
    loadCurrentUser();
  }, []);

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
      const signedUrl = await Storage.get(s3Key, {
        level: 'public',
        expires: 3600
      });
      if (signedUrl && (signedUrl.startsWith('http://') || signedUrl.startsWith('https://'))) {
        return signedUrl;
      }
      return null;
    } catch (error) {
      console.error('[Explore] Error getting signed URL:', error);
      return null;
    }
  };

  // Refresh search results when returning to this screen
  useFocusEffect(
    useCallback(() => {
      if (searchQuery.trim().length >= 1 && currentUsername) {
        handleSearch(searchQuery);
      }
    }, [searchQuery, currentUsername, handleSearch])
  );

  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    // Wait for currentUsername to be loaded
    if (!currentUsername) {
      console.log('[Explore] Waiting for current username to load...');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    // Retry logic for DynamoDB throughput errors
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await API.graphql({
          query: `
            query SearchUsersPublic($searchTerm: String!, $currentUsername: String!) {
              searchUsersPublic(searchTerm: $searchTerm, currentUsername: $currentUsername) {
                userID
                email
                fullName
                username
                isPrivate
                isFollowing
                isFollower
                hasPendingRequest
                profilePhotoUrl
                bio
              }
            }
          `,
          variables: {
            searchTerm: query,
            currentUsername: currentUsername,
          },
        });

        // Filter out any null items from results
        const results = (response.data.searchUsersPublic || []).filter(item => item != null);

        // Resolve S3 keys to signed URLs for profile photos
        const resultsWithResolvedPhotos = await Promise.all(
          results.map(async (user) => ({
            ...user,
            profilePhotoUrl: await resolveProfilePhotoUrl(user.profilePhotoUrl)
          }))
        );

        setSearchResults(resultsWithResolvedPhotos);
        setIsSearching(false);
        return; // Success, exit the function
      } catch (error) {
        lastError = error;

        // Check if it's a throughput error
        const errorMessage = JSON.stringify(error);
        const isThroughputError = errorMessage.includes('throughput') ||
                                   errorMessage.includes('ProvisionedThroughputExceededException');

        // GraphQL may throw with partial errors but still have valid data
        if (error?.data?.searchUsersPublic) {
          const results = error.data.searchUsersPublic.filter(item => item != null);

          // Resolve S3 keys to signed URLs for profile photos
          const resultsWithResolvedPhotos = await Promise.all(
            results.map(async (user) => ({
              ...user,
              profilePhotoUrl: await resolveProfilePhotoUrl(user.profilePhotoUrl)
            }))
          );

          setSearchResults(resultsWithResolvedPhotos);
          setIsSearching(false);
          return; // Got partial data, exit
        }

        if (isThroughputError && attempt < maxRetries) {
          // Exponential backoff: 200ms, 400ms, 800ms
          const delay = Math.pow(2, attempt) * 200;
          console.log(`[Explore] Throughput error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (!isThroughputError) {
          // Non-throughput error, don't retry
          console.log('[Explore] Error searching users:', error);
          setSearchResults([]);
          setIsSearching(false);
          return;
        }
      }
    }

    // All retries exhausted - use console.log to avoid red error screen
    console.log('[Explore] Search temporarily unavailable, please try again');
    setSearchResults([]);
    setIsSearching(false);
  }, [currentUsername]);

  // Auto-search with debouncing
  useEffect(() => {
    // Debounce delay (300ms)
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 1) {
        handleSearch(searchQuery);
      } else if (searchQuery.trim().length === 0) {
        setSearchResults([]);
        setHasSearched(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, handleSearch]);

  const handleFollowPress = useCallback(async (username, isFollowing, hasPendingRequest) => {
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
                await API.graphql({
                  query: customMutations.unfollowUser,
                  variables: {
                    followerUsername: currentUsername,
                    targetUsername: username,
                  },
                });

                // Update local state
                setSearchResults((prev) =>
                  prev.map((user) =>
                    user.username === username
                      ? { ...user, isFollowing: false, hasPendingRequest: false }
                      : user
                  )
                );
              } catch (error) {
                console.error('Error unfollowing user:', error);
                Alert.alert('Error', 'Failed to unfollow user. Please try again.');
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
            followerUsername: currentUsername,
            targetUsername: username,
          },
        });

        // Update local state
        setSearchResults((prev) =>
          prev.map((user) =>
            user.username === username
              ? { ...user, isFollowing: false, hasPendingRequest: false }
              : user
          )
        );
      } catch (error) {
        console.error('Error canceling request:', error);
        Alert.alert('Error', 'Failed to cancel request. Please try again.');
      }
    } else {
      // Follow or send request - no confirmation needed
      try {
        console.log('[Explore] Following user:', username, 'by:', currentUsername);
        const response = await API.graphql({
          query: customMutations.followUser,
          variables: {
            followerUsername: currentUsername,
            targetUsername: username,
          },
        });

        console.log('[Explore] Follow response:', JSON.stringify(response.data.followUser, null, 2));
        const { status } = response.data.followUser;
        console.log('[Explore] Status:', status);

        // Update local state based on response
        // Handle all possible "pending" statuses: pending, requested, already_requested
        const isPending = status === 'pending' || status === 'requested' || status === 'already_requested';
        setSearchResults((prev) =>
          prev.map((user) =>
            user.username === username
              ? {
                  ...user,
                  isFollowing: status === 'following',
                  hasPendingRequest: isPending,
                }
              : user
          )
        );
        console.log('[Explore] State updated for user:', username);
      } catch (error) {
        console.error('[Explore] Error following user:', error);
        Alert.alert('Error', 'Failed to follow user. Please try again.');
      }
    }
  }, [currentUsername]);

  const handleUserPress = useCallback((username) => {
    router.push(`/profile/${username}`);
  }, [router]);

  const renderUserCard = ({ item }) => (
    <UserCard
      username={item.username}
      fullName={item.fullName}
      profilePhotoUrl={item.profilePhotoUrl}
      bio={item.bio}
      isPrivate={item.isPrivate}
      isFollowing={item.isFollowing}
      hasPendingRequest={item.hasPendingRequest}
      onPress={() => handleUserPress(item.username)}
      onFollowPress={() =>
        handleFollowPress(item.username, item.isFollowing, item.hasPendingRequest)
      }
    />
  );

  const renderEmpty = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.ORANGE} />
          <Text style={styles.emptyText}>Searching...</Text>
        </View>
      );
    }

    if (hasSearched && searchResults.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Users Found</Text>
          <Text style={styles.emptyText}>
            Try searching with a different username or name
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Discover Travelers</Text>
        <Text style={styles.emptyText}>
          Search for users by name or username to follow their trips
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/feed')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={Colors.BLACK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Explore</Text>
      </View>

      <View style={styles.searchContainer}>
        <UserSearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSearch={handleSearch}
          placeholder="Search users..."
        />
      </View>

      <FlatList
        data={searchResults}
        renderItem={renderUserCard}
        keyExtractor={(item) => item.username}
        contentContainerStyle={[
          styles.listContent,
          searchResults.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.LIGHT_GRAY,
  },
  backButton: {
    padding: 2,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.BLACK,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.BLACK,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.GRAY,
    textAlign: 'center',
  },
});
