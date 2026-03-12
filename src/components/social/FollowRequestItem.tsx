import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../../constants/Colors';
import { InitialsAvatar } from '../common/InitialsAvatar';

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

export function FollowRequestItem({
  username,
  fullName,
  profilePhotoUrl,
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

  const isProcessing = isApproving || isRejecting;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onUserPress}
        disabled={isProcessing}
        activeOpacity={0.6}
        style={styles.userTouchable}
      >
        <InitialsAvatar
          name={fullName || username}
          profilePhotoUrl={profilePhotoUrl}
          size={52}
        />
        <View style={styles.textContainer}>
          <Text style={styles.fullName} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{username}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.confirmButton, isProcessing && styles.buttonDisabled]}
          onPress={handleApprove}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isApproving ? (
            <ActivityIndicator size="small" color={Colors.WHITE} />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteButton, isProcessing && styles.buttonDisabled]}
          onPress={handleReject}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isRejecting ? (
            <ActivityIndicator size="small" color={Colors.BLACK} />
          ) : (
            <Text style={styles.deleteButtonText}>Delete</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  userTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginLeft: 14,
  },
  fullName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.BLACK,
  },
  username: {
    fontSize: 14,
    color: Colors.GRAY,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    backgroundColor: Colors.BLACK,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.WHITE,
  },
  deleteButton: {
    backgroundColor: '#EFEFEF',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.BLACK,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
