# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Project Setup
```bash
npm install                    # Install dependencies
npx expo start                 # Start development server
npx expo run:ios              # Build and run on iOS simulator
npx expo run:android          # Build and run on Android emulator
```

### Linting and Type Checking
```bash
npx eslint .                  # Run ESLint
npx tsc --noEmit             # Type check without emitting files
```

### AWS Amplify Commands
```bash
amplify status               # Check backend status
amplify push                 # Deploy backend changes
amplify pull                 # Pull latest backend changes
amplify publish              # Build and deploy frontend and backend
```

## Architecture Overview

### Frontend Structure (Expo Router)
- **File-based routing** in `/app` directory with nested layouts
- **Tab navigation** at `/app/(tabs)`: create_new_trip, mytrip (disabled), profile
- **Trip creation flow**: `/app/create-trip/` (city selection → wishlist input)
- **Main planning screen**: `/app/trip-view/trip-view_main.tsx` (2,200+ lines - core UI)
- **Authentication flow**: `/app/authorization/` (7 screens: sign-in, sign-up, password reset, etc.)

### State Management (CreateTripContext)
Central state provider (`/context/CreateTripContext.js`, 761 lines) manages entire trip creation and editing flow:

**Core State:**
- `tripId`: UUID for current trip
- `activities`: Wishlist activities (each with unique `instanceId` to allow duplicate places)
- `dayActivities`: Activities organized by day `{[dayNumber]: {activities: Activity[]}}`
- `dayPolylines`: Encoded route polylines per day
- `selectedCity`, `selectedCityLocation`: City data with coordinates
- `cityCategories`: Pre-generated category suggestions for city exploration
- `collaborators`: Array of users with roles (owner/editor/viewer)
- `currentUserRole`: Permission level for current user
- `version`: Optimistic locking version number

**Key Features:**
- **Instance-based activity management**: Uses `instanceId` instead of `place_id` as primary key, allowing same place multiple times
- **Cloud persistence**: Restore trips from DynamoDB via `restoreTripFromObject()`
- **Autosave**: Periodic (5min) + app background saves with debouncing and lock mechanism
- **Real-time sync**: GraphQL subscriptions trigger reload when collaborators edit
- **AsyncStorage caching**: Temporary storage during trip creation flow

### Backend Architecture (AWS Amplify + Custom Lambda)
Hybrid approach with 17 Lambda functions organized by purpose:

**Managed Services:**
- **Auth**: AWS Cognito (Cognito User Pools + social providers: Google, Apple)
- **API**: GraphQL via AWS AppSync (`/amplify/backend/api/wishlistAPI/schema.graphql`)
- **Storage**: 5 DynamoDB tables (TripStorage, PlacesAPIActivityStorage, categoryStorage, UserProfilesStorage, regionImageStorage)

**AI-Powered Lambda Functions:**
- `wishlistAnalyzer`: Gemini 2.5 Flash Lite parses natural language → structured activities (120s timeout via REST bypass)
- `generateCategoryActivities`: AI-generated activities per category with DynamoDB caching (1-year TTL)
- `CityCategories`: Generate city-specific categories with emojis

**Location & Routing:**
- `getLocationCoordinates`: Google Places API integration
- `GetRoute`: Google Routes API for turn-by-turn directions + polylines
- `OptimizeRoute`: Haversine-based route optimization (local, cost-free alternative to Google)

**Data Persistence:**
- `CreateTripStorage`: Save/update trips with collaborator management and version increment
- `getUserTrips`: Retrieve full trip details
- `getTripIDs`: List user's trip summaries

**Collaboration:**
- `manageCollaborators`: Add/remove/update roles (owner/editor/viewer)
- `searchUsers`: Find users by email/username via Cognito

**Search & Discovery:**
- `searchAutocomplete`: Place autocomplete suggestions
- `searchBarActivities`: Activity search with filters

### Key Data Flows

