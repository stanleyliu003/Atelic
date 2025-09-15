import { API } from 'aws-amplify';

/**
 * Use API.post to invoke Lambda function with higher timeout than GraphQL
 * This bypasses AppSync's 30-second timeout by using REST API instead
 */
export const analyzeWishlistDirect = async (wishlistText, selectedCity) => {
    try {
        console.log('[Lambda Service] Starting direct Lambda analysis via REST API...');
        const startTime = Date.now();

        const payload = {
            wishlist_text: wishlistText,
            selectedCity: selectedCity
        };

        console.log('[Lambda Service] Calling Lambda via REST API...');
        console.log('[Lambda Service] Payload:', payload);

        // Create a custom API configuration for Lambda invocation
        // We'll use API.post with a custom endpoint that has higher timeout
        const result = await API.post('WishlistRestAPI', '/analyze-wishlist', {
            body: payload,
            timeout: 120000 // 2 minutes timeout
        });

        const duration = Date.now() - startTime;
        console.log(`[Lambda Service] Lambda REST API call completed in ${duration}ms`);
        console.log('[Lambda Service] Response:', result);

        // Return the activities in the same format as GraphQL
        return {
            data: {
                analyzeWishlist: {
                    wishlist_activities: result.wishlist_activities || []
                }
            }
        };

    } catch (error) {
        console.error('[Lambda Service] Error in direct Lambda invocation:', error);

        // If the REST API fails, fallback to the original GraphQL approach
        console.log('[Lambda Service] Falling back to GraphQL...');
        throw error;
    }
};