import { Colors } from '../../constants/Colors';
import { Auth, API } from 'aws-amplify';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';

const searchUsers = /* GraphQL */ `
  query SearchUsers($searchTerm: String!) {
    searchUsers(searchTerm: $searchTerm) {
      userID
      email
      fullName
      username
      isExternalProvider
      identities
      __typename
    }
  }
`;

export default function UsernameSetup() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setError('');
    setIsLoading(true);

    // Validate username format first
    if (!username || username.trim().length < 5) {
      setError('Username must be at least 5 characters long.');
      setIsLoading(false);
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]{5,20}$/;
    if (!usernameRegex.test(username)) {
      setError('Username must be 5-20 characters and contain only letters, numbers, and underscores.');
      setIsLoading(false);
      return;
    }

    try {
      // Step 1: Check if username is already taken
      console.log('Checking username availability for:', username.trim());

      const result = await API.graphql({
        query: searchUsers,
        variables: { searchTerm: username.trim() }
      });

      const users = result.data?.searchUsers || [];

      // Check if any user has this exact username
      const usernameExists = users.some(
        user => user.username?.toLowerCase() === username.trim().toLowerCase()
      );

      if (usernameExists) {
        setError('This username is already taken. Please choose another one.');
        setIsLoading(false);
        return;
      }

      console.log('Username is available, proceeding to update...');

      // Step 2: Username is available, update the user's preferred_username
      const user = await Auth.currentAuthenticatedUser();

      // Update preferred_username attribute
      await Auth.updateUserAttributes(user, {
        'preferred_username': username.trim()
      });

      console.log('Username updated successfully:', username);

      // Redirect to main app
      router.replace('(tabs)/create_new_trip');

    } catch (err) {
      console.error('Failed to update username:', err);

      if (err.message?.includes('PreferredUsernameExistsException') || err.code === 'AliasExistsException') {
        setError('This username is already taken. Please choose another one.');
      } else {
        setError(err.message || 'Failed to set username. Please try again.');
      }
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.WHITE }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Choose Your Username</Text>
          <View style={{ marginTop: 40 }}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder='Enter Username (5-20 characters)'
              value={username}
              onChangeText={(value) => setUsername(value)}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoFocus={true}
              editable={!isLoading}
            />
          </View>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleContinue}
            disabled={isLoading || username.length < 5}
            style={[
              styles.button,
              {
                opacity: (username.length >= 5 && !isLoading) ? 1 : 0.3
              }
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.WHITE} />
            ) : (
              <Text style={styles.buttonText}>Next</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
    padding: 25,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
  },
  title: {
    fontFamily: 'outfit-bold',
    fontSize: 32,
    color: Colors.BLACK,
    textAlign: 'center',
  },
  label: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: Colors.BLACK,
    marginBottom: 8,
  },
  input: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 15,
    borderColor: Colors.GRAY,
    fontFamily: 'outfit',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'outfit',
  },
  button: {
    padding: 20,
    borderRadius: 15,
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F36406',
  },
  buttonText: {
    color: Colors.WHITE,
    textAlign: 'center',
    fontFamily: 'outfit-medium',
    fontSize: 17,
  },
});
