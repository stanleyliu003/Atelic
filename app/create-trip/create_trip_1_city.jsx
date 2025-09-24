import 'react-native-get-random-values';
import { Colors } from '../../constants/Colors';
import { API_KEYS } from '../../constants/ApiKeys';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useCreateTrip } from '../../context/CreateTripContext';
import { API } from 'aws-amplify';
import { getCityCategories } from '../../src/graphql/queries';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function create_trip_1_city() {
    const router = useRouter();
    const navigation = useNavigation();
    const {
        setIsCreatingTrip,
        selectedCity,
        setSelectedCity,
        clearTripCreationCache,
        cityCategories,
        setCityCategories,
        tripLength,
        setTripLength,
        CACHE_KEYS
    } = useCreateTrip();
    const googlePlacesRef = useRef(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Note: CACHE_KEYS now comes from context

    // Load cached values on component mount
    const loadCachedValues = async () => {
        try {
            const cachedCity = await AsyncStorage.getItem(CACHE_KEYS.SELECTED_CITY);
            const cachedCategories = await AsyncStorage.getItem(CACHE_KEYS.CITY_CATEGORIES);

            if (cachedCity) {
                setSelectedCity(cachedCity);
                // Set GooglePlacesAutocomplete text directly when loading from cache
                setTimeout(() => {
                    if (googlePlacesRef.current) {
                        googlePlacesRef.current.setAddressText(cachedCity);
                    }
                }, 300); // Slightly longer delay to ensure component is ready
            }

            if (cachedCategories) {
                setCityCategories(JSON.parse(cachedCategories));
            }
        } catch (error) {
            console.error('Error loading cached values:', error);
        }
    };

    // Save city and categories to cache
    const saveCityToCache = async (city, categories) => {
        try {
            if (city) {
                await AsyncStorage.setItem(CACHE_KEYS.SELECTED_CITY, city);
            }
            if (categories) {
                await AsyncStorage.setItem(CACHE_KEYS.CITY_CATEGORIES, JSON.stringify(categories));
            }
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    };

    // Clear cache (useful when trip is completed or user wants to start fresh)
    const clearCache = async () => {
        try {
            await AsyncStorage.multiRemove([CACHE_KEYS.SELECTED_CITY, CACHE_KEYS.CITY_CATEGORIES]);
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    };

    useEffect(() => {
        navigation.setOptions({
            headerShown: false
        })
        
        // Set flag that user is creating a trip
        setIsCreatingTrip(true);
        
        // Load cached values
        loadCachedValues();
        
        // Cleanup when component unmounts
        return () => {
            setIsCreatingTrip(false);
        };
    }, [])

    // Clear categories when selectedCity is cleared, but don't interfere with user input
    useEffect(() => {
        if (!selectedCity) {
            setCityCategories(null);
        }
    }, [selectedCity, setCityCategories])


    // Fetch city categories independently - this can be slow due to Gemini
    const fetchCityCategories = async (cityName) => {
        try {
            const categoriesResult = await API.graphql({
                query: getCityCategories,
                variables: { selectedCity: cityName }
            });
            
            const categories = categoriesResult.data.getCityCategories.categories;
            setCityCategories(categories);
            
            // Update cache with categories
            const existingCity = await AsyncStorage.getItem(CACHE_KEYS.SELECTED_CITY);
            await saveCityToCache(existingCity || cityName, categories);
            
        } catch (error) {
            console.error('Error fetching city categories:', error);
            setCityCategories(null);
        }
    };

    const handleNext = () => {
        if (!selectedCity || !tripLength) {
            return;
        }
        router.push('/create-trip/create_trip_interactive');
    };

    const dayOptions = Array.from({ length: 14 }, (_, i) => i + 1);

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
                </View>

                {/* Destination Prompt */}
                <View style={styles.promptSection}>                    
                    <Text style={styles.promptTitleCity}>Where do you want to go?</Text>
                </View>

                {/* Enter City */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchIconInsideContainer}>
                        <Feather name="search" size={24} color="black" />
                    </View>
                    <GooglePlacesAutocomplete
                        ref={googlePlacesRef}
                        placeholder='Ex: Boston, MA, USA'
                        onPress={async (data) => {
                            setSelectedCity(data.description);
                            // Fetch city categories for trip planning
                            fetchCityCategories(data.description); // Don't await - let it run independently
                        }}
                        query={{
                            key: API_KEYS.GOOGLE_MAPS,
                            language: 'en',
                            types: '(regions)',
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
                                height: 55,
                                color: '#1a1a1a',
                                fontSize: 16,
                                fontFamily: 'outfit',
                                borderWidth: 0,
                                borderRadius: 20,
                                backgroundColor: '#ffffff',
                                paddingHorizontal: 15,
                                paddingLeft: 50,
                                flex: 1,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 8,
                                elevation: 4,
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

                {/* Trip Length Selection - Only show when destination is selected */}
                {selectedCity && (
                    <View style={styles.tripLengthSection}>
                        <View style={styles.promptSection}>
                            <Text style={styles.promptTitle}>How long is your trip?</Text>
                        </View>

                        <View style={{
                            marginTop: -10
                        }}>
                            <View style={styles.dropdownContainer}>
                                <TouchableOpacity
                                    style={styles.dropdownButton}
                                    onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                                >
                                    <View style={styles.dropdownContent}>
                                        <MaterialCommunityIcons name="calendar-clock-outline" size={24} color="black" />
                                        <Text style={[styles.dropdownButtonText, !tripLength && styles.placeholderText]}>
                                            {tripLength ? `${tripLength} day${tripLength > 1 ? 's' : ''}` : 'Select number of days'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.dropdownArrow, isDropdownOpen && styles.dropdownArrowOpen]}>
                                        ▼
                                    </Text>
                                </TouchableOpacity>

                                {isDropdownOpen && (
                                    <View style={styles.dropdownList}>
                                        <ScrollView style={styles.optionsList} nestedScrollEnabled={true}>
                                            {dayOptions.map(day => (
                                                <TouchableOpacity
                                                    key={day}
                                                    style={[
                                                        styles.option,
                                                        tripLength === day && styles.selectedOption
                                                    ]}
                                                    onPress={() => {
                                                        setTripLength(day);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                >
                                                    <Text style={[
                                                        styles.optionText,
                                                        tripLength === day && styles.selectedOptionText
                                                    ]}>
                                                        {day} day{day > 1 ? 's' : ''}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                )}

                {/* Next Button */}
                <View style={{ position: 'absolute', bottom: 50, left: 25, right: 25 }}>
                    <TouchableOpacity
                        onPress={handleNext}
                        style={{
                            padding: 20,
                            backgroundColor: (selectedCity && tripLength) ? Colors.PRIMARY : Colors.GRAY,
                            opacity: (selectedCity && tripLength) ? 1 : 0.6,
                            borderRadius: 15,
                        }}
                        disabled={!selectedCity || !tripLength}
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
    promptSection: {
        paddingHorizontal: 20,
        paddingVertical: 25,
        alignItems: 'left',
      },
      promptTitleCity: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        color: '#1a1a1a',
        textAlign: 'left',
        marginTop: 40,
        marginLeft: -20,
        marginBottom: 8,
      },
      promptTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        color: '#1a1a1a',
        textAlign: 'left',
        marginLeft: -20,
        marginBottom: 8,
      },
    tripLengthSection: {
        marginTop: 20,
    },
    dropdownContainer: {
        position: 'relative',
        zIndex: 1000,
    },
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderWidth: 0,
        borderRadius: 20,
        backgroundColor: 'white',
        height: 55,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    dropdownButtonText: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#1a1a1a',
    },
    dropdownArrow: {
        fontFamily: 'outfit',
        fontSize: 12,
        color: '#666',
        transform: [{ rotate: '0deg' }],
    },
    dropdownArrowOpen: {
        transform: [{ rotate: '180deg' }],
    },
    dropdownList: {
        position: 'absolute',
        top: 65,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderWidth: 0,
        borderRadius: 20,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        zIndex: 1001,
    },
    optionsList: {
        maxHeight: 200,
    },
    option: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    selectedOption: {
        backgroundColor: Colors.PRIMARY + '20',
    },
    optionText: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#1a1a1a',
        textAlign: 'center',
    },
    selectedOptionText: {
        fontFamily: 'outfit-bold',
        color: Colors.PRIMARY,
    },
    searchContainer: {
        position: 'relative',
        marginTop: -15,
    },
    searchIconInsideContainer: {
        position: 'absolute',
        left: 15,
        top: 15,
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
        height: 24,
        width: 24,
    },
    dropdownContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    placeholderText: {
        color: '#999999',
    },

})