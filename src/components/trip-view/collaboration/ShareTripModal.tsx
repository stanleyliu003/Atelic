import React, { useState } from 'react';
import {View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API } from 'aws-amplify';
import { addCollaborator, removeCollaborator, updateCollaboratorRole } from '../../../graphql/mutations';
import { UserSearchField } from './UserSearchField';
import { CollaboratorListItem } from './collaboratorPermissions';
import { useCreateTrip } from '../../../../context/CreateTripContext';

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
  selectedCity?: string;
  onCollaboratorsUpdate: (updatedCollaborators: Collaborator[]) => void;
}

export const ShareTripModal: React.FC<ShareTripModalProps> = ({
  visible,
  onClose,
  tripId,
  collaborators,
  currentUserRole,
  currentUserID,
  selectedCity,
  onCollaboratorsUpdate
}) => {
  const { getCurrentUser } = useCreateTrip();
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole>(currentUserRole === 'owner' ? 'editor' : 'viewer');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [includeMessage, setIncludeMessage] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);



  const canInvite = () => {
    return currentUserRole === 'owner' || currentUserRole === 'editor';
  };

  const handleUserSelect = (user: UserProfile) => {
    console.log('[ShareTripModal] User selected for invitation:', user);
    setSelectedUser(user);
    // Default role based on current user's role:
    // - Owners default to 'editor'
    // - Editors default to 'viewer'
    const defaultRole = currentUserRole === 'owner' ? 'editor' : 'viewer';
    setSelectedRole(defaultRole);
  };

  const handleInviteConfirm = async (user: UserProfile, role: CollaboratorRole) => {
    try {
      setIsLoading(true);
      console.log('[ShareTripModal] Adding collaborator:', user, 'with role:', role);

      const currentUser = getCurrentUser(currentUserID);
      const addedBy = currentUser?.fullName || 'Self';

      const result = await API.graphql({
        query: addCollaborator,
        variables: {
          tripId,
          userID: user.userID,
          userEmail: user.email,
          fullName: user.fullName,
          role,
          addedBy
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
    // Reset to default role based on current user's role
    const defaultRole = currentUserRole === 'owner' ? 'editor' : 'viewer';
    setSelectedRole(defaultRole);
    setIncludeMessage(false);
    setMessage('');
  };

  const getAvailableRoles = (): CollaboratorRole[] => {
    if (currentUserRole === 'owner') {
      return ['editor', 'viewer'];
    } else if (currentUserRole === 'editor') {
      return ['viewer']; // Editors can only invite viewers
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
    Alert.alert('Share link', 'Feature coming soon');
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
            <Text style={styles.headerTitle}>Share Trip</Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {/* Invite Section */}
            {canInvite() && (
              <View style={styles.inviteSection}>
                <Text style={styles.sectionTitle}>Invite collaborators</Text>
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

                {/* Message Section - shown when user is selected */}
                {selectedUser && (
                  <View style={styles.messageSection}>
                    <TouchableOpacity
                      style={styles.messageCheckboxRow}
                      onPress={() => setIncludeMessage(!includeMessage)}
                    >
                      <View style={[
                        styles.messageCheckbox,
                        includeMessage && styles.messageCheckboxSelected
                      ]}>
                        {includeMessage && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.messageCheckboxLabel}>Notify people</Text>
                    </TouchableOpacity>

                    {includeMessage && (
                      <TextInput
                        style={[
                          styles.messageInput,
                          message.length > 0 && styles.messageInputActive
                        ]}
                        placeholder="Message"
                        placeholderTextColor="#999999"
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        numberOfLines={4}
                      />
                    )}
                  </View>
                )}

                {selectedUser && (
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={clearSelectedUser}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.shareButton}
                      onPress={handleInviteUser}
                    >
                      <Text style={styles.shareButtonText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Current Collaborators Section */}
            <View style={styles.collaboratorsSection}>
              <Text style={styles.sectionTitle}>
                People with access
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
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: 35, // Account for status bar
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    zIndex: 2000,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'outfit-bold',
    fontWeight: '600',
    color: '#333333',
  },
  content: {
    flex: 1,
  },
  inviteSection: {
    marginTop: 15,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'outfit-medium',
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
    zIndex: 99999,
    elevation: 1000,
  },
  roleDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 44,
    backgroundColor: '#F8F9FA',
    zIndex: 99999,
    elevation: 1000,
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
    zIndex: 99999,
    elevation: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
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
  messageSection: {
    marginTop: 0,
    zIndex: -1,
    elevation: -1,
  },
  messageCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  messageCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  messageCheckboxLabel: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  messageCheckboxSelected: {
    backgroundColor: '#0957D0',
    borderColor: '#0957D0',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 150,
    zIndex: -1,
    elevation: -1,
  },
  messageInputActive: {
    borderColor: '#0957D0',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
    zIndex: -1,
    elevation: -1,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: '#0957D0',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#0957D0',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  collaboratorsSection: {
    flex: 1,
    marginTop: 12,
    paddingHorizontal: 16,
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