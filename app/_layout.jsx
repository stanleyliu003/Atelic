import { Amplify } from 'aws-amplify';
import { useFonts } from 'expo-font';
import { Stack } from "expo-router";
import { CreateTripProvider } from '../context/CreateTripContext';
import awsconfig from '../src/aws-exports'; // adjust path if needed
import { View, Text } from 'react-native';

Amplify.configure(awsconfig);
console.log('Amplify configured')

export default function RootLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false
    }}>
      <Stack.Screen name="index" options={{
        headerShown: false
      }}/> 
      <Stack.Screen name="(tabs)"/>
    </Stack> 
  );
}
