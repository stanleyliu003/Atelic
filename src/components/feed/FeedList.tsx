import React from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { FeedTripCard } from './FeedTripCard';
import { Colors } from '../../../constants/Colors';

interface FeedTrip {
  tripId: string;
  tripTitle?: string | null;
  selectedCity?: string | null;
  tripPhotoReference?: string[] | null;
  startDate?: string | null;
  endDate?: string | null;
  tripLength?: number | null;
  createdAt: string;
  updatedAt?: string | null;
  ownerUsername: string | null;
  ownerFullName: string | null;
  ownerProfilePhotoUrl?: string | null;
  isOwnTrip?: boolean;
}

interface FeedListProps {
  trips: FeedTrip[];
  isLoading: boolean;
  isRefreshing?: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh?: () => void;
  onTripPress: (tripId: string) => void;
  onProfilePress: (username: string) => void;
}

export function FeedList({
  trips,
  isLoading,
  isRefreshing = false,
  hasMore,
  onLoadMore,
  onRefresh,
  onTripPress,
  onProfilePress,
}: FeedListProps) {
  const renderItem = ({ item }: { item: FeedTrip }) => (
    <FeedTripCard
      trip={item}
      onTripPress={onTripPress}
      onProfilePress={onProfilePress}
    />
  );

  const renderFooter = () => {
    if (!isLoading || !hasMore) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={Colors.ORANGE} />
        <Text style={styles.loadingText}>Loading more trips...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading && trips.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.ORANGE} />
          <Text style={styles.emptyText}>Loading feed...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Trips Yet</Text>
        <Text style={styles.emptyText}>
          Follow other travelers to see their trips here
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
      data={trips}
      renderItem={renderItem}
      keyExtractor={(item) => item.tripId}
      contentContainerStyle={[
        styles.listContent,
        trips.length === 0 && styles.emptyListContent,
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
    padding: 16,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.BLACK,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.GRAY,
    textAlign: 'center',
    paddingHorizontal: 40,
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
