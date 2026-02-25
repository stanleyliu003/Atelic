import React from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { UserCard } from '../explore/UserCard';
import { Colors } from '../../../constants/Colors';

interface Follower {
  username: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  isPrivate: boolean;
  followersCount: number;
  followingCount: number;
}

interface FollowersListProps {
  followers: Follower[];
  isLoading: boolean;
  isRefreshing?: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh?: () => void;
  onUserPress: (username: string) => void;
  onFollowPress: (username: string, isCurrentlyFollowing: boolean, hasPendingRequest: boolean) => void;
  currentUserFollowing: Set<string>;
  pendingRequests?: Set<string>;
  currentUsername?: string;
}

export function FollowersList({
  followers,
  isLoading,
  isRefreshing = false,
  hasMore,
  onLoadMore,
  onRefresh,
  onUserPress,
  onFollowPress,
  currentUserFollowing,
  pendingRequests = new Set(),
  currentUsername,
}: FollowersListProps) {
  const renderItem = ({ item }: { item: Follower }) => {
    const isFollowing = currentUserFollowing.has(item.username);
    const hasPendingRequest = pendingRequests.has(item.username);
    return (
      <UserCard
        username={item.username}
        fullName={item.fullName}
        profilePhotoUrl={item.profilePhotoUrl}
        bio={item.bio}
        isPrivate={item.isPrivate}
        isFollowing={isFollowing}
        hasPendingRequest={hasPendingRequest}
        isCurrentUser={currentUsername === item.username}
        onPress={() => onUserPress(item.username)}
        onFollowPress={() => onFollowPress(item.username, isFollowing, hasPendingRequest)}
      />
    );
  };

  const renderFooter = () => {
    // Don't show footer loading when list is empty (initial load shows in empty component)
    if (!isLoading || !hasMore || followers.length === 0) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={Colors.ORANGE} />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading && followers.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.ORANGE} />
          <Text style={styles.emptyText}>Loading followers...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Followers Yet</Text>
        <Text style={styles.emptyText}>
          When people follow this account, they'll appear here
        </Text>
      </View>
    );
  };

  const handleEndReached = () => {
    if (!isLoading && hasMore) {
      onLoadMore();
    }
  };

  return (
    <FlatList
      data={followers}
      renderItem={renderItem}
      keyExtractor={(item) => item.username}
      contentContainerStyle={[
        styles.listContent,
        followers.length === 0 && styles.emptyListContent,
      ]}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.ORANGE}
            colors={[Colors.ORANGE]}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
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
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.GRAY,
  },
});
