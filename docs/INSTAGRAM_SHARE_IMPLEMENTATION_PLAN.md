# Instagram Share-to-App Implementation Plan

## Overview

Enable users to share Instagram reels/posts directly to Atelic, automatically extracting travel destinations and adding them to their saved places.

---

## User Flow

```
1. User views travel reel/post on Instagram
2. User taps "Share" → "Share to..."
3. User selects "Atelic" from iOS share sheet
4. Atelic Share Extension UI appears within Instagram
   - Shows loading indicator: "Finding places from this post..."
5. Processing completes → Opens main Atelic app
6. Extracted activities appear in "Saved Places" tab
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    iOS SHARE EXTENSION                       │
│  - Receives Instagram URL from share sheet                  │
│  - Reads user auth from App Groups (shared with main app)   │
│  - Displays loading UI within Instagram                     │
│  - Calls Lambda and handles response                        │
│  - Opens main app with results via URL scheme               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              LAMBDA: processInstagramShare                   │
│  - Validates user authentication                            │
│  - Scrapes Instagram for metadata + media URLs              │
│  - Downloads media (video or images)                        │
│  - Sends to Gemini 2.0 Flash for place extraction           │
│  - Calls Google Places API for full activity details        │
│  - Saves to user's saved places in DynamoDB                 │
│  - Returns activity array to Share Extension                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      MAIN APP                                │
│  - Receives deep link with extraction results               │
│  - Displays activities in "Saved Places" tab                │
│  - User can add to wishlist or trip days                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Lambda Backend Development

**Goal:** Create the `processInstagramShare` Lambda function that handles the entire extraction pipeline.

#### 1.1 Create Lambda Function Structure

**Location:** `/amplify/backend/function/processInstagramShare/`

**Files to create:**
- `src/index.js` - Main handler
- `src/instagramScraper.js` - Instagram API integration
- `src/mediaProcessor.js` - Download and prepare media
- `src/geminiExtractor.js` - Gemini 2.0 Flash integration
- `src/placeResolver.js` - Google Places API integration

#### 1.2 Instagram Scraping Integration (Apify)

**API:** Apify Instagram Scraper (`apify~instagram-scraper`)

**Endpoint:**
```
POST https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token={APIFY_API_KEY}
```

**Request Body:**
```json
{
  "directUrls": ["https://www.instagram.com/p/ABC123/"],
  "resultsType": "posts",
  "resultsLimit": 1
}
```

**Response Fields We Use:**

| Field | Type | Description |
|-------|------|-------------|
| `caption` | string | Full caption text for AI extraction |
| `type` | string | `Image`, `Video`, or `Sidecar` (carousel) |
| `displayUrl` | string | Main media CDN URL |
| `displayResourceUrls` | array | All media URLs for carousels |
| `locationName` | string | Tagged location (bonus context) |
| `hashtags` | array | Extracted hashtags |
| `ownerUsername` | string | Post creator |

**Media Type Mapping:**
- `Video` → Reel/Video post → Send video to Gemini
- `Image` → Single image post → Send image to Gemini
- `Sidecar` → Carousel → Send all images from `displayResourceUrls` to Gemini

**Environment variable:** `APIFY_API_KEY`

**Cost:** ~$0.0023 per post scraped (pay-per-result model)

#### 1.3 Media Processing

**Approach:** In-memory processing (no S3 for MVP)

**Logic:**
- If reel/video → Download video to buffer
- If carousel → Download all images to buffers
- If single image → Download image to buffer
- Convert buffers to base64 for Gemini

**Constraints:**
- Lambda memory: Set to 1024MB+ for video processing
- Lambda timeout: Set to 120 seconds (matching wishlistAnalyzer pattern)

#### 1.4 Gemini 2.0 Flash Integration

**Model:** `gemini-2.0-flash`

**Input construction:**
```
[
  { text: "Instagram caption: {caption}" },
  { inlineData: { mimeType: "video/mp4", data: base64 } },  // OR images
  { text: "Extraction prompt..." }
]
```

**Extraction prompt requirements:**
- Extract specific place names (restaurants, hotels, attractions, landmarks)
- Identify the city/region context
- Return structured JSON array
- Handle cases where no places are found

**Output format:**
```json
[
  { "name": "Place Name", "type": "restaurant|hotel|attraction", "city": "City Name" },
  ...
]
```

#### 1.5 Google Places Resolution

**Use existing pattern:** Similar to `getLocationCoordinates` Lambda

**For each extracted place:**
1. Search with place name + city context (e.g., "Locavore Restaurant Bali")
2. Get place_id from search results
3. Fetch full place details (coordinates, photos, ratings, hours)
4. Construct Activity object matching existing schema

#### 1.6 DynamoDB Storage (SavedPlacesStorage)

**Table:** Create new `SavedPlacesStorage` table

**Table Schema:**

| Field | Type | Key | Description |
|-------|------|-----|-------------|
| `userID` | String | Partition Key (PK) | Cognito user ID (matches existing pattern) |
| `savedPlaceId` | String | Sort Key (SK) | UUID for this saved place entry |
| `activity` | Object | - | Full Activity object (matches existing schema) |
| `source` | String | - | `"instagram"` / `"manual"` / `"tiktok"` (future) |
| `sourceUrl` | String | - | Instagram permalink: `https://www.instagram.com/reel/ABC123/` |
| `sourcePostId` | String | - | Instagram shortcode: `ABC123` (for deduplication) |
| `sourceUsername` | String | - | `@travelblogger` (who posted it) |
| `city` | String | - | City context (for filtering/grouping) |
| `savedAt` | String | - | ISO timestamp |

