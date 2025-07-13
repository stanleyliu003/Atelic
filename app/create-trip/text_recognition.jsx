import { Colors } from '@/constants/Colors';
import { generateClient } from '@aws-amplify/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';

const client = generateClient();

export default function text_recognition() {
    const router = useRouter();
    const navigation=useNavigation();
    const { updateActivities, updateWishlistText, setIsLoading } = useCreateTrip();
    const [wishlist_text_raw,setWishlistText]=useState();

    useEffect(()=>{
        navigation.setOptions({
          headerShown:false
      })
    },[])

    const OnWishListInput = async () => {
        //check if users inputted wishlist text
        if(!wishlist_text_raw){
            return;
        }
        try {
            setIsLoading(true);
            // Use the modular client to call the GraphQL API
            const result = await client.graphql({
                query: `
                    query AnalyzeWishlist($wishlist_text: String!) {
                        analyzeWishlist(wishlist_text: $wishlist_text) {
                            wishlist_activities {
                                name
                                lat
                                lng
                                rating
                                user_ratings_total
                                formatted_address
                                types
                                place_id
                                photo_reference
                            }
                        }
                    }
                `,
                variables: { wishlist_text: wishlist_text_raw }
            });
            
            // Extract and print the activities array with proper null checking
            const activities = result?.data?.analyzeWishlist?.wishlist_activities || [];
            console.log('Extracted activities:', JSON.stringify(activities, null, 2));
            
            if (activities.length === 0) {
                console.warn('No activities were returned from the analysis');
            }
            
            // Store activities in context
            updateActivities(activities);
            updateWishlistText(wishlist_text_raw);
            
            // Navigate to the next screen
            //router.replace('create-trip/wishlist_map');
            router.replace('/create-trip/wishlist_info');
        } catch (error) {
            console.error('Error analyzing wishlist:', error);
            if (error.errors) {
                console.error('GraphQL Errors:', JSON.stringify(error.errors, null, 2));
            }
        } finally {
            setIsLoading(false);
        }

    }
    //nesting multiple actions into one function ONLY if user fills out certain criteria


  return (

    <View style={{
      padding:25,
      paddingTop:40,
      backgroundColor:Colors.WHITE,
      height:'100%'
    }}>
      <TouchableOpacity onPress={()=>router.push('(tabs)/create_new_trip')}>
        <Ionicons name="arrow-back" size={32} color="black" />
      </TouchableOpacity>

    {/* Enter Wishlist Text */}
        <View style={{
          marginTop:45
        }}>
          <Text style={{
            fontFamily:'outfit-bold',
            fontSize:36
          }}>Text Recognition</Text>
          <TextInput 
          style={styles.input}
          placeholder='Enter your destinations here (e.g., Times Square, Empire State Building, Statue of Liberty) to build your trip.'
          onChangeText={(value)=>setWishlistText(value)}
          multiline={true} // allows multiple lines to show up
          />
        </View>
    
    {/* Create Wishlist Button */}
      <View> 
        <TouchableOpacity
        onPress={OnWishListInput}
        style ={{
          padding:20,
          backgroundColor:Colors.PRIMARY,
          borderRadius:15, //rounded corners
          marginTop:50
        }}>
       <Text style = {{
           color:Colors.WHITE,
           textAlign:'center',
           fontFamily:'outfit-bold',
       }}> Create Wishlist</Text>
        </TouchableOpacity>
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  input:{
      marginTop:30,
      padding:15,
      borderWidth:1,
      borderRadius:30,
      borderColor:Colors.GRAY,
      fontFamily:'outfit',
      height: 400,
      textAlignVertical: 'top', //aligns text with top
      paddingTop: 15 //padding from top to the actual text
  }
})