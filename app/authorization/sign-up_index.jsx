import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Auth, API } from 'aws-amplify';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, Platform, KeyboardAvoidingView, Linking } from 'react-native';

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

export default function SignUp() {
  const navigation=useNavigation();
  const router=useRouter();

  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

   useEffect(()=>{
       navigation.setOptions({
           headerShown:false,
       })
   },[]);

   //creating a new method
   const OnCreateAccount = async () => {
     setError('');
     setEmailError('');
     setIsLoading(true);

     if (!email || !password) {
       setError('Please fill out all fields.');
       setIsLoading(false);
       return;
     }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    // Check if email is already taken
    try {
      const emailResult = await API.graphql({
        query: searchUsers,
        variables: { searchTerm: email.trim() }
      });

      const emailUsers = emailResult.data?.searchUsers || [];

      // Check if any user has this exact email
      const existingUser = emailUsers.find(
        user => user.email?.toLowerCase() === email.trim().toLowerCase()
      );

      if (existingUser) {
        // Provide different error messages based on authentication method
        if (existingUser.isExternalProvider) {
          setEmailError('An account with this email exists via Google/Apple sign-in. Please use that method instead.');
        } else {
          setEmailError('An account with this email already exists. Please sign in instead.');
        }
        setIsLoading(false);
        return;
      }
    } catch (emailCheckErr) {
      console.error('Email check failed:', emailCheckErr);
      setError('Unable to verify email availability. Please try again.');
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
         },
       });

       // Redirect to confirm sign up page with email param
       router.replace('/authorization/confirm_sign-up_index?email=' + encodeURIComponent(result.user.username));
     } catch (err) {
       console.error('Sign up error:', err);
       if (err.name === 'UsernameExistsException') {
         setError('An account with this email already exists');
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
          paddingTop:50,
          backgroundColor:Colors.WHITE,
          minHeight:'100%'
        }}>
          <TouchableOpacity onPress={()=>router.back()} style={{ marginTop: 20 }}>
            <Ionicons name="arrow-back" size={32} color="black" />
          </TouchableOpacity>

          <Text style={{
            fontFamily:'outfit-bold',
            fontSize:30,
            marginTop:20,
            textAlign:'center'
          }}>Create New Account</Text>

          <Text style={{
            fontFamily:'outfit',
            fontSize:15,
            color:Colors.GRAY,
            marginTop:20,
            textAlign:'center'
          }}>We can't wait to help you plan your dream vacation!</Text>

        {/* Enter Email */}
        <View style={{
          marginTop:30,
          marginBottom:5
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
          autoCorrect={false}
          spellCheck={false}
          />
          {emailError ? (
            <Text style={{ color: 'red', marginTop: 5, fontFamily: 'outfit', fontSize: 14 }}>{emailError}</Text>
          ) : null}
        </View>

        {/* Enter Password */}
        <View style={{
          marginTop:20,
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
          autoCorrect={false}
          spellCheck={false}
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
              backgroundColor: '#F36406',
              borderRadius:15, //rounded corners
              marginTop:30,
              opacity: isLoading ? 0.7 : 1
            }}>
           <Text style = {{
               color:Colors.WHITE,
               textAlign:'center',
               fontFamily: 'outfit'
           }}> {isLoading ? 'Creating Account...' : 'Create Account'}</Text>
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
  }
})