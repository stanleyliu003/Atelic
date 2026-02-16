/* Amplify Params - DO NOT EDIT
	ENV
	FUNCTION_GETLOCATIONCOORDINATES_NAME
	FUNCTION_GETUSERPROFILE_NAME
	REGION
	STORAGE_PLACESAPIACTIVITYSTORAGE_ARN
	STORAGE_PLACESAPIACTIVITYSTORAGE_NAME
	STORAGE_PLACESAPIACTIVITYSTORAGE_STREAMARN
	STORAGE_SAVEDPLACESSTORAGE_ARN
	STORAGE_SAVEDPLACESSTORAGE_NAME
	STORAGE_SAVEDPLACESSTORAGE_STREAMARN
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

/**
 * processInstagramShare Lambda
 *
 * Processes Instagram posts/reels shared via iOS Share Extension:
 * 1. Scrapes Instagram post using Apify
 * 2. Downloads media (images/videos)
 * 3. Extracts place names using Gemini 2.0 Flash
 * 4. Resolves places via Google Places API
 * 5. Saves to SavedPlacesStorage DynamoDB table
 *
 * Reference: docs/INSTAGRAM_SHARE_IMPLEMENTATION_PLAN.md
 */

const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

// Import modules
const { scrapeInstagram } = require('./instagramScraper');
const { downloadAllMedia } = require('./mediaProcessor');
const { extractPlacesWithGemini } = require('./geminiExtractor');

// Initialize AWS clients
const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const lambdaClient = new LambdaClient({ region: process.env.REGION });

const SAVED_PLACES_TABLE = process.env.STORAGE_SAVEDPLACESSTORAGE_NAME;
const GET_LOCATION_COORDINATES_FUNCTION = process.env.FUNCTION_GETLOCATIONCOORDINATES_NAME;
const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;

// Cache configuration
const EXTRACTION_CACHE_TTL_DAYS = 90; // Instagram posts rarely change
const CACHE_TABLE = process.env.STORAGE_PLACESAPIACTIVITYSTORAGE_NAME || 'PlacesAPIActivityStorage';

/**
 * Resolve extracted places to Activity objects by invoking getLocationCoordinates Lambda
 * @param {Array<object>} extractedPlaces - Places from Gemini extraction [{name, city}]
 * @returns {Promise<Array<object>>} - Activity objects
 */
async function resolvePlaces(extractedPlaces) {
    if (!extractedPlaces || extractedPlaces.length === 0) {
        console.log('[index] No places to resolve');
        return [];
    }

    console.log(`[index] Resolving ${extractedPlaces.length} places via getLocationCoordinates (PARALLEL)...`);

    // Resolve all places in parallel using Promise.all
    const resolutionPromises = extractedPlaces.map(async (extractedPlace) => {
        try {
            // Build search query with city context for better accuracy
            const placeName = extractedPlace.city
                ? `${extractedPlace.name}, ${extractedPlace.city}`
                : extractedPlace.name;

            console.log(`[index] Resolving place: ${placeName}`);

            // Invoke getLocationCoordinates Lambda in GraphQL mode
            const payload = {
                arguments: {
                    placeName: placeName,
                    selectedCity: extractedPlace.city || null
                }
            };

            const command = new InvokeCommand({
                FunctionName: GET_LOCATION_COORDINATES_FUNCTION,
                Payload: JSON.stringify(payload)
            });

            const response = await lambdaClient.send(command);

            // Parse response
            const responsePayload = JSON.parse(Buffer.from(response.Payload).toString());

            if (responsePayload && responsePayload.place_id) {
                console.log(`[index] Resolved: ${responsePayload.name} (${responsePayload.place_id})`);
                return responsePayload; // Return the activity
            } else if (responsePayload && responsePayload.error) {
                console.log(`[index] Could not resolve place: ${placeName} - ${responsePayload.error}`);
                return null;
            } else {
                console.log(`[index] No result for place: ${placeName}`);
                return null;
            }
        } catch (error) {
            console.error(`[index] Error resolving place ${extractedPlace.name}:`, error.message);
            return null; // Return null for failed resolutions
        }
    });

    // Wait for all resolutions to complete
    const results = await Promise.all(resolutionPromises);

    // Filter out null values (failed resolutions)
    const activities = results.filter((activity) => activity !== null);

    console.log(`[index] Successfully resolved ${activities.length}/${extractedPlaces.length} places`);
    return activities;
}

/**
 * Count total saved places for a user (efficient COUNT-only query with pagination)
 * @param {string} userID - Cognito user ID
 * @returns {Promise<number>} - Total count of saved places
 */
