/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_PLACESAPIACTIVITYSTORAGE_ARN
	STORAGE_PLACESAPIACTIVITYSTORAGE_NAME
	STORAGE_PLACESAPIACTIVITYSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT *//*
Use the following code to retrieve configured secrets from AWS Secret Manager.
- https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
- https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/sdk-examples-secrets-manager.html
// const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
*/

const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const apiKey = process.env.GOOGLE_PLACES_API_KEY;

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const tableName = process.env.STORAGE_PLACESAPIACTIVITYSTORAGE_NAME;

// Cache TTL constants (in seconds)
const FINDPLACE_TTL = 30 * 24 * 60 * 60; // 30 days
const PLACEDETAILS_TTL = 30 * 24 * 60 * 60; // 30 days

// Cache helper functions
const getCachedData = async (cacheType, cacheKey) => {
    try {
        const command = new GetCommand({
            TableName: tableName,
            Key: {
                cache_type: cacheType,
                cache_key: cacheKey
            }
        });
        
        const result = await ddbDocClient.send(command);
        
        if (result.Item) {
            // Check if TTL has expired
            const now = Math.floor(Date.now() / 1000);
            if (result.Item.ttl && result.Item.ttl < now) {
                console.log(`Cache expired for ${cacheType}:${cacheKey}`);
                return null;
            }
            
            console.log(`Cache HIT for ${cacheType}:${cacheKey}`);
            return result.Item.data;
        }
        
        console.log(`Cache MISS for ${cacheType}:${cacheKey}`);
        return null;
    } catch (error) {
        console.error(`Error getting cached data for ${cacheType}:${cacheKey}:`, error);
        return null; // Fall back to API call if cache fails
    }
};

const setCachedData = async (cacheType, cacheKey, data, ttlSeconds) => {
    try {
        const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;
        
        const command = new PutCommand({
            TableName: tableName,
            Item: {
                cache_type: cacheType,
                cache_key: cacheKey,
                data: data,
                ttl: ttl
            }
        });
        
        await ddbDocClient.send(command);
        console.log(`Cached data for ${cacheType}:${cacheKey} with TTL ${ttl}`);
    } catch (error) {
        console.error(`Error caching data for ${cacheType}:${cacheKey}:`, error);
        // Don't throw error - caching failure shouldn't break the main functionality
    }
};

// Helper function to generate cache key for FindPlace API
const generateFindPlaceCacheKey = (locationName, bias) => {
    let key = encodeURIComponent(locationName.toLowerCase().trim());
    if (bias && bias.lat && bias.lng) {
        key += `_bias_${bias.lat}_${bias.lng}`;
    }
    return key;
};