**Note on URLs:**
- `sourceUrl` stores the **permanent Instagram permalink** (e.g., `https://www.instagram.com/reel/ABC123/`)
- This URL never expires unless the post is deleted
- We do NOT store CDN media URLs (those expire within hours)

**DynamoDB Access Pattern (following existing codebase patterns):**

```javascript
// Reference: amplify/backend/function/getUserProfile/src/index.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

// Table name from environment variable (Amplify pattern)
const SAVED_PLACES_TABLE = process.env.STORAGE_SAVEDPLACESSTORAGE_NAME;

// Query all saved places for a user
const result = await docClient.send(new QueryCommand({
  TableName: SAVED_PLACES_TABLE,
  KeyConditionExpression: 'userID = :uid',
  ExpressionAttributeValues: {
    ':uid': userID
  }
}));

// Save a new place
await docClient.send(new PutCommand({
  TableName: SAVED_PLACES_TABLE,
  Item: {
    userID,
    savedPlaceId: uuid(),
    activity: { /* Activity object */ },
    source: 'instagram',
    sourceUrl: 'https://www.instagram.com/reel/ABC123/',
    sourcePostId: 'ABC123',
    sourceUsername: 'travelblogger',
    city: 'Bali',
    savedAt: new Date().toISOString()
  }
}));
```

**Deduplication (prevent saving same post twice):**

```javascript
// Check if user already saved from this Instagram post
const existing = await docClient.send(new QueryCommand({
  TableName: SAVED_PLACES_TABLE,
  KeyConditionExpression: 'userID = :uid',
  FilterExpression: 'sourcePostId = :postId',
  ExpressionAttributeValues: {
    ':uid': userID,
    ':postId': 'ABC123'  // Instagram shortcode
  }
}));

if (existing.Items && existing.Items.length > 0) {
  // User already saved from this post - return existing or merge
}
```

**Amplify Storage Configuration:**

Add to `amplify/backend/storage/`:
```
storage/
└── SavedPlacesStorage/
    ├── cli-inputs.json
    └── parameters.json
```

Or create via Amplify CLI:
```bash
amplify add storage
# Select: NoSQL Database
# Table name: SavedPlacesStorage
# Partition key: userID (String)
# Sort key: savedPlaceId (String)
```

#### 1.7 Lambda Configuration

**Settings:**
- Runtime: Node.js 18.x
- Memory: 1024 MB (for video processing)
- Timeout: 120 seconds

