import { Amplify, Auth, Hub } from 'aws-amplify';
import awsconfig from '../src/aws-exports';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, AppState } from 'react-native';

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
           <Text style={{
               fontSize:30,
               fontFamily:'outfit-bold',
               textAlign:'center',
               marginTop:10
           }}>Atelic</Text>
            
           <Text style = {{
                fontFamily:'outfit',
                fontSize:17,
                textAlign:'center',
                color:Colors.GRAY,
                marginTop:20,
           }}>Atelic is an AI platform that helps users easily organize their trip itineraries and optimize their activity routes</Text>
           
           <TouchableOpacity style = {styles.button}
                onPress={()=>router.push('/authorization/sign-in_index')}
           > 
                <Text style = {{color:Colors.WHITE, 
                    textAlign:'center',
                    fontFamily:'outfit',
                    fontSize:17
                }}>Login</Text> 
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
   button:{
    padding:15,
    backgroundColor:Colors.PRIMARY,
    borderRadius:99,
    marginTop:'25%'
   }
})
//one misspelling can deter the colors. caps vs no caps primary.

