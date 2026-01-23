# Cost Optimization Implementation Plan

## Overview

This document outlines the implementation plan for two cost optimization strategies:
1. **S3 Photo Caching** - Cache Google Place photos in S3/CloudFront to eliminate per-view costs
2. **Instagram Post-Level Caching** - Cache extracted places by Instagram shortcode to avoid duplicate processing

**Estimated Total Savings:** 80-95% reduction in ongoing costs at scale

---

## Current Cost Structure

### Per Instagram Share (One-Time)
| Component | Cost | Notes |
|-----------|------|-------|
| Apify Scraping | ~$0.0023 | Pay-per-result |
| Gemini 2.0 Flash | ~$0.05-0.10 | Per video/image processing |
| Google Places API | ~$0.05-0.10 | FindPlace + Details (cached after first call) |
| Lambda | ~$0.001 | Negligible |
| **Total per share** | **~$0.10-0.20** | |

### Ongoing Costs (The Real Problem)
| Component | Cost | Impact |
|-----------|------|--------|
| **Google Place Photos** | **$0.007/request** | Every time ANY user views a photo |

### Cost Projection Example
| Scenario | Current Cost | With Optimizations |
|----------|--------------|-------------------|
| 1 place viewed 100 times | $0.70 | ~$0.01 |
| 1 place viewed 10,000 times | $70.00 | ~$0.05 |
| 1,000 places × 100 views each | $700.00 | ~$5.00 |

---

## Optimization 1: S3 Photo Caching

### 1.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT FLOW                              │
│                                                                  │
│  React Native App                                                │
│       │                                                          │
│       ▼                                                          │
│  Google Places Photo API ──────► $0.007 per request              │
│  (Every single view)                                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       PROPOSED FLOW                              │
│                                                                  │
│  React Native App                                                │
│       │                                                          │
│       ▼                                                          │
│  Check DynamoDB for cached S3 URL                                │
│       │                                                          │
│       ├── Cache HIT ──► CloudFront CDN ──► ~$0.0001/request     │
│       │                                                          │
│       └── Cache MISS ──► Lambda: getPlacePhoto                   │
│                              │                                   │
│                              ▼                                   │
│                         Google Photo API ($0.007 once)           │
│                              │                                   │
│                              ▼                                   │
│                         Upload to S3                             │
│                              │                                   │
│                              ▼                                   │
│                         Cache S3 URL in DynamoDB (30-day TTL)    │
│                              │                                   │
│                              ▼                                   │
│                         Return CloudFront URL                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 AWS Resources Required

#### S3 Bucket
- **Name:** `atelic-place-photos-{env}` (e.g., `atelic-place-photos-prod`)
- **Region:** Same as other Amplify resources (us-east-1)
- **Public Access:** Blocked (serve via CloudFront only)
- **Lifecycle Rule:** Delete objects after 35 days (5-day buffer beyond 30-day Google TOS limit)

#### CloudFront Distribution
- **Origin:** S3 bucket
- **Cache Policy:** CachingOptimized (TTL: 1 day min, 30 days max)
- **Price Class:** PriceClass_100 (North America & Europe) or PriceClass_All
- **Domain:** `photos.atelic.app` (optional custom domain)

#### DynamoDB Updates
- **Table:** `PlacesAPIActivityStorage` (existing)
- **New cache_type:** `photo_url`
- **Schema:**
  ```
  cache_type: "photo_url"
  cache_key: "{place_id}_{maxwidth}" (e.g., "ChIJ123_400")
  data: {
    s3_key: "photos/ChIJ123/400.jpg",
    cloudfront_url: "https://d123.cloudfront.net/photos/ChIJ123/400.jpg",
    original_photo_reference: "CmRaAAAA...",
    cached_at: "2026-01-23T10:00:00Z"
  }
  ttl: 1737801600 (30 days from cached_at)
  ```

### 1.3 Lambda Function: getPlacePhoto

**Location:** `amplify/backend/function/getPlacePhoto/`

**Purpose:** Fetch photo from Google, upload to S3, return CloudFront URL

**Files to Create:**
```
amplify/backend/function/getPlacePhoto/
├── src/
│   └── index.js
├── function-parameters.json
└── package.json
```

#### index.js Implementation

