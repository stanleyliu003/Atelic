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
  console.log('🌐 urlOpener called with:', { url, redirectUrl });

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

    console.log('🌐 WebBrowser result:', result);

    // If successful, the result should contain the callback URL with auth code
    if (result.type === 'success' && result.url) {
      console.log('✅ OAuth success! Callback URL:', result.url);
      // Amplify will process this URL automatically through the Linking listener
      Linking.openURL(result.url);
    } else if (result.type === 'cancel' || result.type === 'dismiss') {
      console.log('❌ OAuth cancelled by user');
      WebBrowser.dismissBrowser();
    }

    return result;
  } catch (error) {
    console.error('💥 OAuth WebBrowser error:', error?.message);
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

console.log('Amplify configured with expo-web-browser');

export default function Login() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Set up authentication event listeners
    const authListener = Hub.listen('auth', ({ payload: { event, data } }) => {
      console.log('Auth event:', event);
      switch (event) {
        case 'signIn':
          console.log('User signed in successfully via OAuth');
          // OAuth sign-in completed, check auth state and redirect
          checkAuthenticationState();
          break;
        case 'signIn_failure':
          console.log('OAuth sign-in failed:', data);
          break;
        case 'signOut':
          console.log('User signed out');
          router.replace('/');
          break;
        case 'tokenRefresh':
          console.log('Token refreshed successfully');
          break;
        case 'tokenRefresh_failure':
          console.log('Token refresh failed, redirecting to login');
          setIsCheckingAuth(false);
          break;
        case 'customOAuthState':
          console.log('Custom OAuth state:', data);
          break;
      }
    });

    // Set up URL event listener to handle OAuth redirects
    const urlListener = Linking.addEventListener('url', ({ url }) => {
      console.log('🔗 Deep link received:', url);
      // Amplify will automatically process this, but we'll check auth state after
      setTimeout(() => {
        console.log('Checking auth after deep link...');
        checkAuthenticationState();
      }, 1500);
    });

    // Set up app state listener for when app comes back to foreground
    const appStateListener = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App became active, checking auth state...');
        // Small delay to allow OAuth to complete processing
        setTimeout(() => {
          checkAuthenticationState();
        }, 1500);
      }
    });

    // Check if app was opened with a URL (for OAuth callback)
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('🔗 App opened with URL:', url);
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
    try {
      console.log('Checking authentication state...');

      // This automatically handles token refresh if needed
      const user = await Auth.currentAuthenticatedUser({
        bypassCache: false // Use cached tokens for better performance
      });

      console.log('User authenticated:', user?.username);

      // Get current session to check token expiry
      const session = await Auth.currentSession();
      const accessToken = session.getAccessToken();
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = accessToken.payload.exp - now;

      console.log(`Access token expires in: ${Math.floor(expiresIn / 60)} minutes`);

      // If token expires within 30 minutes, proactively refresh
      if (expiresIn < 1800) {
        console.log('Token expiring soon, refreshing proactively...');
        await Auth.currentSession(); // This triggers refresh
      }

      // Check if user has a username set (important for Google OAuth users)
      const preferredUsername = user?.attributes?.preferred_username;

      if (!preferredUsername) {
        console.log('User missing username, redirecting to username setup...');
        router.replace('/authorization/username-setup');
        return;
      }

      // User is authenticated and has username, redirect to main app
      router.replace('(tabs)/create_new_trip');

    } catch (error) {
      console.log('User not authenticated:', error.message);
      
      // Check if this is a token refresh failure
      if (error.message?.includes('refresh') || error.code === 'NotAuthorizedException') {
        console.log('🔄 Attempting to refresh tokens...');
        try {
          // Force a token refresh attempt
          await Auth.currentSession();
          const user = await Auth.currentAuthenticatedUser({ bypassCache: true });
          console.log('Token refresh successful');
          router.replace('(tabs)/create_new_trip');
          return;
        } catch (refreshError) {
          console.log('Token refresh failed:', refreshError.message);
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
      console.log('Starting Google OAuth flow...');
      await Auth.federatedSignIn({ provider: 'Google' });
      console.log('Google OAuth flow completed/cancelled');
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
      console.log('Starting Apple OAuth flow...');
      await Auth.federatedSignIn({ provider: 'SignInWithApple' });
      console.log('Apple OAuth flow completed/cancelled');
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

