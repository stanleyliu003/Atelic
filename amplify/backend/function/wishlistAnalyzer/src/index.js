/* Amplify Params - DO NOT EDIT
	API_WISHLISTAPI_GRAPHQLAPIENDPOINTOUTPUT
	API_WISHLISTAPI_GRAPHQLAPIIDOUTPUT
	API_WISHLISTAPI_GRAPHQLAPIKEYOUTPUT
	API_WISHLISTAPI_WISHLISTANALYSISTABLE_ARN
	API_WISHLISTAPI_WISHLISTANALYSISTABLE_NAME
	ENV
	FUNCTION_GETLOCATIONCOORDINATES_NAME
	REGION
Amplify Params - DO NOT EDIT *//* Amplify Params - DO NOT EDIT
    ENV
    REGION
    API_WISHLISTAPI_GRAPHQLAPIIDOUTPUT
    API_WISHLISTAPI_GRAPHQLAPIENDPOINTOUTPUT
    API_WISHLISTAPI_GRAPHQLAPIKEYOUTPUT
    API_WISHLISTAPI_WISHLISTANALYSISTABLE_NAME
    API_WISHLISTAPI_WISHLISTANALYSIS_TABLE_ARN
    GEMINI_API_KEY
    FUNCTION_GETLOCATIONCOORDINATES_NAME
Amplify Params - DO NOT EDIT */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const lambdaClient = new LambdaClient({ region: process.env.REGION });

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);

    try {
        // Extract wishlist_text from GraphQL input
        const { wishlist_text } = event.arguments || {};

        if (!wishlist_text) {
            throw new Error('wishlist_text is required');
        }

        // Initialize Gemini with API key from environment
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // **IMPORTANT:** After running the above debug code and checking logs,
        // use the exact model name that is listed and supports 'generateContent'.
        // It is most likely still "gemini-pro", but this verification step is crucial.
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Create prompt for Gemini to extract activities AND get recommendations
        const prompt = `
        You are an expert travel assistant. Analyze the following travel wishlist text. First, identify ALL the cities mentioned in the trip and the number of cities. Second, extract all of the location names, landmarks, or points of interest.
        For each location, provide its full, official name, avoiding abbreviations or slang. The names should be precise and suitable for use with a mapping API like Google Places.
        For example, instead of "UPenn", use "University of Pennsylvania". Instead of "Philly museum of art", use "Philadelphia Museum of Art".
        Also generate a list of exactly 7 high-quality recommendations per each city by following these specific rules: 
        RULE 1: ANALYZE USER INTENT Infer the user's implicit interests from their wishlist. They can have multiple interests (e.g., History, Art, Outdoors, Food, science, music, art, popular attractions, religious, etc. if they chose museums, include other cultural sites; if they chose parks, include outdoor attractions, if they like art museums, suggest a specific gallery district or a notable sculpture park). The recommendations must be complementary to a users interests. 
        RULE 2: APPLY RECOMMENDATION CRITERIA Every recommendation must meet these qualifications: 
        - Thematic Relevance: Aligns with the user's inferred interests from Rule 1. 
        - Quality & Popularity: Must be well-regarded and highly reviewed destinations that tourists and locals appreciate. 
        - Geographic Logic: Should be reasonably accessible from the user's other chosen locations, creating a sensible travel path. 
        - Itinerary Balance: The final list of 7 activities per each city should balance iconic, "must-see" attractions that define the cities with the users interests. 
        - Multi-City Distribution: If multiple cities are mentioned, group recommendations by city. List all recommendations for the first city, then all recommendations for the second city, and so on. Do not alternate between cities.
        RULE 3: APPLY EXCLUSION CRITERIA DO NOT include any of the following in the recommendations: 
        - Locations already present in the user's original wishlist. 
        - Generic chain establishments (e.g., Starbucks, McDonald's). 
        - Hotels or other accommodations. 
        - Overly niche attractions with very limited appeal. 
        - Locations requiring significant travel outside the mentioned cities. 
        - Seasonal attractions that are very likely to be closed (e.g., a water park in winter).
        Return ONLY a single, minified JSON object with no additional text or explanation. The object must have three keys: "cities" (an array of city names), "locations" (an array of objects with "name" and "city"), and "recommendations" (an array of objects with "name" and "city" - 7 recommendations per city mentioned).
        Format: {"cities":["City Name 1","City Name 2"],"locations":[{"name":"Official Location Name 1","city":"City Name 1"},{"name":"Official Location Name 2","city":"City Name 2"}],"recommendations":[{"name":"Recommended Location 1","city":"City Name 1"},{"name":"Recommended Location 2","city":"City Name 1"},{"name":"Recommended Location 3","city":"City Name 1"},{"name":"Recommended Location 4","city":"City Name 1"},{"name":"Recommended Location 5","city":"City Name 1"},{"name":"Recommended Location 6","city":"City Name 1"},{"name":"Recommended Location 7","city":"City Name 1"},{"name":"Recommended Location 8","city":"City Name 2"},{"name":"Recommended Location 9","city":"City Name 2"},{"name":"Recommended Location 10","city":"City Name 2"}]}
        Wishlist text: "${wishlist_text}"
        `;

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
            throw new Error('Failed to parse analysis from AI response.');
        }

        const { cities, locations, recommendations } = analysisResult;

        if (!cities || !Array.isArray(cities) || !locations || !Array.isArray(locations) || !recommendations || !Array.isArray(recommendations)) {
            throw new Error('Invalid JSON structure from AI. Missing "cities", "locations", or "recommendations".');
        }

        // ----------------------------------------------------------------
        // MULTI-CITY GECODING LOGIC
        // ----------------------------------------------------------------

        // Step 1: Get coordinates for all cities to create city-specific search biases.
        console.log(`Getting bias coordinates for cities: ${cities.join(', ')}`);
        const cityInvokeCommand = new InvokeCommand({
            FunctionName: process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME,
            Payload: JSON.stringify({ locations: cities }),
        });
        const cityResponse = await lambdaClient.send(cityInvokeCommand);
        const cityPayload = JSON.parse(new TextDecoder().decode(cityResponse.Payload));
        const cityCoordsArr = JSON.parse(cityPayload.body);
        
        // Create city-specific location biases for precise geocoding
        const cityBiases = {};
        cityCoordsArr.forEach(city => {
            cityBiases[city.name] = { lat: city.lat, lng: city.lng };
        });

        if (Object.keys(cityBiases).length > 0) {
            console.log(`Successfully got biases for ${Object.keys(cityBiases).length} cities:`, cityBiases);
        } else {
            console.warn(`Could not get coordinates for cities "${cities.join(', ')}". Proceeding without bias.`);
        }

        // Step 2: Geocode locations with city-specific biases for maximum accuracy
        const allLocationObjects = [...locations, ...recommendations];
        console.log(`Geocoding ${allLocationObjects.length} locations with city-specific biases.`);
        
        // Geocode each location using its specific city bias
        const geocodedLocations = [];
        
        for (const locationObj of allLocationObjects) {
            const { name, city } = locationObj;
            const cityBias = cityBiases[city];
            
            console.log(`Geocoding "${name}" in "${city}" with bias:`, cityBias);
            
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
                    geocodedLocations.push(...locationResult);
                } else {
                    console.warn(`No geocoding results for "${name}" in "${city}"`);
                }
            } catch (error) {
                console.error(`Error geocoding "${name}" in "${city}":`, error);
            }
        }
        
        console.log('All geocoded locations:', geocodedLocations);
        // Use the geocoded locations we just obtained
        const allLocationsWithCoords = geocodedLocations;

        // Helper function to create activity object
        const createActivityObject = (locationObj, isRecommended = false) => {
            const coordData = allLocationsWithCoords.find(c => c.name === locationObj.name);
            return {
                name: locationObj.name,
                city: locationObj.city, // Include city information
                lat: coordData ? coordData.lat : null,
                lng: coordData ? coordData.lng : null,
                rating: coordData ? coordData.rating : null,
                user_ratings_total: coordData ? coordData.user_ratings_total : null,
                formatted_address: coordData ? coordData.formatted_address : null,
                types: coordData ? coordData.types : [],
                place_id: coordData ? coordData.place_id : null,
                photo_reference: coordData ? coordData.photo_reference : null,
                is_recommended: isRecommended, // Flag to distinguish user's choices from recommendations
            };
        };

        // Create final activities array with user's locations first, then recommendations
        // Filter out any city names from both user locations and recommendations
        const userActivities = locations
            .filter(locationObj => !cities.includes(locationObj.name))
            .map(locationObj => createActivityObject(locationObj, false));
        const recommendedActivities = recommendations
            .filter(locationObj => !cities.includes(locationObj.name))
            .map(locationObj => createActivityObject(locationObj, true));
        
        // Sort recommendations by city to group them together
        const sortedRecommendedActivities = recommendedActivities.sort((a, b) => {
            const cityAIndex = cities.indexOf(a.city);
            const cityBIndex = cities.indexOf(b.city);
            return cityAIndex - cityBIndex;
        });
        
        const finalActivities = [...userActivities, ...sortedRecommendedActivities];
        console.log('finalActivities', finalActivities);

        return {
            wishlist_activities: finalActivities,
        };

    } catch (error) {
        console.error('Error in Lambda function:', error);

        // Standardize error response for GraphQL
        return {
            wishlist_activities: [], // Return an empty array on error for consistency with GraphQL type
            error: error.message // Optionally include error message for client-side debugging
        };
    }
};