/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_PLACESAPIACTIVITYSTORAGE_NAME
	STORAGE_PLACESAPIACTIVITYSTORAGE_ARN
	STORAGE_PLACESAPIACTIVITYSTORAGE_STREAMARN
	PHOTO_S3BUCKET_NAME
	CLOUDFRONT_DOMAIN
	GOOGLE_PLACES_API_KEY
Amplify Params - DO NOT EDIT */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const https = require('https');
const crypto = require('crypto');

// Initialize clients
const s3Client = new S3Client({ region: process.env.REGION });
const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// Configuration
const PHOTO_BUCKET = process.env.PHOTO_S3BUCKET_NAME;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CACHE_TABLE = process.env.STORAGE_PLACESAPIACTIVITYSTORAGE_NAME;
const PHOTO_CACHE_TTL_DAYS = 90;

/**
 * Detect if a photo_reference is in the New Places API resource name format
 * New format: "places/ChIJ.../photos/AUc7tX..."
 * Legacy format: opaque string like "AUc7tXnT..."
 */
function isNewApiPhotoRef(photoReference) {
    return photoReference.startsWith('places/');
}

/**
 * Generate a stable, short hash for use in cache keys and S3 paths.
 * Works for both legacy (short opaque strings) and new (long resource names) formats.
 */
function hashPhotoRef(photoReference) {
    return crypto.createHash('sha256').update(photoReference).digest('hex').substring(0, 16);
}

/**
 * Check if photo is cached in DynamoDB
 * @param {string} placeId - Google place_id
 * @param {string} photoReference - Google photo_reference
 * @param {number} maxWidth - Photo width
 * @returns {Promise<string|null>} - CloudFront URL or null
 */
async function getCachedPhotoUrl(placeId, photoReference, maxWidth) {
    const photoId = hashPhotoRef(photoReference);
    const cacheKey = `${placeId}_${photoId}_${maxWidth}`;

    try {
        const result = await ddbDocClient.send(new GetCommand({
            TableName: CACHE_TABLE,
            Key: {
                cache_type: 'photo_url',
                cache_key: cacheKey
            }
        }));

        if (result.Item) {
            const now = Math.floor(Date.now() / 1000);
            if (result.Item.ttl && result.Item.ttl > now) {
                console.log(`[getPlacePhoto] Cache HIT for ${cacheKey}`);
                return result.Item.data.cloudfront_url;
            }
            console.log(`[getPlacePhoto] Cache EXPIRED for ${cacheKey}`);
        }

        console.log(`[getPlacePhoto] Cache MISS for ${cacheKey}`);
        return null;
    } catch (error) {
        console.error(`[getPlacePhoto] Cache lookup error:`, error);
        return null;
    }
}

/**
 * Fetch photo from Google Places API
 * @param {string} photoReference - Google photo_reference
 * @param {number} maxWidth - Max width of photo
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
async function fetchGooglePhoto(photoReference, maxWidth) {
    let url;
    if (isNewApiPhotoRef(photoReference)) {
        // New Places API photo format: resource name → /media endpoint
        url = `https://places.googleapis.com/v1/${photoReference}/media?maxHeightPx=${maxWidth}&maxWidthPx=${maxWidth}&key=${GOOGLE_API_KEY}`;
    } else {
        // Legacy Places API photo format
        url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;
    }

    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            // Google redirects to the actual image URL
            if (response.statusCode === 302 || response.statusCode === 301) {
                const redirectUrl = response.headers.location;

                https.get(redirectUrl, (imgResponse) => {
                    const chunks = [];
                    imgResponse.on('data', chunk => chunks.push(chunk));
                    imgResponse.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        const contentType = imgResponse.headers['content-type'] || 'image/jpeg';
                        resolve({ buffer, contentType });
                    });
                    imgResponse.on('error', reject);
                }).on('error', reject);
            } else if (response.statusCode === 200) {
                // Direct response (common for New API)
                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const contentType = response.headers['content-type'] || 'image/jpeg';
                    resolve({ buffer, contentType });
                });
            } else {
                reject(new Error(`Google Photo API returned status ${response.statusCode}`));
            }
        });

        request.on('error', reject);
    });
}

/**
 * Upload photo to S3
 * @param {string} placeId - Google place_id
 * @param {string} photoReference - Google photo_reference (hashed for filename)
 * @param {number} maxWidth - Photo width
 * @param {Buffer} buffer - Image data
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - S3 key
 */
