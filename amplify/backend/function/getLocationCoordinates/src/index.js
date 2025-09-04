/* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT *//*
Use the following code to retrieve configured secrets from AWS Secret Manager.
- https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
- https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/sdk-examples-secrets-manager.html
// const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
*/

const https = require('https');

const apiKey = process.env.GOOGLE_PLACES_API_KEY;

// Helper function to get place details (rating, reviews, etc.)
const getPlaceDetailsByPlaceId = (placeId) => {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total,formatted_address,types,photos&key=${apiKey}`;
    
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    let photo_reference = null;
                    if (result.status === 'OK' && result.result) {
                        if (result.result.photos && result.result.photos.length > 0) {
                            photo_reference = result.result.photos[0].photo_reference;
                        }
                        resolve({
                            rating: result.result.rating || null,
                            user_ratings_total: result.result.user_ratings_total || null,
                            formatted_address: result.result.formatted_address || null,
                            types: result.result.types || [],
                            photo_reference: photo_reference
                        });
                    } else {
                        console.warn(`Could not get details for place_id "${placeId}". Status: ${result.status}`);
                        resolve({ rating: null, user_ratings_total: null, formatted_address: null, types: [], photo_reference: null });
                    }
                } catch (e) {
                    console.error(`Error parsing place details JSON for place_id "${placeId}":`, e);
                    resolve({ rating: null, user_ratings_total: null, formatted_address: null, types: [], photo_reference: null });
                }
            });
        });
        req.on('error', (err) => {
            console.error(`[getPlaceDetailsByPlaceId] HTTPS request error for place_id ${placeId}:`, err);
            resolve({ rating: null, user_ratings_total: null, formatted_address: null, types: [], photo_reference: null });
        });
    });
};

// Helper function to get coordinates and place details for a single location
const getLocationInfo = async (locationName, bias) => {
    let url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(locationName)}&inputtype=textquery&fields=name,geometry,place_id&key=${apiKey}`;
    
    // Add location bias if provided. This helps narrow down searches.
    // The bias should be a point: "point:latitude,longitude"
    if (bias && bias.lat && bias.lng) {
        url += `&locationbias=point:${bias.lat},${bias.lng}`;
    }

    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', async () => {
                try {
                    const result = JSON.parse(data);
                    if (result.status === 'OK' && result.candidates && result.candidates.length > 0) {
                        const candidate = result.candidates[0];
                        
                        // Get additional details if we have a place_id
                        let details = { rating: null, user_ratings_total: null, formatted_address: null, types: [], photos: [], photo_reference: null };
                        if (candidate.place_id) {
                            details = await getPlaceDetailsByPlaceId(candidate.place_id);
                        }
                        
                        
                        resolve({
                            name: locationName, // Return original name for matching
                            foundName: candidate.name, // Return what Google found
                            place_id: candidate.place_id,
                            ...candidate.geometry.location,
                            ...details
                        });

                    } else {
                        console.warn(`Could not find coordinates for "${locationName}". Status: ${result.status}`);
                        resolve({ name: locationName, error: 'Not Found' });
                    }
                } catch (e) {
                    console.error(`Error parsing JSON for "${locationName}":`, e);
                    resolve({ name: locationName, error: 'Parse Error' });
                }
            });
        });
        req.on('error', (err) => {
            console.error(`HTTPS request error for "${locationName}":`, err);
            resolve({ name: locationName, error: 'Request Failed' });
        });
    });
};

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
    if (!apiKey) {
        console.error("FATAL: GOOGLE_PLACES_API_KEY environment variable not set.");
        return { statusCode: 500, body: JSON.stringify({ error: 'API Key is not configured.' }) };
    }

    // ============================================================================
    // ADD ADDITIONAL PLACE FUNCTIONALITY (GraphQL @function directive calls)
    // This section ONLY runs when called via GraphQL from the "Add Additional Places" feature
    // in trip-view_main.tsx. It processes a single place name and returns Activity data.
    // ============================================================================
    if (event.arguments) {
        console.log('Processing ADD ADDITIONAL PLACE request via GraphQL');
        const { placeName, selectedCity } = event.arguments;
        
        if (!placeName) {
            throw new Error('placeName is required for addAdditionalPlace');
        }
        
        // Create bias from selectedCity coordinates if possible
        let bias = null;
        if (selectedCity) {
            console.log(`Creating location bias for additional place search using city: ${selectedCity}`);
            // Get coordinates for the selected city to create bias
            const cityResult = await getLocationInfo(selectedCity, null);
            if (cityResult.lat && cityResult.lng) {
                bias = { lat: cityResult.lat, lng: cityResult.lng };
                console.log(`Successfully created bias:`, bias);
            }
        }
        
        const result = await getLocationInfo(placeName, bias);
        
        // Return in Activity format for GraphQL
        if (result.error) {
            throw new Error(`Could not find additional place "${placeName}": ${result.error}`);
        }
        
        console.log(`Successfully processed additional place: ${result.foundName || result.name}`);
        return {
            name: result.foundName || result.name,
            city: selectedCity,
            lat: result.lat,
            lng: result.lng,
            place_id: result.place_id,
            rating: result.rating,
            user_ratings_total: result.user_ratings_total,
            formatted_address: result.formatted_address,
            types: result.types,
            photo_reference: result.photo_reference,
            is_recommended: false
        };
    }

    // ============================================================================
    // WISHLIST ANALYZER FUNCTIONALITY (Direct Lambda invocation)
    // This section runs when called directly by the wishlistAnalyzer Lambda function.
    // It processes multiple locations in batch and returns coordinate data.
    // ============================================================================
    console.log('Processing BATCH LOCATION LOOKUP request from wishlistAnalyzer');
    const { locations, bias } = event;

    if (!locations || !Array.isArray(locations) || locations.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "Please provide a 'locations' array." }) };
    }

    const results = [];
    
    // Process locations in parallel with controlled concurrency for better performance
    // Google Places API can handle moderate concurrent requests
    const maxConcurrent = 8; // Process up to 8 locations simultaneously
    
    const processInBatches = async (locationNames, batchSize) => {
        const allResults = [];
        for (let i = 0; i < locationNames.length; i += batchSize) {
            const batch = locationNames.slice(i, i + batchSize);
            console.log(`Processing geocoding batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(locationNames.length/batchSize)} (${batch.length} locations)`);
            
            // Process current batch in parallel
            const batchPromises = batch.map(name => getLocationInfo(name, bias));
            const batchResults = await Promise.all(batchPromises);
            allResults.push(...batchResults);
            
            console.log(`Completed geocoding batch ${Math.floor(i/batchSize) + 1}, processed ${allResults.length}/${locationNames.length} locations`);
        }
        return allResults;
    };

    const allResults = await processInBatches(locations, maxConcurrent);
    results.push(...allResults);
    
    const successfulLocations = results.filter(r => !r.error);

    return {
        statusCode: 200,
        body: JSON.stringify(successfulLocations),
    };
};

