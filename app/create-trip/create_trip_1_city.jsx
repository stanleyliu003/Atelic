import 'react-native-get-random-values';
import { Colors } from '../../constants/Colors';
import { API_KEYS } from '../../constants/ApiKeys';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useCreateTrip } from '../../context/CreateTripContext';
import { API } from 'aws-amplify';
import { getRegionImage, getCityCategories } from '../../src/graphql/queries';
import { ActivityImage } from '../../src/components/trip-view/activity/activity_image';
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
        CACHE_KEYS
    } = useCreateTrip();
    const [cityPhotoRef, setCityPhotoRef] = useState(null);
    const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
    const googlePlacesRef = useRef(null);

    // Note: CACHE_KEYS now comes from context

    // Load cached values on component mount
    const loadCachedValues = async () => {
        try {
            const cachedCity = await AsyncStorage.getItem(CACHE_KEYS.SELECTED_CITY);
            const cachedPhotoRef = await AsyncStorage.getItem(CACHE_KEYS.CITY_PHOTO_REF);
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
            
            if (cachedPhotoRef) {
                setCityPhotoRef(cachedPhotoRef);
            }
            
            if (cachedCategories) {
                setCityCategories(JSON.parse(cachedCategories));
            }
        } catch (error) {
            console.error('Error loading cached values:', error);
        }
    };

    // Save city, photo reference, and categories to cache
    const saveCityToCache = async (city, photoRef, categories) => {
        try {
            if (city) {
                await AsyncStorage.setItem(CACHE_KEYS.SELECTED_CITY, city);
            }
            if (photoRef) {
                await AsyncStorage.setItem(CACHE_KEYS.CITY_PHOTO_REF, photoRef);
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
            await AsyncStorage.multiRemove([CACHE_KEYS.SELECTED_CITY, CACHE_KEYS.CITY_PHOTO_REF, CACHE_KEYS.CITY_CATEGORIES]);
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

    // Clear photo reference and categories when selectedCity is cleared, but don't interfere with user input
    useEffect(() => {
        if (!selectedCity) {
            setCityPhotoRef(null);
            setCityCategories(null);
            setIsLoadingPhoto(false);
        }
    }, [selectedCity, setCityCategories])

    // Fetch city photo independently - this should be fast
    const fetchCityPhoto = async (cityName) => {
        try {
            setIsLoadingPhoto(true);
            
            const imageResult = await API.graphql({
                query: getRegionImage,
                variables: { selectedCity: cityName }
            });
            
            const photoRef = imageResult.data.getRegionImage.photo_reference;
            setCityPhotoRef(photoRef);
            
            // Save photo to cache immediately
            await saveCityToCache(cityName, photoRef, null);
            
        } catch (error) {
            console.error('Error fetching city photo:', error);
            setCityPhotoRef(null);
            // Still save the city name even if photo fetch fails
            await saveCityToCache(cityName, null, null);
        } finally {
            setIsLoadingPhoto(false);
        }
    };

    // Fetch city categories independently - this can be slow due to Gemini
    const fetchCityCategories = async (cityName) => {
        try {
            const categoriesResult = await API.graphql({
                query: getCityCategories,
                variables: { selectedCity: cityName }
            });
            
            const categories = categoriesResult.data.getCityCategories.categories;
            setCityCategories(categories);
            
            // Update cache with categories (preserving existing photo)
            const existingCity = await AsyncStorage.getItem(CACHE_KEYS.SELECTED_CITY);
            const existingPhoto = await AsyncStorage.getItem(CACHE_KEYS.CITY_PHOTO_REF);
            await saveCityToCache(existingCity || cityName, existingPhoto, categories);
            
        } catch (error) {
            console.error('Error fetching city categories:', error);
            setCityCategories(null);
        }
    };

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
                    <Text style={styles.promptSubtitle}>Select your destination</Text>
                </View>

                {/* Enter City */}
                <View style={{
                    marginTop: 15
                }}>
                    
                    <GooglePlacesAutocomplete
                        ref={googlePlacesRef}
                        placeholder='Ex: Boston, MA, USA'
                        onPress={async (data) => {
                            setSelectedCity(data.description);
                            // Fetch city photo and categories independently
                            // Photo should load quickly, categories may take longer due to Gemini
                            fetchCityPhoto(data.description); // Don't await - let it run independently
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

                {/* City Photo Preview */}
                {selectedCity && (
                    <View style={styles.cityPhotoSection}>
                        {isLoadingPhoto ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={Colors.PRIMARY} />
                                <Text style={styles.loadingText}>Loading destination photo...</Text>
                            </View>
                        ) : (
                            <ActivityImage 
                                photo_reference={cityPhotoRef || ''}
                                style={styles.cityImage}
                            />
                        )}
                    </View>
                )}


                
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
    },
    cityPhotoSection: {
        marginTop: 20,
        padding: 15,
    },
    cityPhotoLabel: {
        fontFamily: 'outfit-medium',
        fontSize: 16,
        color: '#1a1a1a',
        marginBottom: 10,
    },
    cityImage: {
        width: '100%',
        height: 200,
        borderRadius: 15,
    },
    loadingContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 15,
    },
    loadingText: {
        marginTop: 10,
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#666',
    },

})