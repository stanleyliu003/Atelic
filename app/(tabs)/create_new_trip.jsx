import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import StartNewTripCard from '../create-trip/start_new_trip';

export default function Create_New_Trip() {

  const router = useRouter();

  return (
    
    <View style={{
        padding:25,
        paddingTop:55,
        backgroundColor:Colors.WHITE,
        height: '100%'
    }}>

        <View
        style={{
            display:'flex',
            flexDirection:'row',
            alignContent:'center',
            justifyContent:'space-between',
            paddingTop:25,
        }
        }>
            <Text style={{
                fontFamily:'outfit-bold',
                fontSize:33
            }}>Create New Trip</Text>
        </View>
        <StartNewTripCard>
        </StartNewTripCard>
    </View>
  )
}