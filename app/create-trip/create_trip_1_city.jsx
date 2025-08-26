import 'react-native-get-random-values';
import { Colors } from '../../constants/Colors';
import { API_KEYS } from '../../constants/ApiKeys';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useCreateTrip } from '../../context/CreateTripContext';

export default function create_trip_1_city() {
    const router = useRouter();
    const navigation = useNavigation();
    const { setIsCreatingTrip, selectedCity, setSelectedCity } = useCreateTrip();

    useEffect(() => {
        navigation.setOptions({
            headerShown: false
        })
        
        // Set flag that user is creating a trip
        setIsCreatingTrip(true);
        
        // Cleanup when component unmounts
        return () => {
            setIsCreatingTrip(false);
        };
    }, [])

    const handleNext = () => {
        if (!selectedCity) {
            return;
        }
        router.push('/create-trip/create_trip_2_length');
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: Colors.WHITE }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={60}
        >
            <View style={{
                padding: 25,
                paddingTop: 40,
                backgroundColor: Colors.WHITE,
                minHeight: '100%'
            }}>
                <TouchableOpacity onPress={() => router.replace('(tabs)/create_new_trip')} style={{ marginTop: 20 }}>
                    <Ionicons name="arrow-back" size={32} color="black" />
                </TouchableOpacity>

                {/* Enter City */}
                <View style={{
                    marginTop: 15
                }}>
                    <Text style={{
                        fontFamily: 'outfit-bold',
                        fontSize: 36
                    }}>Plan Your Trip</Text>
                    
                    <Text style={[styles.label, { marginTop: 20 }]}>Cities</Text>
                    <GooglePlacesAutocomplete
                        placeholder='Ex: New York City, Boston'
                        onPress={(data) => {
                            setSelectedCity(data.description);
                        }}
                        query={{
                            key: API_KEYS.GOOGLE_MAPS,
                            language: 'en',
                            types: '(cities)',
                        }}
                        styles={{
                            container: {
                                flex: 0,
                                zIndex: 1,
                            },
                            textInputContainer: {
                                flexDirection: 'row',
                            },
                            textInput: {
                                height: 50,
                                color: '#1a1a1a',
                                fontSize: 16,
                                fontFamily: 'outfit',
                                borderWidth: 1,
                                borderRadius: 15,
                                borderColor: '#1a1a1a',
                                paddingHorizontal: 15,
                            },
                            listView: {
                                backgroundColor: 'white',
                                borderRadius: 15,
                                marginTop: 5,
                                elevation: 3,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                            },
                            row: {
                                backgroundColor: 'white',
                                padding: 13,
                                height: 44,
                                flexDirection: 'row',
                            },
                            description: {
                                fontFamily: 'outfit',
                                fontSize: 16,
                                color: '#1a1a1a',
                            },
                        }}
                        fetchDetails={false}
                        enablePoweredByContainer={false}
                        debounce={200}
                    />
                </View>
                
                {/* Next Button */}
                <View style={{ position: 'absolute', bottom: 50, left: 25, right: 25 }}>
                    <TouchableOpacity
                        onPress={handleNext}
                        style={{
                            padding: 20,
                            backgroundColor: selectedCity ? Colors.PRIMARY : Colors.GRAY,
                            opacity: selectedCity ? 1 : 0.6,
                            borderRadius: 15,
                        }}
                        disabled={!selectedCity}
                    >
                        <Text style={{
                            color: Colors.WHITE,
                            textAlign: 'center',
                            fontFamily: 'outfit-bold',
                        }}>Next</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
    }
})