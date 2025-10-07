import { Amplify, Auth, Hub } from 'aws-amplify';
import awsconfig from '../src/aws-exports';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, AppState } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Configure Amplify with enhanced settings
Amplify.configure({
  ...awsconfig,
  Analytics: {
    disabled: true,
  },
});

console.log('Amplify configured')

export default function Login() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Set up authentication event listeners
    const authListener = Hub.listen('auth', ({ payload: { event, data } }) => {
      console.log('Auth event:', event);
      switch (event) {
        case 'signIn':
          console.log('User signed in successfully');
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
      }
    });

    // Set up app state listener for when app comes back to foreground
    const appStateListener = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App became active, checking auth state...');
        checkAuthenticationState();
      }
    });

    // Initial auth check
    checkAuthenticationState();

    // Cleanup listeners
    return () => {
      authListener();
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
      
      // User is authenticated, redirect to main app
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
      await Auth.federatedSignIn({ provider: 'Google' });
    } catch (err) {
      console.error('Google sign-up error:', err);
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
                source={require('../assets/logo_horizontal_transparent.png')}
                style={{
                    width: 750,
                    height: 240,
                    alignSelf: 'center',
                    marginTop: -50,
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
                    fontSize: 17
                }}>Sign up with Google</Text>
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
                    fontSize: 17
                }}>Sign up with email</Text>
            </TouchableOpacity>

            {/* Sign In Link */}
            <TouchableOpacity
                style={{ marginTop: 20 }}
                onPress={() => router.push('/authorization/sign-in_index')}
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
    padding:10,
    backgroundColor:Colors.WHITE,
    borderRadius:15,
    marginTop:-30,
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
    padding:10,
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