// Helper function to get place details (rating, reviews, etc.)
const getPlaceDetailsByPlaceId = async (placeId) => {
    // Check cache first
    const cachedData = await getCachedData('placedetails', placeId);
    if (cachedData) {
        return cachedData;
    }
    
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total,formatted_address,types,photos,name,opening_hours,current_opening_hours,secondary_opening_hours,website,reviews,editorial_summary&key=${apiKey}`;
    
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', async () => {
                try {
                    const result = JSON.parse(data);
                    let photo_reference = null;
                    let placeDetails = null;
                    
                    if (result.status === 'OK' && result.result) {
                        if (result.result.photos && result.result.photos.length > 0) {
                            photo_reference = result.result.photos[0].photo_reference;
                        }
                        
                        // Process opening hours
                        const processOpeningHours = (openingHoursData) => {
                            if (!openingHoursData) return null;
                            return {
                                open_now: openingHoursData.open_now || false,
                                periods: openingHoursData.periods || [],
                                weekday_text: openingHoursData.weekday_text || []
                            };
                        };
                        
                        // Process reviews (limit to first 5 for performance)
                        const processReviews = (reviewsData) => {
                            if (!reviewsData || !Array.isArray(reviewsData)) return [];
                            return reviewsData.slice(0, 5).map(review => ({
                                author_name: review.author_name || null,
                                rating: review.rating || null,
                                text: review.text || null,
                                time: review.time || null,
                                author_url: review.author_url || null,
                                profile_photo_url: review.profile_photo_url || null
                            }));
                        };
                        
                        
                        placeDetails = {
                            // Basic fields
                            display_name: result.result.name || null,
                            formatted_address: result.result.formatted_address || null,
                            types: result.result.types || [],
                            rating: result.result.rating || null,
                            user_ratings_total: result.result.user_ratings_total || null,
                            website_uri: result.result.website || null,
                            
                            // Legacy photo_reference for backward compatibility
                            photo_reference: photo_reference,
                            
                            // Opening hours data
                            current_opening_hours: processOpeningHours(result.result.current_opening_hours),
                            regular_opening_hours: processOpeningHours(result.result.opening_hours),
                            
                            // Reviews and summaries
                            reviews: processReviews(result.result.reviews),
                            editorial_summary: result.result.editorial_summary?.overview || null,
                            
                            // Primary type display name (derived from types)
                            primary_type_display_name: result.result.types && result.result.types.length > 0 
                                ? result.result.types[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                : null
                        };
                        
                        // Cache the successful result
                        await setCachedData('placedetails', placeId, placeDetails, PLACEDETAILS_TTL);
                        
                        resolve(placeDetails);
                    } else {
                        console.warn(`Could not get details for place_id "${placeId}". Status: ${result.status}`);
                        const fallbackDetails = { 
                            display_name: null,
                            formatted_address: null,
                            types: [], 
                            rating: null, 
                            user_ratings_total: null, 
                            website_uri: null,
                            photo_reference: null,
                            current_opening_hours: null,
                            regular_opening_hours: null,
                            reviews: [],
                            editorial_summary: null,
                            primary_type_display_name: null
                        };
                        
                        // Don't cache failed results, just return fallback
                        resolve(fallbackDetails);
                    }
                } catch (e) {
                    console.error(`Error parsing place details JSON for place_id "${placeId}":`, e);
                    const fallbackDetails = { 
                        display_name: null,
                        formatted_address: null,
                        types: [], 
                        rating: null, 
                        user_ratings_total: null, 
                        website_uri: null,
                        photo_reference: null,
                        photos: [],
                        current_opening_hours: null,
                        regular_opening_hours: null,
                        regular_secondary_opening_hours: null,
                        reviews: [],
                        editorial_summary: null,
                        primary_type_display_name: null
                    };
                    resolve(fallbackDetails);
                }
            });
        });
        req.on('error', (err) => {
            console.error(`[getPlaceDetailsByPlaceId] HTTPS request error for place_id ${placeId}:`, err);
            const fallbackDetails = { 
                display_name: null,
                formatted_address: null,
                types: [], 
                rating: null, 
                user_ratings_total: null, 
                website_uri: null,
                photo_reference: null,
                photos: [],
                current_opening_hours: null,
                regular_opening_hours: null,
                regular_secondary_opening_hours: null,
                reviews: [],
                editorial_summary: null,
                primary_type_display_name: null
            };
            resolve(fallbackDetails);
        });
    });
};

// Helper function to get coordinates and place details for a single location
const getLocationInfo = async (locationName, bias) => {
    // Generate cache key for FindPlace API
    const findPlaceCacheKey = generateFindPlaceCacheKey(locationName, bias);
    
    // Check cache first
    const cachedFindPlaceData = await getCachedData('findplace', findPlaceCacheKey);
    if (cachedFindPlaceData) {
        // We have cached FindPlace data, now check if we need PlaceDetails
        if (cachedFindPlaceData.place_id) {
            const cachedPlaceDetails = await getCachedData('placedetails', cachedFindPlaceData.place_id);
            if (cachedPlaceDetails) {
                // Both FindPlace and PlaceDetails are cached
                return {
                    name: locationName,
                    foundName: cachedFindPlaceData.name,
                    place_id: cachedFindPlaceData.place_id,
                    lat: cachedFindPlaceData.lat,
                    lng: cachedFindPlaceData.lng,
                    ...cachedPlaceDetails
                };
            } else {
                // FindPlace is cached but PlaceDetails is not, fetch PlaceDetails only
                const details = await getPlaceDetailsByPlaceId(cachedFindPlaceData.place_id);
                return {
                    name: locationName,
                    foundName: cachedFindPlaceData.name,
                    place_id: cachedFindPlaceData.place_id,
                    lat: cachedFindPlaceData.lat,
                    lng: cachedFindPlaceData.lng,
                    ...details
                };
            }
        } else {
            // Cached FindPlace data without place_id
            return {
                name: locationName,
                foundName: cachedFindPlaceData.name,
                place_id: null,
                lat: cachedFindPlaceData.lat,
                lng: cachedFindPlaceData.lng,
                display_name: cachedFindPlaceData.name,
                formatted_address: null,
                types: [],
                rating: null,
                user_ratings_total: null,
                website_uri: null,
                photo_reference: null,
                current_opening_hours: null,
                regular_opening_hours: null,
                reviews: [],
                editorial_summary: null,
                primary_type_display_name: null
            };
        }
    }
    
    // Cache miss, make API call
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
                        
                        // Cache the FindPlace result
                        const findPlaceResult = {
                            name: candidate.name,
                            place_id: candidate.place_id || null,
                            lat: candidate.geometry.location.lat,
                            lng: candidate.geometry.location.lng
                        };
                        await setCachedData('findplace', findPlaceCacheKey, findPlaceResult, FINDPLACE_TTL);
                        
                        // Get additional details if we have a place_id
                        let details = { 
                            display_name: candidate.name,
                            formatted_address: null,
                            types: [], 
                            rating: null, 
                            user_ratings_total: null, 
                            website_uri: null,
                            photo_reference: null,
                            current_opening_hours: null,
                            regular_opening_hours: null,
                            reviews: [],
                            editorial_summary: null,
                            primary_type_display_name: null
                        };
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
            display_name: result.display_name,
            formatted_address: result.formatted_address,
            types: result.types,
            rating: result.rating,
            user_ratings_total: result.user_ratings_total,
            website_uri: result.website_uri,
            photo_reference: result.photo_reference,
            current_opening_hours: result.current_opening_hours,
            regular_opening_hours: result.regular_opening_hours,
            reviews: result.reviews,
            editorial_summary: result.editorial_summary,
            primary_type_display_name: result.primary_type_display_name,
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

