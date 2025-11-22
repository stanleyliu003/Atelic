# Atelic: Your Intelligent Travel Companion

Atelic is a smart travel planning application designed to transform your travel ideas into perfectly optimized itineraries. Gone are the days of manually plotting points on a map. With Atelic, you simply describe your perfect day, and we'll handle the rest.

## Overview

This project is a cross-platform mobile application built with React Native and Expo Router. It leverages a serverless AWS backend (Amplify + custom Lambda functions) to provide intelligent features, including natural language processing for activity planning, mapping, and advanced route and schedule optimization.

The core idea is to allow users to input their travel plans in plain English. The app then parses this text, identifies key locations, fetches their coordinates from Google Places / Maps, and visualizes them on a map. From there, it uses custom algorithms and routing services to calculate efficient routes and day-by-day itineraries for the user's trip.

## Key Features

* **Natural Language Input:** Describe your trip goals like you're talking to a friend (e.g., "I want to visit the Liberty Bell and then get a cheesesteak at Jim's South St.").
* **AI-Powered Parsing:** Uses an LLM-powered backend to intelligently identify activities and destinations from free-text input.
* **Interactive Mapping:** Displays locations on a dynamic React Native Maps view with custom markers and polylines.
* **Route Optimization:** Calculates efficient paths between all points of interest and organizes them into a trip plan.
* **Schedule Optimization:** (In active development) A backend workflow that builds an optimized hour-by-hour daily schedule.

## Tech Stack

### Frontend

- React Native (`react-native` 0.74.x)
- Expo (`expo` SDK 51)
- Expo Router (file-based routing via `/app`)
- TypeScript support (mixed JS + TS)
- React Native Maps

### Backend

- AWS Amplify (Cognito auth, AppSync GraphQL API, configuration)
- AWS Lambda (custom business logic for parsing, routing, and trip persistence)
- Amazon DynamoDB (trip and activity storage)
- Amazon API Gateway (REST endpoints where needed)
- Google Places / Maps / Routes APIs

## High-Level Architecture

Atelic uses a hybrid AWS architecture:

* **Managed Services with AWS Amplify**
  - Authentication with Amazon Cognito (user pools, social providers)
  - GraphQL API via AppSync
  - DynamoDB tables for trips, activities, user profiles, and metadata
* **Custom Lambda Functions**
  - Natural language wishlist analysis
  - Location lookup via Google Places
  - Route calculation and optimization using Google routing services
  - Persistence of trips and day-by-day itineraries

Frontend routing is handled by Expo Router using the `/app` directory (e.g. `app/(tabs)`, `app/create-trip`, `app/trip-view`). Shared UI and logic live under `/src` (components, hooks, services, types, utils).

## Getting Started (New Hire)

These steps assume you're setting this up on a fresh machine for local development.

### Prerequisites

Install or verify the following:

- Node.js 18+ (LTS recommended) and npm
- Xcode (for iOS simulator) and/or Android Studio (for Android emulator)
- Expo tooling (we typically use `npx expo ...` so a global install is optional)
- AWS account access and credentials for the Atelic dev environment (ask your team lead)

Optional but recommended:

- AWS CLI and Amplify CLI (`npm install -g @aws-amplify/cli`) for backend operations

### 1. Clone the repository

Ask your team lead or check internal documentation for the correct Git URL, then:

```sh
git clone <REPO_URL_FOR_ATELIC_STABLE>
cd Atelic_Stable
```

> If the local folder name differs (e.g. `Atelic_Stable` vs repo name), just `cd` into whatever folder your clone command created.

### 2. Install dependencies

From the project root:

```sh
npm install
```

This installs all dependencies defined in `package.json` and prepares the Expo project.

### 3. Environment configuration

The AWS Amplify configuration for the **dev** environment is already committed (`src/aws-exports.js` and `src/amplifyconfiguration.json`). You generally do **not** need to run `amplify pull` just to get started, but you do need the correct **Google API key(s)** and AWS credentials.

#### 3.1. Google Maps / Places API keys

For local development, set the following environment variables (ask for the current dev key; it should match what we use in `eas.json`):

- `EXPO_PUBLIC_GOOGLE_MAP_KEY` – used by Create Trip flows that call Google Maps/Places directly.
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` – used by `src/constants/api.ts` as `GOOGLE_PLACES_API_KEY`.

You can either:

- Create a `.env` file in the project root (for local use) and set:

```sh
EXPO_PUBLIC_GOOGLE_MAP_KEY="YOUR_GOOGLE_MAPS_PLACES_KEY"
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY="YOUR_GOOGLE_MAPS_PLACES_KEY"
```

Or export them in your shell before running Expo:

```sh
export EXPO_PUBLIC_GOOGLE_MAP_KEY="YOUR_GOOGLE_MAPS_PLACES_KEY"
export EXPO_PUBLIC_GOOGLE_PLACES_API_KEY="YOUR_GOOGLE_MAPS_PLACES_KEY"
```

> For simplicity, we typically set both vars to the same Google key in dev.

#### 3.2. AWS credentials

If you need to interact with the backend beyond just running the app (e.g., `amplify push`, inspecting dev resources), configure your AWS credentials:

```sh
aws configure          # or use your team's preferred SSO / profile setup
```

and ensure you have access to the Atelic dev environment. For most frontend-only work, you just need valid Cognito/AppSync endpoints, which are already configured in the committed Amplify files.

### 4. Run the application

From the project root:

```sh
npm run start          # same as: expo start
```

This will:

- Start the Metro bundler
- Show a QR code for running on a physical device via Expo Go
- Allow launching on iOS Simulator or Android Emulator from the terminal/UI

To run directly on a simulator/emulator:

```sh
npm run ios            # builds and runs on iOS simulator
npm run android        # builds and runs on Android emulator
```

These map to `expo run:ios` and `expo run:android` as defined in `package.json`.

## Common Developer Tasks

- **Linting**

  ```sh
  npx eslint .
  ```

- **Type checking**

  ```sh
  npx tsc --noEmit
  ```

- **Amplify backend operations** (if you have CLI configured and permissions):

  ```sh
  amplify status      # Inspect backend resources
  amplify pull        # Pull latest backend config (if changed in AWS)
  amplify push        # Deploy backend changes
  ```

## Notes and Best Practices

- Treat the values in `src/aws-exports.js` and `src/amplifyconfiguration.json` as **sensitive configuration**; they are committed for convenience in the dev environment but should not be shared outside the team.
- When adding new environment variables, prefer the `EXPO_PUBLIC_...` naming convention so they are accessible in the Expo client.
- Avoid hard-coding API keys or secrets in source files—use environment variables or Amplify/Lambda configuration instead.

## License
 
Distributed under the MIT License. See `LICENSE.txt` for more information.