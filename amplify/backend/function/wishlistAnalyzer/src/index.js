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
        You are an expert travel assistant. Analyze the following travel wishlist text. First, identify the primary city of the trip. Second, extract all of the location names, landmarks, or points of interest.
        For each location, provide its full, official name, avoiding abbreviations or slang. The names should be precise and suitable for use with a mapping API like Google Places.
        For example, instead of "UPenn", use "University of Pennsylvania". Instead of "Philly museum of art", use "Philadelphia Museum of Art".
        Also generate a list of exactly 7 high-quality recommendations by following these specific rules: 
        RULE 1: ANALYZE USER INTENT Infer the user's implicit interests from their wishlist. They can have multiple interests (e.g., History, Art, Outdoors, Food, science, music, art, popular attractions, religious, etc. if they chose museums, include other cultural sites; if they chose parks, include outdoor attractions, if they like art museums, suggest a specific gallery district or a notable sculpture park). The recommendations must be complementary to a users interests. 
        RULE 2: APPLY RECOMMENDATION CRITERIA Every recommendation must meet these qualifications: 
        - Thematic Relevance: Aligns with the user's inferred interests from Rule 1. 
        - Quality & Popularity: Must be well-regarded and highly reviewed destinations that tourists and locals appreciate. 
        - Geographic Logic: Should be reasonably accessible from the user's other chosen locations, creating a sensible travel path. 
        - Itinerary Balance: The final list of 7 must be diverse. It should balance iconic, "must-see" attractions that define the city with unique local favorites or experiences to create a well-rounded itinerary. 
        RULE 3: APPLY EXCLUSION CRITERIA DO NOT include any of the following in the recommendations: 
        - Locations already present in the user's original wishlist. 
        - Generic chain establishments (e.g., Starbucks, McDonald's). 
        - Hotels or other accommodations. 
        - Overly niche attractions with very limited appeal. 
        - Locations requiring significant travel outside the primary city. 
        - Seasonal attractions that are very likely to be closed (e.g., a water park in winter).
        Return ONLY a single, minified JSON object with no additional text or explanation. The object must have three keys: "primaryCity" (a string), "locations" (an array of strings), and "recommendations" (an array of exactly 7 strings).
        Format: {"primaryCity":"City Name","locations":["Official Location Name 1","Official Location Name 2"],"recommendations":["Recommended Location 1","Recommended Location 2","Recommended Location 3","Recommended Location 4","Recommended Location 5","Recommended Location 6","Recommended Location 7"]}
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

        const { primaryCity, locations, recommendations } = analysisResult;

        if (!primaryCity || !locations || !Array.isArray(locations) || !recommendations || !Array.isArray(recommendations)) {
            throw new Error('Invalid JSON structure from AI. Missing "primaryCity", "locations", or "recommendations".');
        }

        // ----------------------------------------------------------------
        // NEW 2-STEP GECODING LOGIC
        // ----------------------------------------------------------------

        // Step 1: Get coordinates for the primary city to create a search bias.
        console.log(`Getting bias coordinates for primary city: ${primaryCity}`);
        const cityInvokeCommand = new InvokeCommand({
            FunctionName: process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME,
            Payload: JSON.stringify({ locations: [primaryCity] }),
        });
        const cityResponse = await lambdaClient.send(cityInvokeCommand);
        const cityPayload = JSON.parse(new TextDecoder().decode(cityResponse.Payload));
        const cityCoordsArr = JSON.parse(cityPayload.body);
        
        const locationBias = cityCoordsArr.length > 0 ? { lat: cityCoordsArr[0].lat, lng: cityCoordsArr[0].lng } : null;

        if (locationBias) {
            console.log(`Successfully got bias:`, locationBias);
        } else {
            console.warn(`Could not get coordinates for primary city "${primaryCity}". Proceeding without bias.`);
        }

        // Step 2: Get coordinates for all locations (user's + recommendations) using the city bias.
        const allLocations = [...locations, ...recommendations];
        console.log(`Invoking getLocationCoordinates for ${allLocations.length} locations with bias.`);
        const locationsInvokeCommand = new InvokeCommand({
            FunctionName: process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME,
            Payload: JSON.stringify({ locations: allLocations, bias: locationBias }),
        });
        const locationsResponse = await lambdaClient.send(locationsInvokeCommand);
        const locationsPayload = JSON.parse(new TextDecoder().decode(locationsResponse.Payload));
        const allLocationsWithCoords = JSON.parse(locationsPayload.body);

        console.log('Received coordinates for all locations:', allLocationsWithCoords);

        // Helper function to create activity object
        const createActivityObject = (locationName, isRecommended = false) => {
            const coordData = allLocationsWithCoords.find(c => c.name === locationName);
            return {
                name: locationName,
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
        const userActivities = locations.map(locationName => createActivityObject(locationName, false));
        const recommendedActivities = recommendations.map(locationName => createActivityObject(locationName, true));
        const finalActivities = [...userActivities, ...recommendedActivities];
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