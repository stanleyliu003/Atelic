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
const CATEGORY_ACTIVITIES_TTL = 365 * 24 * 60 * 60; // 1 year (31,536,000 seconds)

/**
 * Lambda function to generate activities for a specific category using Gemini AI
 * Focuses exclusively on category-based activity generation
 */
exports.handler = async (event) => {
    console.log('generateCategoryActivities input:', JSON.stringify(event, null, 2));

    try {
        const {
            selectedCity,
            category,
            existingWishlistActivities = []
        } = event.arguments || event;

        // Alias for internal use
        const existingActivities = existingWishlistActivities;

        // Validation
        if (!selectedCity) {
            throw new Error('selectedCity is required');
        }
        if (!category) {
            throw new Error('category is required');
        }

        // Build cache key
        const cacheKey = `${selectedCity}-${category}-4`;

        // Check cache first (only for initial requests)
        let cachedResult = null;
        if (existingActivities.length === 0) {
            cachedResult = await getCachedData('activities', cacheKey);
            if (cachedResult && cachedResult.activities) {
                console.log(`Returning cached activities for category: ${category}`);
                return {
                    activities: cachedResult.activities.slice(0, 4),
                    category: category
                };
            }
        } else {
            console.log('Skipping cache for generateMore request - generating fresh activities');
        }

        // Initialize Gemini with API key from environment
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        // Build prompt for category
        const prompt = buildCategoryPrompt(selectedCity, category, existingActivities);
        console.log(`Gemini prompt created for category: ${category}`);

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
            throw new Error('Failed to parse category activities from AI response.');
        }

        const { recommendations } = analysisResult;

        if (!recommendations || !Array.isArray(recommendations)) {
            throw new Error('Invalid JSON structure from AI. Missing "recommendations" array.');
        }

        console.log(`Gemini generated ${recommendations.length} recommendations for category: ${category}`);

        // Get city coordinates for geocoding bias (following wishlistAnalyzer pattern)
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
        // This helps with "Generate More" requests and cross-category deduplication
        console.log(`Checking place_id-based activity cache for ${recommendations.length} recommendations`);
        const cachedActivitiesMap = new Map(); // name -> cached activity
        const recommendationsToGeocode = [];

        // Try to find cached activities by doing a preliminary geocode to get place_ids
        const batchSize = 5;
        for (let i = 0; i < recommendations.length; i += batchSize) {
            const batch = recommendations.slice(i, i + batchSize);

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

            console.log(`Completed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(recommendations.length/batchSize)}, total processed: ${recommendationsToGeocode.length}`);
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
                    is_recommended: true // Category-generated activities are recommended
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
                is_recommended: true, // Category-generated activities are recommended
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
                setCachedData('activity', activity.place_id, activity, CATEGORY_ACTIVITIES_TTL).catch(err => {
                    console.warn(`Failed to cache activity for place_id ${activity.place_id}:`, err);
                });
            }
            
            return activity;
        }).filter(activity => {
            // Filter out activities without place_id to prevent empty cards
            if (!activity.place_id) {
                console.warn(`Filtering out activity "${activity.name}" - no place_id found`);
                return false;
            }
            return true;
        });

        // Apply deduplication against existing activities (by name)
        const deduplicatedActivities = deduplicateActivities(finalActivities, existingActivities);

        // Cache the result only for initial requests
        if (existingActivities.length === 0) {
            await setCachedData('activities', cacheKey, {
                activities: finalActivities,
                category: category,
                timestamp: new Date().toISOString()
            }, CATEGORY_ACTIVITIES_TTL);
        }

        console.log(`Returning ${deduplicatedActivities.length} activities`);

        return {
            activities: deduplicatedActivities.slice(0, 4),
            category: category
        };

    } catch (error) {
        console.error('Error in generateCategoryActivities:', error);

        // Return empty results with the category
        return {
            activities: [],
            category: event.arguments?.category || 'Unknown category'
        };
    }
};


/**
 * Build category-specific prompt for Gemini AI
 * Based on wishlistAnalyzer prompt structure with category focus
 * Includes existing activities to avoid duplicates
 */
function buildCategoryPrompt(selectedCity, category, existingActivities) {
    // Build the existing activities context
    let existingActivitiesContext = "";
    if (existingActivities && existingActivities.length > 0) {
        const existingNames = existingActivities.join(', ');
        existingActivitiesContext = `
AVOID DUPLICATES:
The user already has the following ${category} activities: ${existingNames}
DO NOT recommend any of these existing locations. Generate 4 DIFFERENT ${category} recommendations.
        `;
    }

    return `
You are an expert travel assistant. Generate exactly 4 high-quality ${category} recommendations for ${selectedCity}.

CRITICAL CONSTRAINTS:
1. ONLY focus on ${selectedCity}
2. Generate exactly 4 specific ${category} locations that are WITHIN ${selectedCity} only
3. Use precise, official names suitable for Google Places API
4. Don't recommend neighborhoods or areas, only specific locations
5. Focus on well-regarded, authentic ${category} experiences
${existingActivitiesContext}

CATEGORY FOCUS: ${category}
Generate 4 recommendations that are:
- Highly rated and well-regarded ${category} locations
- Accessible to visitors
- Specific venues, not districts or neighborhoods

STRICT OUTPUT FORMAT:
Return ONLY this JSON structure with no additional text:
{"recommendations":[{"name":"Specific ${category} Name 1","region":"${selectedCity}"},{"name":"Specific ${category} Name 2","region":"${selectedCity}"}]}

Generate 4 specific ${category} recommendations for ${selectedCity} now:
    `;
}


/**
 * Deduplication logic - remove activities that already exist by name
 * Based on addAdditionalPlace deduplication pattern
 */
function deduplicateActivities(activities, existingActivityNames) {
    if (!existingActivityNames || existingActivityNames.length === 0) {
        return activities;
    }

    const existingNamesSet = new Set(existingActivityNames);
    return activities.filter(activity => !existingNamesSet.has(activity.name));
}

// Cache helper functions (following getLocationCoordinates pattern)
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