**Environment variables:**
- `APIFY_API_KEY` - Apify Instagram Scraper token
- `GEMINI_API_KEY` - Gemini 2.0 Flash API key
- `GOOGLE_PLACES_API_KEY` - Google Places API key
- `STORAGE_SAVEDPLACESSTORAGE_NAME` - DynamoDB table name (auto-injected by Amplify)
- `AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID` - Cognito User Pool ID (for validation)
- `ENV` - Environment (dev/prod)
- `REGION` - AWS region

**Lambda Request Schema:**

```json
{
  "instagramUrl": "https://www.instagram.com/reel/ABC123/",
  "userID": "cognito-user-id-123"
}
```

**Note on `userID`:**
- This is the Cognito user ID (sub claim from JWT)
- Matches the pattern used in `getUserProfile` and other existing Lambdas
- The Share Extension reads this from App Groups (stored on login)

**Lambda Response Schema:**

```json
{
  "success": true,
  "savedPlaces": [
    {
      "savedPlaceId": "uuid-123",
      "activity": { /* Full Activity object */ },
      "source": "instagram",
      "sourceUrl": "https://www.instagram.com/reel/ABC123/",
      "city": "Bali"
    }
  ],
  "message": "Found 3 places from this post"
}
```

---

### Phase 2: iOS Share Extension Development

**Goal:** Create native iOS Share Extension that integrates with Instagram's share sheet.

#### 2.1 Expo Configuration

**Requirement:** Development build (not Expo Go)

**Approach:** Custom Expo config plugin to add Share Extension target

**Files to create:**
- `plugins/withShareExtension.js` - Expo config plugin
- `ios/ShareExtension/` - Native Swift files

**app.json additions:**
```json
{
  "expo": {
    "plugins": ["./plugins/withShareExtension"],
    "ios": {
      "bundleIdentifier": "com.atelic.app",
      "infoPlist": {
        "CFBundleURLTypes": [{ "CFBundleURLSchemes": ["atelic"] }]
      }
    }
  }
}
```

#### 2.2 App Groups Setup

**Purpose:** Share authentication state between main app and Share Extension

**App Group identifier:** `group.com.atelic.shared`

**Shared data:**
- `cognitoIdToken` - For Lambda authentication
- `userId` - To associate saved places with user
- `isLoggedIn` - Quick check for auth state

#### 2.3 Share Extension UI

**Components:**
- Loading state: Spinner + "Finding places from this post..."
- Success state: "Found X places! Opening Atelic..."
- Error state: "Couldn't extract places. Try again?"
- Not logged in state: "Please log in to Atelic first"

**Design:** Match Atelic's existing visual style

#### 2.4 Share Extension Logic

**Flow:**
1. Receive shared URL from Instagram
2. Validate URL is Instagram post/reel
3. Read auth token from App Groups
4. If not logged in → Show login prompt, offer to open app
5. Call `processInstagramShare` Lambda
6. On success → Open main app via URL scheme with result ID
7. On error → Show error message with retry option

#### 2.5 Main App Integration

**Deep link handling:**
- URL scheme: `atelic://instagram-import?resultId={id}`
- On app open → Fetch results from Lambda/DynamoDB
- Navigate to Saved Places tab
- Show success toast: "Added X places from Instagram"

---

### Phase 3: Main App UI Updates

**Goal:** Create "Saved Places" tab and integrate imported activities.

#### 3.1 Saved Places Tab

**Location:** New tab in main navigation or section in existing tab

**Features:**
- List of saved activities with source indicator (Instagram icon)
- Swipe to delete
- Tap to view details
- "Add to Trip" action
- "Add to Wishlist" action

#### 3.2 Activity Source Tracking

**Add to Activity type:**
```typescript
interface Activity {
  // ... existing fields
  source?: 'manual' | 'instagram' | 'wishlist';
  sourceUrl?: string;  // Original Instagram URL
  importedAt?: string; // ISO timestamp
}
```

#### 3.3 Deep Link Handler

**In app entry point:**
- Listen for `atelic://` URL scheme
- Parse `instagram-import` path
- Fetch and display imported activities
- Navigate to appropriate screen

---

### Phase 4: Authentication Flow Updates

