import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../../constants/Colors';

interface FollowRequestItemProps {
  username: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  onUserPress: () => void;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}

const DEFAULT_AVATAR = require('../../../assets/images/default-avatar.png');

export function FollowRequestItem({
  username,
  fullName,
  profilePhotoUrl,
  bio,
  createdAt,
  onUserPress,
  onApprove,
  onReject,
}: FollowRequestItemProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove();
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject();
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const isProcessing = isApproving || isRejecting;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.userInfo} onPress={onUserPress} disabled={isProcessing}>
        <Image
          source={profilePhotoUrl ? { uri: profilePhotoUrl } : DEFAULT_AVATAR}
          style={styles.profilePhoto}
          defaultSource={DEFAULT_AVATAR}
        />

        <View style={styles.textContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.fullName} numberOfLines={1}>
              {fullName}
            </Text>
            <Text style={styles.time}>{formatTime(createdAt)}</Text>
          </View>

          <Text style={styles.username} numberOfLines={1}>
            @{username}
          </Text>

          {bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {bio}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={handleReject}
          disabled={isProcessing}
        >
          {isRejecting ? (
            <ActivityIndicator size="small" color={Colors.GRAY} />
          ) : (
            <Text style={styles.rejectButtonText}>Decline</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.approveButton]}
          onPress={handleApprove}
          disabled={isProcessing}
        >
          {isApproving ? (
            <ActivityIndicator size="small" color={Colors.WHITE} />
          ) : (
            <Text style={styles.approveButtonText}>Approve</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: Colors.LIGHT_GRAY,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  userInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  profilePhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.LIGHT_GRAY,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.BLACK,
    flex: 1,
  },
  time: {
    fontSize: 12,
    color: Colors.GRAY,
    marginLeft: 8,
  },
  username: {
    fontSize: 14,
    color: Colors.GRAY,
    marginTop: 2,
  },
  bio: {
    fontSize: 14,
    color: Colors.DARK_GRAY,
    marginTop: 4,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  approveButton: {
    backgroundColor: Colors.BLACK,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.WHITE,
  },
  rejectButton: {
    backgroundColor: Colors.LIGHT_GRAY,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.BLACK,
  },
});