async function getUserSavedPlacesCount(userID) {
    let totalCount = 0;
    let lastEvaluatedKey = null;

    do {
        const params = {
            TableName: SAVED_PLACES_TABLE,
            KeyConditionExpression: 'userID = :uid',
            ExpressionAttributeValues: {
                ':uid': userID
            },
            Select: 'COUNT'
        };

        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await docClient.send(new QueryCommand(params));
        totalCount += result.Count || 0;
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`[index] User ${userID} has ${totalCount} saved places`);
    return totalCount;
}

/**
 * Check if user has admin_permission via UserProfilesStorage (GSI lookup by userID)
 * @param {string} userID - Cognito user ID
 * @returns {Promise<boolean>} - true if admin
 */
async function getUserAdminPermission(userID) {
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: USER_PROFILES_TABLE,
            IndexName: 'userID-index',
            KeyConditionExpression: 'userID = :uid',
            ExpressionAttributeValues: { ':uid': userID },
            ProjectionExpression: 'admin_permission',
            Limit: 1
        }));
        return result.Items?.[0]?.admin_permission === true;
    } catch (error) {
        console.error('[index] Error fetching admin_permission:', error);
        return false;
    }
}

/**
 * Check if user already saved places from this Instagram post (with pagination)
 * @param {string} userID - Cognito user ID
 * @param {string} sourcePostId - Instagram shortcode
 * @returns {Promise<boolean>} - True if duplicate exists
 */
