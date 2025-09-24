/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_PLACESAPIACTIVITYSTORAGE_NAME
	STORAGE_PLACESAPIACTIVITYSTORAGE_ARN
	STORAGE_PLACESAPIACTIVITYSTORAGE_STREAMARN
	GOOGLE_PLACES_API_KEY
Amplify Params - DO NOT EDIT */

const AWS = require('aws-sdk');
const https = require('https');

// Initialize DynamoDB client
const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.STORAGE_PLACESAPIACTIVITYSTORAGE_NAME;
const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;

/**
 * Lambda function to generate activities for a specific category using Google Places API
 * Leverages existing caching and deduplication patterns from getLocationCoordinates and CityCategories
 */
exports.handler = async (event) => {
    console.log('generateCategoryActivities input:', JSON.stringify(event, null, 2));

    try {
        const { selectedCity, category, count = 4, existingActivityIds = [] } = event.arguments || event;

        if (!selectedCity || !category) {
            throw new Error('selectedCity and category are required parameters');
        }

        // Check cache first (similar to CityCategories pattern)
        const cacheKey = `category-activities-${selectedCity}-${category}-${count}`;
        const cachedResult = await getCachedResult(cacheKey);

        if (cachedResult) {
            console.log('Returning cached category activities');
            // Apply deduplication to cached results
            const deduplicatedActivities = deduplicateActivities(cachedResult.activities, existingActivityIds);
            return {
                activities: deduplicatedActivities.slice(0, count),
                category: category
            };
        }

        // Generate category-specific search query
        const searchQuery = buildCategorySearchQuery(category, selectedCity);
        console.log('Search query:', searchQuery);

        // Search for places using Google Places Text Search API
        const searchResults = await searchPlacesByCategory(searchQuery, selectedCity, count * 2); // Get extra for deduplication

        if (!searchResults || searchResults.length === 0) {
            console.log('No places found for category:', category);
            return {
                activities: [],
                category: category
            };
        }

        // Get detailed information for each place (reusing getLocationCoordinates logic)
        const detailedActivities = await Promise.all(
            searchResults.map(place => getPlaceDetails(place.place_id, selectedCity))
        );

        // Filter out null results and apply deduplication
        const validActivities = detailedActivities.filter(activity => activity !== null);
        const deduplicatedActivities = deduplicateActivities(validActivities, existingActivityIds);
        const finalActivities = deduplicatedActivities.slice(0, count);

        // Cache the result (cache more than we return for future requests)
        await cacheResult(cacheKey, {
            activities: validActivities,
            category: category,
            timestamp: new Date().toISOString()
        });

        console.log(`Returning ${finalActivities.length} activities for category: ${category}`);

        return {
            activities: finalActivities,
            category: category
        };

    } catch (error) {
        console.error('Error in generateCategoryActivities:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to generate category activities',
                details: error.message
            })
        };
    }
};

/**
 * Build category-specific search query for Google Places API
 * Uses category mapping similar to CityCategories Lambda
 */
function buildCategorySearchQuery(category, city) {
    const categoryMappings = {
        'Museums': `museums in ${city}`,
        'Restaurants': `best restaurants in ${city}`,
        'Shopping': `shopping centers malls in ${city}`,
        'Parks': `parks gardens in ${city}`,
        'Entertainment': `entertainment venues attractions in ${city}`,
        'Nightlife': `bars clubs nightlife in ${city}`,
        'Culture': `cultural sites temples churches in ${city}`,
        'Food Markets': `food markets street food in ${city}`,
        'Viewpoints': `viewpoints observation decks in ${city}`,
        'Sports': `sports venues stadiums in ${city}`,
        'Art': `art galleries exhibitions in ${city}`,
        'History': `historical sites monuments in ${city}`,
        'Nature': `nature reserves hiking trails in ${city}`,
        'Adventure': `adventure activities outdoor sports in ${city}`,
        'Family': `family attractions kid-friendly in ${city}`,
        'Relaxation': `spas wellness centers in ${city}`,
        'Local Experiences': `local experiences authentic places in ${city}`,
        'Street Food': `street food vendors markets in ${city}`,
        'Rooftop Bars': `rooftop bars sky lounges in ${city}`,
        'Hidden Gems': `hidden gems secret spots in ${city}`
    };

    return categoryMappings[category] || `${category} in ${city}`;
}

/**
 * Search for places using Google Places Text Search API
 * Based on getLocationCoordinates API call pattern
 */
async function searchPlacesByCategory(query, city, maxResults = 10) {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
            `query=${encodeURIComponent(query)}&` +
            `key=${googlePlacesApiKey}&` +
            `type=point_of_interest`;

        const searchResponse = await makeHttpsRequest(url);
        const searchData = JSON.parse(searchResponse);

        if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
            throw new Error(`Places API search failed: ${searchData.status} - ${searchData.error_message}`);
        }

        if (searchData.status === 'ZERO_RESULTS') {
            console.log('No results found for query:', query);
            return [];
        }

        // Return up to maxResults places
        return searchData.results.slice(0, maxResults).map(place => ({
            place_id: place.place_id,
            name: place.name,
            rating: place.rating,
            geometry: place.geometry
        }));

    } catch (error) {
        console.error('Error searching places:', error);
        throw error;
    }
}

