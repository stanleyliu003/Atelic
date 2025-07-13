import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Auth } from 'aws-amplify';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SignUp() {
  const navigation=useNavigation();
  const router=useRouter();

  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [fullName,setFullName]=useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

   useEffect(()=>{
       navigation.setOptions({
           headerShown:false,
       })
   },[]);

   //creating a new method
   const OnCreateAccount = async () => {
     setError('');
     setIsLoading(true);
     
     if (!email || !password || !fullName) {
       setError('Please fill out all fields.');
       setIsLoading(false);
       return;
     }

     // Basic email validation
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(email)) {
       setError('Please enter a valid email address.');
       setIsLoading(false);
       return;
     }

     // Password validation (minimum 8 characters as per Cognito config)
     if (password.length < 8) {
       setError('Password must be at least 8 characters long.');
       setIsLoading(false);
       return;
     }

     try {
       const result = await Auth.signUp({
         username: email,
         password,
         attributes: {
           email,
           name: fullName,
         },
       });

       if (result.user) {
         // User is automatically signed in
         router.replace('(tabs)/create_new_trip');
       } else {
         // User needs to confirm their email
         setError('Please check your email for a confirmation code to complete your registration.');
         // You could navigate to a confirmation screen here
         // router.replace('/authorization/confirm-signup');
       }
     } catch (err) {
       console.error('Sign up error:', err);
       if (err.name === 'UsernameExistsException') {
         setError('An account with this email already exists. Please sign in instead.');
       } else if (err.name === 'InvalidPasswordException') {
         setError('Password does not meet requirements. Please use at least 8 characters.');
       } else {
         setError(err.message || 'Sign up failed. Please try again.');
       }
     } finally {
       setIsLoading(false);
     }
   };

  return (
    <View style={{
      padding:25,
      paddingTop:50,
      backgroundColor:Colors.WHITE,
      height:'100%'
    }}>
      <TouchableOpacity onPress={()=>router.back()}>
        <Ionicons name="arrow-back" size={24} color="black" />
      </TouchableOpacity>

      <Text style={{
        fontFamily:'outfit-bold',
        fontSize:30,
        marginTop:30
      }}>Create New Account</Text>

      <Text style={{
        fontFamily:'outfit',
        fontSize:15,
        color:Colors.GRAY,
        marginTop:20
      }}>Join thousands of users using Atelic today!</Text>

    {/* Enter Full Name */}
    <View style={{
      marginTop:30
    }}>
      <Text style={{
        fontFamily:'outfit'
      }}>Full Name</Text>
      <TextInput 
      style={styles.input}
      placeholder='Enter Full Name'
      value={fullName}
      onChangeText={(value)=>setFullName(value)} 
      />
    </View>

    {/* Enter Email */}
    <View style={{
      marginTop:20
    }}>
      <Text style={{
        fontFamily:'outfit'
      }}>Email</Text>
      <TextInput 
      style={styles.input}
      placeholder='Enter Email'
      value={email}
      onChangeText={(value)=>setEmail(value)}
      keyboardType="email-address"
      autoCapitalize="none"
      />
    </View>

    {/* Enter Password */}
    <View style={{
      marginTop:20
    }}>
      <Text style={{
        fontFamily:'outfit'
      }}>Password</Text>
      <TextInput 
      style={styles.input}
      placeholder='Enter Password (min 8 characters)'
      value={password}
      onChangeText={(value)=>setPassword(value)}
      secureTextEntry={true}
      autoCapitalize="none"
      />
    </View>

    {/* Error Message */}
    {error ? (
      <Text style={{ color: 'red', marginTop: 10, textAlign: 'center', fontFamily: 'outfit' }}>{error}</Text>
    ) : null}

    {/* Create Account Button */}
      <View> 
        <TouchableOpacity
        onPress={OnCreateAccount}
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
       }}> {isLoading ? 'Creating Account...' : 'Create Account'}</Text>
        </TouchableOpacity>
      </View>

      {/* Sign In Button */}
      <View> 
        <TouchableOpacity 
        onPress={()=>router.replace('/authorization/sign-in')}
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
       }}> Already have an account? Sign In </Text>
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