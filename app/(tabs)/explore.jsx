import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { API, Auth } from 'aws-amplify';
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
      setSearchResults(results);
    } catch (error) {
      // GraphQL may throw with partial errors but still have valid data
      if (error?.data?.searchUsersPublic) {
        const results = error.data.searchUsersPublic.filter(item => item != null);
        setSearchResults(results);
      } else {
        console.error('Error searching users:', error);
        setSearchResults([]);
      }
    } finally {
      setIsSearching(false);
    }
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
    try {
      if (isFollowing || hasPendingRequest) {
        // Unfollow or cancel pending request
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

        // Update local state based on response
        setSearchResults((prev) =>
          prev.map((user) =>
            user.username === username
              ? {
                  ...user,
                  isFollowing: status === 'following',
                  hasPendingRequest: status === 'pending',
                }
              : user
          )
        );
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
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
        <Text style={styles.headerTitle}>Explore</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.LIGHT_GRAY,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.BLACK,
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
