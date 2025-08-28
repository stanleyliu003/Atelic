import { Colors } from '../../constants/Colors';
import { API, graphqlOperation } from 'aws-amplify';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';

export default function create_trip_4_additional_info() {
    const router = useRouter();
    const navigation = useNavigation();
    const { updateActivities, updateWishlistText, setIsLoading, resetTrip, setIsCreatingTrip, selectedCategories, cityCategories } = useCreateTrip();
    const [wishlist_text_raw, setWishlistText] = useState();
    const [loading, setLoading] = useState(false);

    const { selectedCity, tripLength } = useCreateTrip();

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

    const OnWishListInput = async () => {
        // Check if user has either selected categories or inputted wishlist text
        if (!wishlist_text_raw && (!selectedCategories || selectedCategories.length === 0)) {
            return;
        }
        try {
            setLoading(true);
            setIsLoading(true);
            // Build categories text if available
            let categoriesText = '';
            if (selectedCategories && selectedCategories.length > 0 && cityCategories) {
                const selectedCategoryDetails = cityCategories.filter(category => 
                    selectedCategories.includes(category.category)
                );
                
                if (selectedCategoryDetails.length > 0) {
                    const categoryDescriptions = selectedCategoryDetails.map(category => {
                        const items = category.category_items ? category.category_items.join(', ') : '';
                        return `${category.category} (${items})`;
                    }).join('; ');
                    
                    categoriesText = ` The user is interested in these types of experiences: ${categoryDescriptions}.`;
                }
            }
            
            // Combine city, trip length, categories, and destinations for the API call
            const combinedText = `User wants to visit ${selectedCity} for ${tripLength} days.${categoriesText}${wishlist_text_raw ? ` They also want to visit these specific places or have these interests: ${wishlist_text_raw}` : ''}`;
            // Use the Gen 1 API to call the GraphQL API
            const result = await API.graphql(graphqlOperation(`
                query AnalyzeWishlist($wishlist_text: String!, $selectedCity: String!) {
                    analyzeWishlist(wishlist_text: $wishlist_text, selectedCity: $selectedCity) {
                        wishlist_activities {
                            name
                            city
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
            `, { wishlist_text: combinedText, selectedCity: selectedCity }));
            
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

    const handleCreateWishlist = () => {
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
                nestedScrollEnabled={true}
                style={{ backgroundColor: Colors.WHITE }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{
                    padding: 25,
                    paddingTop: 40,
                    backgroundColor: Colors.WHITE,
                    minHeight: '100%'
                }}>
                    {/* Header Row */}
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.replace('/create-trip/create_trip_3_categories')} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={32} color="black" />
                        </TouchableOpacity>
                        <Text style={styles.titleText}>Plan Your Trip</Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressSection}>
                        <View style={styles.progressTrack}>
                            <View style={styles.progressFill4}></View>
                        </View>
                        <Text style={styles.progressLabel}>Step 4 of 4</Text>
                    </View>

                    {/* Additional Info Prompt */}
                    <View style={styles.promptSection}>                    
                        <Text style={styles.promptTitle}>Any additional interests or preferences for your trip?</Text>
                        <Text style={styles.promptSubtitle}>Share specific interests, experiences, activities you'd like to include (optional)</Text>
                    </View>

                    {/* Enter Destinations */}
                    <View style={{
                        marginTop: 25
                    }}>
                        <TextInput 
                            style={styles.input}
                            placeholder='Ex: Vegan friendly restaurants, coastal hiking trails, jazz bars'
                            onChangeText={(value) => setWishlistText(value)}
                            multiline={true}
                        />
                    </View>
                
                    {/* Create Wishlist Button */}
                    <View> 
                        <TouchableOpacity
                            onPress={handleCreateWishlist}
                            style={{
                                padding: 20,
                                backgroundColor: loading ? Colors.GRAY : Colors.PRIMARY,
                                opacity: loading ? 0.6 : 1,
                                borderRadius: 15,
                                marginTop: 50
                            }}
                            disabled={loading}
                        >
                            <Text style={{
                                color: Colors.WHITE,
                                textAlign: 'center',
                                fontFamily: 'outfit-bold',
                            }}>{loading ? 'Creating Wishlist...' : 'Create Wishlist'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    input: {
        marginTop: 10,
        padding: 15,
        borderWidth: 1,
        borderRadius: 30,
        borderColor: '#1a1a1a',
        fontFamily: 'outfit',
        height: 250,
        textAlignVertical: 'top',
        paddingTop: 15,
        color: '#1a1a1a'
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
    progressFill4: {
        height: '100%',
        width: '100%',
        backgroundColor: '#333',
        borderRadius: 3,
    },
    progressLabel: {
        marginTop: 10,
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
        fontFamily: 'outfit-medium',
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
})
