import { Colors } from '../../constants/Colors';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';


export default function TabLayout() {
  return (
    <Tabs screenOptions={{
        headerShown:false,
        tabBarActiveTintColor:Colors.PRIMARY
    }}>

      <Tabs.Screen name = "saved_places"
        options={{
            tabBarLabel:"Saved",
            tabBarIcon:({color, focused})=><Ionicons name={focused ? "bookmark" : "bookmark-outline"}
            size={24} color={color} />
        }}
      />
      <Tabs.Screen name = "create_new_trip"
      options={{
            tabBarLabel:" ",
            tabBarIcon:({color, focused})=><Ionicons name="add-circle"
            size={30} color={focused ? '#F36406' : '#FDAA48'} />
      }}
      />
      <Tabs.Screen name = "feed"
        options={{
            tabBarLabel:"Home",
            tabBarIcon:({color, focused})=><Ionicons name={focused ? "home" : "home-outline"}
            size={24} color={color} />
        }}
      />
      <Tabs.Screen name = "explore"
        options={{
            href: null, // Hide this tab from the tab bar
        }}
      />
      <Tabs.Screen name = "mytrip"
        options={{
            href: null, // Hide this tab from the tab bar
        }}
      />
      <Tabs.Screen name = "profile"
      options={{
            href: null, // Hide this tab from the tab bar
      }}
      />
    </Tabs>
  )
}