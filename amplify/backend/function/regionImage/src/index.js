/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_REGIONIMAGESTORAGE_ARN
	STORAGE_REGIONIMAGESTORAGE_NAME
	STORAGE_REGIONIMAGESTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

// DynamoDB setup
const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CACHE_TABLE_NAME = process.env.STORAGE_REGIONIMAGESTORAGE_NAME || 'regionImagesTable';

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
        
        // Get city photo reference with caching
        const cityPhotoRef = await getCityPhotoReferenceWithCache(selectedCity);
        
        console.log('Retrieved photo reference:', cityPhotoRef);
        
        // For GraphQL @function directive, return the data directly
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

// Helper function to check DynamoDB cache for region data
const getCachedRegionData = async (regionName) => {
    try {
        const command = new GetCommand({
            TableName: CACHE_TABLE_NAME,
            Key: { 
                regionName: regionName.toLowerCase().trim()
            }
        });
        const result = await docClient.send(command);
        
        if (result.Item) {
            console.log(`Cache HIT for region: ${regionName}`);
            return {
                placeID: result.Item.placeID,
                photoReference: result.Item.photoReference
            };
        }
        console.log(`Cache MISS for region: ${regionName}`);
        return null;
    } catch (error) {
        console.error('Cache read error:', error);
        return null; // Fallback to API call on cache errors
    }
};

// Helper function to store region data in DynamoDB cache
const cacheRegionData = async (regionName, placeID, photoReference) => {
    try {
        const command = new PutCommand({
            TableName: CACHE_TABLE_NAME,
            Item: {
                regionName: regionName.toLowerCase().trim(),
                placeID: placeID,
                photoReference: photoReference,
                createdAt: new Date().toISOString()
            }
        });
        await docClient.send(command);
        console.log(`Successfully cached data for region: ${regionName}`);
    } catch (error) {
        console.error('Cache write error:', error);
        // Don't fail the main operation if caching fails
    }
};

// New cached version of getCityPhotoReference
const getCityPhotoReferenceWithCache = async (cityName) => {
    // Step 1: Check DynamoDB cache first
    const cachedData = await getCachedRegionData(cityName);
    if (cachedData && cachedData.photoReference) {
        console.log(`Returning cached photo reference for ${cityName}: ${cachedData.photoReference}`);
        return cachedData.photoReference;
    }
    
    // Step 2: If cache miss, check if we have placeID cached but missing photo
    let placeId = cachedData?.placeID;
    let photoReference = null;
    
    if (!placeId) {
        // Step 3: No placeID cached, need to call FindPlaceFromText API
        console.log(`No cached placeID for ${cityName}, calling Google Places API`);
        placeId = await getPlaceIdFromGoogle(cityName);
        
        if (!placeId) {
            console.log(`Could not find placeID for ${cityName}`);
            // Cache the negative result to avoid repeated API calls
            await cacheRegionData(cityName, null, null);
            return null;
        }
    }
    
    // Step 4: Get photo reference using placeID (either from cache or fresh API call)
    console.log(`Getting photo reference for placeID: ${placeId}`);
    photoReference = await getPhotoReferenceFromPlaceId(placeId);
    
    // Step 5: Cache the complete result (placeID + photoReference)
    await cacheRegionData(cityName, placeId, photoReference);
    
    return photoReference;
};

// Helper function to get placeID from Google Places FindPlaceFromText API
const getPlaceIdFromGoogle = async (cityName) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!apiKey) {
        console.error('GOOGLE_PLACES_API_KEY environment variable not set');
        return null;
    }
    
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(cityName)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`;
    console.log(`FindPlaceFromText URL: ${searchUrl}`);
    
    return new Promise((resolve) => {
        const searchReq = https.get(searchUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    console.log(`FindPlaceFromText API response: ${data}`);
                    const searchResult = JSON.parse(data);
                    
                    if (searchResult.status === 'OK' && searchResult.candidates && searchResult.candidates.length > 0) {
                        const placeId = searchResult.candidates[0].place_id;
                        console.log(`Found place_id for ${cityName}: ${placeId}`);
                        resolve(placeId);
                    } else {
                        console.log(`City search failed for ${cityName}. Status: ${searchResult.status}`);
                        resolve(null);
                    }
                } catch (e) {
                    console.error(`Error parsing FindPlaceFromText JSON for ${cityName}:`, e);
                    resolve(null);
                }
            });
        });
        
        searchReq.on('error', (err) => {
            console.error(`HTTPS error in FindPlaceFromText for ${cityName}:`, err);
            resolve(null);
        });
    });
};

// Helper function to get photo reference from Google Places Details API using placeID
const getPhotoReferenceFromPlaceId = async (placeId) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!apiKey) {
        console.error('GOOGLE_PLACES_API_KEY environment variable not set');
        return null;
    }
    
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${apiKey}`;
    console.log(`Place Details URL: ${detailsUrl}`);
    
    return new Promise((resolve) => {
        const detailsReq = https.get(detailsUrl, (detailsRes) => {
            let detailsData = '';
            detailsRes.on('data', (chunk) => { detailsData += chunk; });
            detailsRes.on('end', () => {
                try {
                    console.log(`Place Details API response: ${detailsData}`);
                    const detailsResult = JSON.parse(detailsData);
                    
                    if (detailsResult.status === 'OK' && 
                        detailsResult.result && 
                        detailsResult.result.photos && 
                        detailsResult.result.photos.length > 0) {
                        
                        const photoRef = detailsResult.result.photos[0].photo_reference;
                        console.log(`Successfully found photo reference: ${photoRef}`);
                        resolve(photoRef);
                    } else {
                        console.log(`No photos found for placeID ${placeId}. Details result:`, detailsResult);
                        resolve(null);
                    }
                } catch (e) {
                    console.error(`Error parsing Place Details JSON for placeID ${placeId}:`, e);
                    resolve(null);
                }
            });
        });
        
        detailsReq.on('error', (err) => {
            console.error(`HTTPS error getting place details for placeID ${placeId}:`, err);
            resolve(null);
        });
    });
};

// Original function kept for reference (not used anymore)
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
