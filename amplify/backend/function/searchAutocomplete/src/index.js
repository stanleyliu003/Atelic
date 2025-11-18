/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	GOOGLE_PLACES_API_KEY
Amplify Params - DO NOT EDIT */

const https = require('https');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const lambdaClient = new LambdaClient({ region: process.env.REGION });

/**
 * Lambda function to generate search autocomplete suggestions using Google Places Autocomplete API
 * Returns 5 specific place suggestions with name, address_info, and place_id
 */
exports.handler = async (event) => {
    console.log('searchAutocomplete input:', JSON.stringify(event, null, 2));

    try {
        const { selectedCity, query, filters = [] } = event.arguments || event;

        if (!selectedCity) {
            throw new Error('selectedCity is required');
        }

        if (!query || query.trim().length === 0) {
            return {
                suggestions: []
            };
        }

        // Check for API key
        if (!process.env.GOOGLE_PLACES_API_KEY) {
            console.error('GOOGLE_PLACES_API_KEY environment variable not set');
            throw new Error('GOOGLE_PLACES_API_KEY not configured');
        }

        console.log(`Calling Google Places Autocomplete API for: "${query}" in ${selectedCity} with filters: [${filters.join(', ')}]`);

        // Step 1: Get city coordinates for location bias
        const cityCoordinates = await getCityCoordinates(selectedCity);

        if (!cityCoordinates || !cityCoordinates.lat || !cityCoordinates.lng) {
            console.error(`Could not get coordinates for city: ${selectedCity}`);
            throw new Error(`Unable to determine location for ${selectedCity}`);
        }

        console.log(`City coordinates for ${selectedCity}: ${cityCoordinates.lat}, ${cityCoordinates.lng}`);

        // Step 2: Call Google Places Autocomplete API with location bias
        const suggestions = await getPlacesAutocomplete(
            query,
            cityCoordinates.lat,
            cityCoordinates.lng,
            filters
        );

        console.log(`Successfully generated ${suggestions.length} place suggestions for query: ${query}`);

        return {
            suggestions: suggestions
        };

    } catch (error) {
        console.error('Error in searchAutocomplete:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to generate autocomplete suggestions',
                details: error.message
            })
        };
    }
};

/**
 * Get coordinates for a city by calling getLocationCoordinates Lambda
 */
async function getCityCoordinates(cityName) {
    try {
        const functionName = `getLocationCoordinates-${process.env.ENV}`;

        const payload = {
            arguments: {
                placeName: cityName,
                selectedCity: cityName
            }
        };

        console.log(`Invoking ${functionName} to get coordinates for: ${cityName}`);

        const command = new InvokeCommand({
            FunctionName: functionName,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(payload)
        });

        const response = await lambdaClient.send(command);
        const result = JSON.parse(Buffer.from(response.Payload).toString());

        console.log(`getLocationCoordinates response:`, result);

        if (result && result.lat && result.lng) {
            return {
                lat: result.lat,
                lng: result.lng
            };
        }

        return null;
    } catch (error) {
        console.error(`Error getting city coordinates for ${cityName}:`, error);
        return null;
    }
}

/**
 * Call Google Places Autocomplete API and return formatted suggestions
 */
async function getPlacesAutocomplete(query, cityLat, cityLng, filters) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    // Build the autocomplete URL
    // Using establishment type to get specific places (not addresses)
    // Location bias helps prioritize results near the city center
    // Radius of 50km (50000 meters) to cover the city area
    const radius = 50000; // 50km in meters

    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
        `input=${encodeURIComponent(query)}` +
        `&location=${cityLat},${cityLng}` +
        `&radius=${radius}` +
        `&types=establishment` +
        `&key=${apiKey}`;

    console.log(`Places Autocomplete API URL (key hidden): ${url.replace(apiKey, 'HIDDEN')}`);

    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);

                    if (result.status === 'OK' && result.predictions && result.predictions.length > 0) {
                        // Transform predictions to our suggestion format
                        // Get top 5 results
                        const suggestions = result.predictions.slice(0, 5).map(prediction => {
                            // structured_formatting contains:
                            // - main_text: the place name (e.g., "Tokyo National Museum")
                            // - secondary_text: the address info (e.g., "Ueno Park, Taito City, Tokyo")

                            const mainText = prediction.structured_formatting?.main_text || prediction.description;
                            const secondaryText = prediction.structured_formatting?.secondary_text || '';

                            return {
                                name: mainText,
                                address_info: secondaryText,
                                place_id: prediction.place_id
                            };
                        });

                        console.log(`Parsed ${suggestions.length} autocomplete suggestions`);
                        resolve(suggestions);

                    } else if (result.status === 'ZERO_RESULTS') {
                        console.log(`No autocomplete results found for query: ${query}`);
                        resolve([]);

                    } else {
                        console.error(`Places Autocomplete API error. Status: ${result.status}`, result);
                        resolve([]);
                    }

                } catch (parseError) {
                    console.error('Error parsing Places Autocomplete response:', parseError);
                    console.error('Raw response:', data);
                    reject(new Error('Failed to parse autocomplete response'));
                }
            });
        });

        req.on('error', (err) => {
            console.error('HTTPS request error for Places Autocomplete:', err);
            reject(err);
        });
    });
}