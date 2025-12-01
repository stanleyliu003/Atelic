import { Amplify, Auth, Hub, API } from 'aws-amplify';
import awsconfig from '../src/aws-exports';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, AppState, Linking, Dimensions, SafeAreaView, Platform } from 'react-native';
import { Feather, AntDesign } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import DeviceInfo from 'react-native-device-info';
import { MINIMUM_APP_VERSION } from '../constants/AppConfig';
import { isVersionOutdated } from '../src/utils/versionComparison';
import { UpdateRequired } from '../src/components/UpdateRequired';

// Warm up the browser for better performance (recommended by Expo)
WebBrowser.maybeCompleteAuthSession();

// Get screen dimensions for responsive layout
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const updateUserProfileMutation = /* GraphQL */ `
  mutation UpdateUserProfile($username: String!, $action: String!, $tripData: AWSJSON) {
    updateUserProfile(username: $username, action: $action, tripData: $tripData) {
      __typename
    }
  }
`;

// CRITICAL: This configures Amplify to use expo-web-browser for OAuth
// This ensures authentication happens in an in-app browser (ASWebAuthenticationSession on iOS)
// instead of opening Safari browser
const urlOpener = async (url, redirectUrl) => {
  try {
    // Skip OAuth flow for logout URLs (prevents unwanted popup during sign-out)
    if (url.includes('/logout') || url.includes('sign_out')) {
      console.log('[OAuth] Skipping urlOpener for logout URL');
      return { type: 'cancel' };
    }

    // On iOS, this will use ASWebAuthenticationSession (in-app browser)
    // On Android, this will use Chrome Custom Tabs (in-app browser)
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl, {
      // Use persistent session to enable Google Account Chooser
      // This allows users to select from existing Google accounts on their device
      preferEphemeralSession: false,
      // Show toolbar at bottom with Done button
      showInRecents: false,
    });

    // If successful, the result should contain the callback URL with auth code
    if (result.type === 'success' && result.url) {
      // Amplify will process this URL automatically through the Linking listener
      Linking.openURL(result.url);
    } else if (result.type === 'cancel' || result.type === 'dismiss') {
      WebBrowser.dismissBrowser();
    }

    return result;
  } catch (error) {
    console.error('OAuth WebBrowser error:', error?.message);
    throw error;
  }
};

// Configure Amplify with enhanced settings and expo-web-browser
Amplify.configure({
  ...awsconfig,
  Analytics: {
    disabled: true,
  },
  oauth: {
    ...awsconfig.oauth,
    // Use expo-web-browser for OAuth flows (in-app browser)
    urlOpener: urlOpener,
  },
});


