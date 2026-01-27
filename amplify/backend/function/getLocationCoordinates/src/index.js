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
const FINDPLACE_TTL = 365 * 24 * 60 * 60; // 1 year (31,536,000 seconds)
const PLACEDETAILS_TTL = 365 * 24 * 60 * 60; // 1 year (31,536,000 seconds)

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

// Helper function to get ONLY photo_reference using ID Only SKU (FREE)
const getFreshPhotoReference = async (placeId) => {
    if (!placeId) return null;

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${apiKey}`;

    return new Promise((resolve) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.status === 'OK' && result.result?.photos?.[0]) {
                        console.log(`Fresh photo_reference fetched for place_id: ${placeId}`);
                        resolve(result.result.photos[0].photo_reference);
                    } else {
                        console.log(`No photo available for place_id: ${placeId}`);
                        resolve(null);
                    }
                } catch (e) {
                    console.error(`Error parsing photo reference for place_id ${placeId}:`, e);
                    resolve(null);
                }
            });
        });
        req.on('error', (err) => {
            console.error(`Error fetching photo reference for place_id ${placeId}:`, err);
            resolve(null);
        });
    });
};

/**
 * Reverse lookup: Search for establishment at a given address
 * When user selects a street address, try to find the actual business at that address
 * Priority: lodging first, then any establishment
 * @param {string} address - The full address (e.g., "10 Avery St, Boston, MA 02111")
 * @param {number} lat - Latitude of the address
 * @param {number} lng - Longitude of the address
 * @returns {object|null} - The establishment place_id if found, null otherwise
 */
const findEstablishmentAtAddress = async (address, lat, lng) => {
    // Try 1: Search for lodging first (priority for hotel searches)
    console.log(`[Reverse Lookup] Trying lodging search for: ${address}`);
    const lodgingUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(address)}&location=${lat},${lng}&radius=20&types=lodging&language=en&key=${apiKey}`;

    const lodgingResult = await new Promise((resolve) => {
        const req = https.get(lodgingUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.status === 'OK' && result.predictions && result.predictions.length > 0) {
                        const place = result.predictions[0];
                        console.log(`[Reverse Lookup] Found lodging: ${place.description} (place_id: ${place.place_id})`);
                        resolve({
                            found: true,
                            place_id: place.place_id,
                            name: place.structured_formatting?.main_text || place.description,
                            type: 'lodging'
                        });
                    } else {
                        resolve({ found: false });
                    }
                } catch (e) {
                    console.error(`[Reverse Lookup] Error parsing lodging response:`, e);
                    resolve({ found: false });
                }
            });
        });
        req.on('error', (err) => {
            console.error(`[Reverse Lookup] Error searching for lodging:`, err);
            resolve({ found: false });
        });
    });

    if (lodgingResult.found) {
        return lodgingResult;
    }

    // Try 2: If no lodging found, search for any establishment
    console.log(`[Reverse Lookup] No lodging found, trying establishment search for: ${address}`);
    const establishmentUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(address)}&location=${lat},${lng}&radius=20&types=establishment&language=en&key=${apiKey}`;

    return new Promise((resolve) => {
        const req = https.get(establishmentUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.status === 'OK' && result.predictions && result.predictions.length > 0) {
                        const place = result.predictions[0];
                        console.log(`[Reverse Lookup] Found establishment: ${place.description} (place_id: ${place.place_id})`);
                        resolve({
                            found: true,
                            place_id: place.place_id,
                            name: place.structured_formatting?.main_text || place.description,
                            type: 'establishment'
                        });
                    } else {
                        console.log(`[Reverse Lookup] No establishment found at address: ${address}`);
                        resolve({ found: false });
                    }
                } catch (e) {
                    console.error(`[Reverse Lookup] Error parsing establishment response:`, e);
                    resolve({ found: false });
                }
            });
        });
        req.on('error', (err) => {
            console.error(`[Reverse Lookup] Error searching for establishment:`, err);
            resolve({ found: false });
        });
    });
};

// Helper function to get place details (rating, reviews, etc.)
const getPlaceDetailsByPlaceId = async (placeId) => {
    // Check cache first
    const cachedData = await getCachedData('placedetails', placeId);
    if (cachedData) {
        return cachedData;
    }
    
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total,formatted_address,types,photos,name,geometry,opening_hours,secondary_opening_hours,website,reviews,editorial_summary,international_phone_number&language=en&key=${apiKey}`;
    
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', async () => {
                try {
                    const result = JSON.parse(data);
                    let placeDetails = null;

                    if (result.status === 'OK' && result.result) {
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
                            types: result.result.types || [], // Keep full types array for backward compatibility
                            primaryType: result.result.types && result.result.types.length > 0
                                ? result.result.types[0]
                                : null,
                            rating: result.result.rating || null,
                            user_ratings_total: result.result.user_ratings_total || null,
                            website_uri: result.result.website || null,

                            // Geometry (coordinates)
                            lat: result.result.geometry?.location?.lat || null,
                            lng: result.result.geometry?.location?.lng || null,

                            // NOTE: photo_reference is NO LONGER CACHED per Google's API guidelines
                            // It will be fetched fresh on each request using getFreshPhotoReference()

                            // Opening hours data
                            regular_opening_hours: processOpeningHours(result.result.opening_hours),

                            // Reviews and summaries
                            reviews: processReviews(result.result.reviews),
                            editorial_summary: result.result.editorial_summary?.overview || null,

                            // Primary type display name (derived from primary type)
                            primary_type_display_name: result.result.types && result.result.types.length > 0
                                ? result.result.types[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                : null,

                            // International phone number
                            international_phone_number: result.result.international_phone_number || null
                        };

                        // Cache the successful result (WITHOUT photo_reference)
                        await setCachedData('placedetails', placeId, placeDetails, PLACEDETAILS_TTL);

                        resolve(placeDetails);
                    } else {
                        console.warn(`Could not get details for place_id "${placeId}". Status: ${result.status}`);
                        const fallbackDetails = {
                            display_name: null,
                            formatted_address: null,
                            types: [],
                            primaryType: null,
                            rating: null,
                            user_ratings_total: null,
                            website_uri: null,
                            lat: null,
                            lng: null,
                            regular_opening_hours: null,
                            reviews: [],
                            editorial_summary: null,
                            primary_type_display_name: null,
                            international_phone_number: null
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
                        primaryType: null,
                        rating: null,
                        user_ratings_total: null,
                        website_uri: null,
                        lat: null,
                        lng: null,
                        regular_opening_hours: null,
                        reviews: [],
                        editorial_summary: null,
                        primary_type_display_name: null,
                        international_phone_number: null
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
                primaryType: null,
                rating: null,
                user_ratings_total: null,
                website_uri: null,
                lat: null,
                lng: null,
                regular_opening_hours: null,
                reviews: [],
                editorial_summary: null,
                primary_type_display_name: null,
                international_phone_number: null
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
                // Fetch fresh photo_reference (FREE - ID Only SKU)
                const photo_reference = await getFreshPhotoReference(cachedFindPlaceData.place_id);
                return {
                    name: locationName,
                    foundName: cachedFindPlaceData.name,
                    place_id: cachedFindPlaceData.place_id,
                    lat: cachedFindPlaceData.lat,
                    lng: cachedFindPlaceData.lng,
                    ...cachedPlaceDetails,
                    photo_reference: photo_reference
                };
            } else {
                // FindPlace is cached but PlaceDetails is not, fetch PlaceDetails only
                const details = await getPlaceDetailsByPlaceId(cachedFindPlaceData.place_id);
                // Fetch fresh photo_reference (FREE - ID Only SKU)
                const photo_reference = await getFreshPhotoReference(cachedFindPlaceData.place_id);
                return {
                    name: locationName,
                    foundName: cachedFindPlaceData.name,
                    place_id: cachedFindPlaceData.place_id,
                    lat: cachedFindPlaceData.lat,
                    lng: cachedFindPlaceData.lng,
                    ...details,
                    photo_reference: photo_reference
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
                primaryType: null,
                rating: null,
                user_ratings_total: null,
                website_uri: null,
                photo_reference: null,
                regular_opening_hours: null,
                reviews: [],
                editorial_summary: null,
                primary_type_display_name: null,
                international_phone_number: null
            };
        }
    }
    
    // Cache miss, make API call
    let url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(locationName)}&inputtype=textquery&fields=name,geometry,place_id&language=en&key=${apiKey}`;
    
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
                            primaryType: null,
                            rating: null,
                            user_ratings_total: null,
                            website_uri: null,
                            regular_opening_hours: null,
                            reviews: [],
                            editorial_summary: null,
                            primary_type_display_name: null,
                            international_phone_number: null
                        };
                        let photo_reference = null;
                        if (candidate.place_id) {
                            details = await getPlaceDetailsByPlaceId(candidate.place_id);
                            // Fetch fresh photo_reference (FREE - ID Only SKU)
                            photo_reference = await getFreshPhotoReference(candidate.place_id);
                        }

                        resolve({
                            name: locationName, // Return original name for matching
                            foundName: candidate.name, // Return what Google found
                            place_id: candidate.place_id,
                            ...candidate.geometry.location,
                            ...details,
                            photo_reference: photo_reference
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

        // Check if placeName is actually a place_id (Google Place IDs start with "ChIJ")
        const isPlaceId = placeName.startsWith('ChIJ');

        let result;

        if (isPlaceId) {
            console.log(`Detected place_id format: ${placeName}`);
            // Fetch place details directly using the place_id
            const details = await getPlaceDetailsByPlaceId(placeName);

            if (!details.lat || !details.lng) {
                throw new Error(`Could not get coordinates for place_id: ${placeName}`);
            }

            // CHECK IF THIS IS A STREET ADDRESS (not an establishment)
            // If it's an address type, try to find lodging at this address
            const isAddressType = details.types && details.types.some(t =>
                ['street_address', 'premise', 'route', 'geocode'].includes(t)
            );
            const isLodgingType = details.types && details.types.some(t =>
                ['lodging', 'hotel', 'campground', 'rv_park'].includes(t)
            );

            let finalPlaceId = placeName;
            let finalDetails = details;

            // If it's an address (not already a lodging), try reverse lookup
            if (isAddressType && !isLodgingType && details.formatted_address) {
                console.log(`[Reverse Lookup] Detected address type, searching for establishment at: ${details.formatted_address}`);
                const establishmentResult = await findEstablishmentAtAddress(
                    details.formatted_address,
                    details.lat,
                    details.lng
                );

                if (establishmentResult.found) {
                    // Found an establishment! Use that place_id instead
                    console.log(`[Reverse Lookup] SUCCESS! Found ${establishmentResult.type}: ${establishmentResult.name} (place_id: ${establishmentResult.place_id})`);
                    finalPlaceId = establishmentResult.place_id;
                    finalDetails = await getPlaceDetailsByPlaceId(establishmentResult.place_id);
                } else {
                    console.log(`[Reverse Lookup] No establishment found, using original address place_id`);
                }
            }

            // Fetch fresh photo_reference
            const photo_reference = await getFreshPhotoReference(finalPlaceId);

            result = {
                name: placeName,
                foundName: finalDetails.display_name,
                place_id: finalPlaceId,
                lat: finalDetails.lat || details.lat,
                lng: finalDetails.lng || details.lng,
                display_name: finalDetails.display_name,
                formatted_address: finalDetails.formatted_address,
                types: finalDetails.types,
                primaryType: finalDetails.primaryType,
                rating: finalDetails.rating,
                user_ratings_total: finalDetails.user_ratings_total,
                website_uri: finalDetails.website_uri,
                photo_reference: photo_reference,
                regular_opening_hours: finalDetails.regular_opening_hours,
                reviews: finalDetails.reviews,
                editorial_summary: finalDetails.editorial_summary,
                primary_type_display_name: finalDetails.primary_type_display_name,
                international_phone_number: finalDetails.international_phone_number
            };
        } else {
            // Regular text-based search
            console.log(`Processing text-based place search: ${placeName}`);

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

            result = await getLocationInfo(placeName, bias);

            // Return in Activity format for GraphQL
            if (result.error) {
                throw new Error(`Could not find additional place "${placeName}": ${result.error}`);
            }
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
            primaryType: result.primaryType,
            rating: result.rating,
            user_ratings_total: result.user_ratings_total,
            website_uri: result.website_uri,
            photo_reference: result.photo_reference,
            regular_opening_hours: result.regular_opening_hours,
            reviews: result.reviews,
            editorial_summary: result.editorial_summary,
            primary_type_display_name: result.primary_type_display_name,
            international_phone_number: result.international_phone_number,
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

