/* Amplify Params - DO NOT EDIT
	ENV
	FUNCTION_GETLOCATIONCOORDINATES_NAME
	REGION
Amplify Params - DO NOT EDIT */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { randomUUID } = require('crypto');

// Initialize Lambda client
const lambdaClient = new LambdaClient({ region: process.env.REGION });

/**
 * Lambda function to get full place details from a place_id
 * This is the new simplified version that:
 * 1. Receives a place_id from the autocomplete selection
 * 2. Calls getLocationCoordinates Lambda with the place_id to get full activity details
 * 3. Returns a single activity object
 *
 * REPLACES the old two-step search flow (autocomplete -> search -> select)
 * with a direct flow (autocomplete with places -> select -> get details)
 */
exports.handler = async (event) => {
    console.log('getPlaceDetails input:', JSON.stringify(event, null, 2));

    try {
        const { place_id, selectedCity } = event.arguments || event;

        // Validation
        if (!place_id) {
            throw new Error('place_id is required');
        }
        if (!selectedCity) {
            throw new Error('selectedCity is required');
        }

        console.log(`Fetching place details for place_id: ${place_id} in ${selectedCity}`);

        // Get city coordinates for location bias
        const cityCoordinates = await getCityCoordinates(selectedCity);

        let cityBias = null;
        if (cityCoordinates && cityCoordinates.lat && cityCoordinates.lng) {
            cityBias = { lat: cityCoordinates.lat, lng: cityCoordinates.lng };
            console.log(`Using city bias for ${selectedCity}:`, cityBias);
        }

        // Call getLocationCoordinates Lambda using place_id
        // The getLocationCoordinates Lambda already supports place_id lookups
        // and has caching built in
        const activity = await getPlaceDetailsByPlaceId(place_id, selectedCity, cityBias);

        if (!activity) {
            throw new Error(`Could not retrieve details for place_id: ${place_id}`);
        }

        console.log(`Successfully retrieved place details for: ${activity.name || 'Unknown'}`);

        // Add instanceId for duplicate support (allows same place to be added multiple times)
        activity.instanceId = randomUUID();

        return {
            activity: activity,
            query: activity.name || 'Unknown place'
        };

    } catch (error) {
        console.error('Error in getPlaceDetails:', error);

        // Return error response
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to get place details',
                details: error.message
            })
        };
    }
};

/**
 * Get coordinates for a city by calling getLocationCoordinates Lambda
 */
async function getCityCoordinates(cityName) {
    try {
        const functionName = process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME;

        const payload = {
            arguments: {
                placeName: cityName,
                selectedCity: cityName
            }
        };

        console.log(`Invoking ${functionName} to get coordinates for: ${cityName}`);

        const command = new InvokeCommand({
            FunctionName: functionName,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(payload)
        });

        const response = await lambdaClient.send(command);
        const result = JSON.parse(Buffer.from(response.Payload).toString());

        console.log(`getLocationCoordinates response for city:`, result);

        if (result && result.lat && result.lng) {
            return {
                lat: result.lat,
                lng: result.lng
            };
        }

        return null;
    } catch (error) {
        console.error(`Error getting city coordinates for ${cityName}:`, error);
        return null;
    }
}

/**
 * Get full place details by place_id using getLocationCoordinates Lambda
 * This leverages the existing caching and Place Details API integration
 */
async function getPlaceDetailsByPlaceId(placeId, selectedCity, cityBias) {
    try {
        const functionName = process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME;

        // Use the place_id as the location name
        // getLocationCoordinates will recognize it and do a place_id lookup
        const payload = {
            arguments: {
                placeName: placeId,
                selectedCity: selectedCity
            }
        };

        console.log(`Invoking ${functionName} to get place details for place_id: ${placeId}`);

        const command = new InvokeCommand({
            FunctionName: functionName,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(payload)
        });

        const response = await lambdaClient.send(command);
        const result = JSON.parse(Buffer.from(response.Payload).toString());

        console.log(`getLocationCoordinates response for place_id:`, result);

        if (!result) {
            throw new Error(`No result returned from getLocationCoordinates for place_id: ${placeId}`);
        }

        // Transform the response to Activity format
        const activity = {
            name: result.foundName || result.display_name || result.name || 'Unknown',
            city: selectedCity,
            lat: result.lat || null,
            lng: result.lng || null,
            rating: result.rating || null,
            user_ratings_total: result.user_ratings_total || null,
            formatted_address: result.formatted_address || null,
            types: result.types || [],
            primaryType: result.primaryType || null,
            place_id: result.place_id || placeId,
            photo_reference: result.photo_reference || null,
            is_recommended: false, // User manually searched for this
            display_name: result.display_name || result.foundName || result.name || null,
            website_uri: result.website_uri || null,
            regular_opening_hours: result.regular_opening_hours || null,
            reviews: result.reviews || [],
            editorial_summary: result.editorial_summary || null,
            primary_type_display_name: result.primary_type_display_name || null,
            international_phone_number: result.international_phone_number || null
        };

        return activity;

    } catch (error) {
        console.error(`Error getting place details for place_id ${placeId}:`, error);
        throw error;
    }
}
