import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Auth, API } from 'aws-amplify';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, ScrollView, Platform, Image } from 'react-native';

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

export default function SignIn() {
  const navigation=useNavigation();
  const router=useRouter();

  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

   useEffect(()=>{
       navigation.setOptions({
           headerShown:false,
       })
   },[]);

  const OnSignIn = async () => {
    setError('');
    setIsLoading(true);

    if (!username || !password) {
      setError('Please enter both username and password.');
      setIsLoading(false);
      return;
    }

    // Check if the username is associated with a Google OAuth account
    try {
      console.log('Checking if username is associated with Google account:', username.trim());
      
      const usernameResult = await API.graphql({
        query: searchUsers,
        variables: { searchTerm: username.trim() }
      });

      const users = usernameResult.data?.searchUsers || [];
      
      // Find user with exact username match
      const existingUser = users.find(
        user => user.username?.toLowerCase() === username.trim().toLowerCase()
      );

      // If user exists and is from Google OAuth, auto-redirect to Google sign-in
      if (existingUser && existingUser.isExternalProvider) {
        console.log('User is Google OAuth user, redirecting to Google sign-in');
        setError('This account uses Google sign-in. Redirecting...');
        // Wait a moment for user to see the message
        setTimeout(async () => {
          try {
            await Auth.federatedSignIn({ provider: 'Google' });
          } catch (googleErr) {
            console.error('Google sign-in error:', googleErr);
            setError('This account uses Google sign-in. Please use the "Or Login with" Google button below.');
            setIsLoading(false);
          }
        }, 1000);
        return;
      }

      // If username search found a user, get their email for Cognito sign-in
      // (Cognito uses email as the username for internal users)
      if (existingUser && !existingUser.isExternalProvider) {
        console.log('Found internal user, using email for sign-in:', existingUser.email);
        // Proceed with normal email/password sign-in using the user's email
        try {
          const user = await Auth.signIn(existingUser.email, password);

          if (user.challengeName === 'USER_UNCONFIRMED') {
            // User is not confirmed, redirect to confirm-signup
            router.replace('/authorization/confirm_sign-up_index?email=' + encodeURIComponent(existingUser.email));
          } else if (user.signInUserSession) {
            // Successful sign in
            router.replace('(tabs)/create_new_trip');
          } else {
            setError('Sign in failed. Please try again.');
          }
        } catch (err) {
          if (err.code === 'UserNotConfirmedException') {
            // User exists but is not confirmed
            router.replace('/authorization/confirm_sign-up_index?email=' + encodeURIComponent(existingUser.email));
          } else if (err.name === 'NotAuthorizedException') {
            setError('Incorrect username or password.');
          } else if (err.name === 'UserNotFoundException') {
            setError('No account found with this username. Please create an account first.');
          } else {
            setError(err.message || 'Sign in failed. Please try again.');
          }
        } finally {
          setIsLoading(false);
        }
        return;
      }
    } catch (checkErr) {
      console.error('Username check failed:', checkErr);
      // Continue with fallback sign-in if check fails
    }

    // Fallback: Try to sign in with username directly (in case it's an email)
    try {
      const user = await Auth.signIn(username, password);

      if (user.challengeName === 'USER_UNCONFIRMED') {
        // User is not confirmed, redirect to confirm-signup
        router.replace('/authorization/confirm_sign-up_index?email=' + encodeURIComponent(username));
      } else if (user.signInUserSession) {
        // Successful sign in
        router.replace('(tabs)/create_new_trip');
      } else {
        setError('Sign in failed. Please try again.');
      }
    } catch (err) {
      if (err.code === 'UserNotConfirmedException') {
        // User exists but is not confirmed
        router.replace('/authorization/confirm_sign-up_index?email=' + encodeURIComponent(username));
      } else if (err.name === 'NotAuthorizedException') {
        setError('Incorrect username or password.');
      } else if (err.name === 'UserNotFoundException') {
        setError('No account found with this username. Please create an account first.');
      } else {
        setError(err.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      await Auth.federatedSignIn({ provider: 'Google' });
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError('Google sign-in failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.WHITE }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={60}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: Colors.WHITE }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{
          padding:25,
          paddingTop:40,
          backgroundColor:Colors.WHITE,
          minHeight:'100%'
        }}>
          <TouchableOpacity onPress={()=>router.back()} style={{ marginTop: 20 }}>
            <Ionicons name="arrow-back" size={32} color="black" />
          </TouchableOpacity>
          <Text style={{
            fontFamily:'outfit-bold',
            fontSize:30,
            marginTop:25
          }}>Let's Sign You In</Text>

          <Text style={{
            fontFamily:'outfit',
            fontSize:15,
            color:Colors.GRAY,
            marginTop:20
          }}>Welcome back, you've been missed!</Text>
        
        {/* Username */}
        <View style={{
          marginTop:30
        }}>
          <Text style={{
            fontFamily:'outfit'
          }}>Username</Text>
          <TextInput 
          style={styles.input}
          placeholder='Enter Username'
          value={username}
          onChangeText={(value)=>setUsername(value)} 
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          />
        </View>

         {/* Password */}
        <View style={{
          marginTop:20
        }}>
          <Text style={{
            fontFamily:'outfit'
          }}>Password</Text>
          <TextInput
          secureTextEntry={true}
          style={styles.input}
          placeholder='Enter Password'
          value={password}
          onChangeText={(value)=>setPassword(value)}
          autoCapitalize="none"
          autoCorrect={false}
          />
        </View>

          {/* Forgot Password Link */}
          <TouchableOpacity
            onPress={() => router.push('/authorization/forgot-password_index')}
            style={{ marginTop: 10, alignSelf: 'flex-end' }}
          >
            <Text style={{
              fontFamily: 'outfit',
              color: '#F36406',
              fontSize: 14
            }}>
                Forgot Password?
            </Text>
          </TouchableOpacity>

          {/* Error Message */}
          {error ? (
            <Text style={{ color: 'red', marginTop: 10, textAlign: 'center', fontFamily: 'outfit' }}>{error}</Text>
          ) : null}

          {/* Sign In Button */}
          <View> 
            <TouchableOpacity
            onPress={OnSignIn}
            disabled={isLoading}
            style ={{
              padding:20,
              backgroundColor: '#F36406',
              borderRadius:15, //rounded corners
              marginTop:40,
              opacity: isLoading ? 0.7 : 1
            }}>
           <Text style = {{
               color:Colors.WHITE,
               textAlign:'center',
               fontFamily: 'outfit'
           }}> {isLoading ? 'Signing In...' : 'Sign In'}</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 30 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: Colors.GRAY }} />
            <Text style={{ marginHorizontal: 10, fontFamily: 'outfit', color: Colors.GRAY }}>Or Login with</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: Colors.GRAY }} />
          </View>

          {/* Google Sign In Button */}
          <View>
            <TouchableOpacity
              onPress={onGoogleSignIn}
              disabled={isLoading}
              style={styles.googleButton}>
              <Image
                source={require('../../assets/Google_logo.webp')}
                style={{
                  width: 64,
                  height: 64
                }}
              />
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  input:{
      padding:15,
      borderWidth:1,
      borderRadius:15,
      borderColor:Colors.GRAY,
      fontFamily:'outfit',
      marginTop: 5
  },
  googleButton:{
    padding:20,
    backgroundColor:Colors.WHITE,
    borderRadius:15,
    marginTop:40,
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