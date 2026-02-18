/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_SAVEDPLACESSTORAGE_ARN
	STORAGE_SAVEDPLACESSTORAGE_NAME
	STORAGE_SAVEDPLACESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

/**
 * getSavedPlaces Lambda
 *
 * Retrieves saved places for a user from SavedPlacesStorage DynamoDB table.
 * Supports two query modes:
 * 1. Get all saved places for a user (grouped by city)
 * 2. Get saved places for a specific city (using CityIndex GSI)
 *
 * Reference: docs/INSTAGRAM_SHARE_IMPLEMENTATION_PLAN.md
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize AWS clients
const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const SAVED_PLACES_TABLE = process.env.STORAGE_SAVEDPLACESSTORAGE_NAME;

/**
 * Get all saved places for a user
 * @param {string} userID - Cognito user ID
 * @returns {Promise<Array<object>>} - All saved places
 */
async function getAllSavedPlaces(userID) {
    console.log(`[getSavedPlaces] Querying all saved places for userID: ${userID}`);

    const params = {
        TableName: SAVED_PLACES_TABLE,
        KeyConditionExpression: 'userID = :uid',
        ExpressionAttributeValues: {
            ':uid': userID
        }
    };

    let allItems = [];
    let lastEvaluatedKey = null;

    // Handle pagination
    do {
        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await docClient.send(new QueryCommand(params));
        allItems = allItems.concat(result.Items || []);
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`[getSavedPlaces] Found ${allItems.length} saved places`);
    return allItems;
}

/**
 * Get saved places for a specific city using CityIndex GSI
 * @param {string} userID - Cognito user ID
 * @param {string} city - City name to filter by
 * @returns {Promise<Array<object>>} - Saved places for the city
 */
async function getSavedPlacesByCity(userID, city) {
    console.log(`[getSavedPlaces] Querying saved places for userID: ${userID}, city: ${city}`);

    const params = {
        TableName: SAVED_PLACES_TABLE,
        IndexName: 'CityIndex',
        KeyConditionExpression: 'userID = :uid AND city = :city',
        ExpressionAttributeValues: {
            ':uid': userID,
            ':city': city
        }
    };

    let allItems = [];
    let lastEvaluatedKey = null;

    // Handle pagination
    do {
        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await docClient.send(new QueryCommand(params));
        allItems = allItems.concat(result.Items || []);
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`[getSavedPlaces] Found ${allItems.length} saved places for city: ${city}`);
    return allItems;
}

/**
 * Group saved places by city
 * @param {Array<object>} savedPlaces - All saved places
 * @returns {Array<object>} - Cities with counts, sorted by most recently updated
 */
function groupByCity(savedPlaces) {
    const cityMap = {};

    for (const place of savedPlaces) {
        const city = place.city;
        if (!city) continue; // Skip places without a city (they appear in country cards on the frontend)
        const country = place.country || '';
        
        if (!cityMap[city]) {
            cityMap[city] = {
                city: city,
                country: country,
                count: 0,
                places: [],
                lastUpdatedAt: null
            };
        }
        cityMap[city].count++;
        cityMap[city].places.push(place);

        // Track the most recent savedAt timestamp for this city
        const placeSavedAt = place.savedAt;
        if (placeSavedAt) {
            if (!cityMap[city].lastUpdatedAt || placeSavedAt > cityMap[city].lastUpdatedAt) {
                cityMap[city].lastUpdatedAt = placeSavedAt;
            }
        }
    }

    // Convert to array and sort by lastUpdatedAt (most recent first)
    const cities = Object.values(cityMap).sort((a, b) => {
        // If both have timestamps, sort by most recent first
        if (a.lastUpdatedAt && b.lastUpdatedAt) {
            return b.lastUpdatedAt.localeCompare(a.lastUpdatedAt);
        }
        // If only one has a timestamp, prioritize the one with timestamp
        if (a.lastUpdatedAt && !b.lastUpdatedAt) return -1;
        if (!a.lastUpdatedAt && b.lastUpdatedAt) return 1;
        // If neither has a timestamp, sort by count (descending)
        return b.count - a.count;
    });

    console.log(`[getSavedPlaces] Grouped into ${cities.length} cities, sorted by lastUpdatedAt`);
    return cities;
}

/**
 * Main Lambda handler
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log('[getSavedPlaces] Event:', JSON.stringify(event));

    // Parse input - supports GraphQL (@function directive)
    let userID, city;

    if (event.arguments) {
        // GraphQL invocation
        userID = event.arguments.userID;
        city = event.arguments.city;
    } else {
        // Direct Lambda invocation
        userID = event.userID;
        city = event.city;
    }

    // Validate required fields
    if (!userID) {
        const error = 'userID is required';
        console.error('[getSavedPlaces] Validation error:', error);
        throw new Error(error);
    }

    try {
        let result;

        if (city) {
            // Get saved places for a specific city
            const places = await getSavedPlacesByCity(userID, city);
            result = {
                savedPlaces: places,
                cities: null,
                city: city,
                totalCount: places.length
            };
        } else {
            // Get all saved places grouped by city
            const allPlaces = await getAllSavedPlaces(userID);
            const cities = groupByCity(allPlaces);
            result = {
                savedPlaces: allPlaces,
                cities: cities,
                city: null,
                totalCount: allPlaces.length
            };
        }

        console.log('[getSavedPlaces] Returning result:', {
            totalCount: result.totalCount,
            citiesCount: result.cities ? result.cities.length : 0
        });

        return result;
    } catch (error) {
        console.error('[getSavedPlaces] Error:', error);
        throw new Error(`Failed to get saved places: ${error.message}`);
    }
};