```javascript
/* Amplify Params - DO NOT EDIT
    ENV
    REGION
    STORAGE_PLACESAPIACTIVITYSTORAGE_NAME
Amplify Params - DO NOT EDIT */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const https = require('https');

// Initialize clients
const s3Client = new S3Client({ region: process.env.REGION });
const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// Configuration
const PHOTO_BUCKET = process.env.PHOTO_BUCKET_NAME;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CACHE_TABLE = process.env.STORAGE_PLACESAPIACTIVITYSTORAGE_NAME;
const PHOTO_CACHE_TTL_DAYS = 30;

/**
 * Check if photo is cached in DynamoDB
 */
async function getCachedPhotoUrl(placeId, maxWidth) {
    const cacheKey = `${placeId}_${maxWidth}`;

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
 */
async function fetchGooglePhoto(photoReference, maxWidth) {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;

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
                // Direct response (less common)
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
 */
async function uploadToS3(placeId, maxWidth, buffer, contentType) {
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const s3Key = `photos/${placeId}/${maxWidth}.${extension}`;

    await s3Client.send(new PutObjectCommand({
        Bucket: PHOTO_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'max-age=2592000' // 30 days
    }));

    console.log(`[getPlacePhoto] Uploaded to S3: ${s3Key}`);
    return s3Key;
}

/**
 * Cache the CloudFront URL in DynamoDB
 */
async function cachePhotoUrl(placeId, maxWidth, s3Key, photoReference) {
    const cacheKey = `${placeId}_${maxWidth}`;
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
                original_photo_reference: photoReference,
                cached_at: new Date().toISOString()
            },
            ttl: ttl
        }
    }));

    console.log(`[getPlacePhoto] Cached URL for ${cacheKey}, TTL: ${PHOTO_CACHE_TTL_DAYS} days`);
    return cloudfrontUrl;
}

/**
 * Main handler
 */
exports.handler = async (event) => {
    console.log('[getPlacePhoto] Event:', JSON.stringify(event));

    // Parse input
    const { placeId, photoReference, maxWidth = 400 } = event.arguments || event;

    if (!placeId || !photoReference) {
        return {
            statusCode: 400,
            error: 'placeId and photoReference are required'
        };
    }

    try {
        // Step 1: Check cache
        const cachedUrl = await getCachedPhotoUrl(placeId, maxWidth);
        if (cachedUrl) {
            return {
                statusCode: 200,
                photoUrl: cachedUrl,
                cached: true
            };
        }

        // Step 2: Fetch from Google
        console.log(`[getPlacePhoto] Fetching from Google: ${placeId}`);
        const { buffer, contentType } = await fetchGooglePhoto(photoReference, maxWidth);

        // Step 3: Upload to S3
        const s3Key = await uploadToS3(placeId, maxWidth, buffer, contentType);

        // Step 4: Cache the URL
        const cloudfrontUrl = await cachePhotoUrl(placeId, maxWidth, s3Key, photoReference);

        return {
            statusCode: 200,
            photoUrl: cloudfrontUrl,
            cached: false
        };

    } catch (error) {
        console.error('[getPlacePhoto] Error:', error);

        // Fallback: Return direct Google URL (still works, just costs more)
        const fallbackUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;

        return {
            statusCode: 200,
            photoUrl: fallbackUrl,
            cached: false,
            fallback: true
        };
    }
};
```

### 1.4 Frontend Service: photoService.ts

**Location:** `src/services/photoService.ts`

**Purpose:** Abstract photo URL fetching, use cached URLs when available

```typescript
import { API, graphqlOperation } from 'aws-amplify';
import { getPlacePhoto } from '../graphql/queries';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAP_KEY;

interface PhotoResult {
    url: string;
    cached: boolean;
}

// In-memory cache for current session
const sessionCache = new Map<string, string>();

/**
 * Get photo URL for a place - uses S3 cache when available
 * @param placeId - Google place_id
 * @param photoReference - Google photo_reference
 * @param maxWidth - Max width of photo (default 400)
 */
export async function getPhotoUrl(
    placeId: string,
    photoReference: string,
    maxWidth: number = 400
): Promise<string> {
    // Check session cache first (avoid Lambda call for same photo in same session)
    const cacheKey = `${placeId}_${maxWidth}`;
    if (sessionCache.has(cacheKey)) {
        return sessionCache.get(cacheKey)!;
    }

    try {
        // Call Lambda to get cached URL or fetch new one
        const result = await API.graphql(
            graphqlOperation(getPlacePhoto, {
                placeId,
                photoReference,
                maxWidth
            })
        ) as { data: { getPlacePhoto: { photoUrl: string; cached: boolean } } };

        const photoUrl = result.data.getPlacePhoto.photoUrl;

        // Store in session cache
        sessionCache.set(cacheKey, photoUrl);

        return photoUrl;
    } catch (error) {
        console.warn('[photoService] Failed to get cached photo, falling back to Google URL:', error);

        // Fallback to direct Google URL
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
    }
}

/**
 * Preload photos for a list of activities (call when loading trip data)
 * This warms the cache for better UX
 */
export async function preloadPhotos(
    activities: Array<{ place_id: string; photo_reference?: string }>
): Promise<void> {
    const promises = activities
        .filter(a => a.place_id && a.photo_reference)
        .map(a => getPhotoUrl(a.place_id, a.photo_reference!, 400).catch(() => null));

    await Promise.all(promises);
}

/**
 * Clear session cache (call on logout or memory pressure)
 */
export function clearPhotoCache(): void {
    sessionCache.clear();
}
```

