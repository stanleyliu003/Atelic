import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform
} from 'react-native';
import { getAvatarColor } from '../../../utils/avatarColors';

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
}

export const CollaboratorListItem: React.FC<CollaboratorListItemProps> = ({
  collaborator,
  currentUserRole,
  onRoleChange,
  onRemove,
  isCurrentUser
}) => {
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
    Alert.alert(
      'Change Role',
      `Change ${collaborator.fullName}'s role to ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: () => {
            console.log('[CollaboratorListItem] Changing role:', collaborator.username, 'to', newRole);
            onRoleChange(collaborator.username, newRole);
          }
        }
      ]
    );
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
      <View style={styles.userInfo}>
        <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(collaborator.email) }]}>
          <Text style={styles.avatarText}>
            {collaborator.fullName.charAt(0).toUpperCase()}
          </Text>
        </View>

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
      </View>

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