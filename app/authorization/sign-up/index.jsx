import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { signUp } from 'aws-amplify/auth';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SignUp() {
  const navigation=useNavigation();
  const router=useRouter();

  const [email,setEmail]=useState();
  const [password,setPassword]=useState();
  const [fullName,setFullName]=useState();
  const [error, setError] = useState('');
  //useState() is a react tool uses to set the value of the X

   useEffect(()=>{
       navigation.setOptions({
           headerShown:false,
       })
   },[]);

   //creating a new method
   const OnCreateAccount = async () => {
     setError('');
     if (!email || !password || !fullName) {
       setError('Please fill out all fields.');
       return;
     }
     try {
       await signUp({
         username: email,
         password,
         options: {
           userAttributes: {
             email,
             name: fullName,
           },
         },
       });
       // Optionally, navigate to a confirmation screen or sign-in
       router.replace('/authorization/sign-in');
     } catch (err) {
       setError(err.message || 'Sign up failed.');
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
      onChangeText={(value)=>setEmail(value)}
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
      placeholder='Enter Password'
      onChangeText={(value)=>setPassword(value)}
      />
    </View>

    {/* Error Message */}
    {error ? (
      <Text style={{ color: 'red', marginTop: 10, textAlign: 'center' }}>{error}</Text>
    ) : null}

    {/* Create Account Button */}
      <View> 
        <TouchableOpacity
        onPress={OnCreateAccount}
        style ={{
          padding:20,
          backgroundColor:Colors.PRIMARY,
          borderRadius:15, //rounded corners
          marginTop:50
        }}>
       <Text style = {{
           color:Colors.WHITE,
           textAlign:'center',
       }}> Create Account</Text>
        </TouchableOpacity>
      </View>

      {/* Sign In Button */}
      <View> 
        <TouchableOpacity 
        style ={{
          padding:20,
          backgroundColor:Colors.WHITE,
          borderRadius:15, //rounded corners
          marginTop:20,
          borderWidth:1
        }}>
       <Text style = {{
           color:Colors.PRIMARY,
           textAlign:'center',
       }}> Sign In </Text>
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
      fontFamily:'outfit'
  }
})