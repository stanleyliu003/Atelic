import { Colors } from '@/constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { signIn } from 'aws-amplify/auth';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SignUp() {
  const navigation=useNavigation();
  const router=useRouter();

  const [username,setUsername]=useState();
  const [password,setPassword]=useState();
  const [error, setError] = useState('');
  //useState() is a react tool uses to set the value of the X

   useEffect(()=>{
       navigation.setOptions({
           headerShown:false,
       })
   },[]);

  const OnSignIn = async () => {
    setError('');
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    try {
      await signIn({ username, password });
      // Redirect to main app or tabs
      router.replace('(tabs)/create_new_trip');
    } catch (err) {
      setError(err.message || 'Sign in failed.');
    }
  };


  return (
    <View style={{
      padding:25,
      paddingTop:40,
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
      }}>Let's Sign You In</Text>

      <Text style={{
        fontFamily:'outfit',
        fontSize:15,
        color:Colors.GRAY,
        marginTop:20
      }}>Welcome back, you've been missed!</Text>
    
    {/* Name */}
    <View style={{
      marginTop:30
    }}>
      <Text style={{
        fontFamily:'outfit'
      }}>Username</Text>
      <TextInput 
      style={styles.input}
      placeholder='Enter Username'
      onChangeText={(value)=>setUsername(value)} 
      />
    </View>

     {/* Password */}
    <View style={{
      marginTop:30
    }}>
      <Text style={{
        fontFamily:'outfit'
      }}>Password</Text>
      <TextInput 
      secureTextEntry={true}
      type="password"
      style={styles.input}
      placeholder='Enter Password'
      onChangeText={(value)=>setPassword(value)}
      />
    </View>

      {/* Error Message */}
      {error ? (
        <Text style={{ color: 'red', marginTop: 10, textAlign: 'center' }}>{error}</Text>
      ) : null}

      {/* Sign In Button */}
      <View> 
        <TouchableOpacity
        onPress={OnSignIn}
        style ={{
          padding:20,
          backgroundColor:Colors.PRIMARY,
          borderRadius:15, //rounded corners
          marginTop:50
        }}>
       <Text style = {{
           color:Colors.WHITE,
           textAlign:'center',
       }}> Sign In </Text>
        </TouchableOpacity>
      </View>

      {/* Create Account Button */}
      <View> 
        <TouchableOpacity 
        onPress={()=>router.replace('authorization/sign-up')}
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
       }}> Create Account </Text>
        </TouchableOpacity>
      </View>

      {/* Go to Tabs Button */}
      <View> 
        <TouchableOpacity 
        onPress={()=>router.replace('(tabs)/create_new_trip')}
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
       }}> Go to Tabs </Text>
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