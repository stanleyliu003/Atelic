import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Auth } from 'aws-amplify';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

  return (
    <View style={{
      padding:25,
      paddingTop:40,
      backgroundColor:Colors.WHITE,
      height:'100%'
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

      {/* Create Account Button */}
      <View> 
        <TouchableOpacity 
        onPress={()=>router.replace('/authorization/sign-up_index')}
        style ={{
          padding:20,
          backgroundColor:Colors.WHITE,
          borderRadius:15, //rounded corners
          marginTop:20,
          borderWidth:1,
          borderColor: Colors.PRIMARY
        }}>
       <Text style = {{
           color:Colors.PRIMARY,
           textAlign:'center',
           fontFamily: 'outfit'
       }}> Don't have an account? Create Account </Text>
        </TouchableOpacity>
      </View>

    </View>
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
  }
})