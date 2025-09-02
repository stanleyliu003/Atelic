import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { API, graphqlOperation } from 'aws-amplify';

export default function LoadingWishlist() {
    const router = useRouter();
    const { 
        updateActivities, 
        updateWishlistText, 
        setIsLoading, 
        selectedCategories, 
        cityCategories,
        selectedCity,
        tripLength,
        wishlistText
    } = useCreateTrip();

    useEffect(() => {
        const createWishlist = async () => {
            try {
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
                const combinedText = `User wants to visit ${selectedCity} for ${tripLength} days.${categoriesText}${wishlistText ? ` They also want to visit these specific places or have these interests: ${wishlistText}` : ''}`;
                
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
                // On error, go back to the previous screen
                router.back();
            } finally {
                setIsLoading(false);
            }
        };

        createWishlist();
    }, []);

    return (
        <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: Colors.WHITE
        }}>
            <ActivityIndicator size="large" color={Colors.PRIMARY} />
            <Text style={{
                fontFamily: 'outfit',
                fontSize: 16,
                marginTop: 10,
                color: Colors.GRAY
            }}>
                Creating wishlist...
            </Text>
        </View>
    );
}
