import { API } from 'aws-amplify';
import { getTripIDs as getTripIDsQuery } from '../graphql/queries';
import { getUserTripsDetailed as getUserTripsQuery } from '../graphql/customQueries';

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

/**
 * List all trips for a user (summary data only)
 */
export const listUserTripsFromCloud = async (userID) => {
    try {
        console.log('[Lambda Service] Listing user trips from cloud storage...');
        console.log('[Lambda Service] UserID:', userID);

        const result = await API.graphql({
            query: getTripIDsQuery,
            variables: {
                userID: userID
            }
        });

        console.log('[Lambda Service] Retrieved trip summaries');
        return result.data.getTripIDs;

    } catch (error) {
        console.error('[Lambda Service] Error listing user trips from cloud:', error);
        throw error;
    }
};

/**
 * Retrieve detailed trip data from cloud storage using getUserTrips Lambda function
 */
export const retrieveTripFromCloud = async (userID, tripID) => {
    try {
        console.log('[Lambda Service] Retrieving trip details from cloud storage...');
        console.log('[Lambda Service] UserID:', userID, 'TripID:', tripID);

        const result = await API.graphql({
            query: getUserTripsQuery,
            variables: {
                userID: userID,
                tripID: tripID
            }
        });

        console.log('[Lambda Service] Retrieved trip details:');
        return result.data.getUserTrips;

    } catch (error) {
        console.error('[Lambda Service] Error retrieving trip details from cloud:', error);
        throw error;
    }
};