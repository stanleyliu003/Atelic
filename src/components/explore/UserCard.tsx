import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { InitialsAvatar } from '../common/InitialsAvatar';

interface UserCardProps {
  username: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  isPrivate: boolean;
  isFollowing?: boolean;
  hasPendingRequest?: boolean;
  isCurrentUser?: boolean;
  onPress: () => void;
  onFollowPress: () => void;
}

export function UserCard({
  username,
  fullName,
  profilePhotoUrl,
  bio,
  isPrivate,
  isFollowing,
  hasPendingRequest,
  isCurrentUser,
  onPress,
  onFollowPress,
}: UserCardProps) {
  const getFollowButtonText = () => {
    if (isCurrentUser) return 'View Profile';
    if (hasPendingRequest) return 'Requested';
    if (isFollowing) return 'Following';
    return 'Follow';
  };

  const getFollowButtonStyle = () => {
    if (isCurrentUser) {
      return [styles.followButton, styles.viewProfileButton];
    }
    if (hasPendingRequest) {
      return [styles.followButton, styles.requestedButton];
    }
    if (isFollowing) {
      return [styles.followButton, styles.followingButton];
    }
    return styles.followButton;
  };

  const getFollowButtonTextStyle = () => {
    if (isCurrentUser) {
      return [styles.followButtonText, styles.viewProfileButtonText];
    }
    if (hasPendingRequest) {
      return [styles.followButtonText, styles.requestedButtonText];
    }
    if (isFollowing) {
      return [styles.followButtonText, styles.followingButtonText];
    }
    return styles.followButtonText;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <InitialsAvatar
        name={fullName || username}
        profilePhotoUrl={profilePhotoUrl}
        size={50}
      />

      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.fullName} numberOfLines={1}>
            {fullName}
          </Text>
          {isPrivate && (
            <Ionicons
              name="lock-closed"
              size={14}
              color={Colors.GRAY}
              style={styles.lockIcon}
            />
          )}
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

      <TouchableOpacity
        style={getFollowButtonStyle()}
        onPress={(e) => {
          e.stopPropagation();
          onFollowPress();
        }}
      >
        <Text style={getFollowButtonTextStyle()}>{getFollowButtonText()}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: Colors.LIGHT_GRAY,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.BLACK,
  },
  lockIcon: {
    marginLeft: 4,
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
  followButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.BLACK,
    minWidth: 90,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: Colors.ORANGE,
    borderWidth: 0,
  },
  requestedButton: {
    backgroundColor: Colors.WHITE,
    borderWidth: 1,
    borderColor: Colors.GRAY,
  },
  requestedButtonText: {
    color: Colors.GRAY,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.WHITE,
  },
  followingButtonText: {
    color: Colors.WHITE,
  },
  viewProfileButton: {
    backgroundColor: Colors.LIGHT_GRAY,
  },
  viewProfileButtonText: {
    color: Colors.BLACK,
  },
});
