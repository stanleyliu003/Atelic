import { Colors } from '../../constants/Colors';
import { API, graphqlOperation } from 'aws-amplify';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';

export default function text_recognition() {
    const router = useRouter();
    const navigation=useNavigation();
    const { updateActivities, updateWishlistText, setIsLoading, resetTrip, setIsCreatingTrip } = useCreateTrip();
    const [wishlist_text_raw,setWishlistText]=useState();
    const [city, setCity] = useState();
    const [loading, setLoading] = useState(false);

    useEffect(()=>{
        navigation.setOptions({
          headerShown:false
      })
      
      // Set flag that user is creating a trip
      setIsCreatingTrip(true);
      
      // Cleanup when component unmounts
      return () => {
        setIsCreatingTrip(false);
      };
    },[])

    const OnWishListInput = async () => {
        //check if users inputted wishlist text and city
        if(!wishlist_text_raw || !city){
            return;
        }
        try {
            setLoading(true);
            setIsLoading(true);
            // Combine city and destinations for the API call
            const combinedText = `${city}: ${wishlist_text_raw}`;
            // Use the Gen 1 API to call the GraphQL API
            const result = await API.graphql(graphqlOperation(`
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
                            is_recommended
                        }
                    }
                }
            `, { wishlist_text: combinedText }));
            
            // Extract and print the activities array with proper null checking
            const activities = result?.data?.analyzeWishlist?.wishlist_activities || [];
            console.log('Extracted activities:', JSON.stringify(activities, null, 2));
            
            if (activities.length === 0) {
                console.warn('No activities were returned from the analysis');
            }
            
            // Store activities in context
            updateActivities(activities);
            updateWishlistText(combinedText);
            
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
            setLoading(false);
        }

    }
    //nesting multiple actions into one function ONLY if user fills out certain criteria

    const handleCreateWishlist = () => {
        resetTrip();
        OnWishListInput();
    };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.WHITE }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={60}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: Colors.WHITE }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{
          padding:25,
          paddingTop:40,
          backgroundColor:Colors.WHITE,
          minHeight:'100%'
        }}>
          <TouchableOpacity onPress={()=>router.push('(tabs)/create_new_trip')}>
            <Ionicons name="arrow-back" size={32} color="black" />
          </TouchableOpacity>

        {/* Enter City */}
            <View style={{
              marginTop:25
            }}>
              <Text style={{
                fontFamily:'outfit-bold',
                fontSize:36
              }}>Plan Your Trip</Text>
              
              <Text style={[styles.label, { marginTop: 20 }]}>Cities</Text>
              <TextInput 
                style={styles.cityInput}
                placeholder='Ex: New York City, Boston'
                onChangeText={(value)=>setCity(value)}
              />
            </View>

        {/* Enter Destinations */}
            <View style={{
              marginTop:25
            }}>
              <Text style={styles.label}>Must See Destinations</Text>
              <TextInput 
                style={styles.input}
                placeholder='Ex: Times Square, Statue of Liberty, Boston Common, Harvard'
                onChangeText={(value)=>setWishlistText(value)}
                multiline={true} // allows multiple lines to show up
              />
            </View>
        
        {/* Create Wishlist Button */}
          <View> 
            <TouchableOpacity
            onPress={handleCreateWishlist}
            style ={{
              padding:20,
              backgroundColor:loading ? Colors.GRAY : Colors.PRIMARY,
              opacity: loading ? 0.6 : 1,
              borderRadius:15, //rounded corners
              marginTop:50
            }}
            disabled={loading}
            >
           <Text style = {{
               color: Colors.WHITE,
               textAlign:'center',
               fontFamily:'outfit-bold',
           }}> {loading ? 'Creating Wishlist...' : 'Create Wishlist'}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  label: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    marginTop: 7,
    marginBottom: 10,
    color: '#1a1a1a'
  },
  cityInput: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 15,
    borderColor: '#1a1a1a',
    fontFamily: 'outfit',
    height: 50,
    color: '#1a1a1a'
  },
  input:{
      marginTop: 10,
      padding:15,
      borderWidth:1,
      borderRadius:30,
      borderColor:'#1a1a1a',
      fontFamily:'outfit',
      height: 300,
      textAlignVertical: 'top', //aligns text with top
      paddingTop: 15, //padding from top to the actual text
      color: '#1a1a1a' //very dark gray, almost black for maximum readability
  }
})