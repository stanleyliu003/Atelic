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

// ============================================================================
// NEW PLACES API HELPERS
// ============================================================================

/**
 * Generate a deterministic placeholder rating from a place_id.
 * Same place_id always produces the same rating (4.4 – 4.9).
 */
function generatePlaceholderRating(placeId) {
    if (!placeId) return 4.5;
    let hash = 0;
    for (let i = 0; i < placeId.length; i++) {
        hash = ((hash << 5) - hash) + placeId.charCodeAt(i);
        hash |= 0;
    }
    const ratings = [4.4, 4.5, 4.6, 4.7, 4.8, 4.9];
    return ratings[Math.abs(hash) % ratings.length];
}

/**
 * Generic helper to make HTTPS requests (supports GET and POST with JSON body).
 * Returns parsed JSON response.
 */
const httpsRequest = (url, options = {}) => {
    return new Promise((resolve, reject) => {
        const method = options.method || 'GET';
        const parsedUrl = new URL(url);

        const reqOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method,
            headers: {
                ...options.headers,
            },
        };

        if (options.body) {
            reqOptions.headers['Content-Type'] = 'application/json';
            const bodyStr = JSON.stringify(options.body);
            reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr);
        }

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON response: ${e.message}`));
                }
            });
        });

        req.on('error', (err) => reject(err));

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
};

/**
 * Text Search (IDs Only) — $0.000 per request
 * Returns the place_id for the best match.
 */
const textSearchIdsOnly = async (query, locationBias) => {
    const body = { textQuery: query };

    if (locationBias && locationBias.lat && locationBias.lng) {
        body.locationBias = {
            circle: {
                center: { latitude: locationBias.lat, longitude: locationBias.lng },
                radius: 50000.0,
            },
        };
    }

    const data = await httpsRequest(
        'https://places.googleapis.com/v1/places:searchText',
        {
            method: 'POST',
            headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id',
            },
            body,
        }
    );

    if (data.places && data.places.length > 0) {
        return data.places[0].id;
    }
    return null;
};

/**
 * Place Details — Pro tier ($0.017 per request)
 * Returns eager fields: displayName, location, formattedAddress, types, primaryType,
 * primaryTypeDisplayName, and photos (photos included free within Pro).
 */
const placeDetailsEager = async (placeId) => {
    const data = await httpsRequest(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
            headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'displayName,location,formattedAddress,types,primaryType,primaryTypeDisplayName,photos',
            },
        }
    );

    return {
        display_name: data.displayName?.text || null,
        lat: data.location?.latitude || null,
        lng: data.location?.longitude || null,
        formatted_address: data.formattedAddress || null,
        types: data.types || [],
        primaryType: data.primaryType || null,
        primary_type_display_name: data.primaryTypeDisplayName?.text || null,
        // New API photo resource names (e.g. "places/ChIJ.../photos/AUc7tX...")
        photo_references: data.photos ? data.photos.slice(0, 5).map(p => p.name) : [],
    };
};

/**
 * Place Details — Enterprise + Atmosphere tier ($0.025 per request)
 * Returns lazy fields: rating, reviews, opening hours, website, phone, editorial summary.
 */
const placeDetailsLazy = async (placeId) => {
    const data = await httpsRequest(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
            headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'rating,userRatingCount,reviews,editorialSummary,regularOpeningHours,websiteUri,internationalPhoneNumber',
            },
        }
    );

    return mapLazyFieldsToSchema(data);
};

/**
 * Map New API lazy response fields to existing schema format.
 */
const mapLazyFieldsToSchema = (data) => {
    // Process opening hours
    let regular_opening_hours = null;
    if (data.regularOpeningHours) {
        const oh = data.regularOpeningHours;
        regular_opening_hours = {
            open_now: oh.openNow || false,
            weekday_text: oh.weekdayDescriptions || [],
            periods: (oh.periods || []).map(period => ({
                open: period.open ? {
                    day: period.open.day,
                    time: `${String(period.open.hour || 0).padStart(2, '0')}${String(period.open.minute || 0).padStart(2, '0')}`,
                } : null,
                close: period.close ? {
                    day: period.close.day,
                    time: `${String(period.close.hour || 0).padStart(2, '0')}${String(period.close.minute || 0).padStart(2, '0')}`,
                } : null,
            })),
        };
    }

    // Process reviews (limit to 5)
    const reviews = (data.reviews || []).slice(0, 5).map(review => ({
        author_name: review.authorAttribution?.displayName || null,
        rating: review.rating || null,
        text: review.text?.text || null,
        time: review.publishTime ? Math.floor(new Date(review.publishTime).getTime() / 1000) : null,
        author_url: review.authorAttribution?.uri || null,
        profile_photo_url: review.authorAttribution?.photoUri || null,
    }));

    return {
        rating: data.rating || null,
        user_ratings_total: data.userRatingCount || null,
        editorial_summary: data.editorialSummary?.text || null,
        website_uri: data.websiteUri || null,
        international_phone_number: data.internationalPhoneNumber || null,
        regular_opening_hours,
        reviews,
    };
};

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
// NEW PLACES API: Text Search IDs Only ($0) + Place Details Pro ($0.017) = $0.017 per cache miss
const getLocationInfo = async (locationName, bias) => {
    // Generate cache key for FindPlace API (same key strategy as before)
    const findPlaceCacheKey = generateFindPlaceCacheKey(locationName, bias);

    // Check cache first
    const cachedFindPlaceData = await getCachedData('findplace', findPlaceCacheKey);
    if (cachedFindPlaceData) {
        if (cachedFindPlaceData.place_id) {
            const cachedPlaceDetails = await getCachedData('placedetails', cachedFindPlaceData.place_id);
            if (cachedPlaceDetails) {
                // Both cached — $0 cost
                // Backward compat: old cached entries have rating/reviews (legacy full details).
                // New cached entries have only eager fields + detailsLoaded: false.
                const isLegacyCache = cachedPlaceDetails.rating !== undefined && cachedPlaceDetails.rating !== null;
                return {
                    name: locationName,
                    foundName: cachedFindPlaceData.name,
                    place_id: cachedFindPlaceData.place_id,
                    lat: cachedFindPlaceData.lat,
                    lng: cachedFindPlaceData.lng,
                    ...cachedPlaceDetails,
                    // Legacy cache has real photo_reference; new cache stores it in photo_references array
                    photo_reference: cachedPlaceDetails.photo_reference || (cachedPlaceDetails.photo_references && cachedPlaceDetails.photo_references[0]) || null,
                    // Legacy cache already has real rating; new cache will have placeholder
                    rating: isLegacyCache ? cachedPlaceDetails.rating : generatePlaceholderRating(cachedFindPlaceData.place_id),
                    detailsLoaded: isLegacyCache ? true : false,
                };
            } else {
                // FindPlace cached but PlaceDetails not — fetch eager only ($0.017)
                const eagerDetails = await placeDetailsEager(cachedFindPlaceData.place_id);

                // Cache eager details
                await setCachedData('placedetails', cachedFindPlaceData.place_id, eagerDetails, PLACEDETAILS_TTL);

                return {
                    name: locationName,
                    foundName: cachedFindPlaceData.name,
                    place_id: cachedFindPlaceData.place_id,
                    lat: cachedFindPlaceData.lat,
                    lng: cachedFindPlaceData.lng,
                    display_name: eagerDetails.display_name,
                    formatted_address: eagerDetails.formatted_address,
                    types: eagerDetails.types,
                    primaryType: eagerDetails.primaryType,
                    primary_type_display_name: eagerDetails.primary_type_display_name,
                    photo_reference: eagerDetails.photo_references[0] || null,
                    rating: generatePlaceholderRating(cachedFindPlaceData.place_id),
                    user_ratings_total: null,
                    website_uri: null,
                    regular_opening_hours: null,
                    reviews: [],
                    editorial_summary: null,
                    international_phone_number: null,
                    detailsLoaded: false,
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
                international_phone_number: null,
                detailsLoaded: false,
            };
        }
    }

    // Full cache miss — Text Search IDs Only ($0) + Place Details Pro ($0.017)
    try {
        const placeId = await textSearchIdsOnly(locationName, bias);

        if (!placeId) {
            console.warn(`Could not find place for "${locationName}" via Text Search.`);
            return { name: locationName, error: 'Not Found' };
        }

        const eagerDetails = await placeDetailsEager(placeId);

        // Cache FindPlace result
        const findPlaceResult = {
            name: eagerDetails.display_name || locationName,
            place_id: placeId,
            lat: eagerDetails.lat,
            lng: eagerDetails.lng,
        };
        await setCachedData('findplace', findPlaceCacheKey, findPlaceResult, FINDPLACE_TTL);

        // Cache eager PlaceDetails
        await setCachedData('placedetails', placeId, eagerDetails, PLACEDETAILS_TTL);

        return {
            name: locationName,
            foundName: eagerDetails.display_name || locationName,
            place_id: placeId,
            lat: eagerDetails.lat,
            lng: eagerDetails.lng,
            display_name: eagerDetails.display_name,
            formatted_address: eagerDetails.formatted_address,
            types: eagerDetails.types,
            primaryType: eagerDetails.primaryType,
            primary_type_display_name: eagerDetails.primary_type_display_name,
            photo_reference: eagerDetails.photo_references[0] || null,
            rating: generatePlaceholderRating(placeId),
            user_ratings_total: null,
            website_uri: null,
            regular_opening_hours: null,
            reviews: [],
            editorial_summary: null,
            international_phone_number: null,
            detailsLoaded: false,
        };
    } catch (error) {
        console.error(`Error in getLocationInfo for "${locationName}":`, error);
        return { name: locationName, error: 'Request Failed' };
    }
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
    // LAZY LOADING: Fetch Enterprise+Atmosphere fields on demand ($0.025)
    // Called via GraphQL fetchPlaceDetailsLazy query
    // ============================================================================
    if (event.arguments && event.arguments.lazyLoad) {
        const { place_id } = event.arguments;
        console.log(`[LAZY LOAD] Processing request for place_id: ${place_id}`);
        console.log(`[LAZY LOAD] Full event.arguments:`, JSON.stringify(event.arguments));

        if (!place_id) {
            throw new Error('place_id is required for lazy loading');
        }

        // Check placedetails_lazy cache first
        const cached = await getCachedData('placedetails_lazy', place_id);
        if (cached) {
            console.log(`[LAZY LOAD] Cache HIT for ${place_id} - returning cached data`);
            return cached;
        }

        console.log(`[LAZY LOAD] Cache MISS for ${place_id} - fetching from New Places API ($0.025)`);

        // Fetch from New Places API (Enterprise + Atmosphere tier)
        const lazyData = await placeDetailsLazy(place_id);

        console.log(`[LAZY LOAD] Fetched data:`, JSON.stringify(lazyData));

        // Cache with 1-year TTL
        await setCachedData('placedetails_lazy', place_id, lazyData, PLACEDETAILS_TTL);

        console.log(`[LAZY LOAD] Successfully cached lazy details for ${place_id}`);
        return lazyData;
    }

    // ============================================================================
    // ADD ADDITIONAL PLACE FUNCTIONALITY (GraphQL @function directive calls)
    // This section ONLY runs when called via GraphQL from the "Add Additional Places" feature
    // in trip-view_main.tsx. It processes a single place name and returns Activity data.
    // Fetches ONLY eager fields ($0.017), lazy fields ($0.025) loaded on-demand via description_card.tsx
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
            // Fetch eager details using New API
            const eagerDetails = await placeDetailsEager(placeName);

            if (!eagerDetails.lat || !eagerDetails.lng) {
                throw new Error(`Could not get coordinates for place_id: ${placeName}`);
            }

            // CHECK IF THIS IS A STREET ADDRESS (not an establishment)
            const isAddressType = eagerDetails.types && eagerDetails.types.some(t =>
                ['street_address', 'premise', 'route', 'geocode'].includes(t)
            );
            const isLodgingType = eagerDetails.types && eagerDetails.types.some(t =>
                ['lodging', 'hotel', 'campground', 'rv_park'].includes(t)
            );

            let finalPlaceId = placeName;
            let finalEagerDetails = eagerDetails;

            // If it's an address (not already a lodging), try reverse lookup
            if (isAddressType && !isLodgingType && eagerDetails.formatted_address) {
                console.log(`[Reverse Lookup] Detected address type, searching for establishment at: ${eagerDetails.formatted_address}`);
                const establishmentResult = await findEstablishmentAtAddress(
                    eagerDetails.formatted_address,
                    eagerDetails.lat,
                    eagerDetails.lng
                );

                if (establishmentResult.found) {
                    console.log(`[Reverse Lookup] SUCCESS! Found ${establishmentResult.type}: ${establishmentResult.name} (place_id: ${establishmentResult.place_id})`);
                    finalPlaceId = establishmentResult.place_id;
                    finalEagerDetails = await placeDetailsEager(finalPlaceId);
                } else {
                    console.log(`[Reverse Lookup] No establishment found, using original address place_id`);
                }
            }

            // Cache only eager details (lazy will be fetched on-demand when user opens description)
            await setCachedData('placedetails', finalPlaceId, finalEagerDetails, PLACEDETAILS_TTL);

            result = {
                name: placeName,
                foundName: finalEagerDetails.display_name,
                place_id: finalPlaceId,
                lat: finalEagerDetails.lat || eagerDetails.lat,
                lng: finalEagerDetails.lng || eagerDetails.lng,
                display_name: finalEagerDetails.display_name,
                formatted_address: finalEagerDetails.formatted_address,
                types: finalEagerDetails.types,
                primaryType: finalEagerDetails.primaryType,
                primary_type_display_name: finalEagerDetails.primary_type_display_name,
                photo_reference: finalEagerDetails.photo_references[0] || null,
                rating: generatePlaceholderRating(finalPlaceId),
                user_ratings_total: null,
                website_uri: null,
                regular_opening_hours: null,
                reviews: [],
                editorial_summary: null,
                international_phone_number: null,
                detailsLoaded: false,
            };
        } else {
            // Regular text-based search
            console.log(`Processing text-based place search: ${placeName}`);

            // Create bias from selectedCity coordinates if possible
            let bias = null;
            if (selectedCity) {
                console.log(`Creating location bias for additional place search using city: ${selectedCity}`);
                const cityResult = await getLocationInfo(selectedCity, null);
                if (cityResult.lat && cityResult.lng) {
                    bias = { lat: cityResult.lat, lng: cityResult.lng };
                    console.log(`Successfully created bias:`, bias);
                }
            }

            // getLocationInfo returns eager-only data with detailsLoaded: false
            const eagerResult = await getLocationInfo(placeName, bias);

            if (eagerResult.error) {
                throw new Error(`Could not find additional place "${placeName}": ${eagerResult.error}`);
            }

            // Use eager-only result - lazy details will be fetched on-demand when user opens description
            result = eagerResult;
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
            detailsLoaded: result.detailsLoaded || false,
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

