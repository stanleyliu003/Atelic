import { Colors } from '../../constants/Colors';
import { Auth, API } from 'aws-amplify';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DeviceInfo from 'react-native-device-info';
import DateTimePicker from '@react-native-community/datetimepicker';

const updateUserProfileMutation = /* GraphQL */ `
  mutation UpdateUserProfile($username: String!, $action: String!, $tripData: AWSJSON) {
    updateUserProfile(username: $username, action: $action, tripData: $tripData) {
      __typename
    }
  }
`;

const getUserProfileQuery = /* GraphQL */ `
  query GetUserProfile($username: String) {
    getUserProfile(username: $username) {
      username
      accountCreatedAt
      lastActiveAt
      appVersion
      deviceType
      modelName
      osVersion
      __typename
    }
  }
`;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() - 25)));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('');
  const [fullName, setFullName] = useState('');
  const [isExternalProvider, setIsExternalProvider] = useState(false);
  const [isAppleUser, setIsAppleUser] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [selectedUseCases, setSelectedUseCases] = useState([]);

  const activityOptions = [
    { label: 'History', emoji: '🏛️', value: 'history' },
    { label: 'Foodie', emoji: '🍜', value: 'foodie' },
    { label: 'Art', emoji: '🎨', value: 'art' },
    { label: 'Hidden Gems', emoji: '✨', value: 'hidden-gems' },
    { label: 'Relaxation', emoji: '🧘‍♀️', value: 'relaxation' },
    { label: 'Outdoors', emoji: '🌲', value: 'outdoors' },
    { label: 'Nightlife', emoji: '🍸', value: 'nightlife' },
    { label: 'Luxury', emoji: '💎', value: 'luxury' },
    { label: 'Budget', emoji: '🎒', value: 'budget' },
    { label: 'Kid Friendly', emoji: '🧸', value: 'kid-friendly' },
  ];

  const useCaseOptions = [
    {
      label: 'Collaborate with friends',
      description: 'Invite your friends and family to join your trip and plan special memories together.'
    },
    {
      label: 'Organize my itinerary',
      description: 'Build the perfect itinerary customized to your schedule. Get directions, time estimates, and add notes about each place.'
    },
    {
      label: 'Find unique things to do',
      description: 'Receive activity recommendations personalized to your interests.'
    },
    {
      label: 'Manage trip expenses',
      description: 'Track costs of each travel expenses to stay within your travel budget.'
    },
    {
      label: 'Keep all my bookings in one place',
      description: 'Import your flight, hotel, reservations, and ticket details into your itinerary.'
    },
  ];

  useEffect(() => {
    // Check if user signed in with external provider (Apple or Google)
    const checkUserProvider = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        const attributes = await Auth.userAttributes(user);

        console.log('User attributes:', attributes);

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

  // Extract first name from full name
  const getFirstName = () => {
    if (!fullName) return '';
    return fullName.trim().split(' ')[0];
  };

  // Calculate age from birthdate
  const calculateAge = (birthdate) => {
    if (!birthdate) return null;
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Toggle activity selection
  const toggleActivity = (value) => {
    if (selectedActivities.includes(value)) {
      setSelectedActivities(selectedActivities.filter(item => item !== value));
    } else {
      setSelectedActivities([...selectedActivities, value]);
    }
  };

  // Toggle use case selection
  const toggleUseCase = (label) => {
    if (selectedUseCases.includes(label)) {
      setSelectedUseCases(selectedUseCases.filter(item => item !== label));
    } else {
      setSelectedUseCases([...selectedUseCases, label]);
    }
  };

  const handleContinue = async () => {
    setError('');
    setIsLoading(true);

    // Validate all fields first
    if (!username || username.trim().length < 5) {
      setError('Username must be at least 5 characters long.');
      setIsLoading(false);
      return;
    }

    if (!fullName || fullName.trim().length < 2) {
      setError('Please enter your full name.');
      setIsLoading(false);
      return;
    }

    if (!gender) {
      setError('Please select your gender.');
      setIsLoading(false);
      return;
    }

    if (!selectedDate) {
      setError('Please select your birthday.');
      setIsLoading(false);
      return;
    }

    // Validate age is between 4 and 100
    const age = calculateAge(selectedDate);
    if (!age || age < 4 || age > 100) {
      setError('Age must be between 4 and 100.');
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

      // Format birthdate as YYYY-MM-DD for Cognito
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const birthdate = `${year}-${month}-${day}`;

      // Prepare attributes to update
      const attributesToUpdate = {
        'preferred_username': username.trim(),
        'gender': gender,
        'birthdate': birthdate,
        'name': fullName.trim()
      };

      // Update user attributes
      await Auth.updateUserAttributes(user, attributesToUpdate);

      console.log('Username updated successfully:', username);

      // Set accountCreatedAt once (no overwrite) in UserProfiles
      try {
        const current = await Auth.currentAuthenticatedUser();
        const prefUsernameAttr = (await Auth.userAttributes(current)).find(a => a.Name === 'preferred_username');
        const prefUsername = prefUsernameAttr?.Value || username.trim();
        const cognitoUserId = current.username;
        const appVersion = DeviceInfo.getVersion() || null;
        const osName = DeviceInfo.getSystemName() || null;
        const osVersion = DeviceInfo.getSystemVersion() || null;
        const modelName = DeviceInfo.getModel() || null;
        await API.graphql({
          query: updateUserProfileMutation,
          variables: {
            username: prefUsername,
            action: 'SET_ACCOUNT_CREATED_AT',
            tripData: JSON.stringify({
              createdAt: new Date().toISOString(),
              userID: cognitoUserId,
              appVersion,
              deviceType: osName,
              modelName,
              osVersion
            })
          },
          authMode: 'AMAZON_COGNITO_USER_POOLS'
        });
        // Best-effort read after write
        try {
          await API.graphql({
            query: getUserProfileQuery,
            variables: { username: prefUsername },
            authMode: 'AMAZON_COGNITO_USER_POOLS'
          });
        } catch (readErr) {
        }
      } catch (e) {
        console.warn('[UsernameSetup] Failed to set accountCreatedAt:', e?.errors || e?.message || e);
      }

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

  const handleNext = () => {
    setError('');

    if (currentPage === 1) {
      // Validate full name
      if (!fullName || fullName.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }
      setCurrentPage(2);
    } else if (currentPage === 2) {
      // Validate birthday
      if (!selectedDate) {
        setError('Please select your birthday.');
        return;
      }
      const age = calculateAge(selectedDate);
      if (!age || age < 4 || age > 100) {
        setError('Age must be between 4 and 100.');
        return;
      }
      setCurrentPage(3);
    } else if (currentPage === 3) {
      // Validate username
      if (!username || username.trim().length < 5) {
        setError('Username must be at least 5 characters long.');
        return;
      }
      const usernameRegex = /^[a-zA-Z0-9_]{5,20}$/;
      if (!usernameRegex.test(username)) {
        setError('Username must be 5-20 characters and contain only letters, numbers, and underscores.');
        return;
      }
      setCurrentPage(4);
    } else if (currentPage === 4) {
      // Validate gender
      if (!gender) {
        setError('Please select your gender.');
        return;
      }
      setCurrentPage(5);
    } else if (currentPage === 5) {
      // Activities page - no validation required
      setCurrentPage(6);
    } else if (currentPage === 6) {
      // Final page - submit
      handleContinue();
    }
  };

  const handleBack = () => {
    setError('');
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    } else {
      // Sign out and go back to login
      Auth.signOut({ global: false }).catch(() => {});
      router.replace('/');
    }
  };

  const onDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  };

  const isNextDisabled = () => {
    if (currentPage === 1) {
      return !fullName || fullName.trim().length < 2;
    } else if (currentPage === 2) {
      return !selectedDate;
    } else if (currentPage === 3) {
      return !username || username.trim().length < 5 || username.trim().length > 20;
    } else if (currentPage === 4) {
      return !gender;
    } else if (currentPage === 5) {
      return false; // Activities page - optional
    } else if (currentPage === 6) {
      return isLoading;
    }
    return false;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.WHITE }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: Colors.WHITE }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Back Button */}
            <TouchableOpacity
              style={{ padding: 5, marginBottom: 20, alignSelf: 'flex-start' }}
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={40} color="black" />
            </TouchableOpacity>

            {/* Page 1: Full Name */}
            {currentPage === 1 && (
              <>
                <Text style={styles.title}>What's your Name?</Text>
                <Text style={styles.subtitle}>
                  This is how your friends can find you on Atelic.
                </Text>

                <View style={{ marginTop: 40 }}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    value={fullName}
                    onChangeText={(value) => setFullName(value)}
                    autoCapitalize="words"
                    autoCorrect={false}
                    spellCheck={false}
                    autoFocus={true}
                    editable={!isLoading}
                  />
                </View>
              </>
            )}

            {/* Page 2: Birthday */}
            {currentPage === 2 && (
              <>
                <Text style={styles.title}>
                  Welcome {getFirstName()}! When's your birthday?
                </Text>
                <Text style={styles.subtitle}>
                  We'll use this for activity recommendations and to keep younger users safe.
                </Text>

                <View style={{ marginTop: 40 }}>
                  <Text style={styles.label}>Birthday</Text>
                  <TouchableOpacity
                    style={styles.dateInputField}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dateInputText}>
                      {formatDate(selectedDate)}
                    </Text>
                    <Ionicons name="calendar-outline" size={24} color={Colors.GRAY} />
                  </TouchableOpacity>

                  <Text style={styles.helperText}>
                    Your birthday or age will not appear on your profile.
                  </Text>

                  <Modal
                    visible={showDatePicker}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowDatePicker(false)}
                  >
                    <TouchableOpacity
                      style={styles.modalOverlay}
                      activeOpacity={1}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                      >
                        <View style={styles.datePickerContainer}>
                          <Text style={styles.datePickerTitle}>Choose Date of Birth</Text>
                          <DateTimePicker
                            value={selectedDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={onDateChange}
                            maximumDate={new Date()}
                            minimumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 100))}
                            textColor={Colors.BLACK}
                            themeVariant="light"
                            style={styles.datePicker}
                          />
                          <TouchableOpacity
                            style={styles.datePickerOkButton}
                            onPress={() => setShowDatePicker(false)}
                          >
                            <Text style={styles.datePickerOkText}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </Modal>
                </View>
              </>
            )}

            {/* Page 3: Username */}
            {currentPage === 3 && (
              <>
                <Text style={styles.title}>Choose a Username</Text>
                <Text style={styles.subtitle}>
                  Your username will be visible to other Atelic users.
                </Text>

                <View style={{ marginTop: 40 }}>
                  <Text style={styles.label}>Username</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Username (5-20 characters)"
                    value={username}
                    onChangeText={(value) => setUsername(value)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    autoFocus={true}
                    editable={!isLoading}
                  />
                  {username.length > 0 && (username.length < 5 || username.length > 20) && (
                    <Text style={styles.validationText}>
                      Username must be between 5-20 characters
                    </Text>
                  )}
                </View>
              </>
            )}

            {/* Page 4: Gender */}
            {currentPage === 4 && (
              <>
                <Text style={styles.title}>What's your gender?</Text>
                <Text style={styles.subtitle}>
                  This helps us personalize your experience.
                </Text>

                <View style={{ marginTop: 40 }}>
                  <View style={{ gap: 15 }}>
                    <TouchableOpacity
                      style={[styles.genderButtonFull, gender === 'man' && styles.genderButtonSelected]}
                      onPress={() => setGender('man')}
                    >
                      <Text style={{ color: gender === 'man' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit', fontSize: 16 }}>Man</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderButtonFull, gender === 'woman' && styles.genderButtonSelected]}
                      onPress={() => setGender('woman')}
                    >
                      <Text style={{ color: gender === 'woman' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit', fontSize: 16 }}>Woman</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderButtonFull, gender === 'non-binary' && styles.genderButtonSelected]}
                      onPress={() => setGender('non-binary')}
                    >
                      <Text style={{ color: gender === 'non-binary' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit', fontSize: 16 }}>Non-Binary</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderButtonFull, gender === 'prefer-not-to-say' && styles.genderButtonSelected]}
                      onPress={() => setGender('prefer-not-to-say')}
                    >
                      <Text style={{ color: gender === 'prefer-not-to-say' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit', fontSize: 16 }}>Prefer not to say</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.helperText}>
                    Your gender will not appear on your profile.
                  </Text>
                </View>
              </>
            )}

            {/* Page 5: Activity Preferences */}
            {currentPage === 5 && (
              <>
                <Text style={styles.title}>What types of activities do you enjoy?</Text>
                <Text style={styles.subtitle}>
                  When you create a trip, Atelic recommends activities personalized to your interests.
                </Text>

                <View style={{ marginTop: 40 }}>
                  <View style={styles.activityGrid}>
                    {activityOptions.map((activity) => {
                      const isSelected = selectedActivities.includes(activity.value);
                      return (
                        <TouchableOpacity
                          key={activity.value}
                          style={[
                            styles.activityBox,
                            isSelected && styles.activityBoxSelected
                          ]}
                          onPress={() => toggleActivity(activity.value)}
                        >
                          <Text style={styles.activityEmoji}>{activity.emoji}</Text>
                          <Text style={[
                            styles.activityLabel,
                            { color: isSelected ? Colors.WHITE : Colors.BLACK }
                          ]}>
                            {activity.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            {/* Page 6: Use Cases */}
            {currentPage === 6 && (
              <>
                <Text style={styles.title}>What do you plan to use Atelic for?</Text>
                <Text style={styles.subtitle}>
                  Choose as many as apply.
                </Text>

                <View style={{ marginTop: 40 }}>
                  <View style={{ gap: 15 }}>
                    {useCaseOptions.map((useCase) => {
                      const isSelected = selectedUseCases.includes(useCase.label);
                      return (
                        <TouchableOpacity
                          key={useCase.label}
                          style={[
                            styles.useCaseButton,
                            isSelected && styles.useCaseButtonSelected
                          ]}
                          onPress={() => toggleUseCase(useCase.label)}
                        >
                          <Text style={[
                            styles.useCaseLabel,
                            { color: isSelected ? Colors.WHITE : Colors.BLACK }
                          ]}>
                            {useCase.label}
                          </Text>
                          {isSelected && (
                            <Text style={[
                              styles.useCaseDescription,
                              { color: Colors.WHITE }
                            ]}>
                              {useCase.description}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <TouchableOpacity
              onPress={handleNext}
              disabled={isNextDisabled()}
              style={[
                styles.button,
                {
                  opacity: isNextDisabled() ? 0.3 : 1,
                  marginTop: currentPage === 5 ? 0 : 40
                }
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.WHITE} />
              ) : (
                <Text style={styles.buttonText}>
                  {currentPage === 6 ? 'Complete' : 'Next'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Terms and Privacy Policy - Show on last page */}
            {currentPage === 6 && (
              <View style={{ marginTop: 40, paddingHorizontal: 0 }}>
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
            )}

          </View>
        </View>
      </ScrollView>
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
  subtitle: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
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
  dateInputField: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 15,
    borderColor: Colors.GRAY,
    fontFamily: 'outfit',
    fontSize: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateInputText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.BLACK,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    backgroundColor: Colors.WHITE,
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  datePickerTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 20,
    color: Colors.BLACK,
    marginBottom: 15,
    textAlign: 'center',
  },
  datePicker: {
    width: 320,
    height: 200,
  },
  datePickerOkButton: {
    width: '100%',
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#F36406',
    alignItems: 'center',
    marginTop: 15,
  },
  datePickerOkText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: Colors.WHITE,
  },
  helperText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    textAlign: 'center',
    marginTop: 10,
  },
  validationText: {
    color: 'red',
    marginTop: 5,
    fontFamily: 'outfit',
    fontSize: 14,
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
  genderButtonFull: {
    width: '100%',
    padding: 18,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#F36406',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  activityBox: {
    width: '48%',
    aspectRatio: 1.43,
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBoxSelected: {
    backgroundColor: '#F36406',
  },
  activityEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  activityLabel: {
    fontFamily: 'outfit',
    fontSize: 16,
    textAlign: 'center',
  },
  useCaseButton: {
    width: '100%',
    padding: 18,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  useCaseButtonSelected: {
    backgroundColor: '#F36406',
  },
  useCaseLabel: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    textAlign: 'center',
  },
  useCaseDescription: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    textAlign: 'left',
    marginTop: 8,
    paddingHorizontal: 10,
    lineHeight: 20,
  },
});
