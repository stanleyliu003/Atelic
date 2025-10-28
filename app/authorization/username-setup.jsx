import { Colors } from '../../constants/Colors';
import { Auth, API } from 'aws-amplify';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const [age, setAge] = useState('');
  const [ageError, setAgeError] = useState('');
  const [gender, setGender] = useState('');
  const [fullName, setFullName] = useState('');
  const [isExternalProvider, setIsExternalProvider] = useState(false);
  const [isAppleUser, setIsAppleUser] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  useEffect(() => {
    // Check if user signed in with external provider (Apple or Google)
    const checkUserProvider = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        const attributes = await Auth.userAttributes(user);

        console.log('User attributes:', attributes); // Debug log to see what's available

        // Check if user has identities attribute indicating external provider sign-in
        const identitiesAttr = attributes.find(attr => attr.Name === 'identities');
        if (identitiesAttr) {
          const identities = JSON.parse(identitiesAttr.Value);
          const isApple = identities.some(identity =>
            identity.providerName === 'SignInWithApple' ||
            identity.userId?.startsWith('signinwithapple_')
          );
          const isGoogle = identities.some(identity =>
            identity.providerName === 'Google' ||
            identity.userId?.startsWith('google_')
          );
          const isExternal = isApple || isGoogle;
          
          setIsExternalProvider(isExternal);
          setIsAppleUser(isApple);
          setIsGoogleUser(isGoogle);

          // For external users, check if name is already available
          if (isExternal) {
            // Check for both 'name' attribute and separate given_name/family_name attributes
            const nameAttr = attributes.find(attr => attr.Name === 'name');
            const givenNameAttr = attributes.find(attr => attr.Name === 'given_name');
            const familyNameAttr = attributes.find(attr => attr.Name === 'family_name');
            
            if (nameAttr && nameAttr.Value) {
              console.log(`${isApple ? 'Apple' : 'Google'} user name found:`, nameAttr.Value);
              setFullName(nameAttr.Value);
            } else if (givenNameAttr && familyNameAttr) {
              const fullName = `${givenNameAttr.Value} ${familyNameAttr.Value}`.trim();
              console.log(`${isApple ? 'Apple' : 'Google'} user name constructed from given_name + family_name:`, fullName);
              setFullName(fullName);
            } else if (givenNameAttr && givenNameAttr.Value) {
              console.log(`${isApple ? 'Apple' : 'Google'} user given name only:`, givenNameAttr.Value);
              setFullName(givenNameAttr.Value);
            } else {
              console.log(`${isApple ? 'Apple' : 'Google'} user name not found in attributes`);
              if (isApple) {
                console.log('This is expected for existing Apple users due to Apple\'s privacy behavior');
              }
            }
          }
        }
      } catch (err) {
        console.error('Error checking user provider:', err);
      }
    };

    checkUserProvider();
  }, []);

  const handleContinue = async () => {
    setError('');
    setAgeError('');
    setIsLoading(true);

    // Validate all fields first
    if (!username || username.trim().length < 5) {
      setError('Username must be at least 5 characters long.');
      setIsLoading(false);
      return;
    }

    // Validate full name for Google users (Apple users don't need to provide it per Apple guidelines)
    if (isGoogleUser && (!fullName || fullName.trim().length < 2)) {
      setError('Please enter your full name.');
      setIsLoading(false);
      return;
    }

    if (!gender) {
      setError('Please select your gender.');
      setIsLoading(false);
      return;
    }

    if (!age) {
      setAgeError('Please enter your age.');
      setIsLoading(false);
      return;
    }

    // Validate age is a number between 4 and 100
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 4 || ageNum > 100) {
      setAgeError('Age must be a valid number between 4 and 100.');
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

      // Convert age to birthdate format (YYYY-MM-DD) for Cognito
      // Cognito requires birthdate to be at least 10 characters
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - ageNum;
      const birthdate = `${birthYear}-01-01`;

      // Prepare attributes to update
      const attributesToUpdate = {
        'preferred_username': username.trim(),
        'gender': gender,
        'birthdate': birthdate
      };

      // Add name attribute for external provider users
      // Apple users: combine given_name + family_name into name attribute
      // Google users: use the fullName from user input
      if ((isAppleUser || isGoogleUser) && fullName.trim()) {
        attributesToUpdate['name'] = fullName.trim();
      } else {
        // Fallback: use username as fullName if no fullName is available
        attributesToUpdate['name'] = username.trim();
      }

      // Update user attributes
      await Auth.updateUserAttributes(user, attributesToUpdate);

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
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: Colors.WHITE }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={async () => {
                try {
                  await Auth.signOut();
                } catch (e) {}
                router.replace('/');
              }}
            >
              <Ionicons name="arrow-back" size={40} color="black" />
            </TouchableOpacity>
            
            <Text style={styles.title}>Complete Your Profile</Text>
            
            {/* Full Name Field - Show for Google users only (Apple users per Apple guidelines) */}
            {isGoogleUser && (
              <View style={{ marginTop: 40 }}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder='Enter your full name'
                  value={fullName}
                  onChangeText={(value) => setFullName(value)}
                  autoCapitalize="words"
                  autoCorrect={false}
                  spellCheck={false}
                  autoFocus={true}
                  editable={!isLoading}
                />
              </View>
            )}

            <View style={{ marginTop: isGoogleUser ? 20 : 40 }}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder='Enter Username (5-20 characters)'
                value={username}
                onChangeText={(value) => setUsername(value)}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoFocus={!isGoogleUser}
                editable={!isLoading}
              />
            </View>

            {/* Age Field */}
            <View style={{ marginTop: 20, marginBottom: 5 }}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                placeholder='Enter your age'
                value={age}
                onChangeText={(value) => setAge(value)}
                keyboardType="number-pad"
                autoCorrect={false}
                spellCheck={false}
                editable={!isLoading}
              />
              {ageError ? (
                <Text style={{ color: 'red', marginTop: 5, fontFamily: 'outfit', fontSize: 14 }}>{ageError}</Text>
              ) : null}
            </View>

            {/* Gender Field */}
            <View style={{ marginTop: 20, marginBottom: 5 }}>
              <Text style={styles.label}>Gender</Text>
              <View style={{ marginTop: 5, alignItems: 'center', justifyContent: 'center' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[styles.genderButton, gender === 'male' && styles.genderButtonSelected]}
                    onPress={() => setGender('male')}
                  >
                    <Text style={{ color: gender === 'male' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit' }}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.genderButton, gender === 'female' && styles.genderButtonSelected]}
                    onPress={() => setGender('female')}
                  >
                    <Text style={{ color: gender === 'female' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit' }}>Female</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.genderButton, gender === 'other' && styles.genderButtonSelected]}
                    onPress={() => setGender('other')}
                  >
                    <Text style={{ color: gender === 'other' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit' }}>Other</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <TouchableOpacity
              onPress={handleContinue}
              disabled={isLoading || username.length < 5 || !gender || !age || (isGoogleUser && !fullName)}
              style={[
                styles.button,
                {
                  opacity: (username.length >= 5 && gender && age && (!isGoogleUser || fullName) && !isLoading) ? 1 : 0.3
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
      </ScrollView>

      {/* Terms and Privacy Policy - Fixed to bottom */}
      <View style={{
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        paddingHorizontal: 25,
        paddingBottom: 20,
        backgroundColor: Colors.WHITE
      }}>
        <Text style={{
          fontFamily: 'outfit',
          fontSize: 12,
          color: Colors.GRAY,
          textAlign: 'center',
          lineHeight: 20
        }}>
          By continuing you agree to Atelic's{' '}
          <Text 
            style={{ fontFamily: 'outfit-bold', color: Colors.PRIMARY }}
            onPress={() => Linking.openURL('https://atelictravel.com/terms-of-service/')}
          >
            Terms of Service
          </Text>
          {' '}and acknowledge you've read our{' '}
          <Text 
            style={{ fontFamily: 'outfit-bold', color: Colors.PRIMARY }}
            onPress={() => Linking.openURL('https://atelictravel.com/privacy-policy/')}
          >
            Privacy Policy
          </Text>
        </Text>
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
  backButton: {
    position: 'absolute',
    top: -75,
    left: 0,
    zIndex: 1,
    padding: 5,
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
  genderButton: {
    flex: 1,
    padding: 15,
    borderWidth: 0.5,
    borderRadius: 15,
    borderColor: Colors.GRAY,
    marginRight: 10,
    backgroundColor: Colors.WHITE,
    alignItems: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#F36406',
  },
});