async function checkDuplicate(userID, sourcePostId) {
    console.log(`[index] Checking for duplicate: userID=${userID}, sourcePostId=${sourcePostId}`);

    let lastEvaluatedKey = null;
    let pageCount = 0;

    do {
        pageCount++;
        console.log(`[index] Scanning page ${pageCount} for duplicate sourcePostId...`);

        const params = {
            TableName: SAVED_PLACES_TABLE,
            KeyConditionExpression: 'userID = :uid',
            FilterExpression: 'sourcePostId = :postId',
            ExpressionAttributeValues: {
                ':uid': userID,
                ':postId': sourcePostId
            }
        };

        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await docClient.send(new QueryCommand(params));

        // If we found a match, return immediately
        if (result.Items && result.Items.length > 0) {
            console.log(`[index] Duplicate found on page ${pageCount}`);
            return true;
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`[index] No duplicate found after scanning ${pageCount} page(s)`);
    return false;
}

/**
 * Check if extraction results are cached for this Instagram post
 * @param {string} shortCode - Instagram post shortcode
 * @returns {Promise<object|null>} - Cached extraction data or null
 */
async function getCachedExtraction(shortCode) {
    try {
        const result = await docClient.send(new GetCommand({
            TableName: CACHE_TABLE,
            Key: {
                cache_type: 'instagram_extraction',
                cache_key: shortCode
            }
        }));

        if (result.Item) {
            const now = Math.floor(Date.now() / 1000);
            if (result.Item.ttl && result.Item.ttl > now) {
                console.log(`[index] Extraction cache HIT for shortCode: ${shortCode}`);
                return result.Item.data;
            }
            console.log(`[index] Extraction cache EXPIRED for shortCode: ${shortCode}`);
        }

        console.log(`[index] Extraction cache MISS for shortCode: ${shortCode}`);
        return null;
    } catch (error) {
        console.error(`[index] Extraction cache lookup error:`, error);
        return null; // Continue with normal flow on cache error
    }
}

/**
 * Cache extraction results for future users sharing the same post
 * @param {string} shortCode - Instagram post shortcode
 * @param {Array} extractedPlaces - Places extracted by Gemini
 * @param {object} scrapedData - Original scraped data
 */
async function cacheExtraction(shortCode, extractedPlaces, scrapedData) {
    try {
        const ttl = Math.floor(Date.now() / 1000) + (EXTRACTION_CACHE_TTL_DAYS * 24 * 60 * 60);

        await docClient.send(new PutCommand({
            TableName: CACHE_TABLE,
            Item: {
                cache_type: 'instagram_extraction',
                cache_key: shortCode,
                data: {
                    extractedPlaces: extractedPlaces,
                    postType: scrapedData.type,
                    caption: scrapedData.caption?.substring(0, 500), // Truncate for storage
                    ownerUsername: scrapedData.ownerUsername,
                    extractedAt: new Date().toISOString()
                },
                ttl: ttl
            }
        }));

        console.log(`[index] Cached extraction for shortCode: ${shortCode}, TTL: ${EXTRACTION_CACHE_TTL_DAYS} days`);
    } catch (error) {
        console.error(`[index] Failed to cache extraction:`, error);
        // Non-fatal: continue even if caching fails
    }
}

/**
 * Check if a place already exists for a user (with pagination)
 * @param {string} userID - Cognito user ID
 * @param {string} placeId - Google place_id (globally unique)
 * @returns {Promise<boolean>} - True if place already exists
 */
async function placeExistsForUser(userID, placeId) {
    let lastEvaluatedKey = null;
    let pageCount = 0;

    do {
        pageCount++;
        console.log(`[index] Scanning page ${pageCount} for place_id: ${placeId}...`);

        const params = {
            TableName: SAVED_PLACES_TABLE,
            KeyConditionExpression: 'userID = :uid',
            FilterExpression: 'activity.place_id = :placeId',
            ExpressionAttributeValues: {
                ':uid': userID,
                ':placeId': placeId
            }
        };

        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await docClient.send(new QueryCommand(params));

        // If we found a match, return immediately
        if (result.Items && result.Items.length > 0) {
            console.log(`[index] Place exists - found on page ${pageCount}`);
            return true;
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`[index] Place does not exist - scanned ${pageCount} page(s)`);
    return false;
}

/**
 * Extract country from city string (format: "City, Country")
 * @param {string} city - City string (e.g., "Rome, Italy")
 * @returns {string} - Extracted country or empty string
 */
function extractCountry(city) {
    if (!city || typeof city !== 'string') {
        return '';
    }
    
    const parts = city.split(',').map(part => part.trim());
    // If there's a comma, the last part is typically the country
    if (parts.length >= 2) {
        return parts[parts.length - 1];
    }
    
    return '';
}

/**
 * Save extracted places to DynamoDB (skips duplicates by place_id)
 * Note: place_id is globally unique across all locations, so no city filtering needed
 * @param {string} userID - Cognito user ID
 * @param {Array<object>} activities - Activity objects from place resolver
 * @param {object} scrapedData - Original Instagram post data
 * @returns {Promise<{savedPlaces: Array<object>, skippedCount: number}>} - Saved place records and skipped count
 */
async function savePlaces(userID, activities, scrapedData) {
    console.log(`[index] Saving ${activities.length} places for user ${userID}`);

    const savedPlaces = [];
    const now = new Date().toISOString();
    let skippedCount = 0;

    for (const activity of activities) {
        const city = activity.city || '';
        const country = extractCountry(city);

        // Skip if this place_id already exists for this user (place_id is globally unique)
        if (activity.place_id && await placeExistsForUser(userID, activity.place_id)) {
            console.log(`[index] Skipping duplicate: ${activity.name} (${activity.place_id})`);
            skippedCount++;
            continue;
        }

        // Copy source and sourceUrl into the activity object itself
        // This ensures they persist when activities are added to trips
        const activityWithSource = {
            ...activity,
            source: 'instagram',
            sourceUrl: scrapedData.url
        };

        const savedPlace = {
            userID,
            savedPlaceId: crypto.randomUUID(),
            activity: activityWithSource,
            source: 'instagram',
            sourceUrl: scrapedData.url,
            sourcePostId: scrapedData.shortCode,
            sourceUsername: scrapedData.ownerUsername,
            city: city,
            country: country,
            savedAt: now
        };

        await docClient.send(
            new PutCommand({
                TableName: SAVED_PLACES_TABLE,
                Item: savedPlace
            })
        );

        console.log(`[index] Saved place: ${activity.name} (${savedPlace.savedPlaceId}) - City: ${city}, Country: ${country}`);
        savedPlaces.push(savedPlace);
    }

    console.log(`[index] Saved ${savedPlaces.length} places, skipped ${skippedCount} duplicates`);
    return { savedPlaces, skippedCount };
}

/**
 * Main Lambda handler
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log('[index] processInstagramShare event:', JSON.stringify(event));

    // Parse input - supports both GraphQL (@function directive) and direct invocation
    let instagramUrl, userID;

    if (event.arguments) {
        // GraphQL invocation
        instagramUrl = event.arguments.instagramUrl;
        userID = event.arguments.userID;
    } else if (event.body) {
        // REST API invocation
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        instagramUrl = body.instagramUrl;
        userID = body.userID;
    } else {
        // Direct Lambda invocation
        instagramUrl = event.instagramUrl;
        userID = event.userID;
    }

    // Validate required fields
    if (!instagramUrl) {
        const error = 'instagramUrl is required';
        console.error('[index] Validation error:', error);
        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, error })
        };
    }

    if (!userID) {
        const error = 'userID is required';
        console.error('[index] Validation error:', error);
        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, error })
        };
    }

    console.log(`[index] Processing Instagram share: url=${instagramUrl}, userID=${userID}`);

    try {
        // Step 0: Check saved places limit (skip for admin users)
        console.log('[index] Step 0: Checking saved places limit...');
        const isAdmin = await getUserAdminPermission(userID);
        if (!isAdmin) {
            const savedPlacesCount = await getUserSavedPlacesCount(userID);
            if (savedPlacesCount > 10) {
                console.log(`[index] User ${userID} has ${savedPlacesCount} saved places, exceeds limit of 10`);
                return {
                    statusCode: 429,
                    body: JSON.stringify({
                        success: false,
                        error: 'LIMIT_EXCEEDED',
                        message: 'Exceeded sharing limit for this week.'
                    })
                };
            }
        } else {
            console.log(`[index] User ${userID} has admin_permission, skipping limit check`);
        }

        // Step 1: Scrape Instagram post
        console.log('[index] Step 1: Scraping Instagram post...');
        const scrapedData = await scrapeInstagram(instagramUrl);

        // Step 2: Check for duplicate (same post already saved by this user)
        console.log('[index] Step 2: Checking for user-level duplicates...');
        const isDuplicate = await checkDuplicate(userID, scrapedData.shortCode);
        if (isDuplicate) {
            console.log('[index] User-level duplicate detected, returning early');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    savedPlaces: [],
                    message: 'You already saved places from this post',
                    isDuplicate: true
                })
            };
        }

        // Step 3: Check extraction cache (cross-user optimization)
        console.log('[index] Step 3: Checking extraction cache...');
        let extractedPlaces = null;
        const cachedExtraction = await getCachedExtraction(scrapedData.shortCode);

        if (cachedExtraction) {
            // Cache HIT - skip Apify media download and Gemini processing
            console.log('[index] ✓ Cache HIT - Using cached extraction (skipping media download and Gemini)');
            extractedPlaces = cachedExtraction.extractedPlaces;
        } else {
            // Cache MISS - full processing
            console.log('[index] ✗ Cache MISS - Performing full extraction');
            
            // Step 4: Download media
            console.log('[index] Step 4: Downloading media...');
            const mediaBuffers = await downloadAllMedia(scrapedData);

            // Step 5: Extract places with Gemini (media type dependent processing)
            console.log(`[index] Step 5: Extracting places with Gemini (media type: ${scrapedData.type})...`);
            extractedPlaces = await extractPlacesWithGemini(
                scrapedData.caption,
                mediaBuffers,
                scrapedData.type, // 'Video', 'Image', or 'Sidecar' from Apify
                scrapedData.locationName
            );

            // Cache the extraction for future users
            if (extractedPlaces && extractedPlaces.length > 0) {
                await cacheExtraction(scrapedData.shortCode, extractedPlaces, scrapedData);
            }
        }

        if (!extractedPlaces || extractedPlaces.length === 0) {
            console.log('[index] No places found in content');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    savedPlaces: [],
                    message: 'No travel places found in this post'
                })
            };
        }

        // Step 6: Resolve places via Google Places API
        console.log('[index] Step 6: Resolving places via Google Places API...');
        const activities = await resolvePlaces(extractedPlaces);

        if (activities.length === 0) {
            console.log('[index] No places could be resolved');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    savedPlaces: [],
                    message: 'Could not find the mentioned places on Google Maps'
                })
            };
        }

        // Step 7: Save to DynamoDB (skips duplicates by place_id)
        console.log('[index] Step 7: Saving places to DynamoDB...');
        const { savedPlaces, skippedCount } = await savePlaces(userID, activities, scrapedData);

        // Build response message
        let message;
        if (savedPlaces.length === 0 && skippedCount > 0) {
            message = `All ${skippedCount} place${skippedCount !== 1 ? 's' : ''} from this post were already saved`;
        } else if (skippedCount > 0) {
            message = `Saved ${savedPlaces.length} new place${savedPlaces.length !== 1 ? 's' : ''}, ${skippedCount} already saved`;
        } else {
            message = `Found ${savedPlaces.length} place${savedPlaces.length !== 1 ? 's' : ''} from this post`;
        }

        // Build response
        const response = {
            success: true,
            savedPlaces: savedPlaces.map((sp) => ({
                savedPlaceId: sp.savedPlaceId,
                activity: sp.activity,
                source: sp.source,
                sourceUrl: sp.sourceUrl,
                city: sp.city,
                country: sp.country
            })),
            skippedCount,
            message
        };

        console.log('[index] Processing complete:', response.message);

        return {
            statusCode: 200,
            body: JSON.stringify(response)
        };
    } catch (error) {
        console.error('[index] Error processing Instagram share:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message || 'Failed to process Instagram share'
            })
        };
    }
};
