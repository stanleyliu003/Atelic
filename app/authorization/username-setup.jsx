import { Colors } from '../../constants/Colors';
import { Auth, API } from 'aws-amplify';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, ScrollView, Modal, ImageBackground, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DeviceInfo from 'react-native-device-info';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import appsFlyer from 'react-native-appsflyer';
import { clearAuthData } from '../../src/services/appGroupsService';
import { Video, ResizeMode } from 'expo-av';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

const registerDeviceTokenMutation = /* GraphQL */ `
  mutation RegisterDeviceToken($username: String) {
    registerDeviceToken(username: $username) {
      success
      message
      endpointArn
    }
  }
`;

export default function UsernameSetup() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const isReturningUser = searchParams.mode === 'returning';

  // All users start at page 1, but returning users skip gender (page 3) and username (page 4)
  const [currentPage, setCurrentPage] = useState(1);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() - 25)));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fullName, setFullName] = useState('');
  const [isExternalProvider, setIsExternalProvider] = useState(false);
  const [isAppleUser, setIsAppleUser] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [activityPreferences, setActivityPreferences] = useState([]);
  const [selectedUseCases, setSelectedUseCases] = useState([]);
  const [devicePushToken, setDevicePushToken] = useState(null);
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);

  // Video refs for demo pages
  const videoRef1 = useRef(null);
  const videoRef2 = useRef(null);
  const videoRef3 = useRef(null);
  const videoRef3_5 = useRef(null);
  const videoRef4 = useRef(null);

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
      description: 'Invite your friends and family to join your trip and plan special memories together.',
      value: 'collaborate'
    },
    {
      label: 'Organize my itinerary',
      description: 'Build the perfect itinerary customized to your schedule. Get directions, time estimates, and add notes about each place.',
      value: 'organize_itinerary'
    },
    {
      label: 'Discover unique places and activities',
      description: 'Receive activity recommendations personalized to your interests.',
      value: 'discovery'
    },
    {
      label: 'Manage trip expenses',
      description: 'Track costs of each travel expenses to stay within your travel budget.',
      value: 'manage_expenses'
    },
    {
      label: 'Keep all my bookings in one place',
      description: 'Import your flight, hotel, reservations, and ticket details into your itinerary.',
      value: 'organize_bookings'
    },
  ];

  useEffect(() => {
    // Check if user signed in with external provider (Apple or Google) OR email/password
    const checkUserProvider = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        const attributes = await Auth.userAttributes(user);

        console.log('User attributes:', attributes);

        // For returning users, pre-populate name and username from Cognito
        if (isReturningUser) {
          const nameAttr = attributes.find(attr => attr.Name === 'name');
          const givenNameAttr = attributes.find(attr => attr.Name === 'given_name');
          const familyNameAttr = attributes.find(attr => attr.Name === 'family_name');
          const preferredUsernameAttr = attributes.find(attr => attr.Name === 'preferred_username');
          const birthdateAttr = attributes.find(attr => attr.Name === 'birthdate');
          const genderAttr = attributes.find(attr => attr.Name === 'gender');

          // Set username
          if (preferredUsernameAttr?.Value) {
            setUsername(preferredUsernameAttr.Value);
            console.log('[Returning User] Loaded username:', preferredUsernameAttr.Value);
          }

          // Set name
          if (nameAttr?.Value) {
            const nameParts = nameAttr.Value.trim().split(' ');
            setFirstName(nameParts[0] || '');
            setLastName(nameParts.slice(1).join(' ') || '');
            setFullName(nameAttr.Value);
            console.log('[Returning User] Loaded name:', nameAttr.Value);
          } else if (givenNameAttr?.Value && familyNameAttr?.Value) {
            setFirstName(givenNameAttr.Value);
            setLastName(familyNameAttr.Value);
            setFullName(`${givenNameAttr.Value} ${familyNameAttr.Value}`.trim());
            console.log('[Returning User] Loaded name from given+family');
          } else if (givenNameAttr?.Value) {
            setFirstName(givenNameAttr.Value);
            setLastName('');
            setFullName(givenNameAttr.Value);
            console.log('[Returning User] Loaded name from given only');
          }

          // Set birthdate if available
          if (birthdateAttr?.Value) {
            try {
              const birthDate = new Date(birthdateAttr.Value);
              setSelectedDate(birthDate);
              console.log('[Returning User] Loaded birthdate:', birthdateAttr.Value);
            } catch (dateErr) {
              console.warn('[Returning User] Failed to parse birthdate:', dateErr);
            }
          }

          // Set gender if available
          if (genderAttr?.Value) {
            setGender(genderAttr.Value);
            console.log('[Returning User] Loaded gender:', genderAttr.Value);
          }
        }

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

          // For NEW external users (not returning), check if name is already available
          if (isExternal && !isReturningUser) {
            const nameAttr = attributes.find(attr => attr.Name === 'name');
            const givenNameAttr = attributes.find(attr => attr.Name === 'given_name');
            const familyNameAttr = attributes.find(attr => attr.Name === 'family_name');

            if (nameAttr && nameAttr.Value) {
              console.log(`${isApple ? 'Apple' : 'Google'} user name found:`, nameAttr.Value);
              const nameParts = nameAttr.Value.trim().split(' ');
              setFirstName(nameParts[0] || '');
              setLastName(nameParts.slice(1).join(' ') || '');
              setFullName(nameAttr.Value);
            } else if (givenNameAttr && familyNameAttr) {
              console.log(`${isApple ? 'Apple' : 'Google'} user name constructed from given_name + family_name`);
              setFirstName(givenNameAttr.Value || '');
              setLastName(familyNameAttr.Value || '');
              const fullName = `${givenNameAttr.Value} ${familyNameAttr.Value}`.trim();
              setFullName(fullName);
            } else if (givenNameAttr && givenNameAttr.Value) {
              console.log(`${isApple ? 'Apple' : 'Google'} user given name only:`, givenNameAttr.Value);
              setFirstName(givenNameAttr.Value);
              setLastName('');
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
  }, [isReturningUser]);

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
    if (activityPreferences.includes(value)) {
      setActivityPreferences(activityPreferences.filter(item => item !== value));
    } else {
      setActivityPreferences([...activityPreferences, value]);
    }
  };

  // Toggle use case selection
  const toggleUseCase = (value) => {
    if (selectedUseCases.includes(value)) {
      setSelectedUseCases(selectedUseCases.filter(item => item !== value));
    } else {
      setSelectedUseCases([...selectedUseCases, value]);
    }
  };

  // Request notification permissions and get device token
  const requestNotificationPermission = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Check current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      // If already denied, guide user to Settings
      if (existingStatus === 'denied') {
        setError('');
        setIsLoading(false);
        // Open iOS Settings so user can manually enable notifications
        await Linking.openURL('app-settings:');
        return null;
      }

      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        // Get the native device token (APNs token for iOS)
        const tokenData = await Notifications.getDevicePushTokenAsync();
        const deviceToken = tokenData.data;

        console.log('Device push token obtained:', deviceToken);
        setDevicePushToken(deviceToken);
        setNotificationPermissionGranted(true);

        // Store token - we'll save this to DynamoDB in handleContinue
        return deviceToken;
      } else {
        console.log('Notification permission denied');
        setNotificationPermissionGranted(false);
        // User can still continue without notifications
        return null;
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      setError('Failed to set up notifications. You can continue without notifications.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    setError('');
    setIsLoading(true);

    // Validate all fields first
    // For returning users, skip username validation (already set)
    if (!isReturningUser) {
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
    }

    if (!firstName || firstName.trim().length < 1) {
      setError('Please enter your first name.');
      setIsLoading(false);
      return;
    }

    if (!lastName || lastName.trim().length < 1) {
      setError('Please enter your last name.');
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

    try {
      const user = await Auth.currentAuthenticatedUser();

      // For NEW users only: Check if username is already taken
      if (!isReturningUser) {
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
      } else {
        console.log('[Returning User] Skipping username availability check');
      }

      // Format birthdate as YYYY-MM-DD for Cognito
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const birthdate = `${year}-${month}-${day}`;

      // Prepare attributes to update
      const attributesToUpdate = {
        'gender': gender,
        'birthdate': birthdate,
        'name': fullName.trim()
      };

      // Only update username for new users
      if (!isReturningUser) {
        attributesToUpdate['preferred_username'] = username.trim();
      }

      // Update user attributes
      await Auth.updateUserAttributes(user, attributesToUpdate);

      console.log('[OnboardingComplete] User attributes updated successfully');

      // Update UserProfiles in DynamoDB
      try {
        const current = await Auth.currentAuthenticatedUser();
        const prefUsernameAttr = (await Auth.userAttributes(current)).find(a => a.Name === 'preferred_username');
        const prefUsername = prefUsernameAttr?.Value || username.trim();
        const cognitoUserId = current.username;
        const appVersion = DeviceInfo.getVersion() || null;
        const osName = DeviceInfo.getSystemName() || null;
        const osVersion = DeviceInfo.getSystemVersion() || null;
        const modelName = DeviceInfo.getModel() || null;

        // Use different action based on user type
        const action = isReturningUser ? 'UPDATE_ONBOARDING' : 'SET_ACCOUNT_CREATED_AT';
        const tripDataPayload = {
          appVersion,
          deviceType: osName,
          modelName,
          osVersion,
          activityPreferences,
          selectedUseCases,
          devicePushToken: devicePushToken || null,
          notificationsEnabled: notificationPermissionGranted
        };

        // For new users, also include createdAt and userID
        if (!isReturningUser) {
          tripDataPayload.createdAt = new Date().toISOString();
          tripDataPayload.userID = cognitoUserId;
        }

        await API.graphql({
          query: updateUserProfileMutation,
          variables: {
            username: prefUsername,
            action: action,
            tripData: JSON.stringify(tripDataPayload)
          }
        });

        console.log(`[OnboardingComplete] UserProfile updated with action: ${action}`);

        // Link AppsFlyer attribution if available (NEW USERS ONLY)
        if (!isReturningUser) {
          try {
            // Get AppsFlyer device ID
            const appsflyerId = await appsFlyer.getAppsFlyerUID();
            
            if (appsflyerId) {
              console.log('[Attribution] Linking AppsFlyer attribution, device ID:', appsflyerId);
              
              // Call LINK_ATTRIBUTION action
              const attributionResult = await API.graphql({
                query: updateUserProfileMutation,
                variables: {
                  username: prefUsername,
                  action: 'LINK_ATTRIBUTION',
                  tripData: JSON.stringify({ appsflyerDeviceId: appsflyerId })
                }
              });
              
              console.log('[Attribution] Successfully linked attribution:', attributionResult);
              
              // Set CUID in AppsFlyer SDK to track cross-device
              appsFlyer.setCustomerUserId(cognitoUserId);
              console.log('[Attribution] Set CUID in AppsFlyer:', cognitoUserId);
            } else {
              console.log('[Attribution] No AppsFlyer device ID available');
            }
          } catch (attrErr) {
            console.warn('[Attribution] Failed to link attribution (non-blocking):', attrErr?.errors || attrErr?.message || attrErr);
            // Non-blocking - attribution linking failure shouldn't prevent signup
          }
        }

        // Register device token with SNS if notifications were granted
        if (devicePushToken && notificationPermissionGranted) {
          try {
            const registerResult = await API.graphql({
              query: registerDeviceTokenMutation,
              variables: { username: prefUsername },
              authMode: 'AMAZON_COGNITO_USER_POOLS'
            });
            console.log('Device token registered with SNS:', registerResult.data?.registerDeviceToken);
          } catch (snsErr) {
            console.warn('Failed to register device token with SNS (non-blocking):', snsErr?.errors || snsErr?.message || snsErr);
            // Non-blocking - user can still continue
          }
        }

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

  const handleNext = async () => {
    setError('');

    if (currentPage === 1) {
      // Page 1: First name and last name
      if (!firstName || firstName.trim().length < 1) {
        setError('Please enter your first name.');
        return;
      }
      if (!lastName || lastName.trim().length < 1) {
        setError('Please enter your last name.');
        return;
      }
      setCurrentPage(2);
    } else if (currentPage === 2) {
      // Page 2: Birthday
      if (!selectedDate) {
        setError('Please select your birthday.');
        return;
      }
      const age = calculateAge(selectedDate);
      if (!age || age < 4 || age > 100) {
        setError('Age must be between 4 and 100.');
        return;
      }
      // For returning users, skip page 3 (gender) and page 4 (username), go directly to page 5
      setCurrentPage(isReturningUser ? 5 : 3);
    } else if (currentPage === 3) {
      // Page 3: Gender (SKIP for returning users)
      if (!gender) {
        setError('Please select your gender.');
        return;
      }
      // Skip page 4 (username) if user already has username (from email sign-up)
      if (username && username.trim().length >= 5) {
        console.log('[UsernameSetup] Skipping username page - already set:', username);
        setCurrentPage(5); // Jump to "Good company" page
      } else {
        setCurrentPage(4); // Go to username page for OAuth users
      }
    } else if (currentPage === 4) {
      // Page 4: Username (SKIP for returning users)
      if (!username || username.trim().length < 5) {
        setError('Username must be at least 5 characters long.');
        return;
      }
      const usernameRegex = /^[a-zA-Z0-9_]{5,20}$/;
      if (!usernameRegex.test(username)) {
        setError('Username must be 5-20 characters and contain only letters, numbers, and underscores.');
        return;
      }
      setCurrentPage(5);
    } else if (currentPage === 5) {
      // Page 5: Good company page - no validation required
      setCurrentPage(6);
    } else if (currentPage === 6) {
      // Page 6: Activities page - no validation required
      setCurrentPage(7);
    } else if (currentPage === 7) {
      // Page 7: Use cases page - no validation required
      setCurrentPage(8);
    } else if (currentPage === 8) {
      // Page 8: Instagram capture image - go to first demo video
      setCurrentPage(9);
    } else if (currentPage === 9) {
      // Page 9: Demo video 1 - go to demo video 2
      setCurrentPage(10);
    } else if (currentPage === 10) {
      // Page 10: Demo video 2 - go to demo video 3
      setCurrentPage(11);
    } else if (currentPage === 11) {
      // Page 11: Demo video 3 - go to demo video 3.5
      setCurrentPage(12);
    } else if (currentPage === 12) {
      // Page 12: Demo video 3.5 - go to demo video 4
      setCurrentPage(13);
    } else if (currentPage === 13) {
      // Page 13: Demo video 4 - go to notifications
      setCurrentPage(14);
    } else if (currentPage === 14) {
      // Page 14: Notifications page - request permission then go to welcome
      await requestNotificationPermission();
      setCurrentPage(15);
    } else if (currentPage === 15) {
      // Page 15: Welcome page - submit
      handleContinue();
    }
  };

  const handleBack = () => {
    setError('');

    if (currentPage > 1) {
      // Special handling for returning users: skip pages 3 and 4 when going backwards
      if (currentPage === 5 && isReturningUser) {
        // From page 5 (Good Company), go back to page 2 (Birthday), skipping gender and username
        setCurrentPage(2);
      } else {
        setCurrentPage(currentPage - 1);
      }
    } else {
      // Sign out and go back to login
      Auth.signOut({ global: false }).catch(() => {});
      const cleared = clearAuthData();
      console.log('[UsernameSetup] Auth data clear result:', cleared ? '✅ Cleared' : '⚠️ Not available');
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
      return !firstName || firstName.trim().length < 1 || !lastName || lastName.trim().length < 1;
    } else if (currentPage === 2) {
      return !selectedDate;
    } else if (currentPage === 3) {
      return !gender;
    } else if (currentPage === 4) {
      return !username || username.trim().length < 5 || username.trim().length > 20;
    } else if (currentPage === 5) {
      return false; // Good company page - no validation
    } else if (currentPage === 6) {
      return false; // Activities page - optional
    } else if (currentPage === 7) {
      return false; // Use cases page - optional
    } else if (currentPage === 8) {
      return false; // Instagram capture page - no validation
    } else if (currentPage === 9) {
      return false; // Demo video 1 - no validation
    } else if (currentPage === 10) {
      return false; // Demo video 2 - no validation
    } else if (currentPage === 11) {
      return false; // Demo video 3 - no validation
    } else if (currentPage === 12) {
      return false; // Demo video 3.5 - no validation
    } else if (currentPage === 13) {
      return false; // Demo video 4 - no validation
    } else if (currentPage === 14) {
      return false; // Notifications page - no validation
    } else if (currentPage === 15) {
      return isLoading; // Welcome page - can submit while loading
    }
    return false;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.WHITE }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: 60,
          paddingBottom: currentPage === 7 ? 180 : ([6, 8].includes(currentPage) ? 120 : 40)
        }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: Colors.WHITE }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Back Button - hide on video pages 9, 10, 11, 12, 13 */}
            {![9, 10, 11, 12, 13].includes(currentPage) && (
              <TouchableOpacity
                style={{ padding: 5, marginBottom: 10, alignSelf: 'flex-start' }}
                onPress={handleBack}
              >
                <Ionicons name="arrow-back" size={40} color="black" />
              </TouchableOpacity>
            )}

            {/* Page 1: First Name and Last Name */}
            {currentPage === 1 && (
              <>
                <Text style={styles.title}>What's your Name?</Text>
                <Text style={styles.subtitle}>
                  This is how your friends can find you on Atelic.
                </Text>

                <View style={{ marginTop: 40, gap: 20 }}>
                  <View>
                    <Text style={styles.label}>First Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your first name"
                      value={firstName}
                      onChangeText={(value) => {
                        setFirstName(value);
                        setFullName(`${value} ${lastName}`.trim());
                      }}
                      autoCapitalize="words"
                      autoCorrect={false}
                      spellCheck={false}
                      autoFocus={true}
                      editable={!isLoading}
                    />
                  </View>

                  <View>
                    <Text style={styles.label}>Last Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your last name"
                      value={lastName}
                      onChangeText={(value) => {
                        setLastName(value);
                        setFullName(`${firstName} ${value}`.trim());
                      }}
                      autoCapitalize="words"
                      autoCorrect={false}
                      spellCheck={false}
                      editable={!isLoading}
                    />
                  </View>
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

            {/* Page 3: Gender */}
            {currentPage === 3 && (
              <>
                <Text style={styles.title}>What's your gender?</Text>
                <Text style={styles.subtitle}>
                  This helps us personalize your experience.
                </Text>

                <View style={{ marginTop: 40 }}>
                  <View style={{ gap: 15 }}>
                    <TouchableOpacity
                      style={[styles.genderButtonFull, gender === 'male' && styles.genderButtonSelected]}
                      onPress={() => setGender('male')}
                    >
                      <Text style={{ color: gender === 'male' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit', fontSize: 16 }}>Man</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderButtonFull, gender === 'female' && styles.genderButtonSelected]}
                      onPress={() => setGender('female')}
                    >
                      <Text style={{ color: gender === 'female' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit', fontSize: 16 }}>Woman</Text>
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

            {/* Page 4: Username */}
            {currentPage === 4 && (
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

            {/* Page 5: Good Company */}
            {currentPage === 5 && (
              <>
                <Text style={styles.imageTitle}>You're in good company</Text>
                <Text style={styles.imageSubtitle}>Hundreds of travelers plan their trip with Atelic</Text>
                <ImageBackground
                  source={require('../../assets/images/friends_traveling3.jpeg')}
                  style={styles.imageBackground}
                  imageStyle={styles.backgroundImage}
                />
              </>
            )}

            {/* Page 6: Activity Preferences */}
            {currentPage === 6 && (
              <>
                <Text style={styles.title}>What types of activities do you enjoy?</Text>
                <Text style={styles.subtitle}>
                  When you create a trip, Atelic recommends activities personalized to your interests.
                </Text>

                <View style={{ marginTop: 40 }}>
                  <View style={styles.activityGrid}>
                    {activityOptions.map((activity) => {
                      const isSelected = activityPreferences.includes(activity.value);
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

            {/* Page 7: Use Cases */}
            {currentPage === 7 && (
              <>
                <Text style={styles.title}>What do you plan to use Atelic for?</Text>
                <Text style={styles.subtitle}>
                  Choose as many as apply.
                </Text>

                <View style={{ marginTop: 40 }}>
                  <View style={{ gap: 15 }}>
                    {useCaseOptions.map((useCase) => {
                      const isSelected = selectedUseCases.includes(useCase.value);
                      return (
                        <TouchableOpacity
                          key={useCase.value}
                          style={[
                            styles.useCaseButton,
                            isSelected && styles.useCaseButtonSelected
                          ]}
                          onPress={() => toggleUseCase(useCase.value)}
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

            {/* Page 8: Instagram Capture */}
            {currentPage === 8 && (
              <>
                <Text style={styles.imageTitle}>Save spots from Instagram!</Text>
                <View style={styles.instagramImageContainer}>
                  <Image
                    source={require('../../assets/Instagram_Capture.png')}
                    style={styles.instagramImage}
                    resizeMode="cover"
                  />
                </View>
              </>
            )}

            {/* Pages 9, 10, 11, 12, 13 are rendered outside ScrollView as fullscreen */}

            {/* Page 14: Notification Permission */}
            {currentPage === 14 && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 10 }}>
                  <Ionicons name="notifications-outline" size={60} color="black" />
                </View>
                <Text style={styles.title}>We can remind you about</Text>

                <View style={{ marginTop: 30, gap: 20 }}>
                  <View style={styles.notificationFeatureBox}>
                    <View style={styles.notificationIconCircle}>
                      <Ionicons name="mail" size={28} color="#F36406" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notificationFeatureTitle}>Trip Invites</Text>
                      <Text style={styles.notificationFeatureDesc}>Get invited to join trips with friends</Text>
                    </View>
                  </View>

                  <View style={styles.notificationFeatureBox}>
                    <View style={styles.notificationIconCircle}>
                      <Ionicons name="people" size={28} color="#F36406" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notificationFeatureTitle}>Collaboration Updates</Text>
                      <Text style={styles.notificationFeatureDesc}>Know when friends update your shared trip</Text>
                    </View>
                  </View>

                  <View style={styles.notificationFeatureBox}>
                    <View style={styles.notificationIconCircle}>
                      <Ionicons name="calendar" size={28} color="#F36406" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notificationFeatureTitle}>Trip Reminders</Text>
                      <Text style={styles.notificationFeatureDesc}>Get reminded for upcoming trips, flights, and reservations</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.skipText}>
                  You can change this anytime in Settings
                </Text>
              </>
            )}

            {/* Page 15: Welcome */}
            {currentPage === 15 && (
              <>
                <Text style={styles.imageTitle}>Welcome {getFirstName()}</Text>
                <Text style={styles.imageSubtitle}>You're all set. Start your first itinerary, invite your travel buddies, and create your dream trip!</Text>
                <ImageBackground
                  source={require('../../assets/images/freinds_traveling4.png')}
                  style={styles.imageBackground}
                  imageStyle={styles.backgroundImage}
                />
              </>
            )}

            {/* Only show error and button for pages that DON'T have fixed bottom button */}
            {![6, 7, 8, 9, 10, 11, 12, 13].includes(currentPage) && (
              <>
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
                      marginTop: 35
                    }
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.WHITE} />
                  ) : (
                    <Text style={styles.buttonText}>
                      {currentPage === 15 ? 'Start planning' : currentPage === 14 ? 'Choose permissions' : 'Continue'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

          </View>
        </View>
      </ScrollView>

      {/* Fixed button at bottom for pages 6, 7, 8 */}
      {[6, 7, 8].includes(currentPage) && (
        <View style={styles.fixedButtonContainer}>
          {/* Terms and Privacy Policy - Only show on page 7 */}
          {currentPage === 7 && (
            <View style={{ marginBottom: 15, paddingHorizontal: 0 }}>
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

          {error ? (
            <Text style={[styles.errorText, { marginBottom: 10 }]}>{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleNext}
            disabled={isNextDisabled()}
            style={[
              styles.button,
              {
                opacity: isNextDisabled() ? 0.3 : 1,
                marginTop: 0
              }
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.WHITE} />
            ) : (
              <Text style={styles.buttonText}>
                {currentPage === 8 ? 'Try it now' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Page 9: Fullscreen Demo Video 1 - red box bottom right */}
      {currentPage === 9 && (
        <View style={styles.fullscreenVideoContainer}>
          <Video
            ref={videoRef1}
            source={require('../../assets/Demo_S1.mp4')}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={true}
            isMuted={true}
            useNativeControls={false}
          />
          <TouchableOpacity
            style={[styles.demoButton1, styles.demoButtonPosition1]}
            onPress={() => setCurrentPage(10)}
          />
        </View>
      )}

      {/* Page 10: Fullscreen Demo Video 2 */}
      {currentPage === 10 && (
        <View style={styles.fullscreenVideoContainer}>
          <Video
            ref={videoRef2}
            source={require('../../assets/Demo_S2.mp4')}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={true}
            isMuted={true}
            useNativeControls={false}
          />
          <TouchableOpacity
            style={[styles.demoButton1, styles.demoButtonPosition2]}
            onPress={() => setCurrentPage(11)}
          />
        </View>
      )}

      {/* Page 11: Fullscreen Demo Video 3 */}
      {currentPage === 11 && (
        <View style={styles.fullscreenVideoContainer}>
          <Video
            ref={videoRef3}
            source={require('../../assets/Demo_S3.mp4')}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={true}
            isMuted={true}
            useNativeControls={false}
          />
          <TouchableOpacity
            style={[styles.demoButton1, styles.demoButtonPosition3]}
            onPress={() => setCurrentPage(12)}
          />
        </View>
      )}

      {/* Page 12: Fullscreen Demo Video 3.5 */}
      {currentPage === 12 && (
        <View style={styles.fullscreenVideoContainer}>
          <Video
            ref={videoRef3_5}
            source={require('../../assets/Demo_S3.5.mov')}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={true}
            isMuted={true}
            useNativeControls={false}
          />
          <TouchableOpacity
            style={[styles.demoButton2, styles.demoButtonPosition3_5]}
            onPress={() => setCurrentPage(13)}
          />
        </View>
      )}

      {/* Page 13: Fullscreen Demo Video 4 - auto advance when finished */}
      {currentPage === 13 && (
        <View style={styles.fullscreenVideoContainer}>
          <Video
            ref={videoRef4}
            source={require('../../assets/Demo_S4.mov')}
            style={styles.fullscreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={false}
            isMuted={true}
            useNativeControls={false}
            onPlaybackStatusUpdate={(status) => {
              if (status.didJustFinish) {
                setCurrentPage(14);
              }
            }}
          />
        </View>
      )}
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
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.WHITE,
    padding: 25,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
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
    backgroundColor: '#000000',
  },
  activityGrid: {
    marginTop: -10,
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
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
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
  imageBackground: {
    width: '100%',
    height: 430,
    marginTop: 20,
  },
  backgroundImage: {
    borderRadius: 20,
  },
  imageTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 32,
    color: Colors.BLACK,
    textAlign: 'center',
  },
  imageSubtitle: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
  },
  notificationFeatureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 18,
    backgroundColor: '#F5F5F5',
    borderRadius: 15,
  },
  notificationIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationFeatureTitle: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: Colors.BLACK,
    marginBottom: 4,
  },
  notificationFeatureDesc: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    lineHeight: 20,
  },
  enableNotificationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    backgroundColor: Colors.WHITE,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#F36406',
    marginTop: 10,
  },
  enableNotificationsText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: '#F36406',
  },
  notificationSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    backgroundColor: '#ECFDF5',
    borderRadius: 15,
    marginTop: 10,
  },
  notificationSuccessText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: '#10B981',
  },
  skipText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    textAlign: 'center',
    marginTop: 20,
  },
  instagramImageContainer: {
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instagramImage: {
    width: (screenWidth - 50),
    height: (screenWidth - 50) * 1.3,
    borderRadius: 20,
  },
  demoVideo: {
    width: screenWidth - 50,
    height: (screenWidth - 50) * 1.8,
    borderRadius: 20,
    alignSelf: 'center',
  },
  fullscreenVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  fullscreenVideo: {
    width: screenWidth,
    height: screenHeight,
  },
  videoBackButton: {
    position: 'absolute',
    top: 60,
    left: 25,
    padding: 5,
    zIndex: 10,
  },
  demoButton1: {
    position: 'absolute',
    width: 80,
    height: 80,
    backgroundColor: 'transparent',
  },
  demoButton2: {
    position: 'absolute',
    width: 240,
    height: 80,
    backgroundColor: 'transparent',
  },
  demoButtonPosition1: {
    bottom: screenHeight * 0.20,
    right: 0,
  },
  demoButtonPosition2: {
    bottom: screenHeight * 0.106,
    left: (screenWidth - 80) / 2,
  },
  demoButtonPosition3: {
    bottom: screenHeight * 0.153,
    left: (screenWidth - 175) / 2,
  },
  demoButtonPosition3_5: {
    bottom: screenHeight * 0.15,
    left: (screenWidth - 240) / 2,
  },
});
