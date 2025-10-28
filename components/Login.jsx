import { Amplify, Auth, Hub } from 'aws-amplify';
import awsconfig from '../src/aws-exports';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, AppState, Linking } from 'react-native';
import { Feather, AntDesign } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

// Warm up the browser for better performance (recommended by Expo)
WebBrowser.maybeCompleteAuthSession();

// CRITICAL: This configures Amplify to use expo-web-browser for OAuth
// This ensures authentication happens in an in-app browser (ASWebAuthenticationSession on iOS)
// instead of opening Safari browser
const urlOpener = async (url, redirectUrl) => {
  try {
    // On iOS, this will use ASWebAuthenticationSession (in-app browser)
    // On Android, this will use Chrome Custom Tabs (in-app browser)
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl, {
      // Prefer ephemeral session to avoid showing saved password suggestions
      // This creates a more seamless OAuth experience without autofill popups
      preferEphemeralSession: true,
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
  const [isNavigating, setIsNavigating] = useState(false);

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
    // Prevent multiple simultaneous navigation attempts
    if (isNavigating) {
      return;
    }

    try {
      // This automatically handles token refresh if needed
      const user = await Auth.currentAuthenticatedUser({
        bypassCache: false // Use cached tokens for better performance
      });

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
        setIsNavigating(true);
        router.replace('/authorization/username-setup');
        return;
      }

      // User is authenticated and has username, redirect to main app
      setIsNavigating(true);
      router.replace('(tabs)/create_new_trip');

    } catch (error) {
      // Check if this is a token refresh failure
      if (error.message?.includes('refresh') || error.code === 'NotAuthorizedException') {
        try {
          // Force a token refresh attempt
          await Auth.currentSession();
          await Auth.currentAuthenticatedUser({ bypassCache: true });
          setIsNavigating(true);
          router.replace('(tabs)/create_new_trip');
          return;
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError.message);
        }
      }

      // User needs to sign in
      setIsCheckingAuth(false);
    }
  };

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
      // After OAuth completes, check authentication state
      setTimeout(() => {
        checkAuthenticationState();
      }, 1000);
    } catch (err) {
      console.error('Google sign-up error:', err);
    }
  };

  const handleAppleSignUp = async () => {
    try {
      await Auth.federatedSignIn({ provider: 'SignInWithApple' });
      // After OAuth completes, check authentication state
      setTimeout(() => {
        checkAuthenticationState();
      }, 1000);
    } catch (err) {
      console.error('Apple sign-up error:', err);
    }
  };

  // Show login screen only if user is not authenticated
  return (
    <View>
        <Image source = {require('../assets/images/multiethnic-friends-having-fun-walking-on-city-street---group-1.webp')}
            style={{
                width:'100%',
                height:500
            }}
        />
        <View style = {styles.container}>
           <Image
                source={require('../assets/Atelic_Logo_Updated.png')}
                
                style={{
                    width: 325,
                    height: 150,
                    alignSelf: 'center',
                    marginTop: -20,
                    marginBottom: 50,
                    resizeMode: 'contain'
                }}
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
                style={{ marginTop: 20, padding: 15 }}
                onPress={() => router.push('/authorization/sign-in_index')}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
                <Text style={{
                    fontFamily: 'outfit',
                    fontSize: 15,
                    textAlign: 'center',
                    color: Colors.GRAY
                }}>
                    Already have an account? <Text style={{ color: Colors.PRIMARY, fontFamily: 'outfit-bold' }}>Sign in</Text>
                </Text>
            </TouchableOpacity>
        </View>
   </View>
  )
}

const styles = StyleSheet.create({
   container:{
       backgroundColor:Colors.WHITE,
       marginTop:-20,
       borderTopRightRadius:30,
       borderTopLeftRadius:30,
       padding:15,
       height:'100%',
   },
   googleButton:{
    padding:7.5,
    backgroundColor:Colors.WHITE,
    borderRadius:15,
    marginTop:-50,
    borderWidth:0.3,
    borderColor:Colors.GRAY,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    position:'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
   },
   appleButton:{
    padding:7.5,
    backgroundColor:Colors.WHITE,
    borderRadius:15,
    marginTop:15,
    borderWidth:0.3,
    borderColor:Colors.GRAY,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    position:'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
   },
   emailButton:{
    padding:7.5,
    backgroundColor:Colors.WHITE,
    borderRadius:15,
    marginTop:15,
    borderWidth:0.3,
    borderColor:Colors.GRAY,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    position:'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
   }
})
//one misspelling can deter the colors. caps vs no caps primary.