### 1.5 Component Updates

**Files to Update:**
- `src/components/trip-view/activity/activity_image.tsx`
- `src/components/profile/TripCarouselImage.tsx`
- `app/trip-view/publish_success.tsx`

**Example Update (activity_image.tsx):**

```typescript
// BEFORE (direct Google URL)
const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;

// AFTER (use photoService)
import { getPhotoUrl } from '../../../services/photoService';

// In useEffect or useMemo:
const [photoUrl, setPhotoUrl] = useState<string | null>(null);

useEffect(() => {
    if (place_id && photo_reference) {
        getPhotoUrl(place_id, photo_reference, 400)
            .then(setPhotoUrl)
            .catch(console.error);
    }
}, [place_id, photo_reference]);
```

### 1.6 GraphQL Schema Addition

**File:** `amplify/backend/api/wishlistAPI/schema.graphql`

```graphql
type PhotoResult {
    photoUrl: String!
    cached: Boolean!
    fallback: Boolean
}

type Query {
    # ... existing queries ...

    getPlacePhoto(placeId: String!, photoReference: String!, maxWidth: Int): PhotoResult
        @function(name: "getPlacePhoto-${env}")
}
```

### 1.7 Environment Variables

**Lambda: getPlacePhoto**
```
PHOTO_BUCKET_NAME=atelic-place-photos-${env}
CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net
GOOGLE_PLACES_API_KEY=<existing key>
STORAGE_PLACESAPIACTIVITYSTORAGE_NAME=<auto-injected by Amplify>
```

### 1.8 Implementation Steps

1. **Create S3 Bucket** (Manual in AWS Console or CloudFormation)
   - Enable versioning (optional, for debugging)
   - Set lifecycle rule: delete after 35 days
   - Block all public access

2. **Create CloudFront Distribution** (Manual in AWS Console)
   - Origin: S3 bucket with OAI (Origin Access Identity)
   - Default TTL: 86400 (1 day)
   - Max TTL: 2592000 (30 days)
   - Compress objects: Yes

3. **Create Lambda Function**
   ```bash
   amplify add function
   # Name: getPlacePhoto
   # Runtime: Node.js
   # Template: Hello World
   ```

4. **Update GraphQL Schema**
   - Add `getPlacePhoto` query
   - Run `amplify push` (user runs this manually)

5. **Create photoService.ts**

6. **Update Components**
   - activity_image.tsx
   - TripCarouselImage.tsx
   - publish_success.tsx

7. **Test End-to-End**
   - First load: should fetch from Google, upload to S3
   - Second load: should return CloudFront URL
   - Check S3 bucket for uploaded photos
   - Verify 30-day TTL in DynamoDB

---

## Optimization 2: Instagram Post-Level Caching

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT FLOW                              │
│                                                                  │
│  User A shares reel ABC123                                       │
│       │                                                          │
│       ├── Apify scrape ($0.0023)                                │
│       ├── Gemini extraction (~$0.07)                            │
│       └── Google Places (cached) ✓                              │
│                                                                  │
│  User B shares SAME reel ABC123                                  │
│       │                                                          │
│       ├── Apify scrape ($0.0023) ← DUPLICATE COST               │
│       ├── Gemini extraction (~$0.07) ← DUPLICATE COST           │
│       └── Google Places (cached) ✓                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       PROPOSED FLOW                              │
│                                                                  │
│  User A shares reel ABC123                                       │
│       │                                                          │
│       ├── Check extraction cache → MISS                         │
│       ├── Apify scrape ($0.0023)                                │
│       ├── Gemini extraction (~$0.07)                            │
│       ├── Cache extracted places in DynamoDB                    │
│       └── Google Places (cached) ✓                              │
│                                                                  │
│  User B shares SAME reel ABC123                                  │
│       │                                                          │
│       ├── Check extraction cache → HIT ✓                        │
│       ├── Skip Apify ✓ (saved $0.0023)                          │
│       ├── Skip Gemini ✓ (saved ~$0.07)                          │
│       └── Google Places (cached) ✓                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 DynamoDB Cache Schema

