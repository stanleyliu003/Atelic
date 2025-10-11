/* Amplify Params - DO NOT EDIT
	ENV
	FUNCTION_GETLOCATIONCOORDINATES_NAME
	REGION
	STORAGE_PLACESAPIACTIVITYSTORAGE_ARN
	STORAGE_PLACESAPIACTIVITYSTORAGE_NAME
	STORAGE_PLACESAPIACTIVITYSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize clients
const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const lambdaClient = new LambdaClient({ region: process.env.REGION });
const tableName = process.env.STORAGE_PLACESAPIACTIVITYSTORAGE_NAME;

// Cache TTL constants (in seconds)
const SEARCH_ACTIVITIES_TTL = 365 * 24 * 60 * 60; // 1 year (31,536,000 seconds)

// Address detection regex - detects if query looks like a street address
const ADDRESS_REGEX = /\d+[A-Z]?[-#]?\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|way|place|pl|court|ct|circle|cir|parkway|pkwy|terrace|ter|alley|plaza|square|sq|highway|hwy|route|rt|row|crescent|cres)/i;

/**
 * Lambda function to search for activities using either address lookup or AI-powered search
 * Handles two modes:
 * 1. Address mode: User provides specific address -> Google Places Text Search
 * 2. General search mode: User provides search query -> Gemini AI recommendations
 * 
 * DEDUPLICATION BEHAVIOR:
 * - Activities already in wishlist WILL appear in search results (UI shows "On list" tag)
 * - Only internal deduplication: same place_id won't appear twice in one result set
 * - "Generate More" uses existingWishlistActivities to avoid repeating previously shown results
 */
exports.handler = async (event) => {
    console.log('searchBarActivities input:', JSON.stringify(event, null, 2));

    try {
        const {
            selectedCity,
            searchQuery,
            existingWishlistActivities = [],
            filters = []
        } = event.arguments || event;

        // Validation
        if (!selectedCity) {
            throw new Error('selectedCity is required');
        }
        if (!searchQuery) {
            throw new Error('searchQuery is required');
        }

        // Parse existing activities - support both string arrays (legacy) and object arrays (new)
        let existingActivityNames = [];
        let existingActivityPlaceIds = [];

        if (existingWishlistActivities.length > 0) {
            if (typeof existingWishlistActivities[0] === 'string') {
                // Legacy format: array of names only
                existingActivityNames = existingWishlistActivities;
                console.log('Using legacy format: array of activity names');
            } else if (typeof existingWishlistActivities[0] === 'object') {
                // New format: array of activity objects with name and place_id
                existingActivityNames = existingWishlistActivities.map(a => a.name).filter(n => n);
                existingActivityPlaceIds = existingWishlistActivities.map(a => a.place_id).filter(id => id);
                console.log(`Parsed existing activities: ${existingActivityNames.length} names, ${existingActivityPlaceIds.length} place_ids`);
            }
        }

        // Build cache key
        const filterString = filters.length > 0 ? `-${filters.sort().join(',')}` : '';
        const cacheKey = `${selectedCity}-${searchQuery}${filterString}-search`;

        // Check cache first (only for initial requests)
        let cachedResult = null;
        if (existingActivityNames.length === 0 && existingActivityPlaceIds.length === 0) {
            cachedResult = await getCachedData('activities', cacheKey);
            if (cachedResult && cachedResult.activities) {
                console.log(`Returning cached search results for: ${searchQuery}`);
                return {
                    activities: cachedResult.activities.slice(0, 4),
                    query: searchQuery
                };
            }
        } else {
            console.log('Skipping cache for generateMore request - generating fresh activities');
        }

        // HYBRID APPROACH: Detect if search query is an address
        const isAddress = ADDRESS_REGEX.test(searchQuery);

        if (isAddress) {
            console.log(`Detected address query: "${searchQuery}". Routing to Google Places Text Search.`);
            return await handleAddressQuery(searchQuery, selectedCity, existingActivityNames, existingActivityPlaceIds, cacheKey);
        } else {
            console.log(`Detected general search query: "${searchQuery}". Routing to Gemini AI.`);
            return await handleGeneralSearchQuery(searchQuery, selectedCity, existingActivityNames, existingActivityPlaceIds, filters, cacheKey);
        }

    } catch (error) {
        console.error('Error in searchBarActivities:', error);

        // Return empty results with the query
        return {
            activities: [],
            query: event.arguments?.searchQuery || 'Unknown query'
        };
    }
};

