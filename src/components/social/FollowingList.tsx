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

interface Following {
  username: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  isPrivate: boolean;
  followersCount: number;
  followingCount: number;
}

interface FollowingListProps {
  following: Following[];
  isLoading: boolean;
  isRefreshing?: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh?: () => void;
  onUserPress: (username: string) => void;
  onUnfollowPress: (username: string) => void;
}

export function FollowingList({
  following,
  isLoading,
  isRefreshing = false,
  hasMore,
  onLoadMore,
  onRefresh,
  onUserPress,
  onUnfollowPress,
}: FollowingListProps) {
  const renderItem = ({ item }: { item: Following }) => (
    <UserCard
      username={item.username}
      fullName={item.fullName}
      profilePhotoUrl={item.profilePhotoUrl}
      bio={item.bio}
      isPrivate={item.isPrivate}
      isFollowing={true}
      hasPendingRequest={false}
      onPress={() => onUserPress(item.username)}
      onFollowPress={() => onUnfollowPress(item.username)}
    />
  );

  const renderFooter = () => {
    if (!isLoading || !hasMore) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={Colors.ORANGE} />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading && following.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.ORANGE} />
          <Text style={styles.emptyText}>Loading following...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Not Following Anyone</Text>
        <Text style={styles.emptyText}>
          When you follow people, they'll appear here
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
      data={following}
      renderItem={renderItem}
      keyExtractor={(item) => item.username}
      contentContainerStyle={[
        styles.listContent,
        following.length === 0 && styles.emptyListContent,
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