**Goal:** Ensure Share Extension can authenticate users.

#### 4.1 Store Auth in App Groups

**On login (in main app):**
- After successful Cognito authentication
- Write tokens to App Groups shared storage
- Write userId to App Groups

**On logout:**
- Clear App Groups shared storage

#### 4.2 Token Refresh Handling

**Challenge:** Share Extension may have expired token

**Solution:**
- Store refresh token in App Groups
- Lambda validates and handles token refresh
- Or: Show "Session expired, please open Atelic" message

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Lambda count | 1 combined Lambda | Share Extension needs speed; operations always run together |
| Media storage | In-memory (no S3) | Simpler; Instagram reels are small enough |
| Scraping API | **Apify Instagram Scraper** | 95%+ reliability, excellent anti-bot handling, consistent data structure |
| Gemini model | 2.0 Flash | Multimodal (video + images); good balance of speed/quality |
| Auth sharing | App Groups | Standard iOS pattern for extension ↔ app communication |
| DynamoDB table | New `SavedPlacesStorage` | Clean separation; easy per-user queries; matches existing Amplify patterns |
| User identifier | `userID` (Cognito sub) | Consistent with existing codebase (`getUserProfile`, `CreateTripStorage`) |
| URL storage | Permalink only | CDN URLs expire; permalinks are permanent |

---

## Cost Estimates

| Component | Cost per Share |
|-----------|----------------|
| Instagram Scraping (Apify) | ~$0.0023 |
| Gemini 2.0 Flash (video/images) | ~$0.05-0.10 |
| Google Places API (3-5 places) | ~$0.05-0.10 |
| Lambda execution | ~$0.001 |
| **Total** | **~$0.10-0.20** |

---

## Risk Mitigation

### Instagram API Reliability
- **Risk:** Scraping API may fail or be rate-limited
- **Mitigation:** Implement retry logic with exponential backoff; Apify has 95%+ reliability; cache successful scrapes

### Video Size Limits
- **Risk:** Long videos may exceed Lambda memory
- **Mitigation:** Limit to first 60 seconds; or use S3 streaming for large files

### Share Extension Timeout
- **Risk:** iOS kills extensions after ~30 seconds
- **Mitigation:** Show progress UI; consider async processing with push notification on completion

### Place Resolution Accuracy
- **Risk:** Gemini extracts "that cafe" instead of actual name
- **Mitigation:** Prompt engineering; filter low-confidence extractions; let users edit/remove

### User Not Logged In
- **Risk:** User tries to share before logging into Atelic
- **Mitigation:** Clear messaging; deep link to login flow; remember pending share

---

## File Structure (New Files)

```
amplify/backend/function/
└── processInstagramShare/
    ├── src/
    │   ├── index.js              # Main handler (reference: getUserProfile/src/index.js)
    │   ├── instagramScraper.js   # Apify API integration
    │   ├── mediaProcessor.js     # Download and prepare media
    │   ├── geminiExtractor.js    # Gemini 2.0 Flash integration
    │   └── placeResolver.js      # Google Places API integration
    ├── function-parameters.json
    └── package.json

amplify/backend/storage/
└── SavedPlacesStorage/           # New DynamoDB table
    ├── cli-inputs.json
    └── parameters.json

plugins/
└── withShareExtension.js

ios/
└── ShareExtension/
    ├── ShareViewController.swift
    ├── Info.plist
    └── MainInterface.storyboard

src/
├── screens/
│   └── SavedPlacesScreen.tsx (new)
├── services/
│   └── shareExtensionService.js (new)
└── types/
    └── activity.types.ts (update)

app.json (update)
```

---

## Code Reference: Lambda Handler Pattern

**Based on existing codebase pattern from `amplify/backend/function/getUserProfile/src/index.js`:**

