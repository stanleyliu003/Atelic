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
            tabBarIcon:({color, focused})=><Ionicons name="add-circle"
            size={30} color={focused ? '#F36406' : '#FDAA48'} />
      }}
      />
      <Tabs.Screen name = "profile"
      options={{
            tabBarLabel:"Profile",
            tabBarIcon:({color, focused})=><FontAwesome5 name={focused ? "user-alt" : "user"}
            size={24} color={color} />
      }}
      />
    </Tabs>
  )
}