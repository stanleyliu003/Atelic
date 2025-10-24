import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Auth } from 'aws-amplify';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, ScrollView, Platform, Alert } from 'react-native';

export default function ResetPassword() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [email, setEmail] = useState(params.email || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, []);

  const handleResetPassword = async () => {
    setError('');
    setIsLoading(true);

    // Validation
    if (!email || !code || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      setIsLoading(false);
      return;
    }

    try {
      // Submit the password reset
      await Auth.forgotPasswordSubmit(email, code, newPassword);

      // Show success message
      Alert.alert(
        'Password Reset Successful',
        'Your password has been reset successfully. You can now sign in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/authorization/sign-in_index')
          }
        ]
      );
    } catch (err) {
      console.error('Reset password error:', err);
      if (err.code === 'CodeMismatchException') {
        setError('Invalid verification code. Please check the code and try again.');
      } else if (err.code === 'ExpiredCodeException') {
        setError('Verification code has expired. Please request a new one.');
      } else if (err.code === 'InvalidPasswordException') {
        setError('Password does not meet requirements. Please ensure it has at least 8 characters.');
      } else if (err.code === 'LimitExceededException') {
        setError('Too many attempts. Please try again later.');
      } else if (err.code === 'UserNotFoundException') {
        setError('User not found. Please check your email and try again.');
      } else {
        setError(err.message || 'Failed to reset password. Please try again.');
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
      await Auth.forgotPassword(email);
      Alert.alert(
        'Code Sent',
        'A new verification code has been sent to your email.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Resend code error:', err);
      if (err.code === 'UserNotFoundException') {
        setError('No account found with this email.');
      } else if (err.code === 'LimitExceededException') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(err.message || 'Failed to resend code. Please try again.');
      }
    } finally {
      setIsResending(false);
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
          padding: 25,
          paddingTop: 50,
          backgroundColor: Colors.WHITE,
          paddingBottom: 40
        }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Ionicons name="arrow-back" size={32} color="black" />
          </TouchableOpacity>

          <Text style={{
            fontFamily: 'outfit-bold',
            fontSize: 30,
            marginTop: 20
          }}>Reset Your Password</Text>

          <Text style={{
            fontFamily: 'outfit',
            fontSize: 15,
            color: Colors.GRAY,
            marginTop: 20
          }}>Enter the verification code sent to your email and your new password.</Text>

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
              autoCorrect={false}
            />
          </View>

          {/* Verification Code */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontFamily: 'outfit' }}>Verification Code</Text>
            <TextInput
              style={styles.input}
              placeholder='Enter 6-digit code'
              value={code}
              onChangeText={setCode}
              keyboardType="numeric"
              maxLength={6}
            />
          </View>

          {/* New Password */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontFamily: 'outfit' }}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder='Enter new password'
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              passwordRules=""
            />
          </View>

          {/* Confirm Password */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontFamily: 'outfit' }}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder='Confirm new password'
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              passwordRules=""
            />
          </View>

          {/* Password Requirements */}
          <Text style={{
            fontFamily: 'outfit',
            fontSize: 12,
            color: Colors.GRAY,
            marginTop: 10
          }}>
            Password must be at least 8 characters.
          </Text>

          {/* Error Message */}
          {error ? (
            <Text style={{ color: 'red', marginTop: 10, textAlign: 'center', fontFamily: 'outfit' }}>
              {error}
            </Text>
          ) : null}

          {/* Reset Password Button */}
          <View>
            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={isLoading}
              style={{
                padding: 20,
                backgroundColor: '#F36406',
                borderRadius: 15,
                marginTop: 40,
                opacity: isLoading ? 0.7 : 1
              }}>
              <Text style={{
                color: Colors.WHITE,
                textAlign: 'center',
                fontFamily: 'outfit'
              }}>
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
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
      </ScrollView>
    </KeyboardAvoidingView>
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
