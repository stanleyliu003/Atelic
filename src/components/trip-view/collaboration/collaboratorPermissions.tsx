import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { API, Storage } from 'aws-amplify';
import { getAvatarColor } from '../../../utils/avatarColors';
import { getUserProfile } from '../../../graphql/queries';

// Helper function to resolve S3 keys to signed URLs
const resolveProfilePhotoUrl = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;

  // If it's already a valid HTTP URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Otherwise, treat it as an S3 key (with or without 's3://' prefix)
  const s3Key = url.startsWith('s3://') ? url.replace('s3://', '') : url;

  try {
    const signedUrl = await Storage.get(s3Key, {
      level: 'public',
      expires: 3600
    });
    if (signedUrl && (signedUrl.startsWith('http://') || signedUrl.startsWith('https://'))) {
      return signedUrl;
    }
    return null;
  } catch (error) {
    console.error('[CollaboratorPermissions] Error getting signed URL:', error);
    return null;
  }
};

interface Collaborator {
  email: string;
  fullName: string;
  username: string;
  userID: string;
  role: 'owner' | 'editor' | 'viewer';
  addedBy: string;
}

type CollaboratorRole = 'owner' | 'editor' | 'viewer';

interface CollaboratorListItemProps {
  collaborator: Collaborator;
  currentUserRole: CollaboratorRole;
  onRoleChange: (email: string, newRole: CollaboratorRole) => void;
  onRemove: (email: string) => void;
  isCurrentUser: boolean;
  onClose?: () => void;
}

