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
const SEARCH_ACTIVITIES_TTL = 24 * 60 * 60; // 24 hours

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

        // Alias for internal use
        const existingActivities = existingWishlistActivities;

        // Build cache key
        const filterString = filters.length > 0 ? `-${filters.sort().join(',')}` : '';
        const cacheKey = `${selectedCity}-${searchQuery}${filterString}-search`;

        // Check cache first (only for initial requests)
        let cachedResult = null;
        if (existingActivities.length === 0) {
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
            return await handleAddressQuery(searchQuery, selectedCity, existingActivities, cacheKey);
        } else {
            console.log(`Detected general search query: "${searchQuery}". Routing to Gemini AI.`);
            return await handleGeneralSearchQuery(searchQuery, selectedCity, existingActivities, filters, cacheKey);
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
 */
async function handleAddressQuery(searchQuery, selectedCity, existingActivities, cacheKey) {
    try {
        // Check cache for address query
        if (existingActivities.length === 0) {
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
        // Include city in query for better results
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

        // Log all results for debugging
        const results = textSearchResponse.data.results;
        console.log(`Text Search returned ${results.length} results:`);
        results.forEach((place, idx) => {
            console.log(`  [${idx}] ${place.name} - types: ${place.types?.join(', ')}`);
        });

        // Filter results to find interesting places (not just generic addresses)
        // Prioritize establishments, attractions, landmarks, etc. over generic "premise"
        let selectedPlace = results[0]; // Default to first result

        // Generic types to exclude (too generic or not useful for travel planning)
        const genericTypes = [
            'premise',
            'street_address',
            'geocode',
            'route',
            'neighborhood',
            'locality',
            'political',
            'sublocality',
            'administrative_area_level_1',
            'administrative_area_level_2',
            'postal_code'
        ];

        // Try to find a result that's an interesting place (not just a generic address)
        const interestingPlace = results.find(place => {
            const types = place.types || [];
            // Check if this place has at least one non-generic type
            return types.some(type => !genericTypes.includes(type));
        });

        if (interestingPlace) {
            selectedPlace = interestingPlace;
            console.log(`Found interesting place: "${selectedPlace.name}" (types: ${selectedPlace.types?.join(', ')})`);
        } else {
            console.log(`Only found generic address using : "${selectedPlace.name}"`);
        }

        const placeName = selectedPlace.name;

        // Get detailed place information using getLocationCoordinates
        const locationInvokeCommand = new InvokeCommand({
            FunctionName: process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME,
            Payload: JSON.stringify({
                locations: [placeName],
                city: selectedCity
            }),
        });

        const locationResponse = await lambdaClient.send(locationInvokeCommand);
        const locationPayload = JSON.parse(new TextDecoder().decode(locationResponse.Payload));
        const locationResult = JSON.parse(locationPayload.body);

        if (!locationResult || locationResult.length === 0) {
            console.warn(`Could not geocode place: "${placeName}"`);
            return {
                activities: [],
                query: searchQuery
            };
        }

        const coordData = locationResult[0];

        // Create activity object
        const activity = {
            name: coordData.name,
            city: selectedCity,
            lat: coordData.lat,
            lng: coordData.lng,
            rating: coordData.rating,
            user_ratings_total: coordData.user_ratings_total,
            formatted_address: coordData.formatted_address,
            types: coordData.types || [],
            primaryType: coordData.primaryType,
            place_id: coordData.place_id,
            photo_reference: coordData.photo_reference,
            is_recommended: true,
            display_name: coordData.display_name,
            website_uri: coordData.website_uri,
            regular_opening_hours: coordData.regular_opening_hours,
            reviews: coordData.reviews,
            editorial_summary: coordData.editorial_summary,
            primary_type_display_name: coordData.primary_type_display_name,
            international_phone_number: coordData.international_phone_number,
        };

        // Apply deduplication
        const deduplicatedActivities = deduplicateActivities([activity], existingActivities);

        // Cache the result only for initial requests
        if (existingActivities.length === 0) {
            await setCachedData('activities', cacheKey, {
                activities: [activity], // Cache the full activity, not deduplicated
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
async function handleGeneralSearchQuery(searchQuery, selectedCity, existingActivities, filters, cacheKey) {
    try {
        // Initialize Gemini with API key from environment
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        // Build prompt for general search
        const prompt = buildSearchPrompt(selectedCity, searchQuery, filters, existingActivities);
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

        // Apply deduplication against existing activities (by name)
        const deduplicatedActivities = deduplicateActivities(finalActivities, existingActivities);

        // Cache the result only for initial requests
        if (existingActivities.length === 0) {
            await setCachedData('activities', cacheKey, {
                activities: finalActivities,
                query: searchQuery,
                timestamp: new Date().toISOString()
            }, SEARCH_ACTIVITIES_TTL);
        }

        console.log(`Returning ${deduplicatedActivities.length} activities for general search`);

        return {
            activities: deduplicatedActivities.slice(0, 4),
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
${filtersContext}${existingActivitiesContext}

SEARCH QUERY: "${searchQuery}"
Generate 4 recommendations that:
- Directly match or closely relate to "${searchQuery}"
- Are highly rated and well-regarded locations
- Are accessible to visitors
- Are specific venues, not districts or neighborhoods

STRICT OUTPUT FORMAT:
Return ONLY this JSON structure with no additional text:
{"recommendations":[{"name":"Specific Place Name 1","region":"${selectedCity}"},{"name":"Specific Place Name 2","region":"${selectedCity}"}]}

Generate 4 specific recommendations for "${searchQuery}" in ${selectedCity} now:
    `;
}

/**
 * Deduplication logic - remove activities that already exist by name
 */
function deduplicateActivities(activities, existingActivityNames) {
    if (!existingActivityNames || existingActivityNames.length === 0) {
        return activities;
    }

    const existingNamesSet = new Set(existingActivityNames);
    return activities.filter(activity => !existingNamesSet.has(activity.name));
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
