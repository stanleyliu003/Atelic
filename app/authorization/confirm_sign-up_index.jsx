import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Auth } from 'aws-amplify';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';

export default function ConfirmSignUp() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [email, setEmail] = useState(params.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState(''); // Add password field
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, []);

  const handleConfirmSignUp = async () => {
    setError('');
    setIsLoading(true);

    if (!email || !code || !password) { // Require password
      setError('Please enter your email, password, and confirmation code.');
      setIsLoading(false);
      return;
    }

    try {
      await Auth.confirmSignUp(email, code);
      // Auto sign in after confirmation
      try {
        await Auth.signIn(email, password);
        // Redirect to username-setup to complete profile (name, birthday, gender, preferences)
        router.replace('/authorization/username-setup');
      } catch (signInErr) {
        setError('Account confirmed, but sign in failed: ' + (signInErr.message || 'Please try again.'));
      }
    } catch (err) {
      console.error('Confirmation error:', err);
      if (err.name === 'CodeMismatchException') {
        setError('Invalid confirmation code. Please check your email and try again.');
      } else if (err.name === 'ExpiredCodeException') {
        setError('Confirmation code has expired. Please request a new one.');
      } else if (err.name === 'NotAuthorizedException') {
        // Account is already confirmed, try to sign in
        try {
          await Auth.signIn(email, password);
          router.replace('/authorization/username-setup');
        } catch (signInErr) {
          setError('Account is already confirmed, but sign in failed: ' + (signInErr.message || 'Please try again.'));
        }
      } else {
        setError(err.message || 'Confirmation failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }

    setError('');
    setIsResending(true);

    try {
      await Auth.resendSignUp(email);
      Alert.alert(
        'Code Sent',
        'A new confirmation code has been sent to your email.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Resend error:', err);
      if (err.name === 'UserNotFoundException') {
        setError('No account found with this email. Please sign up first.');
      } else if (err.name === 'NotAuthorizedException') {
        setError('Account is already confirmed. Please sign in instead.');
      } else {
        setError(err.message || 'Failed to resend code. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={{
      padding: 25,
      paddingTop: 50,
      backgroundColor: Colors.WHITE,
      height: '100%'
    }}>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
        <Ionicons name="arrow-back" size={32} color="black" />
      </TouchableOpacity>

      <Text style={{
        fontFamily: 'outfit-bold',
        fontSize: 30,
        marginTop: 20
      }}>Confirm Your Account</Text>

      <Text style={{
        fontFamily: 'outfit',
        fontSize: 15,
        color: Colors.GRAY,
        marginTop: 20
      }}>Enter the verification code sent to your email</Text>

      {/* Email */}
      <View style={{ marginTop: 30 }}>
        <Text style={{ fontFamily: 'outfit' }}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder='Enter your email'
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Confirmation Code */}
      <View style={{ marginTop: 20 }}>
        <Text style={{ fontFamily: 'outfit' }}>Confirmation Code</Text>
        <TextInput
          style={styles.input}
          placeholder='Enter 6-digit code'
          value={code}
          onChangeText={setCode}
          keyboardType="numeric"
          maxLength={6}
        />
      </View>

      {/* Password */}
      <View style={{ marginTop: 20 }}>
        <Text style={{ fontFamily: 'outfit' }}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder='Enter your password'
          value={password}
          onChangeText={setPassword}
          secureTextEntry={true}
          autoCapitalize="none"
        />
      </View>

      {/* Error Message */}
      {error ? (
        <Text style={{ color: 'red', marginTop: 10, textAlign: 'center', fontFamily: 'outfit' }}>
          {error}
        </Text>
      ) : null}

      {/* Confirm Button */}
      <View>
        <TouchableOpacity
          onPress={handleConfirmSignUp}
          disabled={isLoading}
          style={{
            padding: 20,
            backgroundColor: '#F36406',
            borderRadius: 15,
            marginTop: 50,
            opacity: isLoading ? 0.7 : 1
          }}>
          <Text style={{
            color: Colors.WHITE,
            textAlign: 'center',
            fontFamily: 'outfit'
          }}>
            {isLoading ? 'Confirming...' : 'Confirm Account'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Resend Code Button */}
      <View>
        <TouchableOpacity
          onPress={handleResendCode}
          disabled={isResending}
          style={{
            padding: 20,
            backgroundColor: Colors.WHITE,
            borderRadius: 15,
            marginTop: 20,
            borderWidth: 1,
            borderColor: Colors.PRIMARY
          }}>
          <Text style={{
            color: Colors.PRIMARY,
            textAlign: 'center',
            fontFamily: 'outfit'
          }}>
            {isResending ? 'Sending...' : 'Resend Code'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Back to Sign In */}
      <View>
        <TouchableOpacity
          onPress={() => router.replace('/authorization/sign-in_index')}
          style={{
            padding: 20,
            backgroundColor: Colors.WHITE,
            borderRadius: 15,
            marginTop: 20
          }}>
          <Text style={{
            color: Colors.GRAY,
            textAlign: 'center',
            fontFamily: 'outfit'
          }}>
            Back to Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 15,
    borderColor: Colors.GRAY,
    fontFamily: 'outfit',
    marginTop: 5
  }
}); 