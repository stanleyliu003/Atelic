import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { API } from 'aws-amplify';

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
    
    const progressAnim = useRef(new Animated.Value(0)).current;
    const [progressText, setProgressText] = useState('Initializing...');

    useEffect(() => {
        const animateProgress = (toValue, duration = 4000) => {
            return new Promise(resolve => {
                Animated.timing(progressAnim, {
                    toValue,
                    duration,
                    useNativeDriver: false,
                }).start(resolve);
            });
        };

        const runProgressAnimation = async () => {
            // Step 1: Initial setup (3 seconds)
            setProgressText('Preparing your preferences...');
            await animateProgress(0.2, 4000);
            
            // Step 2: Building query (3 seconds)
            setProgressText('Building your travel query...');
            await animateProgress(0.4, 4000);
            
            // Step 3: Analyzing preferences (3 seconds)
            setProgressText('Analyzing your preferences...');
            await animateProgress(0.7, 4000);
            
            // Step 4: Processing results (3 seconds)
            setProgressText('Creating your wishlist...');
            await animateProgress(0.9, 4000);
            
            // Step 5: Finalizing (3 seconds)
            setProgressText('Almost done...');
            await animateProgress(1.0, 4000);
        };

        const createWishlist = async () => {
            try {
                setIsLoading(true);

                // Add timing logs to debug timeout issue
                const requestStartTime = Date.now();
                console.log(`[TIMING] Request starting at: ${new Date(requestStartTime).toISOString()}`);

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

                console.log(`[TIMING] Starting API call at: ${new Date().toISOString()}`);
                console.log(`[TIMING] Combined text length: ${combinedText.length} characters`);

                // Start the API call and progress animation in parallel
                const [result] = await Promise.all([
                    // API call with timing
                    (async () => {
                        try {
                            const apiStartTime = Date.now();
                            console.log(`[TIMING] REST API call starting at: ${new Date(apiStartTime).toISOString()}`);

                            const apiResult = await API.post('WishlistRestAPI', '/analyze/wishlist', {
                                body: {
                                    wishlist_text: combinedText,
                                    selectedCity: selectedCity
                                }
                            });

                            const apiEndTime = Date.now();
                            const apiDuration = apiEndTime - apiStartTime;
                            console.log(`[TIMING] REST API call completed at: ${new Date(apiEndTime).toISOString()}`);
                            console.log(`[TIMING] REST API call duration: ${apiDuration}ms`);

                            return apiResult;
                        } catch (apiError) {
                            const apiErrorTime = Date.now();
                            console.error(`[TIMING] REST API call failed at: ${new Date(apiErrorTime).toISOString()}`);
                            console.error(`[TIMING] REST API call duration before error: ${apiErrorTime - requestStartTime}ms`);
                            console.error(`[TIMING] API Error details:`, apiError);
                            throw apiError;
                        }
                    })(),
                    // Progress animation (15 seconds total - 5 steps x 3 seconds each)
                    runProgressAnimation()
                ]);
                
                // Extract and print the activities array with proper null checking
                // REST API may wrap the response in a body field or return it directly
                let responseData = result;
                if (typeof result.body === 'string') {
                    try {
                        responseData = JSON.parse(result.body);
                    } catch (parseError) {
                        console.error('Error parsing REST API response body:', parseError);
                        responseData = result;
                    }
                } else if (result.body && typeof result.body === 'object') {
                    responseData = result.body;
                }

                const activities = responseData?.wishlist_activities || [];
                const requestEndTime = Date.now();
                const totalDuration = requestEndTime - requestStartTime;

                console.log(`[TIMING] Request completed at: ${new Date(requestEndTime).toISOString()}`);
                console.log(`[TIMING] Total request duration: ${totalDuration}ms`);
                console.log(`[TIMING] Activities received: ${activities.length}`);
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
                setProgressText('Something went wrong...');
                // On error, go back to the previous screen
                setTimeout(() => router.back(), 1000);
            } finally {
                setIsLoading(false);
            }
        };

        createWishlist();
    }, []);

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%']
    });

    return (
        <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: Colors.WHITE,
            paddingHorizontal: 40
        }}>
            <Text style={{
                fontFamily: 'outfit-bold',
                fontSize: 28,
                marginBottom: 10,
                color: Colors.PRIMARY,
                textAlign: 'center'
            }}>
                Creating Your Wishlist
            </Text>
            
            <Text style={{
                fontFamily: 'outfit',
                fontSize: 16,
                marginBottom: 30,
                color: Colors.GRAY,
                textAlign: 'center'
            }}>
                {progressText}
            </Text>
            
            {/* Progress Bar Container */}
            <View style={{
                width: '100%',
                height: 6,
                backgroundColor: '#e0e0e0',
                borderRadius: 3,
                overflow: 'hidden',
                marginBottom: 15
            }}>
                <Animated.View style={{
                    height: '100%',
                    width: progressWidth,
                    backgroundColor: Colors.PRIMARY,
                    borderRadius: 3,
                }} />
            </View>
            

        </View>
    );
}
