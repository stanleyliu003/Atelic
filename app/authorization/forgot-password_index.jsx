import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Auth, API } from 'aws-amplify';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';

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

export default function ForgotPassword() {
  const navigation = useNavigation();
  const router = useRouter();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, []);

  const handleForgotPassword = async () => {
    setError('');
    setIsLoading(true);

    if (!usernameOrEmail.trim()) {
      setError('Please enter your email or username.');
      setIsLoading(false);
      return;
    }

    try {
      // First, check if the input is a username and get the email
      console.log('Checking if input is username:', usernameOrEmail.trim());

      let emailToUse = usernameOrEmail.trim();

      // If input doesn't contain '@', assume it's a username and look up the email
      if (!usernameOrEmail.includes('@')) {
        try {
          const usernameResult = await API.graphql({
            query: searchUsers,
            variables: { searchTerm: usernameOrEmail.trim() }
          });

          const users = usernameResult.data?.searchUsers || [];

          // Find user with exact username match
          const existingUser = users.find(
            user => user.username?.toLowerCase() === usernameOrEmail.trim().toLowerCase()
          );

          if (existingUser) {
            // Check if user is from Google OAuth
            if (existingUser.isExternalProvider) {
              setError('This account uses Google sign-in. Please use the "Or Login with" Google button on the sign-in page.');
              setIsLoading(false);
              return;
            }

            emailToUse = existingUser.email;
            console.log('Found user email:', emailToUse);
          }
        } catch (checkErr) {
          console.error('Username lookup failed:', checkErr);
          // Continue with the input as-is if lookup fails
        }
      }

      // Check if the email belongs to a Google OAuth user
      if (usernameOrEmail.includes('@')) {
        try {
          const emailResult = await API.graphql({
            query: searchUsers,
            variables: { searchTerm: usernameOrEmail.trim() }
          });

          const users = emailResult.data?.searchUsers || [];
          const existingUser = users.find(
            user => user.email?.toLowerCase() === usernameOrEmail.trim().toLowerCase()
          );

          if (existingUser && existingUser.isExternalProvider) {
            setError('This account uses Google sign-in. Please use the "Or Login with" Google button on the sign-in page.');
            setIsLoading(false);
            return;
          }
        } catch (checkErr) {
          console.error('Email check failed:', checkErr);
        }
      }

      // Send the password reset code
      await Auth.forgotPassword(emailToUse);

      // Navigate to reset password page with the email
      router.push('/authorization/reset-password_index?email=' + encodeURIComponent(emailToUse));

    } catch (err) {
      console.error('Forgot password error:', err);
      if (err.code === 'UserNotFoundException') {
        setError('No account found with this email or username.');
      } else if (err.code === 'InvalidParameterException') {
        setError('Invalid email format. Please enter a valid email or username.');
      } else if (err.code === 'LimitExceededException') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(err.message || 'Failed to send reset code. Please try again.');
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
          padding: 25,
          paddingTop: 50,
          backgroundColor: Colors.WHITE,
          minHeight: '100%'
        }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Ionicons name="arrow-back" size={32} color="black" />
          </TouchableOpacity>

          <Text style={{
            fontFamily: 'outfit-bold',
            fontSize: 30,
            marginTop: 20
          }}>Trouble logging in?</Text>

          <Text style={{
            fontFamily: 'outfit',
            fontSize: 15,
            color: Colors.GRAY,
            marginTop: 20
          }}>Enter your email or username and we'll send you a link to get back into your account.</Text>

          {/* Email or Username */}
          <View style={{ marginTop: 30 }}>
            <Text style={{ fontFamily: 'outfit' }}>Email or Username</Text>
            <TextInput
              style={styles.input}
              placeholder='Enter your email or username'
              value={usernameOrEmail}
              onChangeText={setUsernameOrEmail}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
          </View>

          {/* Error Message */}
          {error ? (
            <Text style={{ color: 'red', marginTop: 10, textAlign: 'center', fontFamily: 'outfit' }}>
              {error}
            </Text>
          ) : null}

          {/* Send Reset Code Button */}
          <View>
            <TouchableOpacity
              onPress={handleForgotPassword}
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
                {isLoading ? 'Sending Code...' : 'Send Reset Code'}
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
