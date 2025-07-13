import { Amplify } from 'aws-amplify';
import { useFonts } from 'expo-font';
import { Stack } from "expo-router";
import { CreateTripProvider } from '../context/CreateTripContext';
import awsconfig from '../src/aws-exports'; // adjust path if needed
import { View, Text } from 'react-native';

// Configure Amplify with React Native adapter
Amplify.configure({
  ...awsconfig,
  // Add React Native specific configuration
  Analytics: {
    disabled: true,
  },
});

console.log('Amplify configured')

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'outfit': require('../assets/fonts/Outfit-Regular.ttf'),
    'outfit-medium': require('../assets/fonts/Outfit-Medium.ttf'),
    'outfit-bold': require('../assets/fonts/Outfit-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <CreateTripProvider>
      <Stack screenOptions={{
        headerShown: false
      }}>
        <Stack.Screen name="index" options={{
          headerShown: false
        }}/> 
        <Stack.Screen name="(tabs)"/>
      </Stack> 
    </CreateTripProvider>
  );
}
