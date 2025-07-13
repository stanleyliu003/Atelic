import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';


export default function MyTrip() {
  //storing user trips
  //const[userTrips,setUserTrips]=useState([]);
  //userTrips,[]=0;

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
            }}>My Trips</Text>
        </View>
    </View>
  )
}
//super case sensitive