**Trip Creation Pipeline:**
1. City selection → Google Places Autocomplete
2. Gemini generates city categories → cached in DynamoDB
3. User selects category → generate activities (Gemini + Places API)
4. Activities added to wishlist → CreateTripContext state
5. User creates days → initialize day structure
6. Drag activities to days → update `dayActivities`
7. Optimize route → Haversine algorithm + Google Routes API
8. Encode polyline → store in `dayPolylines`
9. Save trip → `CreateTripStorage` Lambda → DynamoDB
10. Real-time sync → GraphQL subscriptions notify collaborators

**Activity Search Flow:**
1. User types query → SearchBar component
2. AutocompleteModal → `searchAutocomplete` Lambda
3. Select place → `getPlaceDetails` Lambda → Google Places API
4. Add to wishlist/day → update context
5. Autosave triggers after 5s debounce

**Collaboration Flow:**
1. Owner shares trip → ShareTripModal
2. Search users → `searchUsers` Lambda (Cognito query)
3. Add collaborator → `manageCollaborators` Lambda
4. DynamoDB update → triggers GraphQL subscription `onTripUpdated`
5. Collaborators receive real-time update
6. Permission checks → `currentUserRole` determines UI access
7. Read-only rendering for viewers

### GraphQL Schema (`schema.graphql`)
**Core Types:**
- `Activity`: 32 fields (place_id, name, coordinates, opening_hours, reviews, photos, etc.)
- `Trip`: Complete trip with days array, wishlist, collaborators, version
- `Day`: dayNumber, activities array, encodedPolyline
- `Collaborator`: userID, role (owner/editor/viewer), email, username

**Authentication:** Hybrid API Key (public) + Cognito User Pools

### Cost Optimization Strategies
- **Haversine optimization** instead of Google Optimization API (saves on API costs)
- **ID Only SKU** for photo reference refreshes (free tier)
- **DynamoDB caching** for categories (1-year TTL) and place details
- **Debounced autosave** prevents excessive Lambda invocations

### File Structure
- `/app`: Expo Router pages and layouts
- `/context`: CreateTripContext (761 lines) - central state management
- `/src/components`: Reusable UI components
- `/src/services`: API calls (lambdaService.js for Lambda invocations)
- `/src/hooks`: Custom hooks (use_day_activities.ts, use_activity_selection.ts)
- `/src/types`: TypeScript definitions (activity.types.ts)
- `/amplify/backend/api/wishlistAPI`: GraphQL schema (473 lines)
- `/amplify/backend/function`: 17 Lambda function directories

### Environment Variables
**Frontend:**
- `EXPO_PUBLIC_GOOGLE_MAP_KEY`: Google Maps SDK and Places API key

**Lambda Functions:**
- `GEMINI_API_KEY`: Gemini AI for natural language processing
- `GOOGLE_PLACES_API_KEY`: Location services and place details
- `GOOGLE_ROUTES_API_KEY`: Route calculation and directions

AWS Amplify configurations in `src/aws-exports.js` and `src/amplifyconfiguration.json` (committed for dev environment)

### Critical Architectural Patterns

**Instance-Based Activity Management:**
Activities use `instanceId` (UUID) as primary key instead of `place_id`, allowing users to visit the same place multiple times without conflicts. This is crucial for the day planning feature where duplicate destinations are common.

**Hybrid Caching Strategy:**
- **Long-term**: DynamoDB with 1-year TTL (categories, place details)
- **Session**: AsyncStorage during trip creation flow
- **In-memory**: Route cache, category activities

**Autosave Architecture:**
Prevents data loss while minimizing costs:
- Saves every 5 minutes for owners/editors
- Saves on app background/inactive state
- Uses `isSavingRef` lock to prevent concurrent saves
- Minimum 5s debounce between saves

**Permission Model:**
Three-tier role system (owner/editor/viewer) controls UI rendering. GraphQL uses public API key auth, so permissions are enforced at the application layer, not API layer.

**Real-Time Collaboration:**
GraphQL subscriptions on `onTripUpdated` mutation trigger automatic trip reload when collaborators make changes. Version number provides optimistic concurrency control to detect conflicts.