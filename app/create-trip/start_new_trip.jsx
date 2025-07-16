import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

export default function StartNewTripCard() {

    const router=useRouter(); //initializing the router
  return (
    <View
    style = {{
        padding:20,
        marginTop:50,
        display:'flex', //what does this mean?
        alignItems:'center',
        gap:25
    }}
    >
    <Ionicons name="location-sharp" size={30} color="black" />
    <Text style={{
        fontSize: 20,
        fontFamily:'outfit',
    }}>
      No trips planned yet 
    </Text>

    <Text style={{
        fontSize:20,
        fontFamily:'outfit',
        textAlign:'center',
        color:Colors.GRAY
    }}>
        Looks like its time to plan a new travel experience! Get started below.
    </Text>

    <TouchableOpacity 
    onPress={()=>router.push('create-trip/text_recognition')} //redirecting when button is pushed 
    style ={{ 
        padding:10,
        backgroundColor:Colors.PRIMARY,
        borderRadius:15,
        paddingHorizontal:30
    }}>
        <Text style = {{
            color:Colors.WHITE,
            fontFamily:'outfit-medium',
            fontSize:17
        }}>
            Start a new trip
        </Text>
    </TouchableOpacity>
    </View>
  )
}