import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal
} from 'react-native';
import { API } from 'aws-amplify';
import { searchUsers } from '../../../graphql/queries';
import { getAvatarColor } from '../../../utils/avatarColors';

interface UserProfile {
  userID: string;
  email: string;
  fullName: string;
  username: string;
  isExternalProvider?: boolean;
  identities?: string | null;
}

interface UserSearchFieldProps {
  onUserSelect: (user: UserProfile) => void;
  existingCollaborators?: UserProfile[];
  placeholder?: string;
  selectedUser?: UserProfile | null;
  onClearUser?: () => void;
}

export const UserSearchField: React.FC<UserSearchFieldProps> = ({
  onUserSelect,
  existingCollaborators = [],
  placeholder = "Search by name or email...",
  selectedUser = null,
  onClearUser
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search effect
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      await performSearch(searchTerm.trim());
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const performSearch = async (term: string) => {
    try {
      setIsSearching(true);
      console.log('[UserSearchField] Searching for:', term);

      const result = await API.graphql({
        query: searchUsers,
        variables: { searchTerm: term }
      }) as any;

      const users = result.data?.searchUsers || [];
      console.log('[UserSearchField] Search results:', users);

      // Filter out users who are already collaborators
      const existingEmails = existingCollaborators.map(c => c.email.toLowerCase());
      const filteredUsers = users.filter((user: UserProfile) =>
        !existingEmails.includes(user.email.toLowerCase())
      );

      setSearchResults(filteredUsers);
      setShowResults(true);
    } catch (error) {
      console.error('[UserSearchField] Search error:', error);
      Alert.alert('Search Error', 'Failed to search users. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserSelect = (user: UserProfile) => {
    console.log('[UserSearchField] User selected:', user);
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
    onUserSelect(user);
  };

  const handleInputBlur = () => {
    // Delay hiding results to allow for tap on result
    setTimeout(() => setShowResults(false), 150);
  };

  return (
    <View style={styles.container}>
      <View style={[
        styles.searchInputContainer,
        (searchTerm.length > 0 || selectedUser) && styles.searchInputContainerActive
      ]}>
        <TextInput
          style={styles.searchInput}
          placeholder={selectedUser ? selectedUser.fullName : placeholder}
          value={selectedUser ? selectedUser.fullName : searchTerm}
          onChangeText={selectedUser ? undefined : setSearchTerm}
          onFocus={() => selectedUser ? undefined : (searchResults.length > 0 && setShowResults(true))}
          onBlur={selectedUser ? undefined : handleInputBlur}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!selectedUser}
        />
        {selectedUser && onClearUser && (
          <TouchableOpacity onPress={onClearUser} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
        {isSearching && !selectedUser && (
          <ActivityIndicator
            size="small"
            color="#666"
            style={styles.searchSpinner}
          />
        )}
      </View>

      {/* Render results in a Modal to ensure it's above everything */}
      <Modal
        visible={showResults && !selectedUser}
        transparent={true}
        animationType="none"
        onRequestClose={() => setShowResults(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowResults(false)}
        >
          <View style={styles.resultsContainer}>
            {searchResults.length > 0 ? (
              searchResults.map((user) => (
                <TouchableOpacity
                  key={user.userID}
                  style={styles.resultItem}
                  onPress={() => handleUserSelect(user)}
                >
                  <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(user.email) }]}>
                    <Text style={styles.avatarText}>
                      {user.fullName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.fullName}</Text>
                    <Text style={styles.userEmail}>@{user.username}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              searchTerm.length >= 2 && !isSearching && (
                <Text style={styles.noResultsText}>No users found</Text>
              )
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 16,
    zIndex: 10000,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    zIndex: 10000,
  },
  searchInputContainerActive: {
    borderColor: '#0957D0',
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#333333',
  },
  searchSpinner: {
    marginLeft: 8,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    paddingTop: 270, // Position below search input in ShareTripModal
    paddingHorizontal: 16,
  },
  resultsContainer: {
    backgroundColor: '#E9EEF6',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    maxHeight: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 1000,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#E9EEF6',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#666666',
  },
  noResultsText: {
    padding: 16,
    textAlign: 'center',
    color: '#666666',
    fontSize: 14,
  },
});