export const CollaboratorListItem: React.FC<CollaboratorListItemProps> = ({
  collaborator,
  currentUserRole,
  onRoleChange,
  onRemove,
  isCurrentUser,
  onClose
}) => {
  const router = useRouter();
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  // Fetch profile photo
  useEffect(() => {
    const fetchProfilePhoto = async () => {
      if (!collaborator.username) return;

      let photoUrl: string | null = null;

      try {
        const response = await API.graphql({
          query: getUserProfile,
          variables: { username: collaborator.username },
        });
        const profile = (response as any).data?.getUserProfile;
        photoUrl = profile?.profilePhotoUrl || null;
      } catch (error) {
        // Try to extract from partial error
        const profile = (error as any)?.data?.getUserProfile;
        photoUrl = profile?.profilePhotoUrl || null;
      }

      // Resolve S3 key to signed URL
      const resolvedUrl = await resolveProfilePhotoUrl(photoUrl);
      setProfilePhotoUrl(resolvedUrl);
    };

    fetchProfilePhoto();
  }, [collaborator.username]);

  const handleProfilePress = () => {
    if (onClose) {
      onClose();
    }

    if (isCurrentUser) {
      // Navigate to own profile tab
      router.push('/(tabs)/feed');
    } else {
      // Navigate to other user's profile
      router.push(`/profile/${collaborator.username}`);
    }
  };

  const canManageCollaborator = () => {
    // Owners can manage editors and viewers
    // Editors can manage viewers only
    // Can't manage yourself or other owners
    if (isCurrentUser || collaborator.role === 'owner') {
      return false;
    }

    if (currentUserRole === 'owner') {
      return collaborator.role === 'editor' || collaborator.role === 'viewer';
    }

    if (currentUserRole === 'editor') {
      return collaborator.role === 'viewer';
    }

    return false;
  };

  const getAvailableRoles = (): CollaboratorRole[] => {
    let roles: CollaboratorRole[] = [];

    if (currentUserRole === 'owner') {
      // Owners can promote/demote between editor and viewer
      roles = ['editor', 'viewer'];
    } else if (currentUserRole === 'editor') {
      // Editors can only manage viewers (no role changes, just removal)
      roles = ['viewer'];
    }

    // Filter out the collaborator's current role - only show the OTHER role(s)
    return roles.filter(role => role !== collaborator.role);
  };

  const handleRolePress = () => {
    if (!canManageCollaborator()) return;

    const availableRoles = getAvailableRoles();
    const options = [
      ...availableRoles.map(role =>
        role.charAt(0).toUpperCase() + role.slice(1)
      ),
      'Remove Access',
      'Cancel'
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: options.length - 2, // "Remove Access"
          cancelButtonIndex: options.length - 1, // "Cancel"
          title: `Manage ${collaborator.fullName}`,
        },
        (buttonIndex) => {
          if (buttonIndex === options.length - 1) {
            // Cancel pressed
            return;
          } else if (buttonIndex === options.length - 2) {
            // Remove Access pressed
            handleRemoveAccess();
          } else {
            // Role selected
            const selectedRole = availableRoles[buttonIndex];
            if (selectedRole !== collaborator.role) {
              handleRoleChange(selectedRole);
            }
          }
        }
      );
    } else {
      // Android fallback - show simple alert
      Alert.alert(
        `Manage ${collaborator.fullName}`,
        'Choose an action:',
        [
          ...availableRoles.map(role => ({
            text: role.charAt(0).toUpperCase() + role.slice(1),
            onPress: () => {
              if (role !== collaborator.role) {
                handleRoleChange(role);
              }
            }
          })),
          {
            text: 'Remove Access',
            style: 'destructive',
            onPress: handleRemoveAccess
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handleRoleChange = (newRole: CollaboratorRole) => {
    // Change role immediately without confirmation
    console.log('[CollaboratorListItem] Changing role:', collaborator.username, 'to', newRole);
    onRoleChange(collaborator.username, newRole);
  };

  const handleRemoveAccess = () => {
    Alert.alert(
      'Remove Access',
      `Remove ${collaborator.fullName} from this trip?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            console.log('[CollaboratorListItem] Removing collaborator:', collaborator.username);
            onRemove(collaborator.username);
          }
        }
      ]
    );
  };

  const getRoleColor = (role: CollaboratorRole): string => {
    switch (role) {
      case 'owner':
        return '#FF6B35';
      case 'editor':
        return '#4CAF50';
      case 'viewer':
        return '#9E9E9E';
    }
  };

  const getRoleDisplayText = (role: CollaboratorRole): string => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.userInfo} onPress={handleProfilePress}>
        {profilePhotoUrl && (profilePhotoUrl.startsWith('http://') || profilePhotoUrl.startsWith('https://')) ? (
          <Image
            source={{ uri: profilePhotoUrl }}
            style={styles.userAvatarImage}
          />
        ) : (
          <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(collaborator.email) }]}>
            <Text style={styles.avatarText}>
              {collaborator.fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.userDetails}>
          <View style={styles.nameContainer}>
            <Text style={styles.userName}>
              {collaborator.fullName}
              {isCurrentUser && <Text style={styles.youIndicator}> (You)</Text>}
            </Text>
          </View>
          <Text style={styles.userEmail}>@{collaborator.username}</Text>
          {/* Commented out for now to hide the added by text. Backlog item to do {collaborator.addedBy && collaborator.addedBy !== 'Self' && (
            <Text style={styles.addedByText}>Added by {collaborator.addedBy}</Text>
          )} */}
        </View>
      </TouchableOpacity>

      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[
            styles.roleBadge,
            { backgroundColor: getRoleColor(collaborator.role) },
            canManageCollaborator() && styles.roleBadgeClickable
          ]}
          onPress={canManageCollaborator() ? handleRolePress : undefined}
          disabled={!canManageCollaborator()}
        >
          <Text style={styles.roleBadgeText}>
            {getRoleDisplayText(collaborator.role)}
          </Text>
          {canManageCollaborator() && (
            <Text style={styles.dropdownArrow}> ▼</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  youIndicator: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  userEmail: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  addedByText: {
    fontSize: 12,
    color: '#999999',
  },
  roleContainer: {
    marginLeft: 12,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadgeClickable: {
    // Add visual indication that it's clickable
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dropdownArrow: {
    color: '#FFFFFF',
    fontSize: 10,
    marginLeft: 4,
  },
});