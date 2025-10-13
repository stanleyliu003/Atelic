import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Auth, API } from 'aws-amplify';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const searchUsers = /* GraphQL */ `
  query SearchUsers($searchTerm: String!) {
    searchUsers(searchTerm: $searchTerm) {
      userID
      email
      fullName
      username
      __typename
    }
  }
`;

export default function SignUp() {
  const navigation=useNavigation();
  const router=useRouter();

  const [email,setEmail]=useState('');
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [fullName,setFullName]=useState('');
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [birthdate, setBirthdate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('');

   useEffect(()=>{
       navigation.setOptions({
           headerShown:false,
       })
   },[]);

   //creating a new method
   const OnCreateAccount = async () => {
     setError('');
     setUsernameError('');
     setEmailError('');
     setIsLoading(true);

     if (!email || !username || !password || !fullName || !birthdate || !gender) {
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
      console.log('Checking email availability for:', email.trim());

      const emailResult = await API.graphql({
        query: searchUsers,
        variables: { searchTerm: email.trim() }
      });

      const emailUsers = emailResult.data?.searchUsers || [];

      // Check if any user has this exact email
      const emailExists = emailUsers.some(
        user => user.email?.toLowerCase() === email.trim().toLowerCase()
      );

      if (emailExists) {
        setEmailError('An account with this email already exists. Please sign in instead.');
        setIsLoading(false);
        return;
      }

      console.log('Email is available, checking username...');
    } catch (emailCheckErr) {
      console.error('Email check failed:', emailCheckErr);
      setError('Unable to verify email availability. Please try again.');
      setIsLoading(false);
      return;
    }

    // Username validation
    const usernameRegex = /^[a-zA-Z0-9_]{5,15}$/;
    if (!usernameRegex.test(username)) {
      setError('Username must be 5-15 characters and contain only letters, numbers, and underscores.');
      setIsLoading(false);
      return;
    }

    // Check if username is already taken
    try {
      console.log('Checking username availability for:', username.trim());

      const result = await API.graphql({
        query: searchUsers,
        variables: { searchTerm: username.trim() }
      });

      const users = result.data?.searchUsers || [];

      // Check if any user has this exact username
      const usernameExists = users.some(
        user => user.username?.toLowerCase() === username.trim().toLowerCase()
      );

      if (usernameExists) {
        setUsernameError('This username is already taken. Please choose another one.');
        setIsLoading(false);
        return;
      }

      console.log('Username is available, proceeding with sign up...');
    } catch (usernameCheckErr) {
      console.error('Username check failed:', usernameCheckErr);
      setError('Unable to verify username availability. Please try again.');
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
           birthdate,
           gender,
           preferred_username: username,
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

   const onGoogleSignUp = async () => {
     setError('');
     setIsLoading(true);
     try {
       await Auth.federatedSignIn({ provider: 'Google' });
     } catch (err) {
       console.error('Google sign-up error:', err);
       setError('Google sign-up failed. Please try again.');
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
            marginTop:20
          }}>Create New Account</Text>

          <Text style={{
            fontFamily:'outfit',
            fontSize:15,
            color:Colors.GRAY,
            marginTop:20
          }}>Join thousands of users using Atelic today!</Text>

        {/* Enter Full Name */}
        <View style={{
          marginTop:30,
          marginBottom:5
        }}>
          <Text style={{
            fontFamily:'outfit'
          }}>Full Name</Text>
          <TextInput 
          style={styles.input}
          placeholder='Enter Full Name'
          value={fullName}
          onChangeText={(value)=>setFullName(value)}
          autoCorrect={false}
          spellCheck={false}
          />
        </View>

        {/* Enter Email */}
        <View style={{
          marginTop:20,
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

        {/* Enter Username */}
        <View style={{
          marginTop:20,
          marginBottom:5
        }}>
          <Text style={{
            fontFamily:'outfit'
          }}>Username</Text>
          <TextInput
          style={styles.input}
          placeholder='Enter Username (5-15 characters)'
          value={username}
          onChangeText={(value)=>setUsername(value)}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          />
          {usernameError ? (
            <Text style={{ color: 'red', marginTop: 5, fontFamily: 'outfit', fontSize: 14 }}>{usernameError}</Text>
          ) : null}
        </View>

        {/* Enter Birthdate */}
        <View style={{
          marginTop:20,
          marginBottom:5
        }}>
          <Text style={{
            fontFamily:'outfit'
          }}>Birthdate</Text>
          <TouchableOpacity
            style={[styles.input, { justifyContent: 'center' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: birthdate ? Colors.PRIMARY : Colors.GRAY, fontFamily: 'outfit' }}>
              {birthdate ? birthdate : 'Select Birthdate'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <>
              <DateTimePicker
                value={birthdate
                  ? new Date(
                      Number(birthdate.split('-')[0]),
                      Number(birthdate.split('-')[1]) - 1,
                      Number(birthdate.split('-')[2])
                    )
                  : new Date(2000, 0, 1)
                }
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    const yyyy = selectedDate.getFullYear();
                    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(selectedDate.getDate()).padStart(2, '0');
                    setBirthdate(`${yyyy}-${mm}-${dd}`);
                  }
                  if (Platform.OS === 'android') {
                    setShowDatePicker(false);
                  }
                }}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={{ marginTop: 10, alignSelf: 'center', padding: 15, backgroundColor: Colors.PRIMARY, borderRadius: 15, borderColor: Colors.PRIMARY }}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={{ color: Colors.WHITE, fontSize: 18, fontFamily: 'outfit' }}>Done</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Select Gender */}
        <View style={{
          marginTop: 20,
          marginBottom:5
        }}>
          <Text style={{
            fontFamily: 'outfit'
          }}>Gender</Text>
          <View style={{ marginTop: 5, alignItems: 'center', justifyContent: 'center' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'male' && styles.genderButtonSelected]}
                onPress={() => setGender('male')}
              >
                <Text style={{ color: gender === 'male' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit' }}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'female' && styles.genderButtonSelected]}
                onPress={() => setGender('female')}
              >
                <Text style={{ color: gender === 'female' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit' }}>Female</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'other' && styles.genderButtonSelected]}
                onPress={() => setGender('other')}
              >
                <Text style={{ color: gender === 'other' ? Colors.WHITE : Colors.PRIMARY, fontFamily: 'outfit' }}>Other</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
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
  genderButton: {
    flex: 1,
    padding: 15,
    borderWidth: 1,
    borderRadius: 15,
    borderColor: Colors.PRIMARY,
    marginRight: 10,
    backgroundColor: Colors.WHITE,
    alignItems: 'center',
  },
  genderButtonSelected: {
    backgroundColor: Colors.PRIMARY,
  },
})