```javascript
/* Amplify Params - DO NOT EDIT
  AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID
  ENV
  REGION
  STORAGE_SAVEDPLACESSTORAGE_NAME
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuid } = require('uuid');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const SAVED_PLACES_TABLE = process.env.STORAGE_SAVEDPLACESSTORAGE_NAME;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log('processInstagramShare event:', JSON.stringify(event));

  const { instagramUrl, userID } = event.arguments || JSON.parse(event.body || '{}');

  if (!instagramUrl || !userID) {
    throw new Error('instagramUrl and userID are required');
  }

  try {
    // 1. Scrape Instagram
    const scrapedData = await scrapeInstagram(instagramUrl);

    // 2. Check for duplicate (same post already saved by this user)
    const isDuplicate = await checkDuplicate(userID, scrapedData.shortCode);
    if (isDuplicate) {
      return {
        success: true,
        savedPlaces: [],
        message: 'You already saved places from this post'
      };
    }

    // 3. Download media
    const mediaBuffers = await downloadMedia(scrapedData);

    // 4. Extract places with Gemini
    const extractedPlaces = await extractPlacesWithGemini(scrapedData.caption, mediaBuffers);

    // 5. Resolve places via Google Places API
    const activities = await resolvePlaces(extractedPlaces);

    // 6. Save to DynamoDB
    const savedPlaces = await savePlaces(userID, activities, scrapedData);

    return {
      success: true,
      savedPlaces,
      message: `Found ${savedPlaces.length} places from this post`
    };

  } catch (error) {
    console.error('Error processing Instagram share:', error);
    throw new Error(`Failed to process Instagram share: ${error.message}`);
  }
};

async function checkDuplicate(userID, sourcePostId) {
  const result = await docClient.send(new QueryCommand({
    TableName: SAVED_PLACES_TABLE,
    KeyConditionExpression: 'userID = :uid',
    FilterExpression: 'sourcePostId = :postId',
    ExpressionAttributeValues: {
      ':uid': userID,
      ':postId': sourcePostId
    }
  }));
  return result.Items && result.Items.length > 0;
}

async function savePlaces(userID, activities, scrapedData) {
  const savedPlaces = [];
  const now = new Date().toISOString();

  for (const activity of activities) {
    const savedPlace = {
      userID,
      savedPlaceId: uuid(),
      activity,
      source: 'instagram',
      sourceUrl: scrapedData.url,           // Permanent permalink
      sourcePostId: scrapedData.shortCode,  // For deduplication
      sourceUsername: scrapedData.ownerUsername,
      city: activity.city || '',
      savedAt: now
    };

    await docClient.send(new PutCommand({
      TableName: SAVED_PLACES_TABLE,
      Item: savedPlace
    }));

    savedPlaces.push(savedPlace);
  }

  return savedPlaces;
}
```

---

## Implementation Order

1. **Phase 1.1-1.4:** Lambda core (scraping + Gemini) - Can test independently
2. **Phase 1.5-1.6:** Lambda completion (Places API + storage)
3. **Phase 4:** Auth updates (needed before Share Extension)
4. **Phase 2.1-2.2:** Expo config + App Groups setup
5. **Phase 2.3-2.5:** Share Extension implementation
6. **Phase 3:** Main app UI updates

---

## Testing Strategy

### Lambda Testing
- Unit tests for each module (scraper, processor, extractor)
- Integration test with real Instagram URLs
- Test various post types: reel, single image, carousel
- Test edge cases: no places found, private post, deleted post

### Share Extension Testing
- Test on physical iOS device (required for extensions)
- Test share from Instagram app
- Test auth state handling (logged in, logged out, expired token)
- Test error states and retry flow

### End-to-End Testing
- Full flow from Instagram share to places appearing in app
- Test with various travel content (clear locations vs vague references)
- Performance testing (time from share to results)

---

## Success Metrics

- **Extraction accuracy:** >80% of clearly mentioned places correctly identified
- **End-to-end latency:** <15 seconds from share to results in app
- **User adoption:** Track share extension usage via analytics
- **Error rate:** <5% of shares fail completely

---

## Future Enhancements

1. **TikTok support:** Same pattern, different scraping API
2. **YouTube support:** For travel vlogs
3. **Batch import:** Share multiple posts at once
4. **Smart suggestions:** "You've saved 5 places in Bali, want to create a trip?"
5. **Social features:** Share your imported itinerary with friends
