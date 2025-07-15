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

        // Create prompt for Gemini to extract activities
        const prompt = `
        You are an expert travel assistant. Analyze the following travel wishlist text. First, identify the primary city of the trip. Second, extract all of the location names, landmarks, or points of interest.
        For each location, provide its full, official name, avoiding abbreviations or slang. The names should be precise and suitable for use with a mapping API like Google Places.
        For example, instead of "UPenn", use "University of Pennsylvania". Instead of "Philly museum of art", use "Philadelphia Museum of Art".

        Return ONLY a single, minified JSON object with no additional text or explanation. No need to return or tell me to "see location 1" or "go enjoy location 2" I just want the location name The object must have two keys: "primaryCity" (a string) and "locations" (an array of strings).

        Format: {"primaryCity":"City Name","locations":["Official Location Name 1","Official Location Name 2"]}

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

        const { primaryCity, locations } = analysisResult;

        if (!primaryCity || !locations || !Array.isArray(locations)) {
            throw new Error('Invalid JSON structure from AI. Missing "primaryCity" or "locations".');
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

        // Step 2: Get coordinates for all other locations using the city bias.
        console.log(`Invoking getLocationCoordinates for ${locations.length} locations with bias.`);
        const locationsInvokeCommand = new InvokeCommand({
            FunctionName: process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME,
            Payload: JSON.stringify({ locations, bias: locationBias }),
        });
        const locationsResponse = await lambdaClient.send(locationsInvokeCommand);
        const locationsPayload = JSON.parse(new TextDecoder().decode(locationsResponse.Payload));
        const locationsWithCoords = JSON.parse(locationsPayload.body);

        console.log('Received coordinates for locations:', locationsWithCoords);

        // Combine original names with the new coordinates
        const finalActivities = locations.map(locationName => {
            const coordData = locationsWithCoords.find(c => c.name === locationName);
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
            };
        });

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