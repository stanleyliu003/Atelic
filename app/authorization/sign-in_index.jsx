import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Auth } from 'aws-amplify';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, ScrollView, Platform, Image } from 'react-native';

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
        setError('No account found with this email. Please create an account first.');
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
        
        {/* Email/Username */}
        <View style={{
          marginTop:30
        }}>
          <Text style={{
            fontFamily:'outfit'
          }}>Email</Text>
          <TextInput 
          style={styles.input}
          placeholder='Enter Email'
          value={username}
          onChangeText={(value)=>setUsername(value)} 
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
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
              backgroundColor: isLoading ? Colors.GRAY : Colors.PRIMARY,
              borderRadius:15, //rounded corners
              marginTop:50,
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