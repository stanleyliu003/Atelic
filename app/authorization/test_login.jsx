import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { signUp } from 'aws-amplify/auth';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function TestLogin() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    setError('');
    setIsLoading(true);

    // Basic validation
    if (!email || !password || !fullName) {
      setError('Please fill out all fields');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Attempting to sign up with:', { email, fullName });
      
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name: fullName,
          },
          autoSignIn: true,
        },
      });

      console.log('Sign up result:', { isSignUpComplete, userId, nextStep });

      if (isSignUpComplete) {
        Alert.alert(
          'Success!',
          'Account created successfully! You are now signed in.',
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('Navigating to main app...');
                router.replace('/(tabs)/mytrip');
              }
            }
          ]
        );
      } else if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        Alert.alert(
          'Email Verification Required',
          'Please check your email and click the verification link to complete registration.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/authorization/sign-in')
            }
          ]
        );
      }
    } catch (err) {
      console.error('Sign up error:', err);
      
      if (err.name === 'UsernameExistsException') {
        setError('An account with this email already exists');
      } else if (err.name === 'InvalidPasswordException') {
        setError('Password does not meet requirements (min 8 characters)');
      } else if (err.name === 'InvalidParameterException') {
        setError('Please check your email format');
      } else {
        setError(err.message || 'Sign up failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>Test Sign Up</Text>
      </View>

      <Text style={styles.subtitle}>
        Testing AWS Cognito Authentication
      </Text>

      {/* Full Name */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />
      </View>

      {/* Email */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Password */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter password (min 8 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
      </View>

      {/* Error Message */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {/* Sign Up Button */}
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSignUp}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </Text>
      </TouchableOpacity>

      {/* Test Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Test Information:</Text>
        <Text style={styles.infoText}>• Use a real email address</Text>
        <Text style={styles.infoText}>• Password must be 8+ characters</Text>
        <Text style={styles.infoText}>• Check email for verification</Text>
        <Text style={styles.infoText}>• Check console for detailed logs</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: Colors.WHITE,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontFamily: 'outfit-bold',
    color: Colors.PRIMARY,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'outfit',
    color: Colors.GRAY,
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontFamily: 'outfit-bold',
    marginBottom: 8,
    color: Colors.PRIMARY,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.GRAY,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    fontFamily: 'outfit',
  },
  errorText: {
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'outfit',
  },
  button: {
    backgroundColor: Colors.PRIMARY,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 30,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.WHITE,
    fontSize: 16,
    fontFamily: 'outfit-bold',
  },
  infoContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.PRIMARY,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'outfit-bold',
    marginBottom: 10,
    color: Colors.PRIMARY,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'outfit',
    color: Colors.GRAY,
    marginBottom: 5,
  },
});
