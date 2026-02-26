import { API } from 'aws-amplify';
import { getTripIDs as getTripIDsQuery } from '../graphql/queries';
import { getUserTripsDetailed as getUserTripsQuery } from '../graphql/customQueries';
import { deleteUserAccount as deleteUserAccountMutation } from '../graphql/customMutations';
import { randomUUID } from 'expo-crypto';
import { getCachedTrip, setCachedTrip } from './tripCacheService';

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

        // Add instanceId to each activity returned from Lambda
        const activitiesWithInstanceIds = (result.wishlist_activities || []).map(activity => ({
            ...activity,
            instanceId: randomUUID()  // Generate unique ID for each new activity
        }));

        console.log('[Lambda Service] Added instanceIds to', activitiesWithInstanceIds.length, 'activities');

        // Return the activities in the same format as GraphQL
        return {
            data: {
                analyzeWishlist: {
                    wishlist_activities: activitiesWithInstanceIds
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
            },
            authMode: 'API_KEY',
            // Force network fetch to bypass AppSync cache and get fresh tripTitle data
            fetchPolicy: 'network-only'
        });

        console.log('[Lambda Service] Retrieved trip summaries');
        return result.data.getTripIDs;

    } catch (error) {
        // Handle partial errors - GraphQL may return data even with errors
        if (error?.data?.getTripIDs) {
            return error.data.getTripIDs;
        }
        // Don't log to console to avoid error toasts
        throw error;
    }
};

/**
 * Retrieve detailed trip data from cloud storage using getUserTrips Lambda function.
 * Checks AsyncStorage cache first; falls back to network on miss or expiry.
 */
export const retrieveTripFromCloud = async (userID, tripID) => {
    // Check local cache first for instant loads on repeat opens
    const cached = await getCachedTrip(tripID);
    if (cached) {
        console.log('[Lambda Service] Cache hit for trip:', tripID);
        return cached;
    }

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

        const trip = result.data.getUserTrips;
        console.log('[Lambda Service] Retrieved trip details:');

        // Persist to cache for subsequent opens (fire-and-forget)
        setCachedTrip(tripID, trip);

        return trip;

    } catch (error) {
        console.error('[Lambda Service] Error retrieving trip details from cloud:', error);
        throw error;
    }
};

/**
 * Delete user account and all associated data
 */
export const deleteUserAccountFromCloud = async (userID) => {
    try {
        console.log('[Lambda Service] Initiating account deletion...');
        console.log('[Lambda Service] UserID:', userID);

        const result = await API.graphql({
            query: deleteUserAccountMutation,
            variables: {
                userID: userID
            }
        });

        console.log('[Lambda Service] Account deletion completed:', result.data.deleteUserAccount);
        return result.data.deleteUserAccount;

    } catch (error) {
        console.error('[Lambda Service] Error deleting user account:', error);
        throw error;
    }
};