export default function Login() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showDeletedNotice, setShowDeletedNotice] = useState(false);
  const [showUpdateRequired, setShowUpdateRequired] = useState(false);
  const [currentAppVersion, setCurrentAppVersion] = useState(null);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    // Set up authentication event listeners
    const authListener = Hub.listen('auth', ({ payload: { event } }) => {
      switch (event) {
        case 'signIn':
          checkAuthenticationState();
          break;
        case 'signOut':
          router.replace('/');
          break;
        case 'tokenRefresh_failure':
          setIsCheckingAuth(false);
          break;
      }
    });

    // Set up URL event listener to handle OAuth redirects
    const urlListener = Linking.addEventListener('url', () => {
      setTimeout(() => {
        checkAuthenticationState();
      }, 1500);
    });

    // Set up app state listener for when app comes back to foreground
    const appStateListener = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setTimeout(() => {
          checkAuthenticationState();
        }, 1500);
      }
    });

    // Detect deletion success flag in initial URL (deep link) if any
    Linking.getInitialURL().then((url) => {
      if (url && url.includes('deleted=1')) {
        setShowDeletedNotice(true);
      }
    }).catch(() => {});

    // Initial auth check
    checkAuthenticationState();

    // Cleanup listeners
    return () => {
      authListener();
      urlListener.remove();
      appStateListener?.remove();
    };
  }, []);

  const checkAuthenticationState = async () => {
    // ========== VERSION CHECK (BEFORE ANYTHING ELSE) ==========
    const appVersion = DeviceInfo.getVersion() || null;
    setCurrentAppVersion(appVersion);

    const platform = Platform.OS; // 'ios' or 'android'
    const minimumVersion = MINIMUM_APP_VERSION[platform];

    if (isVersionOutdated(appVersion, minimumVersion)) {
      console.log('[Login] App version outdated, showing update prompt');
      setShowUpdateRequired(true);
      setIsCheckingAuth(false);
      return; // Block further execution - don't proceed to auth
    }
    // ===========================================================

    // Prevent multiple simultaneous navigation attempts
    if (isNavigatingRef.current) {
      return;
    }

    try {
      // This automatically handles token refresh if needed
      const user = await Auth.currentAuthenticatedUser({
        bypassCache: false // Use cached tokens for better performance
      });

      // Check again after async operation in case another call started
      if (isNavigatingRef.current) {
        return;
      }

      // Get current session to check token expiry
      const session = await Auth.currentSession();
      const accessToken = session.getAccessToken();
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = accessToken.payload.exp - now;

      // If token expires within 30 minutes, proactively refresh
      if (expiresIn < 1800) {
        await Auth.currentSession(); // This triggers refresh
      }

      // Check if user has a username set (important for Google OAuth users)
      const preferredUsername = user?.attributes?.preferred_username;

      if (!preferredUsername) {
        isNavigatingRef.current = true;
        router.replace('/authorization/username-setup');
        return;
      }

      // Update device info for all users (both old and new)
      // This ensures backward compatibility: old users without device info will get it populated
      try {
        const appVersion = DeviceInfo.getVersion() || null;
        const osName = DeviceInfo.getSystemName() || null;       // maps to deviceType
        const osVersion = DeviceInfo.getSystemVersion() || null;
        const modelName = DeviceInfo.getModel() || null;

        // CRITICAL: Pass the actual Cognito username (user.username = sub/userID)
        // NOT the preferred_username, so AdminGetUserCommand can fetch Cognito data
        const actualUsername = user.username; // This is the Cognito Username (sub)

        await API.graphql({
          query: updateUserProfileMutation,
          variables: {
            username: actualUsername, // Use actual Cognito username for API calls
            action: 'UPDATE_LOGIN',
            tripData: JSON.stringify({
              appVersion,
              deviceType: osName,
              modelName,
              osVersion,
              preferredUsername: preferredUsername // Also pass for reference
            })
          },
          authMode: 'AMAZON_COGNITO_USER_POOLS'
        });
        console.log('[Login] Updated device info for user:', preferredUsername, 'userID:', actualUsername);
      } catch (e) {
        // Don't block login if device info update fails
        console.warn('[Login] Failed to update device info:', e?.errors || e?.message || e);
      }

      // User is authenticated and has username, redirect to main app
      isNavigatingRef.current = true;
      router.replace('(tabs)/profile');

    } catch (error) {
      // Check if this is a token refresh failure
      if (error.message?.includes('refresh') || error.code === 'NotAuthorizedException') {
        try {
          // Force a token refresh attempt
          await Auth.currentSession();
          await Auth.currentAuthenticatedUser({ bypassCache: true });

          // Check navigation flag again
          if (!isNavigatingRef.current) {
            isNavigatingRef.current = true;
            router.replace('(tabs)/profile');
          }
          return;
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError.message);
        }
      }

      // User needs to sign in
      setIsCheckingAuth(false);
    }
  };

  // Show update required screen if app version is outdated
  if (showUpdateRequired && currentAppVersion) {
    return (
      <UpdateRequired
        currentVersion={currentAppVersion}
        minimumVersion={MINIMUM_APP_VERSION[Platform.OS]}
      />
    );
  }

  // Show loading spinner while checking authentication
  if (isCheckingAuth) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.WHITE
      }}>
        <ActivityIndicator size="large" color={Colors.PRIMARY} />
        <Text style={{
          fontFamily: 'outfit',
          fontSize: 16,
          marginTop: 10,
          color: Colors.GRAY
        }}>
          Checking authentication...
        </Text>
      </View>
    );
  }

  const handleGoogleSignUp = async () => {
    try {
      await Auth.federatedSignIn({ provider: 'Google' });
      // The Hub listener, URL listener, and AppState listener will handle navigation
      // No need to manually call checkAuthenticationState here
    } catch (err) {
      console.error('Google sign-up error:', err);
    }
  };

  const handleAppleSignUp = async () => {
    try {
      await Auth.federatedSignIn({ provider: 'SignInWithApple' });
      // The Hub listener, URL listener, and AppState listener will handle navigation
      // No need to manually call checkAuthenticationState here
    } catch (err) {
      console.error('Apple sign-up error:', err);
    }
  };

  // Show login screen only if user is not authenticated
  return (
    <View style={styles.outerContainer}>
      <Image
        source={require('../assets/images/multiethnic-friends-having-fun-walking-on-city-street---group-1.webp')}
        style={styles.headerImage}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeAreaBottom}>
        <View style={styles.container}>
          {showDeletedNotice && (
            <View style={{
              backgroundColor: '#e8f5e9',
              borderColor: '#a5d6a7',
              borderWidth: 1,
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <Text style={{
                fontFamily: 'outfit',
                fontSize: 14,
                color: '#1b5e20'
              }}>
                Your account has been permanently deleted. Thank you for using Atelic.
              </Text>
            </View>
          )}
          <Image
            source={require('../assets/Atelic_Logo_Updated.png')}
            style={styles.logo}
          />

          {/* Google Sign Up Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignUp}
          >
            <Image
              source={require('../assets/Google_logo.webp')}
              style={{
                width: 24,
                height: 24,
                position: 'absolute',
                left: 20
              }}
            />
            <Text style={{
              color: Colors.BLACK,
              textAlign: 'center',
              fontFamily: 'outfit',
              fontSize: 16
            }}>Sign up with Google</Text>
          </TouchableOpacity>

          {/* Apple Sign Up Button */}
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignUp}
          >
            <AntDesign
              name="apple1"
              size={24}
              color={Colors.BLACK}
              style={{
                position: 'absolute',
                left: 20
              }}
            />
            <Text style={{
              color: Colors.BLACK,
              textAlign: 'center',
              fontFamily: 'outfit',
              fontSize: 16
            }}>Sign up with Apple</Text>
          </TouchableOpacity>

          {/* Email Sign Up Button */}
          <TouchableOpacity
            style={styles.emailButton}
            onPress={() => router.push('/authorization/sign-up_index')}
          >
            <Feather
              name="mail"
              size={24}
              color={Colors.PRIMARY}
              style={{
                position: 'absolute',
                left: 20
              }}
            />
            <Text style={{
              color: Colors.PRIMARY,
              textAlign: 'center',
              fontFamily: 'outfit',
              fontSize: 16
            }}>Sign up with email</Text>
          </TouchableOpacity>

          {/* Sign In Link */}
          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => router.push('/authorization/sign-in_index')}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInTextBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
   outerContainer: {
       flex: 1,
       backgroundColor: Colors.WHITE,
   },
   headerImage: {
       width: '100%',
       height: SCREEN_HEIGHT * 0.5, // 50% of screen height to fill top better
       resizeMode: 'cover',
   },
   safeAreaBottom: {
       backgroundColor: Colors.WHITE,
   },
   container: {
       backgroundColor: Colors.WHITE,
       marginTop: -20,
       borderTopRightRadius: 30,
       borderTopLeftRadius: 30,
       paddingHorizontal: 20,
       paddingTop: 20,
       paddingBottom: 20, // SafeAreaView handles bottom padding now
       minHeight: SCREEN_HEIGHT * 0.6, // Ensures enough space for content
   },
   logo: {
       width: 330,
       height: 150,
       alignSelf: 'center',
       marginTop: -20,
       marginBottom: 15, // Reduced from 50 for better spacing
       resizeMode: 'contain',
   },
   googleButton: {
       padding: 7.5,
       backgroundColor: Colors.WHITE,
       borderRadius: 15,
       borderWidth: 0.3,
       borderColor: Colors.GRAY,
       flexDirection: 'row',
       justifyContent: 'center',
       alignItems: 'center',
       position: 'relative',
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.1,
       shadowRadius: 4,
       elevation: 2,
   },
   appleButton: {
       padding: 7.5,
       backgroundColor: Colors.WHITE,
       borderRadius: 15,
       marginTop: 15,
       borderWidth: 0.3,
       borderColor: Colors.GRAY,
       flexDirection: 'row',
       justifyContent: 'center',
       alignItems: 'center',
       position: 'relative',
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.1,
       shadowRadius: 4,
       elevation: 2,
   },
   emailButton: {
       padding: 7.5,
       backgroundColor: Colors.WHITE,
       borderRadius: 15,
       marginTop: 15,
       borderWidth: 0.3,
       borderColor: Colors.GRAY,
       flexDirection: 'row',
       justifyContent: 'center',
       alignItems: 'center',
       position: 'relative',
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.1,
       shadowRadius: 4,
       elevation: 2,
   },
   signInLink: {
       marginTop: 20,
       marginBottom: 10, // Added bottom margin for extra space
       padding: 15,
   },
   signInText: {
       fontFamily: 'outfit',
       fontSize: 16,
       textAlign: 'center',
       color: Colors.GRAY,
   },
   signInTextBold: {
       color: Colors.PRIMARY,
       fontFamily: 'outfit-bold',
   },
})
//one misspelling can deter the colors. caps vs no caps primary.

