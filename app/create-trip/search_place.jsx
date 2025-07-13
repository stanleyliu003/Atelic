// import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

export default function search_place() {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAP_KEY;
    console.log('My Google API Key in SearchPlace component:', apiKey);
    if (!apiKey) {
    console.error("API KEY IS UNDEFINED OR NOT LOADED IN APP!");
    }

    useEffect(() => {
        if (!apiKey) {
            console.error("API Key is undefined for direct fetch test!");
            return;
        }
        const testUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Toronto&language=en&key=${apiKey}`;
        console.log('Directly fetching:', testUrl);

        fetch(testUrl)
            .then(response => {
                console.log('Direct Fetch Response Status:', response.status);
                // Try to get text first to avoid issues if not JSON
                return response.text().then(text => {
                    console.log('Direct Fetch Response Text:', text);
                    try {
                        const jsonData = JSON.parse(text);
                        console.log('Direct Fetch Response JSON Data:', JSON.stringify(jsonData, null, 2));
                        if (jsonData.status !== 'OK' && jsonData.status !== 'ZERO_RESULTS') {
                            console.error('Google API Error:', jsonData.error_message || jsonData.status);
                        }
                    } catch (e) {
                        console.error('Failed to parse direct fetch response as JSON.');
                    }
                });
            })
            .catch(err => {
                console.error('Direct Fetch Error:', err);
            });
    }, [apiKey]); // Re-run if apiKey changes (though it shouldn't frequently)

    
    
    // const navigation=useNavigation();
    {/*
    useEffect(()=>{
        navigation.setOptions({
            headerShown:true,
            headerTransparent:true,
            headerTitle:'Search'
        })
    },[])
    */}

  return (


    <View 
    style={{
        
    }}
    >
        {
        <GooglePlacesAutocomplete
        placeholder='Search'
        onPress={(data, details = null) => {
            // 'details' is provided when fetchDetails = true
        console.log(data, details);
        }}
        query={{
            key: process.env.EXPO_PUBLIC_GOOGLE_MAP_KEY,
            language: 'en',
        }} 

    />
    } 
    
    </View>
    )
}

