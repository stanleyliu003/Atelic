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

#### 1.2 Instagram Scraping Integration

**API Choice:** RapidAPI Instagram Scraper (MVP) → Apify (Production)

**Data to extract:**
- Caption text
- Media type (reel/post/carousel)
- Media URLs (video URL or array of image URLs)
- Location tag (if user tagged a location)

**Environment variable:** `RAPIDAPI_KEY`

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

#### 1.6 DynamoDB Storage

**Option A:** Add to existing TripStorage with a "saved places" structure
**Option B:** Create new SavedPlacesStorage table

**Schema consideration:**
```json
{
  "userId": "user-123",
  "savedPlaces": [
    { "activity": {...}, "source": "instagram", "sourceUrl": "https://...", "savedAt": "2024-..." }
  ]
}
```

#### 1.7 Lambda Configuration

**Settings:**
- Runtime: Node.js 18.x
- Memory: 1024 MB (for video processing)
- Timeout: 120 seconds
- Environment variables:
  - `RAPIDAPI_KEY`
  - `GEMINI_API_KEY`
  - `GOOGLE_PLACES_API_KEY`

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
| Scraping API | RapidAPI (MVP) → Apify (prod) | Cost-effective for testing; reliable for production |
| Gemini model | 2.0 Flash | Multimodal (video + images); good balance of speed/quality |
| Auth sharing | App Groups | Standard iOS pattern for extension ↔ app communication |

---

## Cost Estimates

| Component | Cost per Share |
|-----------|----------------|
| Instagram Scraping (RapidAPI) | ~$0.01 |
| Gemini 2.0 Flash (video/images) | ~$0.05-0.10 |
| Google Places API (3-5 places) | ~$0.05-0.10 |
| Lambda execution | ~$0.001 |
| **Total** | **~$0.10-0.20** |

---

## Risk Mitigation

### Instagram API Reliability
- **Risk:** Scraping API may fail or be rate-limited
- **Mitigation:** Implement retry logic; have fallback to Apify; cache successful scrapes

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
    │   ├── index.js
    │   ├── instagramScraper.js
    │   ├── mediaProcessor.js
    │   ├── geminiExtractor.js
    │   └── placeResolver.js
    └── function-parameters.json

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