/**
 * Get detailed place information using Place Details API
 * Reuses exact logic from getLocationCoordinates Lambda
 */
async function getPlaceDetails(placeId, city) {
    try {
        // Check if we have this place cached first
        const cachedPlace = await getCachedPlace(placeId);
        if (cachedPlace) {
            console.log('Returning cached place details for:', placeId);
            return cachedPlace;
        }

        const fields = [
            'name', 'geometry', 'formatted_address', 'rating', 'user_ratings_total',
            'types', 'place_id', 'photos', 'reviews', 'opening_hours', 'website',
            'editorial_summary', 'primary_type_display_name', 'international_phone_number'
        ].join(',');

        const url = `https://maps.googleapis.com/maps/api/place/details/json?` +
            `place_id=${placeId}&` +
            `fields=${fields}&` +
            `key=${googlePlacesApiKey}`;

        const response = await makeHttpsRequest(url);
        const data = JSON.parse(response);

        if (data.status !== 'OK') {
            console.error(`Place details API failed for ${placeId}: ${data.status}`);
            return null;
        }

        const place = data.result;

        // Transform to Activity schema (exact mapping from getLocationCoordinates)
        const activity = {
            name: place.name || 'Unknown',
            city: city,
            lat: place.geometry?.location?.lat || 0,
            lng: place.geometry?.location?.lng || 0,
            rating: place.rating || null,
            user_ratings_total: place.user_ratings_total || null,
            formatted_address: place.formatted_address || '',
            types: place.types || [],
            primaryType: place.types?.[0] || '',
            place_id: place.place_id || '',
            photo_reference: place.photos?.[0]?.photo_reference || '',
            is_recommended: true, // Category-generated activities are considered recommended
            display_name: place.name || '',
            website_uri: place.website || '',
            regular_opening_hours: place.opening_hours ? {
                open_now: place.opening_hours.open_now,
                periods: place.opening_hours.periods?.map(period => ({
                    open: period.open ? {
                        day: period.open.day,
                        time: period.open.time,
                        date: period.open.date,
                        truncated: period.open.truncated
                    } : null,
                    close: period.close ? {
                        day: period.close.day,
                        time: period.close.time,
                        date: period.close.date,
                        truncated: period.close.truncated
                    } : null
                })) || [],
                weekday_text: place.opening_hours.weekday_text || []
            } : null,
            reviews: place.reviews?.slice(0, 3).map(review => ({
                author_name: review.author_name || '',
                rating: review.rating || 0,
                text: review.text || '',
                time: review.time || 0,
                author_url: review.author_url || '',
                profile_photo_url: review.profile_photo_url || ''
            })) || [],
            editorial_summary: place.editorial_summary || '',
            primary_type_display_name: place.primary_type_display_name || '',
            international_phone_number: place.international_phone_number || ''
        };

        // Cache the result for future requests
        await cachePlace(placeId, activity);

        return activity;

    } catch (error) {
        console.error('Error getting place details for:', placeId, error);
        return null;
    }
}

/**
 * Deduplication logic - remove activities that already exist
 * Based on addAdditionalPlace deduplication pattern
 */
function deduplicateActivities(activities, existingActivityIds) {
    if (!existingActivityIds || existingActivityIds.length === 0) {
        return activities;
    }

    const existingIdSet = new Set(existingActivityIds);
    return activities.filter(activity => !existingIdSet.has(activity.place_id));
}

/**
 * Cache management functions - based on CityCategories caching pattern
 */
async function getCachedResult(cacheKey) {
    try {
        const params = {
            TableName: tableName,
            Key: { id: cacheKey }
        };

        const result = await dynamodb.get(params).promise();

        if (result.Item) {
            // Check if cache is still valid (24 hours TTL)
            const cacheTime = new Date(result.Item.timestamp);
            const now = new Date();
            const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);

            if (hoursDiff < 24) {
                return result.Item;
            } else {
                // Cache expired, delete it
                await dynamodb.delete(params).promise();
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting cached result:', error);
        return null;
    }
}

async function cacheResult(cacheKey, data) {
    try {
        const params = {
            TableName: tableName,
            Item: {
                id: cacheKey,
                ...data,
                ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours TTL
            }
        };

        await dynamodb.put(params).promise();
        console.log('Cached result for key:', cacheKey);
    } catch (error) {
        console.error('Error caching result:', error);
    }
}

async function getCachedPlace(placeId) {
    try {
        const params = {
            TableName: tableName,
            Key: { id: placeId }
        };

        const result = await dynamodb.get(params).promise();
        return result.Item || null;
    } catch (error) {
        console.error('Error getting cached place:', error);
        return null;
    }
}

async function cachePlace(placeId, activity) {
    try {
        const params = {
            TableName: tableName,
            Item: {
                id: placeId,
                ...activity,
                timestamp: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days TTL for places
            }
        };

        await dynamodb.put(params).promise();
    } catch (error) {
        console.error('Error caching place:', error);
    }
}

/**
 * HTTP request helper - reused from existing Lambda functions
 */
function makeHttpsRequest(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                resolve(data);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.setTimeout(10000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}
