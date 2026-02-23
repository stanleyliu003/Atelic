import 'react-native-get-random-values';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from "expo-router";
import { CreateTripProvider } from '../context/CreateTripContext';
import { View, Text, Platform, Linking, InteractionManager } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Auth } from 'aws-amplify';
import { retrieveTripFromCloud } from '../src/services/lambdaService';
import appsFlyer from 'react-native-appsflyer';
import * as Tracking from 'expo-tracking-transparency';

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // Show banner even when app is open
    shouldPlaySound: true,    // Play notification sound
    shouldSetBadge: true,     // Update app badge number
  }),
});

export default function RootLayout() {
  const router = useRouter();
  const notificationListener = useRef();
  const responseListener = useRef();

  const [fontsLoaded] = useFonts({
    'outfit': require('../assets/fonts/Outfit-Regular.ttf'),
    'outfit-medium': require('../assets/fonts/Outfit-Medium.ttf'),
    'outfit-bold': require('../assets/fonts/Outfit-Bold.ttf'),
  });

  // Track whether ATT has been requested to avoid duplicate prompts
  const attRequestedRef = useRef(false);
  const [appReady, setAppReady] = useState(false);

  // Request ATT permission after the app is fully visible on screen.
  // This is separated from AppsFlyer init to ensure the dialog appears
  // reliably on iPad (iPhone compatibility mode) and newer iPadOS versions.
  useEffect(() => {
    if (Platform.OS !== 'ios' || attRequestedRef.current || !appReady) return;

    const requestATT = async () => {
      try {
        // Check current status first — if already determined, skip the request
        const { status: currentStatus } = await Tracking.getTrackingPermissionsAsync();
        console.log('[ATT] Current permission status:', currentStatus);

        if (currentStatus === 'undetermined') {
          // Wait for all pending UI interactions/animations to finish,
          // then add a delay to ensure the app window is fully visible.
          // This is critical for iPad compatibility mode where the window
          // may not be ready when useEffect first fires.
          await new Promise(resolve => {
            InteractionManager.runAfterInteractions(() => {
              setTimeout(resolve, 1500);
            });
          });

          const { status } = await Tracking.requestTrackingPermissionsAsync();
          console.log('[ATT] Permission granted:', status);
        }
      } catch (error) {
        console.error('[ATT] Failed to request permission:', error);
      }
      attRequestedRef.current = true;
    };

    requestATT();
  }, [appReady]);

  // Initialize AppsFlyer SDK (independent of ATT — SDK handles ATT wait internally)
  useEffect(() => {
    const initAppsFlyer = async () => {
      try {
        appsFlyer.initSdk(
          {
            devKey: process.env.EXPO_PUBLIC_APPSFLYER_DEV_KEY,
            appId: process.env.EXPO_PUBLIC_APPSFLYER_APPLE_APP_ID,
            isDebug: __DEV__,
            onInstallConversionDataListener: true,
            onDeepLinkListener: false,
            timeToWaitForATTUserAuthorization: 10,
          },
          (result) => {
            console.log('[AppsFlyer] SDK initialized successfully:', result);
          },
          (error) => {
            console.error('[AppsFlyer] SDK initialization error:', error);
          }
        );

        appsFlyer.onInstallConversionData((data) => {
          console.log('[AppsFlyer] Attribution data received:', JSON.stringify(data, null, 2));
        });

        // Set CUID if user is already logged in
        try {
          const user = await Auth.currentAuthenticatedUser();
          if (user?.username) {
            appsFlyer.setCustomerUserId(user.username);
            console.log('[AppsFlyer] Set CUID for logged-in user:', user.username);
          }
        } catch (authErr) {
          console.log('[AppsFlyer] No authenticated user yet, CUID will be set after login');
        }

      } catch (error) {
        console.error('[AppsFlyer] Failed to initialize:', error);
      }
    };

    initAppsFlyer();
  }, []);

  // Set up deep linking listeners
  useEffect(() => {
    // Handle deep link when app is already open
    const handleDeepLink = (event) => {
      const url = event.url;
      console.log('🔗 Deep link received:', url);
      
      if (url) {
        // Parse the URL - format: atelicstable://route
        const route = url.replace(/.*?:\/\//g, '');
        console.log('🔗 Parsed route:', route);
        
        if (route === 'saved_places') {
          router.push('/(tabs)/saved_places');
        }
        // Add more routes here as needed
      }
    };

    // Listen for URLs when app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 Initial URL:', url);
        const route = url.replace(/.*?:\/\//g, '');
        console.log('🔗 Parsed initial route:', route);
        
        if (route === 'saved_places') {
          // Use setTimeout to ensure navigation happens after app is ready
          setTimeout(() => {
            router.push('/(tabs)/saved_places');
          }, 500);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Set up notification listeners
  useEffect(() => {
    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📩 Notification received in foreground:', notification);
      console.log('📦 Foreground content.data:', JSON.stringify(notification.request.content.data, null, 2));
      console.log('📦 Foreground trigger.payload:', JSON.stringify(notification.request.trigger?.payload, null, 2));
      console.log('📦 Foreground trigger.remoteMessage:', JSON.stringify(notification.request.trigger?.remoteMessage, null, 2));
    });

    // Listen for user tapping on notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log('👆 User tapped notification:', response);

      // Check multiple possible locations for custom data
      const contentData = response.notification.request.content.data;
      const triggerPayload = response.notification.request.trigger?.payload;
      const remoteMessage = response.notification.request.trigger?.remoteMessage;

      console.log('📦 Content data:', JSON.stringify(contentData, null, 2));
      console.log('📦 Trigger payload:', JSON.stringify(triggerPayload, null, 2));
      console.log('📦 Remote message:', JSON.stringify(remoteMessage, null, 2));

      // Try to extract custom data from any available location
      const data = contentData || triggerPayload || remoteMessage;

      // Handle different notification types
      if (data && data.type === 'trip_invitation') {
        console.log('Trip invitation tapped, data:', data);

        const tripId = data.tripId;

        if (tripId) {
          try {
            // Get current user ID
            const user = await Auth.currentAuthenticatedUser();
            const userID = user.username;

            console.log('Loading trip from notification:', { tripId, userID });

            // Retrieve the trip data
            const tripData = await retrieveTripFromCloud(userID, tripId);

            if (tripData) {
              // Navigate to a special route that will handle loading the trip
              // We pass the trip data as a stringified parameter
              router.push({
                pathname: '/(tabs)/profile',
                params: {
                  autoLoadTripId: tripId,
                  fromNotification: 'true'
                }
              });
            } else {
              console.warn('Trip data not found, navigating to profile');
              router.push('/(tabs)/profile');
            }
          } catch (error) {
            console.error('Error loading trip from notification:', error);
            // Fallback to profile page
            router.push('/(tabs)/profile');
          }
        } else {
          console.log('No tripId in notification, navigating to profile');
          router.push('/(tabs)/profile');
        }
      } else {
        console.log('Notification tapped but no custom data available');
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

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
        <Stack.Screen
          name="edit-profile"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </CreateTripProvider>
  );
}