**Table:** `PlacesAPIActivityStorage` (existing)

**New cache_type:** `instagram_extraction`

**Schema:**
```
cache_type: "instagram_extraction"
cache_key: "{shortCode}" (e.g., "ABC123xyz")
data: {
    extractedPlaces: [
        { name: "Colosseum", city: "Rome" },
        { name: "Trevi Fountain", city: "Rome" },
        ...
    ],
    postType: "Video",
    caption: "Best places in Rome...",
    ownerUsername: "travelblogger",
    extractedAt: "2026-01-23T10:00:00Z"
}
ttl: 1745577600 (90 days - Instagram posts rarely change)
```

### 2.3 Implementation Changes

**File:** `amplify/backend/function/processInstagramShare/src/index.js`

**Add these functions:**

```javascript
const EXTRACTION_CACHE_TTL_DAYS = 90; // Instagram posts rarely change

/**
 * Check if extraction results are cached for this Instagram post
 * @param {string} shortCode - Instagram post shortcode
 * @returns {Promise<object|null>} - Cached extraction data or null
 */
async function getCachedExtraction(shortCode) {
    try {
        // Use the same PlacesAPIActivityStorage table
        const CACHE_TABLE = process.env.STORAGE_PLACESAPIACTIVITYSTORAGE_NAME
            || 'PlacesAPIActivityStorage'; // Fallback for direct invocation

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
        const CACHE_TABLE = process.env.STORAGE_PLACESAPIACTIVITYSTORAGE_NAME
            || 'PlacesAPIActivityStorage';

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
```

**Update handler to use cache:**

```javascript
exports.handler = async (event) => {
    // ... existing validation code ...

    try {
        // Step 1: Scrape Instagram post (needed for shortCode)
        console.log('[index] Step 1: Scraping Instagram post...');
        const scrapedData = await scrapeInstagram(instagramUrl);

        // Step 2: Check for user-level duplicate (same user, same post)
        console.log('[index] Step 2: Checking for user duplicates...');
        const isDuplicate = await checkDuplicate(userID, scrapedData.shortCode);
        if (isDuplicate) {
            // ... existing duplicate handling ...
        }

        // NEW Step 3: Check extraction cache (cross-user)
        console.log('[index] Step 3: Checking extraction cache...');
        let extractedPlaces = null;
        const cachedExtraction = await getCachedExtraction(scrapedData.shortCode);

        if (cachedExtraction) {
            // Cache HIT - skip Apify media download and Gemini processing
            console.log('[index] Using cached extraction - skipping media download and Gemini');
            extractedPlaces = cachedExtraction.extractedPlaces;
        } else {
            // Cache MISS - full processing
            console.log('[index] Step 4: Downloading media...');
            const mediaBuffers = await downloadAllMedia(scrapedData);

            console.log(`[index] Step 5: Extracting places with Gemini (media type: ${scrapedData.type})...`);
            extractedPlaces = await extractPlacesWithGemini(
                scrapedData.caption,
                mediaBuffers,
                scrapedData.type,
                scrapedData.locationName
            );

            // Cache the extraction for future users
            if (extractedPlaces && extractedPlaces.length > 0) {
                await cacheExtraction(scrapedData.shortCode, extractedPlaces, scrapedData);
            }
        }

        if (!extractedPlaces || extractedPlaces.length === 0) {
            // ... existing "no places found" handling ...
        }

        // Continue with existing place resolution and save logic...
        console.log('[index] Step 6: Resolving places via Google Places API...');
        const activities = await resolvePlaces(extractedPlaces);

        // ... rest of existing code ...
    } catch (error) {
        // ... existing error handling ...
    }
};
```

### 2.4 Required Imports

Add to top of `index.js`:

```javascript
const { GetCommand } = require('@aws-sdk/lib-dynamodb');
```

### 2.5 Environment Variables

Add to Lambda configuration:

```
STORAGE_PLACESAPIACTIVITYSTORAGE_NAME=PlacesAPIActivityStorage-{env}
```

(This may already be available if the Lambda has access to the storage)

### 2.6 Implementation Steps

1. **Update Lambda IAM Role**
   - Ensure `processInstagramShare` Lambda has read/write access to `PlacesAPIActivityStorage` table
   - Add to `function-parameters.json` if not already present

2. **Add GetCommand Import**
   - Update imports in `index.js`

3. **Add Cache Functions**
   - `getCachedExtraction()`
   - `cacheExtraction()`

