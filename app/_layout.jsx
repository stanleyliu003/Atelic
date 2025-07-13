import { Amplify } from 'aws-amplify';
import { useFonts } from 'expo-font';
import { Stack } from "expo-router";
import { CreateTripProvider } from '../context/CreateTripContext';
import awsconfig from '../src/aws-exports'; // adjust path if needed

Amplify.configure(awsconfig);
console.log('Amplify configured')

export default function RootLayout() {
    
  useFonts({
    'outfit':require('/Users/stanleycliu/Desktop/Atelic_App_Dev/Atelic_Stable/assets/fonts/Outfit-Regular.ttf'),
    'outfit-medium':require('/Users/stanleycliu/Desktop/Atelic_App_Dev/Atelic_Stable/assets/fonts/Outfit-Medium.ttf'),
    'outfit-bold':require('/Users/stanleycliu/Desktop/Atelic_App_Dev/Atelic_Stable/assets/fonts/Outfit-Bold.ttf'),
  })

  return(
    <CreateTripProvider>
      <Stack screenOptions={{
        headerShown:false
      }}>
       <Stack.Screen name="index" options={{
          headerShown:false
        }}/> 
        <Stack.Screen name="(tabs)"/>
      </Stack> 
    </CreateTripProvider>
  );
}
