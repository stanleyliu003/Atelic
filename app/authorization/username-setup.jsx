import { Colors } from '../../constants/Colors';
import { Auth, API } from 'aws-amplify';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  const [birthdate, setBirthdate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('');
  const [fullName, setFullName] = useState('');
  const [isAppleUser, setIsAppleUser] = useState(false);

  useEffect(() => {
    // Check if user signed in with Apple
    const checkUserProvider = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        const attributes = await Auth.userAttributes(user);
        
        // Check if user has identities attribute indicating Apple sign-in
        const identitiesAttr = attributes.find(attr => attr.Name === 'identities');
        if (identitiesAttr) {
          const identities = JSON.parse(identitiesAttr.Value);
          const isApple = identities.some(identity => 
            identity.providerName === 'SignInWithApple' || 
            identity.userId?.startsWith('signinwithapple_')
          );
          setIsAppleUser(isApple);
        }
      } catch (err) {
        console.error('Error checking user provider:', err);
      }
    };
    
    checkUserProvider();
  }, []);

  const handleContinue = async () => {
    setError('');
    setIsLoading(true);

    // Validate all fields first
    if (!username || username.trim().length < 5) {
      setError('Username must be at least 5 characters long.');
      setIsLoading(false);
      return;
    }

    if (isAppleUser && (!fullName || fullName.trim().length < 2)) {
      setError('Please enter your full name.');
      setIsLoading(false);
      return;
    }

    if (!gender) {
      setError('Please select your gender.');
      setIsLoading(false);
      return;
    }

    if (!birthdate) {
      setError('Please select your birthdate.');
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

      // Prepare attributes to update
      const attributesToUpdate = {
        'preferred_username': username.trim(),
        'gender': gender,
        'birthdate': birthdate
      };

      // Add name attribute for Apple users
      if (isAppleUser && fullName.trim()) {
        attributesToUpdate['name'] = fullName.trim();
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
            <Text style={styles.title}>Complete Your Profile</Text>
            
            {/* Full Name Field - Only for Apple users */}
            {isAppleUser && (
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

            <View style={{ marginTop: isAppleUser ? 20 : 40 }}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder='Enter Username (5-20 characters)'
                value={username}
                onChangeText={(value) => setUsername(value)}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoFocus={!isAppleUser}
                editable={!isLoading}
              />
            </View>

            {/* Birthdate Field */}
            <View style={{ marginTop: 20, marginBottom: 5 }}>
              <Text style={styles.label}>Birthdate</Text>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'center' }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: birthdate ? Colors.PRIMARY : Colors.GRAY, fontFamily: 'outfit' }}>
                  {birthdate ? birthdate : 'Select Birthdate'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <>
                  <DateTimePicker
                    value={birthdate
                      ? new Date(
                          Number(birthdate.split('-')[0]),
                          Number(birthdate.split('-')[1]) - 1,
                          Number(birthdate.split('-')[2])
                        )
                      : new Date(2000, 0, 1)
                    }
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        const yyyy = selectedDate.getFullYear();
                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                        setBirthdate(`${yyyy}-${mm}-${dd}`);
                      }
                      if (Platform.OS === 'android') {
                        setShowDatePicker(false);
                      }
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={{ marginTop: 10, alignSelf: 'center', padding: 15, backgroundColor: '#F36406', borderRadius: 15, borderColor: Colors.PRIMARY }}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={{ color: Colors.WHITE, fontSize: 18, fontFamily: 'outfit' }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
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
              disabled={isLoading || username.length < 5 || !gender || !birthdate || (isAppleUser && !fullName)}
              style={[
                styles.button,
                {
                  opacity: (username.length >= 5 && gender && birthdate && (!isAppleUser || fullName) && !isLoading) ? 1 : 0.3
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