/**
 * Handle address queries using getLocationCoordinates (leverages place_id cache)
 * Returns the specific place/establishment at the given address
 *
 * OPTIMIZATION: Uses getLocationCoordinates which has place_id-based caching
 * This ensures address queries benefit from the shared place_id cache
 * 
 * NOTE: Activities already in wishlist will still appear in results.
 * The UI displays "On list" tags to indicate wishlist items.
 */
async function handleAddressQuery(searchQuery, selectedCity, existingActivityNames, existingActivityPlaceIds, cacheKey) {
    try {
        // Check cache for address query
        if (existingActivityNames.length === 0 && existingActivityPlaceIds.length === 0) {
            const cachedResult = await getCachedData('activities', cacheKey);
            if (cachedResult && cachedResult.activities) {
                console.log(`Returning cached address result for: ${searchQuery}`);
                return {
                    activities: cachedResult.activities,
                    query: searchQuery
                };
            }
        }

        // Construct full address query with city context
        const fullQuery = `${searchQuery}, ${selectedCity}`;
        console.log(`Looking up address via getLocationCoordinates: "${fullQuery}"`);

        // Get city coordinates for bias
        console.log(`Getting bias coordinates for city: ${selectedCity}`);
        const cityInvokeCommand = new InvokeCommand({
            FunctionName: process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME,
            Payload: JSON.stringify({ locations: [selectedCity] }),
        });
        const cityResponse = await lambdaClient.send(cityInvokeCommand);
        const cityPayload = JSON.parse(new TextDecoder().decode(cityResponse.Payload));
        const cityCoordsArr = JSON.parse(cityPayload.body);

        // Create city-specific location bias for precise geocoding
        let cityBias = null;
        if (cityCoordsArr && cityCoordsArr.length > 0) {
            cityBias = { lat: cityCoordsArr[0].lat, lng: cityCoordsArr[0].lng };
            console.log(`Successfully got bias for ${selectedCity}:`, cityBias);
        }

        // Call getLocationCoordinates with the full address query
        // This will leverage place_id-based caching for Place Details
        const locationInvokeCommand = new InvokeCommand({
            FunctionName: process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME,
            Payload: JSON.stringify({
                locations: [fullQuery],
                bias: cityBias
            }),
        });

        const locationResponse = await lambdaClient.send(locationInvokeCommand);
        const locationPayload = JSON.parse(new TextDecoder().decode(locationResponse.Payload));
        const locationResults = JSON.parse(locationPayload.body);

        if (!locationResults || locationResults.length === 0) {
            console.log(`No results found for address: "${fullQuery}"`);
            return {
                activities: [],
                query: searchQuery
            };
        }

        // Use the first result (most relevant from FindPlace API)
        const coordData = locationResults[0];

        // Create activity object using getLocationCoordinates data
        const activity = {
            name: coordData.foundName || coordData.name,
            city: selectedCity,
            lat: coordData.lat || null,
            lng: coordData.lng || null,
            rating: coordData.rating || null,
            user_ratings_total: coordData.user_ratings_total || null,
            formatted_address: coordData.formatted_address || null,
            types: coordData.types || [],
            primaryType: coordData.primaryType || null,
            place_id: coordData.place_id || null,
            photo_reference: coordData.photo_reference || null,
            is_recommended: true,
            display_name: coordData.display_name || null,
            website_uri: coordData.website_uri || null,
            regular_opening_hours: coordData.regular_opening_hours || null,
            reviews: coordData.reviews || [],
            editorial_summary: coordData.editorial_summary || null,
            primary_type_display_name: coordData.primary_type_display_name || null,
            international_phone_number: coordData.international_phone_number || null
        };

        // Check place_id-based activity cache and update if new
        if (activity.place_id) {
            await setCachedData('activity', activity.place_id, activity, SEARCH_ACTIVITIES_TTL);
        }

        // Apply deduplication against activities passed from UI
        // UI controls what to deduplicate: empty [] for first search, [searchResults] for "Generate More"
        const deduplicatedActivities = deduplicateActivities([activity], existingActivityNames, existingActivityPlaceIds);

        // Cache the result only for initial requests
        if (existingActivityNames.length === 0 && existingActivityPlaceIds.length === 0) {
            await setCachedData('activities', cacheKey, {
                activities: [activity],
                query: searchQuery,
                timestamp: new Date().toISOString()
            }, SEARCH_ACTIVITIES_TTL);
        }

        console.log(`Returning ${deduplicatedActivities.length} activity for address query`);

        return {
            activities: deduplicatedActivities,
            query: searchQuery
        };

    } catch (error) {
        console.error('Error in handleAddressQuery:', error);
        return {
            activities: [],
            query: searchQuery
        };
    }
}

