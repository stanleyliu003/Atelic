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
                {/* Header Row */}
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.replace('(tabs)/create_new_trip')} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={32} color="black" />
                    </TouchableOpacity>
                    <Text style={styles.titleText}>Plan Your Trip</Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressSection}>
                    <View style={styles.progressTrack}>
                        <View style={styles.progressFill1}></View>
                    </View>
                    <Text style={styles.progressLabel}>Step 1 of 3</Text>
                </View>

                {/* Destination Prompt */}
                <View style={styles.promptSection}>                    
                    <Text style={styles.promptTitle}>Where do you want to go?</Text>
                    <Text style={styles.promptSubtitle}>Select your destination city</Text>
                </View>

                {/* Enter City */}
                <View style={{
                    marginTop: 15
                }}>
                    
                    <GooglePlacesAutocomplete
                        placeholder='Ex: Boston, MA, USA'
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
                                width: '100%',
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
                                flex: 1,
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
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 10,
    },
    backButton: {
        marginRight: 15,
    },
    titleText: {
        fontFamily: 'outfit-bold',
        fontSize: 32,
        color: '#1a1a1a',
        flex: 1,
    },
    progressSection: {
        padding: 20,
        backgroundColor: 'white',
    },
    progressTrack: {
        height: 6,
        backgroundColor: '#e0e0e0',
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
    },
    progressFill1: {
        height: '100%',
        width: '33.33%',
        backgroundColor: '#333',
        borderRadius: 3,
    },
    promptSection: {
        paddingHorizontal: 20,
        paddingVertical: 25,
        alignItems: 'center',
      },
      promptTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 8,
      },
      promptSubtitle: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
      },
    progressLabel: {
        marginTop: 10,
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
        fontFamily: 'outfit-medium',
    }
})