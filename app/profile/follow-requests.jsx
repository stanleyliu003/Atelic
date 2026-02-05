import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { API, Auth } from 'aws-amplify';
import { Ionicons } from '@expo/vector-icons';
import { FollowRequestItem } from '../../src/components/social/FollowRequestItem';
import { Colors } from '../../constants/Colors';
import * as customQueries from '../../src/graphql/customQueries';
import * as customMutations from '../../src/graphql/customMutations';

export default function FollowRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');

  const loadRequests = useCallback(async () => {
    setIsLoading(true);

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
      setRequests(followRequests || []);
    } catch (error) {
      console.error('Error loading follow requests:', error);
    } finally {
      setIsLoading(false);
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

      // Remove from local state
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

      // Remove from local state
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
          <ActivityIndicator size="large" color={Colors.ORANGE} />
          <Text style={styles.emptyText}>Loading requests...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color={Colors.GRAY} />
        <Text style={styles.emptyTitle}>No Follow Requests</Text>
        <Text style={styles.emptyText}>
          When people request to follow you, they'll appear here
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.BLACK} />
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
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.GRAY,
    textAlign: 'center',
  },
});