4. **Update Handler Flow**
   - Check cache after scraping (need shortCode)
   - Skip media download and Gemini if cached
   - Cache results after successful extraction

5. **Test**
   - Share a reel as User A → verify extraction cached
   - Share same reel as User B → verify cache hit in CloudWatch logs
   - Verify costs reduced in billing

---

## Implementation Timeline

### Phase 1: Instagram Post-Level Caching (Optimization 2)
**Estimated Effort:** 2-3 hours
**Priority:** HIGH (Quick win, immediate savings)

| Task | Time |
|------|------|
| Add cache functions to index.js | 30 min |
| Update handler flow | 30 min |
| Update IAM permissions (if needed) | 15 min |
| Testing | 1-2 hours |

### Phase 2: S3 Photo Caching (Optimization 1)
**Estimated Effort:** 1-2 days
**Priority:** HIGH (Largest long-term savings)

| Task | Time |
|------|------|
| Create S3 bucket | 15 min |
| Create CloudFront distribution | 30 min |
| Create getPlacePhoto Lambda | 2 hours |
| Update GraphQL schema | 30 min |
| Create photoService.ts | 1 hour |
| Update components (3 files) | 2 hours |
| Testing | 2-3 hours |
| User runs `amplify push` | - |

---

## Monitoring & Verification

### CloudWatch Metrics to Track

1. **Instagram Extraction Cache**
   - Search logs for: `"Extraction cache HIT"` vs `"Extraction cache MISS"`
   - Goal: >20% hit rate for viral content

2. **Photo Cache**
   - Search logs for: `"[getPlacePhoto] Cache HIT"` vs `"[getPlacePhoto] Cache MISS"`
   - Goal: >80% hit rate after initial population

### Cost Tracking

1. **Google Places API**
   - Monitor in Google Cloud Console
   - Track "Places Photo" requests (should decrease dramatically)

2. **AWS Costs**
   - S3 storage (should be minimal, ~$0.02/GB)
   - CloudFront data transfer (much cheaper than Google)
   - Lambda invocations (slight increase, but very cheap)

### DynamoDB Queries for Analysis

```javascript
// Count cached extractions
const extractionCount = await docClient.send(new QueryCommand({
    TableName: 'PlacesAPIActivityStorage',
    KeyConditionExpression: 'cache_type = :type',
    ExpressionAttributeValues: { ':type': 'instagram_extraction' },
    Select: 'COUNT'
}));

// Count cached photos
const photoCount = await docClient.send(new QueryCommand({
    TableName: 'PlacesAPIActivityStorage',
    KeyConditionExpression: 'cache_type = :type',
    ExpressionAttributeValues: { ':type': 'photo_url' },
    Select: 'COUNT'
}));
```

---

## Risk Mitigation

### Google Terms of Service Compliance

| Requirement | Implementation |
|-------------|----------------|
| Photo cache max 30 days | S3 lifecycle rule: 35 days, DynamoDB TTL: 30 days |
| Don't cache permanently | TTL enforced at both S3 and DynamoDB levels |
| Refresh after expiry | Lambda re-fetches when TTL expired |

### Fallback Mechanisms

1. **Photo Cache Failure**
   - Falls back to direct Google URL
   - User experience unaffected, just costs more

2. **Extraction Cache Failure**
   - Falls back to full Apify + Gemini processing
   - User experience unaffected, just costs more

3. **S3/CloudFront Unavailable**
   - photoService.ts includes fallback to Google URL
   - Graceful degradation

---

## Files to Create/Modify Summary

### New Files
- `amplify/backend/function/getPlacePhoto/src/index.js`
- `amplify/backend/function/getPlacePhoto/function-parameters.json`
- `amplify/backend/function/getPlacePhoto/package.json`
- `src/services/photoService.ts`

### Modified Files
- `amplify/backend/function/processInstagramShare/src/index.js`
- `amplify/backend/api/wishlistAPI/schema.graphql`
- `src/components/trip-view/activity/activity_image.tsx`
- `src/components/profile/TripCarouselImage.tsx`
- `app/trip-view/publish_success.tsx`

### AWS Resources (Manual Setup)
- S3 Bucket: `atelic-place-photos-{env}`
- CloudFront Distribution
- IAM permissions for Lambda → S3

---

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Cost per viral reel (100 shares) | ~$12.00 | ~$0.50 |
| Cost per photo view (100 views) | $0.70 | ~$0.01 |
| Photo cache hit rate | 0% | >80% |
| Extraction cache hit rate | 0% | >20% |
