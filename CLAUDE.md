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

### Frontend Structure
- **Expo Router**: File-based routing with nested layouts in `/app` directory
- **React Native + TypeScript**: Core mobile development stack
- **Context API**: State management via `CreateTripContext` for trip planning flow
- **Custom Components**: Modular UI components in `/src/components`

### Backend Architecture (AWS Amplify + Custom Lambda)
Hybrid approach combining Amplify's managed services with custom Lambda functions:

**Managed Services (Amplify):**
- Authentication: AWS Cognito for user management
- API Layer: GraphQL API via AWS AppSync 
- Data Storage: DynamoDB for trip data persistence

**Custom Lambda Functions:**
- `wishlistAnalyzer`: Uses Gemini AI to parse natural language trip descriptions
- `getLocationCoordinates`: Fetches location data from Google Places API
- `GetRoute`: Calculates routes between waypoints using Google Routes API
- `OptimizeRoute`: Implements route optimization algorithms (includes Haversine distance calculations)
- `CreateTripStorage`: Handles trip data persistence and retrieval

### Key Data Flow
1. User inputs trip wishlist in natural language
2. `wishlistAnalyzer` Lambda processes text using Gemini AI
3. `getLocationCoordinates` fetches coordinates for identified locations
4. Activities are displayed on React Native Maps
5. `OptimizeRoute` calculates optimal route ordering
6. `GetRoute` generates turn-by-turn directions and polylines
7. `CreateTripStorage` saves completed trip data

### State Management
- **CreateTripContext**: Central state for trip creation flow
  - `activities`: Array of parsed activities with coordinates
  - `dayActivities`: Activities organized by day
  - `dayPolylines`: Route polylines for each day
  - `wishlistText`: Raw user input text
  - Trip restoration and persistence helpers

### GraphQL Schema
Core types include `Activity`, `Trip`, `Day`, with mutations for route optimization and trip creation. Custom resolvers connect to Lambda functions for AI processing and route calculations.

### File Structure
- `/app`: Expo Router pages and layouts
- `/src/components`: Reusable UI components
- `/src/services`: GraphQL API calls
- `/src/hooks`: Custom React hooks for state management
- `/src/types`: TypeScript type definitions
- `/amplify`: AWS Amplify backend configuration
- `/constants`: API keys and app constants

### Environment Variables
Required environment variables:
- `EXPO_PUBLIC_GOOGLE_MAP_KEY`: Google Maps API key
- Various AWS Amplify auto-generated configurations
- Lambda function environment variables for API keys (Gemini, Google Places, Google Routes)

### Testing and Development
- Use iOS Simulator or physical device for testing location features
- Maps functionality requires actual Google Maps API key
- Backend Lambda functions can be tested independently via AWS console