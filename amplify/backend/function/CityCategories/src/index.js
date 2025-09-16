/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_CATEGORYSTORAGE_ARN
	STORAGE_CATEGORYSTORAGE_NAME
	STORAGE_CATEGORYSTORAGE_STREAMARN
	GEMINI_API_KEY
Amplify Params - DO NOT EDIT */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

// DynamoDB setup
const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    
    try {
        // Extract selectedCity from GraphQL arguments
        const { selectedCity } = event.arguments || {};
        
        console.log('Processing getCityCategories request for city:', selectedCity);
        
        if (!selectedCity) {
            console.error('selectedCity is required but not provided');
            throw new Error('selectedCity is required');
        }
        
        // Check DynamoDB cache first
        const cachedCategories = await getCachedCategories(selectedCity);
        if (cachedCategories) {
            console.log(`Returning cached categories for ${selectedCity}`);
            return {
                city: selectedCity,
                categories: cachedCategories
            };
        }
        
        // Generate city categories using Gemini AI
        const cityCategories = await generateCityCategories(selectedCity);
        
        // Cache the result if successful
        if (cityCategories && cityCategories.length > 0) {
            await cacheCategories(selectedCity, cityCategories);
            console.log(`Cached categories for ${selectedCity}`);
        }
        
        console.log('Retrieved categories:', cityCategories);
        
        // For GraphQL @function directive, return the data directly (not wrapped in HTTP response)
        const result = {
            city: selectedCity,
            categories: cityCategories
        };
        
        console.log('Returning result:', JSON.stringify(result));
        return result;
        
    } catch (error) {
        console.error('Error in CityCategories handler:', error);
        // For GraphQL errors, return error result with city (non-nullable in schema)
        const errorResult = {
            city: event.arguments?.selectedCity || 'Unknown',
            categories: null
        };
        console.log('Returning error result:', JSON.stringify(errorResult));
        return errorResult;
    }
};

// Helper function to get cached categories from DynamoDB
const getCachedCategories = async (cityName) => {
    try {
        const command = new GetCommand({
            TableName: process.env.STORAGE_CATEGORYSTORAGE_NAME,
            Key: {
                regionName: cityName.toLowerCase().trim()
            }
        });
        
        console.log(`Checking cache for ${cityName}`);
        const result = await docClient.send(command);
        
        if (result.Item && result.Item.categoryInfo) {
            console.log(`Found cached categories for ${cityName}`);
            return JSON.parse(result.Item.categoryInfo);
        } else {
            console.log(`No cached categories found for ${cityName}`);
            return null;
        }
    } catch (error) {
        console.error(`Error retrieving cached categories for ${cityName}:`, error);
        return null; // Continue with API call if cache fails
    }
};

// Helper function to cache categories in DynamoDB
const cacheCategories = async (cityName, categories) => {
    try {
        const command = new PutCommand({
            TableName: process.env.STORAGE_CATEGORYSTORAGE_NAME,
            Item: {
                regionName: cityName.toLowerCase().trim(),
                categoryInfo: JSON.stringify(categories),
                cachedAt: new Date().toISOString()
            }
        });
        
        console.log(`Caching categories for ${cityName}`);
        await docClient.send(command);
        console.log(`Successfully cached categories for ${cityName}`);
    } catch (error) {
        console.error(`Error caching categories for ${cityName}:`, error);
        // Don't throw error - caching failure shouldn't break the main functionality
    }
};

// Helper function to generate city categories using Gemini API
const generateCityCategories = async (cityName) => {
    console.log(`Starting generateCityCategories for city: ${cityName}`);
    
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY environment variable not set');
        return null;
    }
    
    try {
        // Initialize Gemini with API key from environment
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        
        const prompt = `You are a travel categorization engine with deep local knowledge.

GOAL
Given a single place name (city, country, state, or region), return a JSON array of EXACTLY 6 objects. Each object must have:
- "category": a short, distinctive Title Case label that captures what makes this place unique
- "category_items": an array with EXACTLY ONE string containing EXACTLY TWO specific items separated by commas (no "and")
- "emoji": a single emoji that represents the category

RULES
- Use only items actually located in the requested place (city-level for cities; country-level for countries)
- Categories must be distinctive to this destination - avoid generic labels like "Restaurants" or "Attractions"
- Items must be specific proper nouns: actual place names, institutions, neighborhoods, or experiences unique to this location
- Prioritize local favorites and authentic experiences over tourist traps
- Keep categories mutually distinct with no overlap
- Cover diverse interests (culture, food, neighborhoods, landmarks, nature, etc.)
- No duplicates across categories or items
- Select an emoji that is relevant to the category
- Output valid JSON ONLY - no prose, no markdown, no trailing commas

OUTPUT FORMAT
[
  { "category": "Distinctive Category Name", "category_items": ["Item 1, Item 2"], "emoji": "Category Emoji" },
  { "category": "Distinctive Category Name", "category_items": ["Item 1, Item 2"], "emoji": "Category Emoji" },
]

EXAMPLE (for reference only; do NOT include unless input is exactly "Paris, France"):
Input: Paris, France
Output:
[
  { "category": "Art & Museums", "category_items": ["Louvre, Musée d'Orsay"], "emoji": "🎨" },
  { "category": "Seine Experiences", "category_items": ["Bateaux Parisiens, Pont Neuf"], "emoji": "🚢" }
]

INPUT: ${cityName}`;

        console.log(`Calling Gemini API for ${cityName}`);
        
        // Call Gemini API using the SDK
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const geminiResponse = response.text();
        
        console.log(`Raw Gemini response for ${cityName}: ${geminiResponse}`);
        
        // Parse the response from Gemini
        let categories;
        try {
            // Extract JSON from response (similar to wishlistAnalyzer pattern)
            const jsonString = geminiResponse.match(/\[.*\]/s)?.[0] || geminiResponse.trim();
            categories = JSON.parse(jsonString);
        } catch (parseError) {
            console.error(`Error parsing Gemini response for ${cityName}:`, parseError);
            console.error(`Raw response: ${geminiResponse}`);
            return null;
        }
        
        // Validate the structure
        if (Array.isArray(categories) && categories.length === 6) {
            const isValid = categories.every(cat => 
                cat.category && 
                Array.isArray(cat.category_items) && 
                cat.category_items.length === 1
            );
            
            if (isValid) {
                console.log(`Successfully generated categories for ${cityName}`);
                return categories;
            } else {
                console.error(`Invalid category structure for ${cityName}`);
                return null;
            }
        } else {
            console.error(`Expected 6 categories, got ${categories?.length || 0} for ${cityName}`);
            return null;
        }
        
    } catch (error) {
        console.error(`Error calling Gemini API for ${cityName}:`, error);
        return null;
    }
};
