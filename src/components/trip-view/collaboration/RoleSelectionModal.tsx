import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';

interface UserProfile {
  userID: string;
  email: string;
  fullName: string;
}

type CollaboratorRole = 'owner' | 'editor' | 'viewer';

interface RoleSelectionModalProps {
  visible: boolean;
  selectedUser: UserProfile | null;
  currentUserRole: CollaboratorRole;
  onConfirm: (user: UserProfile, role: CollaboratorRole) => void;
  onCancel: () => void;
}

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  visible,
  selectedUser,
  currentUserRole,
  onConfirm,
  onCancel
}) => {
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole>('viewer');

  // Determine available roles based on current user's permissions
  const getAvailableRoles = (): CollaboratorRole[] => {
    if (currentUserRole === 'owner') {
      return ['editor', 'viewer'];
    } else if (currentUserRole === 'editor') {
      return ['viewer'];
    }
    return []; // viewers can't invite anyone
  };

  const availableRoles = getAvailableRoles();

  const handleConfirm = () => {
    if (!selectedUser) {
      Alert.alert('Error', 'No user selected');
      return;
    }

    if (!availableRoles.includes(selectedRole)) {
      Alert.alert('Error', 'Invalid role selected');
      return;
    }

    console.log('[RoleSelectionModal] Inviting user:', selectedUser, 'as', selectedRole);
    onConfirm(selectedUser, selectedRole);
  };

  const getRoleDescription = (role: CollaboratorRole): string => {
    switch (role) {
      case 'editor':
        return 'Can view and edit the trip';
      case 'viewer':
        return 'Can view the trip only';
      default:
        return '';
    }
  };

  const getRoleColor = (role: CollaboratorRole): string => {
    switch (role) {
      case 'editor':
        return '#4CAF50';
      case 'viewer':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  if (!selectedUser) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invite to Trip</Text>
          <TouchableOpacity onPress={handleConfirm} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* User Profile Section */}
          <View style={styles.userSection}>
            <View style={styles.userAvatar}>
              <Text style={styles.avatarText}>
                {selectedUser.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{selectedUser.fullName}</Text>
              <Text style={styles.userEmail}>{selectedUser.email}</Text>
            </View>
          </View>

          {/* Role Selection Section */}
          <View style={styles.roleSection}>
            <Text style={styles.roleSectionTitle}>Choose access level:</Text>

            {availableRoles.map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleOption,
                  selectedRole === role && styles.roleOptionSelected
                ]}
                onPress={() => setSelectedRole(role)}
              >
                <View style={styles.roleOptionContent}>
                  <View style={styles.roleOptionLeft}>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(role) }]}>
                      <Text style={styles.roleBadgeText}>{role.toUpperCase()}</Text>
                    </View>
                    <View style={styles.roleTextContainer}>
                      <Text style={styles.roleTitle}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
                      <Text style={styles.roleDescription}>{getRoleDescription(role)}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.radioButton,
                    selectedRole === role && styles.radioButtonSelected
                  ]}>
                    {selectedRole === role && <View style={styles.radioButtonInner} />}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {availableRoles.length === 0 && (
            <View style={styles.noPermissionContainer}>
              <Text style={styles.noPermissionText}>
                You don't have permission to invite collaborators.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: 50, // Account for status bar
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  sendButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sendButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 24,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666666',
  },
  roleSection: {
    flex: 1,
  },
  roleSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  roleOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  roleOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  roleOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 12,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  roleTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  roleDescription: {
    fontSize: 14,
    color: '#666666',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#007AFF',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  noPermissionContainer: {
    padding: 24,
    alignItems: 'center',
  },
  noPermissionText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});