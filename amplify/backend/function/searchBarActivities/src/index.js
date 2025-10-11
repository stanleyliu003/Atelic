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
const axios = require('axios');

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
 * Handle address queries using Google Places Text Search API
 * Returns the specific place/establishment at the given address
 *
 * OPTIMIZATION: Uses Text Search data directly + single Place Details call
 * Previous: 3 API calls (Text Search + FindPlace + Place Details)
 * Current: 2 API calls (Text Search + Place Details)
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

        const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

        // Use Text Search API to find establishments at this address
        const textSearchUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
        const fullQuery = `${searchQuery}, ${selectedCity}`;
        const textSearchParams = {
            query: fullQuery,
            key: GOOGLE_PLACES_API_KEY
        };

        console.log(`Calling Google Places Text Search for: "${fullQuery}"`);
        const textSearchResponse = await axios.get(textSearchUrl, { params: textSearchParams });

        if (!textSearchResponse.data.results || textSearchResponse.data.results.length === 0) {
            console.log(`No text search results found for: "${fullQuery}"`);
            return {
                activities: [],
                query: searchQuery
            };
        }

        // Find the most relevant place from results
        const results = textSearchResponse.data.results;
        console.log(`Text Search returned ${results.length} results`);

        // Generic types to exclude (too generic or not useful for travel planning)
        const genericTypes = [
            'premise', 'street_address', 'geocode', 'route', 'neighborhood',
            'locality', 'political', 'sublocality', 'administrative_area_level_1',
            'administrative_area_level_2', 'postal_code', 'subpremise'
        ];

        // Find the first interesting place (has non-generic type)
        let selectedPlace = results.find(place => {
            const types = place.types || [];
            return types.some(type => !genericTypes.includes(type));
        }) || results[0]; // Fallback to first result if none found

        console.log(`Initial selection: "${selectedPlace.name}" (types: ${selectedPlace.types?.join(', ')})`);

        // If we only got a generic address, search for establishments at this location
        const isGenericAddress = selectedPlace.types?.every(type => genericTypes.includes(type)) ?? true;
        
        if (isGenericAddress && selectedPlace.geometry?.location) {
            console.log(`Generic address detected. Searching for establishments at this location...`);
            
            const nearbySearchUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
            const nearbyParams = {
                location: `${selectedPlace.geometry.location.lat},${selectedPlace.geometry.location.lng}`,
                radius: 20, // 20 meter radius - very close to the address
                key: GOOGLE_PLACES_API_KEY
            };

            try {
                const nearbyResponse = await axios.get(nearbySearchUrl, { params: nearbyParams });
                
                if (nearbyResponse.data.results && nearbyResponse.data.results.length > 0) {
                    // Filter out generic results and find actual establishments
                    const establishments = nearbyResponse.data.results.filter(place => {
                        const types = place.types || [];
                        return types.some(type => !genericTypes.includes(type));
                    });

                    if (establishments.length > 0) {
                        selectedPlace = establishments[0];
                        console.log(`Found establishment at address: "${selectedPlace.name}" (types: ${selectedPlace.types?.join(', ')})`);
                    } else {
                        console.log(`No establishments found nearby, using original address`);
                    }
                } else {
                    console.log(`Nearby search returned no results`);
                }
            } catch (nearbyError) {
                console.warn(`Nearby search failed: ${nearbyError.message}, using original address`);
            }
        }

        console.log(`Final selected place: "${selectedPlace.name}" (types: ${selectedPlace.types?.join(', ')})`);

        // Extract data from Text Search response
        const location = selectedPlace.geometry?.location || {};
        const photoReference = selectedPlace.photos?.[0]?.photo_reference || null;

        // Get additional details only if we have a place_id
        let placeDetails = {
            display_name: selectedPlace.name,
            website_uri: null,
            regular_opening_hours: null,
            reviews: [],
            editorial_summary: null,
            primary_type_display_name: null,
            international_phone_number: null
        };

        if (selectedPlace.place_id) {
            console.log(`Fetching details for place_id: ${selectedPlace.place_id}`);
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json`;
            const detailsParams = {
                place_id: selectedPlace.place_id,
                fields: 'name,opening_hours,website,reviews,editorial_summary,international_phone_number',
                key: GOOGLE_PLACES_API_KEY
            };

            try {
                const detailsResponse = await axios.get(detailsUrl, { params: detailsParams });
                if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
                    const details = detailsResponse.data.result;
                    
                    placeDetails = {
                        display_name: details.name || selectedPlace.name,
                        website_uri: details.website || null,
                        regular_opening_hours: details.opening_hours ? {
                            open_now: details.opening_hours.open_now || false,
                            periods: details.opening_hours.periods || [],
                            weekday_text: details.opening_hours.weekday_text || []
                        } : null,
                        reviews: (details.reviews || []).slice(0, 5).map(review => ({
                            author_name: review.author_name || null,
                            rating: review.rating || null,
                            text: review.text || null,
                            time: review.time || null,
                            author_url: review.author_url || null,
                            profile_photo_url: review.profile_photo_url || null
                        })),
                        editorial_summary: details.editorial_summary?.overview || null,
                        primary_type_display_name: selectedPlace.types?.[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || null,
                        international_phone_number: details.international_phone_number || null
                    };
                }
            } catch (detailsError) {
                console.warn(`Could not fetch place details: ${detailsError.message}`);
            }
        }

        // Create activity object using Text Search + Place Details data
        const activity = {
            name: selectedPlace.name,
            city: selectedCity,
            lat: location.lat || null,
            lng: location.lng || null,
            rating: selectedPlace.rating || null,
            user_ratings_total: selectedPlace.user_ratings_total || null,
            formatted_address: selectedPlace.formatted_address || null,
            types: selectedPlace.types || [],
            primaryType: selectedPlace.types?.[0] || null,
            place_id: selectedPlace.place_id || null,
            photo_reference: photoReference,
            is_recommended: true,
            ...placeDetails
        };

        // Apply deduplication
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

        // Geocode the recommendations
        console.log(`Geocoding ${recommendations.length} recommendations with city-specific bias.`);
        const batchSize = 5;
        const geocodedLocations = [];

        for (let i = 0; i < recommendations.length; i += batchSize) {
            const batch = recommendations.slice(i, i + batchSize);

            const batchPromises = batch.map(async (recommendationObj) => {
                const { name } = recommendationObj;

                console.log(`Geocoding "${name}" in "${selectedCity}" with bias:`, cityBias);

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

                    if (locationResult && locationResult.length > 0) {
                        return locationResult;
                    } else {
                        console.warn(`No geocoding results for "${name}" in "${selectedCity}"`);
                        return [];
                    }
                } catch (error) {
                    console.error(`Error geocoding "${name}" in "${selectedCity}":`, error);
                    return [];
                }
            });

            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(results => {
                if (results.length > 0) {
                    geocodedLocations.push(...results);
                }
            });

            console.log(`Completed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(recommendations.length/batchSize)}, total geocoded: ${geocodedLocations.length}`);
        }

        // Create final activities array
        const finalActivities = recommendations.map(recommendationObj => {
            const coordData = geocodedLocations.find(c => c.name === recommendationObj.name);
            return {
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
        });

        // Apply deduplication against existing activities (by place_id)
        let deduplicatedActivities = deduplicateActivities(finalActivities, existingActivityNames, existingActivityPlaceIds);

        // Deduplicate by place_id within the current results
        deduplicatedActivities = deduplicateByPlaceId(deduplicatedActivities);

        // Cache the result only for initial requests (cache deduplicated activities)
        if (existingActivityNames.length === 0 && existingActivityPlaceIds.length === 0) {
            await setCachedData('activities', cacheKey, {
                activities: deduplicatedActivities,
                query: searchQuery,
                timestamp: new Date().toISOString()
            }, SEARCH_ACTIVITIES_TTL);
        }

        console.log(`Returning ${deduplicatedActivities.length} activities for general search (after place_id deduplication)`);

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
 * Deduplication logic - remove activities that already exist by place_id
 * @param {Array} activities - Array of activity objects to deduplicate
 * @param {Array} existingActivityNames - Array of existing activity names (unused, kept for backward compatibility)
 * @param {Array} existingActivityPlaceIds - Array of existing activity place_ids
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