/**
 * Handle general search queries using Gemini AI
 * Returns 4 recommended activities based on search query and filters
 * 
 * NOTE: Activities already in wishlist will still appear in results.
 * The UI displays "On list" tags to indicate wishlist items.
 * Internal deduplication prevents the same place_id from appearing twice in one result set.
 */
async function handleGeneralSearchQuery(searchQuery, selectedCity, existingActivityNames, existingActivityPlaceIds, filters, cacheKey) {
    try {
        // Initialize Gemini with API key from environment
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        // Build prompt for general search
        const prompt = buildSearchPrompt(selectedCity, searchQuery, filters, existingActivityNames);
        console.log(`Gemini prompt created for search: ${searchQuery}`);

        // Call Gemini API
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const geminiResponse = response.text();

        // Parse the response from Gemini
        let analysisResult;
        try {
            const jsonString = geminiResponse.match(/{.*}/s)[0];
            analysisResult = JSON.parse(jsonString);
        } catch (parseError) {
            console.error('Error parsing Gemini response into JSON:', parseError, 'Raw response:', geminiResponse);
            throw new Error('Failed to parse search results from AI response.');
        }

        const { recommendations } = analysisResult;

        if (!recommendations || !Array.isArray(recommendations)) {
            throw new Error('Invalid JSON structure from AI. Missing "recommendations" array.');
        }

        console.log(`Gemini generated ${recommendations.length} recommendations for search: ${searchQuery}`);

        // Get city coordinates for geocoding bias
        console.log(`Getting bias coordinates for city: ${selectedCity}`);
        const cityInvokeCommand = new InvokeCommand({
            FunctionName: process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME,
            Payload: JSON.stringify({ locations: [selectedCity] }),
        });
        const cityResponse = await lambdaClient.send(cityInvokeCommand);
        const cityPayload = JSON.parse(new TextDecoder().decode(cityResponse.Payload));
        const cityCoordsArr = JSON.parse(cityPayload.body);

        // Create city-specific location bias for precise geocoding
        let cityBias = null;
        if (cityCoordsArr && cityCoordsArr.length > 0) {
            cityBias = { lat: cityCoordsArr[0].lat, lng: cityCoordsArr[0].lng };
            console.log(`Successfully got bias for ${selectedCity}:`, cityBias);
        } else {
            console.warn(`Could not get coordinates for city "${selectedCity}". Proceeding without bias.`);
        }

        // First, check place_id-based activity cache for recommendations that may already exist
        // This helps with "Generate More" requests and cross-query deduplication
        console.log(`Checking place_id-based activity cache for ${recommendations.length} recommendations`);
        const cachedActivitiesMap = new Map(); // name -> cached activity
        const recommendationsToGeocode = [];

        // Try to find cached activities by doing a preliminary geocode to get place_ids
        const preliminaryBatchSize = 5;
        for (let i = 0; i < recommendations.length; i += preliminaryBatchSize) {
            const batch = recommendations.slice(i, i + preliminaryBatchSize);
            
            const batchPromises = batch.map(async (recommendationObj) => {
                const { name } = recommendationObj;
                
                // First do a quick geocode to get the place_id
                const locationInvokeCommand = new InvokeCommand({
                    FunctionName: process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME,
                    Payload: JSON.stringify({
                        locations: [name],
                        bias: cityBias
                    }),
                });

                try {
                    const locationResponse = await lambdaClient.send(locationInvokeCommand);
                    const locationPayload = JSON.parse(new TextDecoder().decode(locationResponse.Payload));
                    const locationResult = JSON.parse(locationPayload.body);

                    if (locationResult && locationResult.length > 0 && locationResult[0].place_id) {
                        const placeId = locationResult[0].place_id;
                        
                        // Check if we have a cached activity for this place_id
                        const cachedActivity = await getCachedData('activity', placeId);
                        if (cachedActivity) {
                            console.log(`Cache HIT for activity with place_id: ${placeId} (${name})`);
                            cachedActivitiesMap.set(name, cachedActivity);
                            return { name, cached: true, data: locationResult[0] };
                        }
                        
                        // If not cached, the geocode already happened, just use it
                        console.log(`Cache MISS for activity with place_id: ${placeId} (${name})`);
                        return { name, cached: false, data: locationResult[0] };
                    } else {
                        console.warn(`No place_id found for "${name}" in "${selectedCity}"`);
                        return { name, cached: false, data: null };
                    }
                } catch (error) {
                    console.error(`Error checking cache for "${name}":`, error);
                    return { name, cached: false, data: null };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            recommendationsToGeocode.push(...batchResults);
        }

        console.log(`Found ${cachedActivitiesMap.size} cached activities, ${recommendationsToGeocode.length - cachedActivitiesMap.size} need processing`);

        // Create final activities array using cached data or fresh geocode data
        const finalActivities = recommendations.map(recommendationObj => {
            const { name } = recommendationObj;
            
            // Check if we have a cached activity
            if (cachedActivitiesMap.has(name)) {
                const cachedActivity = cachedActivitiesMap.get(name);
                console.log(`Using cached activity for: ${name}`);
                return {
                    ...cachedActivity,
                    city: selectedCity, // Ensure city is updated to current context
                    is_recommended: true
                };
            }
            
            // Otherwise use the fresh geocode data
            const geocodeResult = recommendationsToGeocode.find(r => r.name === name);
            const coordData = geocodeResult?.data;
            
            const activity = {
                name: recommendationObj.name,
                city: selectedCity,
                lat: coordData ? coordData.lat : null,
                lng: coordData ? coordData.lng : null,
                rating: coordData ? coordData.rating : null,
                user_ratings_total: coordData ? coordData.user_ratings_total : null,
                formatted_address: coordData ? coordData.formatted_address : null,
                types: coordData ? coordData.types : [],
                primaryType: coordData ? coordData.primaryType : null,
                place_id: coordData ? coordData.place_id : null,
                photo_reference: coordData ? coordData.photo_reference : null,
                is_recommended: true,
                display_name: coordData ? coordData.display_name : null,
                website_uri: coordData ? coordData.website_uri : null,
                regular_opening_hours: coordData ? coordData.regular_opening_hours : null,
                reviews: coordData ? coordData.reviews : null,
                editorial_summary: coordData ? coordData.editorial_summary : null,
                primary_type_display_name: coordData ? coordData.primary_type_display_name : null,
                international_phone_number: coordData ? coordData.international_phone_number : null,
            };
            
            // Cache the new activity by place_id for future reuse
            if (activity.place_id) {
                setCachedData('activity', activity.place_id, activity, SEARCH_ACTIVITIES_TTL).catch(err => {
                    console.warn(`Failed to cache activity for place_id ${activity.place_id}:`, err);
                });
            }
            
            return activity;
        });

        // Apply deduplication against activities passed from UI
        // UI controls what to deduplicate: empty [] for first search, [searchResults] for "Generate More"
        let deduplicatedActivities = deduplicateActivities(finalActivities, existingActivityNames, existingActivityPlaceIds);

        // Also deduplicate identical place_ids within the current results (prevents same place appearing twice)
        deduplicatedActivities = deduplicateByPlaceId(deduplicatedActivities);

        // Cache the result only for initial requests
        if (existingActivityNames.length === 0 && existingActivityPlaceIds.length === 0) {
            await setCachedData('activities', cacheKey, {
                activities: deduplicatedActivities,
                query: searchQuery,
                timestamp: new Date().toISOString()
            }, SEARCH_ACTIVITIES_TTL);
        }

        console.log(`Returning ${deduplicatedActivities.length} activities for general search (after deduplication)`);

        return {
            activities: deduplicatedActivities,
            query: searchQuery
        };

    } catch (error) {
        console.error('Error in handleGeneralSearchQuery:', error);
        return {
            activities: [],
            query: searchQuery
        };
    }
}

/**
 * Build search-specific prompt for Gemini AI
 * Includes user query and active filters
 */
function buildSearchPrompt(selectedCity, searchQuery, filters, existingActivities) {
    // Build existing activities context
    let existingActivitiesContext = "";
    if (existingActivities && existingActivities.length > 0) {
        const existingNames = existingActivities.join(', ');
        existingActivitiesContext = `
AVOID DUPLICATES:
The user already searched for: ${existingNames}
DO NOT recommend any of these existing locations. Generate DIFFERENT recommendations.
        `;
    }

    // Build filters context - just pass filter IDs directly
    const filtersContext = filters.length > 0
        ? `\nACTIVE FILTERS: ${filters.join(', ')}\nAll recommendations MUST satisfy these filters. Only recommend places that satisfy ALL active filters.\n`
        : '';

    return `
You are an expert travel assistant. Generate exactly 4 high-quality recommendations for "${searchQuery}" in ${selectedCity}.

CRITICAL CONSTRAINTS:
1. ONLY focus on ${selectedCity}
2. Generate exactly 4 specific locations matching "${searchQuery}" that are WITHIN ${selectedCity} only
3. Use precise, official names suitable for Google Places API
4. Don't recommend neighborhoods or areas, only specific locations
5. Focus on well-regarded, authentic experiences
6. Each recommendation MUST be a DIFFERENT physical location with a DIFFERENT address
7. DO NOT recommend multiple tour operators, companies, or services for the same attraction/location
${filtersContext}${existingActivitiesContext}

SEARCH QUERY: "${searchQuery}"
Generate 4 recommendations that:
- Directly match or closely relate to "${searchQuery}"
- Are highly rated and well-regarded locations
- Are accessible to visitors
- Are specific venues, not districts or neighborhoods
- Are at DIFFERENT addresses (not the same place with different names)
- Are distinct physical locations (not multiple ways to access the same attraction)

STRICT OUTPUT FORMAT:
Return ONLY this JSON structure with no additional text:
{"recommendations":[{"name":"Specific Place Name 1","region":"${selectedCity}"},{"name":"Specific Place Name 2","region":"${selectedCity}"}]}

Generate 4 diverse, distinct physical locations for "${searchQuery}" in ${selectedCity} now:
    `;
}

/**
 * Deduplication logic - remove activities that match existing place_ids
 * 
 * USAGE:
 * - First search: UI passes [] (empty) → no deduplication, all results shown (wishlist items get "On list" tag)
 * - Generate More: UI passes [searchResults] → deduplicates against previously shown results only
 * 
 * This allows wishlist items to appear in search results while preventing duplicate results
 * when user clicks "Generate More".
 * 
 * @param {Array} activities - Array of activity objects to deduplicate
 * @param {Array} existingActivityNames - Array of existing activity names (unused, kept for backward compatibility)
 * @param {Array} existingActivityPlaceIds - Array of existing activity place_ids to filter out
 */
function deduplicateActivities(activities, existingActivityNames, existingActivityPlaceIds = []) {
    if (!existingActivityPlaceIds || existingActivityPlaceIds.length === 0) {
        return activities;
    }

    const existingPlaceIdsSet = new Set(existingActivityPlaceIds.filter(id => id)); // Filter out null/undefined

    return activities.filter(activity => {
        // Check place_id match (only if activity has a place_id)
        const placeIdMatch = activity.place_id && existingPlaceIdsSet.has(activity.place_id);

        if (placeIdMatch) {
            console.log(`Filtering out duplicate by place_id: ${activity.place_id} (${activity.name})`);
            return false;
        }

        return true;
    });
}

/**
 * Deduplicate activities by place_id within the current batch
 * Keeps the first occurrence of each unique place_id
 */
function deduplicateByPlaceId(activities) {
    const seenPlaceIds = new Set();
    const uniqueActivities = [];

    for (const activity of activities) {
        // Skip activities without place_id or with duplicate place_id
        if (activity.place_id && !seenPlaceIds.has(activity.place_id)) {
            seenPlaceIds.add(activity.place_id);
            uniqueActivities.push(activity);
        } else if (!activity.place_id) {
            // Keep activities without place_id (geocoding may have failed)
            uniqueActivities.push(activity);
        } else {
            console.log(`Skipping duplicate place_id: ${activity.place_id} for activity: ${activity.name}`);
        }
    }

    return uniqueActivities;
}

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
