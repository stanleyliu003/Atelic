# Atelic: Your Intelligent Travel Companion

Atelic is a smart travel planning application designed to transform your travel ideas into perfectly optimized itineraries. Gone are the days of manually plotting points on a map. With Atelic, you simply describe your perfect day, and we'll handle the rest.

## Overview

This project is a cross-platform mobile application built with React Native. It leverages a powerful, serverless AWS backend to provide intelligent features, including natural language processing for activity planning, mapping, and advanced route and schedule optimization.

The core idea is to allow users to input their travel plans in plain English. The app then parses this text, identifies key locations, fetches their coordinates, and visualizes them on a map. From there, it uses sophisticated algorithms to calculate the most efficient route and schedule for the user's trip.

## Key Features

* **Natural Language Input:** Describe your trip goals like you're talking to a friend (e.g., "I want to visit the Liberty Bell and then get a cheesesteak at Jim's South St.").
* **AI-Powered Parsing:** Uses a Large Language Model (LLM) to intelligently identify activities and destinations from your text.
* **Interactive Mapping:** Displays all your desired locations on a dynamic map with custom icons for easy visualization.
* **Route Optimization:** Calculates the most efficient path between all your points of interest, saving you time and travel headaches.
* **Schedule Optimization:** (In Development) A complex backend program that will create an optimized hour-by-hour schedule based on your destinations.

## Tech Stack

### Frontend

```
- React Native
- Expo
- TypeScript
- React Native Maps
- Expo Router (for navigation)
```

### Backend

```
- AWS (Amazon Web Services)
- AWS Amplify (for Authentication & simple APIs)
- AWS Lambda (for custom, complex logic)
- Amazon API Gateway
- Amazon DynamoDB
- Google Places API
```

## Architecture

Atelic uses a modern, hybrid backend approach on AWS to balance development speed with custom power.

* **Managed Services with AWS Amplify:** Standard, boilerplate features like **user authentication** (via Amazon Cognito) and simple API calls (for the LLM and Google Places integration) are handled by AWS Amplify. This allows for rapid development and secure, pre-configured setups.

* **Custom Logic with AWS Lambda:** The core, proprietary features of the app—the **route and schedule optimization algorithms**—are built as standalone, custom AWS Lambda functions. This provides the full control and flexibility needed for these computationally intensive and specialized tasks, without being constrained by the Amplify framework.

This architecture uses the right tool for the right job: Amplify for speed on common tasks, and custom Lambda for power and control where it matters most.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

* Node.js & npm
* Expo CLI
* An AWS account
* Xcode (for iOS) / Android Studio (for Android)

### Installation

1.  **Clone the repo**
    ```sh
    git clone https://github.com/your-username/atelic.git
    cd atelic
    ```
2.  **Install NPM packages**
    ```sh
    npm install
    ```
3.  **Set up environment variables**
    * Create a `.env` file in the root directory.
    * Add your API keys and backend configuration details (e.g., AWS region, API Gateway endpoint).
    ```
    EXPO_PUBLIC_GOOGLE_MAP_KEY='YOUR_GOOGLE_MAPS_KEY'
    API_GATEWAY_ENDPOINT='YOUR_API_GATEWAY_URL'
    ```
4.  **Run the application**
    * To run the development build you created:
        ```sh
        npx expo start
        ```
    * If you need to create a new build after adding native libraries:
        ```sh
        npx expo run:ios
        # or
        npx expo run:android
        ```

## License
 
Distributed under the MIT License. See `LICENSE.txt` for more information.