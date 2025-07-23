import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import StartNewTripCard from '../create-trip/start_new_trip';
import Start2ndTripCard from '../create-trip/start_2nd_trip';
import { useCreateTrip } from '../../context/CreateTripContext';

export default function Create_New_Trip() {

  const router = useRouter();
  const { activities, wishlistText } = useCreateTrip();

  // Check if user has existing trip data
  const hasExistingTrip = activities && activities.length > 0 && wishlistText;

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
        
        {hasExistingTrip ? <Start2ndTripCard /> : <StartNewTripCard />}
    </View>
  )
}