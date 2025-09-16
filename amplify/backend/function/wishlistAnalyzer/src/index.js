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
 * REST API Gateway Lambda handler for wishlist analysis
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
    // Track execution time to prevent timeout
    const startTime = Date.now();
    const maxExecutionTime = 55000; // 55 seconds, leaving 5 seconds buffer before Lambda timeout

    try {
        // Extract wishlist_text and selectedCity from REST API input
        // For REST API, the data comes from event.body
        let requestBody = {};
        if (event.body) {
            try {
                requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
            } catch (parseError) {
                console.error('Error parsing request body:', parseError);
                return {
                    statusCode: 400,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Headers": "*",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        error: 'Invalid JSON in request body'
                    })
                };
            }
        }

        const { wishlist_text, selectedCity } = requestBody;

        if (!wishlist_text) {
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: 'wishlist_text is required'
                })
            };
        }

        if (!selectedCity) {
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: 'selectedCity is required'
                })
            };
        }

        // Initialize Gemini with API key from environment
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // **IMPORTANT:** After running the above debug code and checking logs,
        // use the exact model name that is listed and supports 'generateContent'.
        // It is most likely still "gemini-pro", but this verification step is crucial.
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        // Create prompt for Gemini to extract activities AND get recommendations
        const prompt = `
       You are an expert travel assistant. Analyze the following travel wishlist text for the region: ${selectedCity}.

       CRITICAL CONSTRAINTS:
       1. ONLY focus on ${selectedCity} - do NOT include other regions, cities, or areas
       2. When users mention broad categories (like "night markets", "temples", "coastal areas"), extract only 1-2 SPECIFIC examples within ${selectedCity}
       3. Generate exactly 7 recommendations that are WITHIN ${selectedCity} only
       4. Use precise, official names suitable for Google Places API

       TASK 1 - EXTRACT SPECIFIC LOCATIONS:
       From the wishlist text, identify specific location names, landmarks, or points of interest mentioned by the user.
       - Use full, official names (e.g., "University of Pennsylvania" not "UPenn")
       - If user mentions categories like "night markets", only extract 1-2 specific examples in ${selectedCity}
       - Ignore vague references that don't point to specific places

       TASK 2 - GENERATE 7 RECOMMENDATIONS:
       Create exactly 7 high-quality recommendations within ${selectedCity} that:
       - Match the user's interests inferred from their wishlist
       - Are well-regarded attractions/destinations
       - Are geographically accessible within ${selectedCity}
       - Are NOT already in the user's wishlist
       - Are NOT generic chains, hotels, or overly niche attractions


       STRICT OUTPUT FORMAT:
       Return ONLY this JSON structure with no additional text:
       {"region":["${selectedCity}"],"locations":[{"name":"Specific Location Name","region":"${selectedCity}"}],"recommendations":[{"name":"Rec 1","region":"${selectedCity}"},{"name":"Rec 2","region":"${selectedCity}"},{"name":"Rec 3","region":"${selectedCity}"},{"name":"Rec 4","region":"${selectedCity}"},{"name":"Rec 5","region":"${selectedCity}"},{"name":"Rec 6","region":"${selectedCity}"},{"name":"Rec 7","region":"${selectedCity}"}]}


       EXAMPLES OF CORRECT BEHAVIOR:
       - User mentions "night markets" → Extract 1 specific market in ${selectedCity}
       - User mentions "temples" → Extract 1 specific temples in ${selectedCity}
       - User mentions "coastal charms" → Extract 1 specific beach/coastal area in ${selectedCity}
       - DO NOT create extensive lists from broad categories
      
       Format: {"region":["${selectedCity}"],"locations":[{"name":"Official Location Name 1","region":"${selectedCity}"},{"name":"Official Location Name 2","region":"${selectedCity}"}],"recommendations":[{"name":"Recommended Location 1","region":"${selectedCity}"},{"name":"Recommended Location 2","region":"${selectedCity}"},{"name":"Recommended Location 3","region":"${selectedCity}"},{"name":"Recommended Location 4","region":"${selectedCity}"},{"name":"Recommended Location 5","region":"${selectedCity}"}]}


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

        const { region, locations, recommendations } = analysisResult;

        if (!region || !Array.isArray(region) || !locations || !Array.isArray(locations) || !recommendations || !Array.isArray(recommendations)) {
            throw new Error('Invalid JSON structure from AI. Missing "region", "locations", or "recommendations".');
        }

        // ----------------------------------------------------------------
        // SINGLE-CITY GEOCODING LOGIC
        // ----------------------------------------------------------------

        // Step 1: Get coordinates for the selected city to create city-specific search bias.
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

        // Step 2: Geocode locations with city-specific bias for maximum accuracy
        const allLocationObjects = [...locations, ...recommendations];
        console.log(`Geocoding ${allLocationObjects.length} locations with city-specific bias.`);
        
        // Process locations in parallel batches to improve performance
        const batchSize = 5; // Process 5 locations at a time to avoid overwhelming the API
        const geocodedLocations = [];
        
        for (let i = 0; i < allLocationObjects.length; i += batchSize) {
            // Check if we're approaching timeout
            if (Date.now() - startTime > maxExecutionTime) {
                console.warn(`Approaching timeout, stopping geocoding at batch ${Math.floor(i/batchSize) + 1}. Processed ${geocodedLocations.length} locations so far.`);
                break;
            }
            
            const batch = allLocationObjects.slice(i, i + batchSize);
            
            // Process current batch in parallel
            const batchPromises = batch.map(async (locationObj) => {
                const { name, region } = locationObj;
                
                console.log(`Geocoding "${name}" in "${region}" with bias:`, cityBias);
                
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
                        console.warn(`No geocoding results for "${name}" in "${region}"`);
                        return [];
                    }
                } catch (error) {
                    console.error(`Error geocoding "${name}" in "${region}":`, error);
                    return [];
                }
            });
            
            // Wait for current batch to complete before processing next batch
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(results => {
                if (results.length > 0) {
                    geocodedLocations.push(...results);
                }
            });
            
            console.log(`Completed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allLocationObjects.length/batchSize)}, total geocoded: ${geocodedLocations.length}`);
        }
        
        console.log('All geocoded locations:', geocodedLocations);
        // Use the geocoded locations we just obtained
        const allLocationsWithCoords = geocodedLocations;

        // Helper function to create activity object
        const createActivityObject = (locationObj, isRecommended = false) => {
            const coordData = allLocationsWithCoords.find(c => c.name === locationObj.name);
            return {
                name: locationObj.name,
                city: locationObj.region, // Include region information as city
                lat: coordData ? coordData.lat : null,
                lng: coordData ? coordData.lng : null,
                rating: coordData ? coordData.rating : null,
                user_ratings_total: coordData ? coordData.user_ratings_total : null,
                formatted_address: coordData ? coordData.formatted_address : null,
                types: coordData ? coordData.types : [], // Keep for backward compatibility
                primaryType: coordData ? coordData.primaryType : null,
                place_id: coordData ? coordData.place_id : null,
                photo_reference: coordData ? coordData.photo_reference : null,
                is_recommended: isRecommended, // Flag to distinguish user's choices from recommendations
                // Enhanced fields
                display_name: coordData ? coordData.display_name : null,
                website_uri: coordData ? coordData.website_uri : null,
                regular_opening_hours: coordData ? coordData.regular_opening_hours : null,
                reviews: coordData ? coordData.reviews : null,
                editorial_summary: coordData ? coordData.editorial_summary : null,
                primary_type_display_name: coordData ? coordData.primary_type_display_name : null,
                international_phone_number: coordData ? coordData.international_phone_number : null,
            };
        };

        // Create final activities array with all activities marked as recommended
        // Filter out any city names from both user locations and recommendations
        const userActivities = locations
            .filter(locationObj => locationObj.name !== selectedCity)
            .map(locationObj => createActivityObject(locationObj, true));
        const recommendedActivities = recommendations
            .filter(locationObj => locationObj.name !== selectedCity)
            .map(locationObj => createActivityObject(locationObj, true));
        
        const finalActivities = [...userActivities, ...recommendedActivities];
        console.log('finalActivities', finalActivities);

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                wishlist_activities: finalActivities,
            })
        };

    } catch (error) {
        console.error('Error in Lambda function:', error);

        // Standardize error response for REST API
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                wishlist_activities: [], // Return an empty array on error
                error: error.message // Include error message for client-side debugging
            })
        };
    }
};