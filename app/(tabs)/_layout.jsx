import { Colors } from '../../constants/Colors';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';


export default function TabLayout() {
  return (
    <Tabs screenOptions={{
        headerShown:false,
        tabBarActiveTintColor:Colors.PRIMARY
    }}>

      <Tabs.Screen name = "mytrip"
        options={{
            tabBarLabel:"Coming Soon",
            tabBarIcon:({color})=><Ionicons name="location-sharp" 
            size={24} color={Colors.GRAY} />,
            tabBarButton: () => (
              <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: 0.5
              }}>
                <Ionicons name="location-sharp" size={24} color={Colors.GRAY} />
                <Text style={{
                  fontSize: 12,
                  color: Colors.GRAY,
                  fontFamily: 'outfit',
                  marginTop: 2
                }}>Coming Soon</Text>
              </View>
            )
        }}
      />
      <Tabs.Screen name = "create_new_trip"
      options={{
            tabBarLabel:" ",
            tabBarIcon:({color})=><Ionicons name="add-circle" 
            size={30} color={color} />
      }}
      />
      <Tabs.Screen name = "profile"
      options={{
            tabBarLabel:"Profile",
            tabBarIcon:({color})=><Feather name="user" 
            size={24} color={color} />
      }}
      />
    </Tabs>
  )
}