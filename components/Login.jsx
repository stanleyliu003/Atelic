import { Amplify, Auth, Hub, API } from 'aws-amplify';
import awsconfig from '../src/aws-exports';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, AppState, Linking, Dimensions, SafeAreaView, Platform } from 'react-native';
import { Feather, AntDesign } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import DeviceInfo from 'react-native-device-info';
import { checkUpdateRequired, getCurrentAppVersion } from '../src/services/versionCheckService';
import { UpdateRequired } from '../src/components/UpdateRequired';
import { storeAuthData } from '../src/services/appGroupsService';

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

const getUserProfileQuery = /* GraphQL */ `
  query GetUserProfile($username: String) {
    getUserProfile(username: $username) {
      username
      notificationsEnabled
      activityPreferences
      selectedUseCases
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
  const [minimumRequiredVersion, setMinimumRequiredVersion] = useState(null);
  const isNavigatingRef = useRef(false);
  const authCheckTimeoutRef = useRef(null);

  useEffect(() => {
    const scheduleAuthCheck = (delayMs = 200) => {
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
      authCheckTimeoutRef.current = setTimeout(() => {
        checkAuthenticationState();
      }, delayMs);
    };

    // Set up authentication event listeners
    const authListener = Hub.listen('auth', ({ payload: { event } }) => {
      switch (event) {
        case 'signIn':
          checkAuthenticationState();
          break;
        case 'signOut':
          const cleared = clearAuthData();
          console.log('[Login] Auth data clear result (signOut event):', cleared ? '✅ Cleared' : '⚠️ Not available');
          router.replace('/');
          break;
        case 'tokenRefresh_failure':
          setIsCheckingAuth(false);
          break;
      }
    });

    // Set up URL event listener to handle OAuth redirects
    const urlListener = Linking.addEventListener('url', () => {
      // Keep this short; Amplify will process the redirect quickly
      scheduleAuthCheck(200);
    });

    // Set up app state listener for when app comes back to foreground
    const appStateListener = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        scheduleAuthCheck(200);
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
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
    };
  }, []);

  const checkAuthenticationState = async () => {
    // Prevent multiple simultaneous navigation attempts
    if (isNavigatingRef.current) {
      return;
    }

    try {
      // ===== FIX 1: Parallelize version check with auth check =====
      // These are independent operations — run concurrently instead of sequentially
      const [minimumVersion, user] = await Promise.all([
        checkUpdateRequired(),
        Auth.currentAuthenticatedUser({ bypassCache: false }),
      ]);

      // Handle version check result
      if (minimumVersion) {
        console.log('[Login] App version outdated, showing update prompt');
        setMinimumRequiredVersion(minimumVersion);
        setShowUpdateRequired(true);
        setIsCheckingAuth(false);
        return;
      }

      if (isNavigatingRef.current) {
        return;
      }

      // ===== FIX 4: Parallelize session fetch with attribute fetch =====
      const attributeMap = user?.attributes || {};
      let preferredUsername = attributeMap?.preferred_username;
      let name = attributeMap?.name;
      let birthdate = attributeMap?.birthdate;
      let gender = attributeMap?.gender;
      const needsAttributeFetch = !preferredUsername || !name || !birthdate || !gender;

      // ===== FIX 2: Single session call (currentSession auto-refreshes expired tokens) =====
      // Run session + attribute fetch concurrently when both are needed
      const [session, fetchedAttributes] = await Promise.all([
        Auth.currentSession(),
        needsAttributeFetch
          ? Auth.userAttributes(user).catch((e) => {
              console.warn('[Login] Failed to fetch user attributes:', e?.message || e);
              return null;
            })
          : Promise.resolve(null),
      ]);

      // Merge fetched attributes if needed
      if (needsAttributeFetch && fetchedAttributes) {
        preferredUsername = preferredUsername || fetchedAttributes.find(attr => attr.Name === 'preferred_username')?.Value;
        name = name || fetchedAttributes.find(attr => attr.Name === 'name')?.Value;
        birthdate = birthdate || fetchedAttributes.find(attr => attr.Name === 'birthdate')?.Value;
        gender = gender || fetchedAttributes.find(attr => attr.Name === 'gender')?.Value;
      }

      // Store auth data in App Groups for Share Extension (fire-and-forget)
      const userID = user.attributes.sub;
      const idToken = session.getIdToken().getJwtToken();
      storeAuthData(userID, idToken, user.username).then((stored) => {
        if (stored) {
          console.log('[Login] ✅ Stored auth data in App Groups');
        } else {
          console.log('[Login] ⚠️ Could not store auth data in App Groups (native module unavailable)');
        }
      });

      // Redirect to username-setup if profile is incomplete
      if (!preferredUsername || !name || !birthdate || !gender) {
        console.log('[Login] Incomplete profile detected, redirecting to username-setup');
        console.log('[Login] Missing fields:', {
          hasUsername: !!preferredUsername,
          hasName: !!name,
          hasBirthdate: !!birthdate,
          hasGender: !!gender
        });
        isNavigatingRef.current = true;
        router.replace('/authorization/username-setup');
        return;
      }

      // User is authenticated and has username, redirect to main app
      isNavigatingRef.current = true;
      router.replace('(tabs)/feed');

      // Update device info in the background (do not block navigation/spinner)
      (async () => {
        try {
          const appVersion = DeviceInfo.getVersion() || null;
          const osName = DeviceInfo.getSystemName() || null;
          const osVersion = DeviceInfo.getSystemVersion() || null;
          const modelName = DeviceInfo.getModel() || null;
          const actualUsername = user.username;

          await API.graphql({
            query: updateUserProfileMutation,
            variables: {
              username: actualUsername,
              action: 'UPDATE_LOGIN',
              tripData: JSON.stringify({
                appVersion,
                deviceType: osName,
                modelName,
                osVersion,
                preferredUsername: preferredUsername
              })
            },
            authMode: 'AMAZON_COGNITO_USER_POOLS'
          });
          console.log('[Login] Updated device info for user:', preferredUsername, 'userID:', actualUsername);
        } catch (e) {
          console.log('[Login] Failed to update device info:', e?.errors || e?.message || e);
        }
      })();

    } catch (error) {
      // If auth failed but it might be a refresh issue, try one more time
      if (error.message?.includes('refresh') || error.code === 'NotAuthorizedException') {
        try {
          await Auth.currentSession();
          await Auth.currentAuthenticatedUser({ bypassCache: true });

          if (!isNavigatingRef.current) {
            isNavigatingRef.current = true;
            router.replace('(tabs)/feed');
          }
          return;
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError.message);
        }
      }

      // User needs to sign in — version check still needed for unauthenticated users
      // (Promise.all rejects early if auth fails, so version check may not have completed)
      checkUpdateRequired().then((minimumVersion) => {
        if (minimumVersion) {
          setMinimumRequiredVersion(minimumVersion);
          setShowUpdateRequired(true);
        }
      });

      setIsCheckingAuth(false);
    }
  };

  // Show update required screen if app version is outdated
  if (showUpdateRequired && minimumRequiredVersion) {
    return (
      <UpdateRequired
        currentVersion={getCurrentAppVersion()}
        minimumVersion={minimumRequiredVersion}
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

