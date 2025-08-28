/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	GOOGLE_PLACES_API_KEY
Amplify Params - DO NOT EDIT */

const https = require('https');

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
    try {
        // Extract selectedCity from GraphQL arguments
        const { selectedCity } = event.arguments || {};
        
        console.log('Processing getRegionImage request for city:', selectedCity);
        
        if (!selectedCity) {
            console.error('selectedCity is required but not provided');
            throw new Error('selectedCity is required');
        }
        
        // Get city photo reference
        const cityPhotoRef = await getCityPhotoReference(selectedCity);
        
        console.log('Retrieved photo reference:', cityPhotoRef);
        
        // For GraphQL @function directive, return the data directly (not wrapped in HTTP response)
        const result = {
            city: selectedCity,
            photo_reference: cityPhotoRef
        };
        
        console.log('Returning result:', JSON.stringify(result));
        return result;
        
    } catch (error) {
        console.error('Error in regionImage handler:', error);
        // For GraphQL errors, return error result with city (non-nullable in schema)
        const errorResult = {
            city: event.arguments?.selectedCity || 'Unknown',
            photo_reference: null
        };
        console.log('Returning error result:', JSON.stringify(errorResult));
        return errorResult;
    }
};

// Helper function to get city photo reference from Google Places API
const getCityPhotoReference = async (cityName) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    console.log(`Starting getCityPhotoReference for city: ${cityName}`);
    
    if (!apiKey) {
        console.error('GOOGLE_PLACES_API_KEY environment variable not set');
        return null;
    }
    
    // First, find the place using Places API Text Search
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(cityName)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`;
    console.log(`Search URL: ${searchUrl}`);
    
    return new Promise((resolve) => {
        const searchReq = https.get(searchUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', async () => {
                try {
                    console.log(`Search API response: ${data}`);
                    const searchResult = JSON.parse(data);
                    
                    if (searchResult.status === 'OK' && searchResult.candidates && searchResult.candidates.length > 0) {
                        const placeId = searchResult.candidates[0].place_id;
                        console.log(`Found place_id for ${cityName}: ${placeId}`);
                        
                        // Get place details including photos
                        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${apiKey}`;
                        console.log(`Details URL: ${detailsUrl}`);
                        
                        const detailsReq = https.get(detailsUrl, (detailsRes) => {
                            let detailsData = '';
                            detailsRes.on('data', (chunk) => { detailsData += chunk; });
                            detailsRes.on('end', () => {
                                try {
                                    console.log(`Details API response: ${detailsData}`);
                                    const detailsResult = JSON.parse(detailsData);
                                    
                                    if (detailsResult.status === 'OK' && 
                                        detailsResult.result && 
                                        detailsResult.result.photos && 
                                        detailsResult.result.photos.length > 0) {
                                        
                                        const photoRef = detailsResult.result.photos[0].photo_reference;
                                        console.log(`Successfully found photo reference for ${cityName}: ${photoRef}`);
                                        resolve(photoRef);
                                    } else {
                                        console.log(`No photos found for ${cityName}. Details result:`, detailsResult);
                                        resolve(null);
                                    }
                                } catch (e) {
                                    console.error(`Error parsing place details JSON for ${cityName}:`, e);
                                    console.error(`Raw details data: ${detailsData}`);
                                    resolve(null);
                                }
                            });
                        });
                        
                        detailsReq.on('error', (err) => {
                            console.error(`HTTPS error getting place details for ${cityName}:`, err);
                            resolve(null);
                        });
                        
                    } else {
                        console.log(`City search failed for ${cityName}. Search result:`, searchResult);
                        resolve(null);
                    }
                } catch (e) {
                    console.error(`Error parsing search results JSON for ${cityName}:`, e);
                    console.error(`Raw search data: ${data}`);
                    resolve(null);
                }
            });
        });
        
        searchReq.on('error', (err) => {
            console.error(`HTTPS error searching for city ${cityName}:`, err);
            resolve(null);
        });
    });
};
