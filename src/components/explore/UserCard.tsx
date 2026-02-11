import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';

interface UserCardProps {
  username: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  isPrivate: boolean;
  isFollowing?: boolean;
  hasPendingRequest?: boolean;
  onPress: () => void;
  onFollowPress: () => void;
}

const DEFAULT_AVATAR = require('../../../assets/images/default-avatar.png');

export function UserCard({
  username,
  fullName,
  profilePhotoUrl,
  bio,
  isPrivate,
  isFollowing,
  hasPendingRequest,
  onPress,
  onFollowPress,
}: UserCardProps) {
  const getFollowButtonText = () => {
    if (hasPendingRequest) return 'Requested';
    if (isFollowing) return 'Following';
    return 'Follow';
  };

  const getFollowButtonStyle = () => {
    if (hasPendingRequest) {
      return [styles.followButton, styles.requestedButton];
    }
    if (isFollowing) {
      return [styles.followButton, styles.followingButton];
    }
    return styles.followButton;
  };

  const getFollowButtonTextStyle = () => {
    if (isFollowing) {
      return [styles.followButtonText, styles.followingButtonText];
    }
    return styles.followButtonText;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Image
        source={profilePhotoUrl ? { uri: profilePhotoUrl } : DEFAULT_AVATAR}
        style={styles.profilePhoto}
        defaultSource={DEFAULT_AVATAR}
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
        disabled={hasPendingRequest}
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
  profilePhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.LIGHT_GRAY,
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
    backgroundColor: Colors.LIGHT_GRAY,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.WHITE,
  },
  followingButtonText: {
    color: Colors.WHITE,
  },
});
