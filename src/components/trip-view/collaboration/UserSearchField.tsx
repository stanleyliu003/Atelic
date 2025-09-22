import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert
} from 'react-native';
import { API } from 'aws-amplify';
import { searchUsers } from '../../../graphql/queries';

interface UserProfile {
  userID: string;
  email: string;
  fullName: string;
}

interface UserSearchFieldProps {
  onUserSelect: (user: UserProfile) => void;
  existingCollaborators?: UserProfile[];
  placeholder?: string;
}

export const UserSearchField: React.FC<UserSearchFieldProps> = ({
  onUserSelect,
  existingCollaborators = [],
  placeholder = "Search by name or email..."
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
      <View style={styles.searchInputContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          value={searchTerm}
          onChangeText={setSearchTerm}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          onBlur={handleInputBlur}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isSearching && (
          <ActivityIndicator
            size="small"
            color="#666"
            style={styles.searchSpinner}
          />
        )}
      </View>

      {showResults && searchResults.length > 0 && (
        <View style={styles.resultsContainer}>
          {searchResults.map((user) => (
            <TouchableOpacity
              key={user.userID}
              style={styles.resultItem}
              onPress={() => handleUserSelect(user)}
            >
              <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>
                  {user.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.fullName}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showResults && searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
        <View style={styles.resultsContainer}>
          <Text style={styles.noResultsText}>No users found</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
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
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
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