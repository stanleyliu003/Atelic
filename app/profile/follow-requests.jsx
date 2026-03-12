import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { API, Auth, Storage } from 'aws-amplify';
import { Ionicons } from '@expo/vector-icons';
import { FollowRequestItem } from '../../src/components/social/FollowRequestItem';
import { Colors } from '../../constants/Colors';
import * as customQueries from '../../src/graphql/customQueries';
import * as customMutations from '../../src/graphql/customMutations';

const resolveProfilePhotoUrl = async (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  const s3Key = url.startsWith('s3://') ? url.replace('s3://', '') : url;
  try {
    const signedUrl = await Storage.get(s3Key, {
      level: 'public',
      expires: 3600,
    });
    return signedUrl;
  } catch (error) {
    console.error('Error resolving profile photo URL:', error);
    return null;
  }
};

export default function FollowRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [username, setUsername] = useState('');

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setIsLoading(true);

    try {
      const user = await Auth.currentAuthenticatedUser();
      const userName = user.attributes?.preferred_username || '';
      setUsername(userName);

      const response = await API.graphql({
        query: customQueries.getFollowRequests,
        variables: {
          targetUsername: userName,
          limit: 50,
        },
      });

      const { requests: followRequests } = response.data.getFollowRequests;

      // Resolve S3 profile photo URLs to signed HTTPS URLs
      const resolvedRequests = await Promise.all(
        (followRequests || []).map(async (req) => {
          if (req.requesterProfile?.profilePhotoUrl) {
            const resolvedUrl = await resolveProfilePhotoUrl(req.requesterProfile.profilePhotoUrl);
            return {
              ...req,
              requesterProfile: {
                ...req.requesterProfile,
                profilePhotoUrl: resolvedUrl,
              },
            };
          }
          return req;
        })
      );
      setRequests(resolvedRequests);
    } catch (error) {
      console.error('Error loading follow requests:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleUserPress = useCallback((requestUsername) => {
    router.push(`/profile/${requestUsername}`);
  }, [router]);

  const handleApprove = useCallback(async (requesterUsername) => {
    try {
      await API.graphql({
        query: customMutations.approveFollowRequest,
        variables: {
          targetUsername: username,
          requesterUsername: requesterUsername,
          action: 'approve',
        },
      });

      setRequests((prev) =>
        prev.filter((req) => req.requesterUsername !== requesterUsername)
      );
    } catch (error) {
      console.error('Error approving request:', error);
      throw error;
    }
  }, [username]);

  const handleReject = useCallback(async (requesterUsername) => {
    try {
      await API.graphql({
        query: customMutations.approveFollowRequest,
        variables: {
          targetUsername: username,
          requesterUsername: requesterUsername,
          action: 'reject',
        },
      });

      setRequests((prev) =>
        prev.filter((req) => req.requesterUsername !== requesterUsername)
      );
    } catch (error) {
      console.error('Error rejecting request:', error);
      throw error;
    }
  }, [username]);

  const renderItem = ({ item }) => (
    <FollowRequestItem
      username={item.requesterUsername}
      fullName={item.requesterProfile?.fullName || 'Unknown User'}
      profilePhotoUrl={item.requesterProfile?.profilePhotoUrl}
      bio={item.requesterProfile?.bio}
      createdAt={item.createdAt}
      onUserPress={() => handleUserPress(item.requesterUsername)}
      onApprove={() => handleApprove(item.requesterUsername)}
      onReject={() => handleReject(item.requesterUsername)}
    />
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.GRAY} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="person-add-outline" size={32} color={Colors.GRAY} />
        </View>
        <Text style={styles.emptyTitle}>No Follow Requests</Text>
        <Text style={styles.emptySubtitle}>
          When people request to follow you, they'll appear here
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={28} color={Colors.BLACK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Follow Requests</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={requests}
        renderItem={renderItem}
        keyExtractor={(item) => item.requesterUsername}
        contentContainerStyle={[
          styles.listContent,
          requests.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRequests(true)}
            tintColor={Colors.GRAY}
          />
        }
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
  listContent: {
    flexGrow: 1,
    paddingTop: 4,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 48,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.GRAY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.BLACK,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.GRAY,
    textAlign: 'center',
    lineHeight: 20,
  },
});