async function uploadToS3(placeId, photoReference, maxWidth, buffer, contentType) {
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    // Use hash of photoReference for stable, short identifier (works for both legacy and new formats)
    const photoId = hashPhotoRef(photoReference);
    const s3Key = `photos/${placeId}/${photoId}_${maxWidth}.${extension}`;

    await s3Client.send(new PutObjectCommand({
        Bucket: PHOTO_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'max-age=7776000' // 90 days
    }));

    console.log(`[getPlacePhoto] Uploaded to S3: ${s3Key}`);
    return s3Key;
}

/**
 * Cache the CloudFront URL in DynamoDB
 * @param {string} placeId - Google place_id
 * @param {string} photoReference - Google photo_reference
 * @param {number} maxWidth - Photo width
 * @param {string} s3Key - S3 object key
 * @returns {Promise<string>} - CloudFront URL
 */
async function cachePhotoUrl(placeId, photoReference, maxWidth, s3Key) {
    const photoId = hashPhotoRef(photoReference);
    const cacheKey = `${placeId}_${photoId}_${maxWidth}`;
    const cloudfrontUrl = `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
    const ttl = Math.floor(Date.now() / 1000) + (PHOTO_CACHE_TTL_DAYS * 24 * 60 * 60);

    await ddbDocClient.send(new PutCommand({
        TableName: CACHE_TABLE,
        Item: {
            cache_type: 'photo_url',
            cache_key: cacheKey,
            data: {
                s3_key: s3Key,
                cloudfront_url: cloudfrontUrl,
                photo_reference: photoReference,
                cached_at: new Date().toISOString()
            },
            ttl: ttl
        }
    }));

    console.log(`[getPlacePhoto] Cached URL for ${cacheKey}, TTL: ${PHOTO_CACHE_TTL_DAYS} days`);
    return cloudfrontUrl;
}

/**
 * Main handler - Get cached photo URL or fetch from Google and cache
 */
exports.handler = async (event) => {
    console.log('[getPlacePhoto] Event:', JSON.stringify(event));

    // Parse input - handle both GraphQL and direct invocation
    let placeId, photoReference, maxWidth, forceRefresh;

    if (event.arguments) {
        // GraphQL invocation
        placeId = event.arguments.placeId;
        photoReference = event.arguments.photoReference;
        maxWidth = event.arguments.maxWidth || 400;
        forceRefresh = event.arguments.forceRefresh || false;
    } else {
        // Direct invocation
        placeId = event.placeId;
        photoReference = event.photoReference;
        maxWidth = event.maxWidth || 400;
        forceRefresh = event.forceRefresh || false;
    }

    if (!placeId || !photoReference) {
        console.error('[getPlacePhoto] Missing required parameters');
        return {
            statusCode: 400,
            photoUrl: null,
            cached: false,
            error: 'placeId and photoReference are required'
        };
    }

    try {
        // Step 1: Check cache (skip if forceRefresh)
        if (!forceRefresh) {
            const cachedUrl = await getCachedPhotoUrl(placeId, photoReference, maxWidth);
            if (cachedUrl) {
                return {
                    statusCode: 200,
                    photoUrl: cachedUrl,
                    cached: true
                };
            }
        } else {
            console.log(`[getPlacePhoto] Force refresh requested - skipping cache for ${placeId}`);
        }

        // Step 2: Fetch from Google
        console.log(`[getPlacePhoto] Fetching from Google: ${placeId}`);
        const { buffer, contentType } = await fetchGooglePhoto(photoReference, maxWidth);

        // Step 3: Upload to S3
        const s3Key = await uploadToS3(placeId, photoReference, maxWidth, buffer, contentType);

        // Step 4: Cache the URL
        const cloudfrontUrl = await cachePhotoUrl(placeId, photoReference, maxWidth, s3Key);

        return {
            statusCode: 200,
            photoUrl: cloudfrontUrl,
            cached: false
        };

    } catch (error) {
        console.error('[getPlacePhoto] Error:', error);

        // Fallback: Return direct Google URL (still works, just costs more)
        let fallbackUrl;
        if (isNewApiPhotoRef(photoReference)) {
            fallbackUrl = `https://places.googleapis.com/v1/${photoReference}/media?maxHeightPx=${maxWidth}&maxWidthPx=${maxWidth}&key=${GOOGLE_API_KEY}`;
        } else {
            fallbackUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;
        }

        return {
            statusCode: 200,
            photoUrl: fallbackUrl,
            cached: false,
            fallback: true
        };
    }
};
