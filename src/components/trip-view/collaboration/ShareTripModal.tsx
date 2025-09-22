import React, { useState } from 'react';
import {View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { API } from 'aws-amplify';
import { addCollaborator, removeCollaborator, updateCollaboratorRole } from '../../../graphql/mutations';
import { UserSearchField } from './UserSearchField';
import { CollaboratorListItem } from './CollaboratorListItem';

interface UserProfile {
  userID: string;
  email: string;
  fullName: string;
}

interface Collaborator {
  email: string;
  fullName: string;
  userID: string;
  role: 'owner' | 'editor' | 'viewer';
  addedBy: string;
}

type CollaboratorRole = 'owner' | 'editor' | 'viewer';

interface ShareTripModalProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  collaborators: Collaborator[];
  currentUserRole: CollaboratorRole;
  currentUserID: string;
  onCollaboratorsUpdate: (updatedCollaborators: Collaborator[]) => void;
}

export const ShareTripModal: React.FC<ShareTripModalProps> = ({
  visible,
  onClose,
  tripId,
  collaborators,
  currentUserRole,
  currentUserID,
  onCollaboratorsUpdate
}) => {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole>('editor');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canInvite = () => {
    return currentUserRole === 'owner' || currentUserRole === 'editor';
  };

  const handleUserSelect = (user: UserProfile) => {
    console.log('[ShareTripModal] User selected for invitation:', user);
    setSelectedUser(user);
    setSelectedRole('editor'); // Default to editor as requested
  };

  const handleInviteConfirm = async (user: UserProfile, role: CollaboratorRole) => {
    try {
      setIsLoading(true);
      console.log('[ShareTripModal] Adding collaborator:', user, 'with role:', role);

      const result = await API.graphql({
        query: addCollaborator,
        variables: {
          tripId,
          userID: user.userID,
          userEmail: user.email,
          fullName: user.fullName,
          role
        }
      }) as any;

      const updatedTrip = result.data?.addCollaborator;
      if (updatedTrip?.collaborators) {
        console.log('[ShareTripModal] Collaborator added successfully');
        onCollaboratorsUpdate(updatedTrip.collaborators);
      }

      setSelectedUser(null);
      setSelectedRole('editor');
    } catch (error) {
      console.error('[ShareTripModal] Error adding collaborator:', error);
      Alert.alert('Error', 'Failed to add collaborator. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!selectedUser) return;
    await handleInviteConfirm(selectedUser, selectedRole);
  };

  const clearSelectedUser = () => {
    setSelectedUser(null);
    setSelectedRole('editor');
  };

  const getAvailableRoles = (): CollaboratorRole[] => {
    if (currentUserRole === 'owner') {
      return ['editor', 'viewer'];
    } else if (currentUserRole === 'editor') {
      return ['viewer'];
    }
    return [];
  };

  const handleRoleChange = async (email: string, newRole: CollaboratorRole) => {
    try {
      setIsLoading(true);
      console.log('[ShareTripModal] Updating collaborator role:', email, 'to', newRole);

      const result = await API.graphql({
        query: updateCollaboratorRole,
        variables: {
          tripId,
          userEmail: email,
          role: newRole
        }
      }) as any;

      const updatedTrip = result.data?.updateCollaboratorRole;
      if (updatedTrip?.collaborators) {
        console.log('[ShareTripModal] Collaborator role updated successfully');
        onCollaboratorsUpdate(updatedTrip.collaborators);
      }
    } catch (error) {
      console.error('[ShareTripModal] Error updating collaborator role:', error);
      Alert.alert('Error', 'Failed to update collaborator role. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCollaborator = async (email: string) => {
    try {
      setIsLoading(true);
      console.log('[ShareTripModal] Removing collaborator:', email);

      const result = await API.graphql({
        query: removeCollaborator,
        variables: {
          tripId,
          userEmail: email
        }
      }) as any;

      const updatedTrip = result.data?.removeCollaborator;
      if (updatedTrip?.collaborators) {
        console.log('[ShareTripModal] Collaborator removed successfully');
        onCollaboratorsUpdate(updatedTrip.collaborators);
      }
    } catch (error) {
      console.error('[ShareTripModal] Error removing collaborator:', error);
      Alert.alert('Error', 'Failed to remove collaborator. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Commenting out for now - will implement proper link sharing later
  // const getTripUrl = () => {
  //   return `https://atelic.app/trip/${tripId}`;
  // };

  const handleCopyLink = () => {
    // Copy trip link to clipboard
    Alert.alert('Link Copied', 'Trip link copied to clipboard');
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Share Trip</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Invite Section */}
            {canInvite() && (
              <View style={styles.inviteSection}>
                <Text style={styles.sectionTitle}>Invite people</Text>
                <View style={styles.inviteRow}>
                  <View style={styles.searchFieldContainer}>
                    <UserSearchField
                      onUserSelect={handleUserSelect}
                      existingCollaborators={collaborators}
                      placeholder="Search by name or email..."
                      selectedUser={selectedUser}
                      onClearUser={clearSelectedUser}
                    />
                  </View>

                  {/* Role Selection Dropdown - shown when user is selected */}
                  {selectedUser && (
                    <View style={styles.roleDropdownContainer}>
                      <TouchableOpacity
                        style={styles.roleDropdown}
                        onPress={() => setShowRoleDropdown(!showRoleDropdown)}
                      >
                        <Text style={styles.roleDropdownText}>
                          {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
                        </Text>
                        <Text style={styles.roleDropdownArrow}>
                          {showRoleDropdown ? '▲' : '▼'}
                        </Text>
                      </TouchableOpacity>

                      {showRoleDropdown && (
                        <View style={styles.roleOptions}>
                          {getAvailableRoles().map((role) => (
                            <TouchableOpacity
                              key={role}
                              style={[
                                styles.roleOption,
                                selectedRole === role && styles.roleOptionSelected
                              ]}
                              onPress={() => {
                                setSelectedRole(role);
                                setShowRoleDropdown(false);
                              }}
                            >
                              <Text style={[
                                styles.roleOptionText,
                                selectedRole === role && styles.roleOptionTextSelected
                              ]}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {selectedUser && (
                  <TouchableOpacity
                    style={styles.sendInviteButton}
                    onPress={handleInviteUser}
                  >
                    <Text style={styles.sendInviteButtonText}>Send Invite</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Current Collaborators Section */}
            <View style={styles.collaboratorsSection}>
              <Text style={styles.sectionTitle}>
                People with access ({collaborators.length})
              </Text>

              <View style={styles.collaboratorsList}>
                {collaborators.map((collaborator) => (
                  <CollaboratorListItem
                    key={collaborator.email}
                    collaborator={collaborator}
                    currentUserRole={currentUserRole}
                    onRoleChange={handleRoleChange}
                    onRemove={handleRemoveCollaborator}
                    isCurrentUser={collaborator.userID === currentUserID}
                  />
                ))}
              </View>
            </View>

            {/* Link Sharing Section */}
            <View style={styles.linkSection}>
              <Text style={styles.sectionTitle}>Get link</Text>
              <TouchableOpacity style={styles.linkContainer} onPress={handleCopyLink}>
                <View style={styles.linkInfo}>
                  <Text style={styles.linkTitle}>Anyone with the link</Text>
                  <Text style={styles.linkDescription}>
                    {currentUserRole === 'owner' ? 'Can view' : 'Restricted access'}
                  </Text>
                </View>
                <Text style={styles.copyText}>Copy link</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Updating...</Text>
            </View>
          )}
        </View>
      </Modal>

    </>
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
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  headerSpacer: {
    width: 50, // Match close button width for centering
  },
  content: {
    flex: 1,
  },
  inviteSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  searchFieldContainer: {
    flex: 1,
  },
  roleDropdownContainer: {
    width: 120,
  },
  roleDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 44,
  },
  roleDropdownText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  roleDropdownArrow: {
    fontSize: 12,
    color: '#666666',
  },
  roleOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  roleOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  roleOptionSelected: {
    backgroundColor: '#F0F8FF',
  },
  roleOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  roleOptionTextSelected: {
    color: '#007AFF',
  },
  sendInviteButton: {
    backgroundColor: '#0957D0',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 90,
  },
  sendInviteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  collaboratorsSection: {
    flex: 1,
  },
  collaboratorsList: {
    backgroundColor: '#FFFFFF',
  },
  linkSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
  },
  linkDescription: {
    fontSize: 14,
    color: '#666666',
  },
  copyText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});