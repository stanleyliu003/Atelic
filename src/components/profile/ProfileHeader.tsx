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

interface ProfileHeaderProps {
  username: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  isOwnProfile: boolean;
  isPrivate: boolean;
  isFollowing?: boolean;
  hasPendingRequest?: boolean;
  onFollowPress?: () => void;
  onEditPress?: () => void;
}

const DEFAULT_AVATAR = require('../../../assets/images/default-avatar.png');

export function ProfileHeader({
  username,
  fullName,
  profilePhotoUrl,
  bio,
  isOwnProfile,
  isPrivate,
  isFollowing,
  hasPendingRequest,
  onFollowPress,
  onEditPress,
}: ProfileHeaderProps) {
  const getFollowButtonText = () => {
    if (hasPendingRequest) return 'Requested';
    if (isFollowing) return 'Following';
    return 'Follow';
  };

  const getFollowButtonStyle = () => {
    if (isFollowing) {
      return styles.followingButton;
    }
    return styles.followButton;
  };

  return (
    <View style={styles.container}>
      {/* Profile Photo */}
      <View style={styles.photoContainer}>
        <Image
          source={profilePhotoUrl ? { uri: profilePhotoUrl } : DEFAULT_AVATAR}
          style={styles.profilePhoto}
          defaultSource={DEFAULT_AVATAR}
        />
      </View>

      {/* Full Name */}
      <Text style={styles.fullName}>{fullName}</Text>

      {/* Username */}
      <View style={styles.usernameContainer}>
        <Text style={styles.username}>@{username}</Text>
        {isPrivate && (
          <View style={styles.privateBadge}>
            <Ionicons name="lock-closed" size={14} color={Colors.GRAY} />
            <Text style={styles.privateText}>Private</Text>
          </View>
        )}
      </View>

      {/* Bio */}
      {bio && <Text style={styles.bio}>{bio}</Text>}

      {/* Action Button */}
      <View style={styles.buttonContainer}>
        {isOwnProfile ? (
          <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={getFollowButtonStyle()}
            onPress={onFollowPress}
            disabled={hasPendingRequest}
          >
            <Text
              style={
                isFollowing ? styles.followingButtonText : styles.followButtonText
              }
            >
              {getFollowButtonText()}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: Colors.WHITE,
  },
  photoContainer: {
    marginBottom: 12,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.LIGHT_GRAY,
  },
  fullName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.BLACK,
    marginBottom: 4,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  username: {
    fontSize: 16,
    color: Colors.GRAY,
    marginRight: 8,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.LIGHT_GRAY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privateText: {
    fontSize: 12,
    color: Colors.GRAY,
    marginLeft: 4,
  },
  bio: {
    fontSize: 14,
    color: Colors.DARK_GRAY,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 32,
  },
  editButton: {
    backgroundColor: Colors.LIGHT_GRAY,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.BLACK,
  },
  followButton: {
    backgroundColor: Colors.BLACK,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.WHITE,
  },
  followingButton: {
    backgroundColor: Colors.WHITE,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.GRAY,
  },
  followingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.BLACK,
  },
});
