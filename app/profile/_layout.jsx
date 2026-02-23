import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'default',
      }}
    >
      <Stack.Screen
        name="[username]"
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="followers"
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="following"
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="follow-requests"
        options={{
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
