/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	GEMINI_API_KEY
Amplify Params - DO NOT EDIT */

const { GoogleGenerativeAI } = require('@google/generative-ai');

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
        
        // Generate city categories using Gemini AI
        const cityCategories = await generateCityCategories(selectedCity);
        
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
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `You are a travel categorization engine with deep local knowledge.

GOAL
Given a single place name (city or country), return a JSON array of EXACTLY 6 objects. Each object must have:
- "category": a short, distinctive Title Case label that captures what makes this place unique
- "category_items": an array with EXACTLY ONE string containing EXACTLY THREE specific items separated by commas (no "and")

RULES
- Use only items actually located in the requested place (city-level for cities; country-level for countries)
- Categories must be distinctive to this destination - avoid generic labels like "Restaurants" or "Attractions"
- Items must be specific proper nouns: actual place names, institutions, neighborhoods, or experiences unique to this location
- Prioritize local favorites and authentic experiences over tourist traps
- Keep categories mutually distinct with no overlap
- Cover diverse interests (culture, food, neighborhoods, landmarks, nature, etc.)
- Use correct diacritics and proper spelling
- No duplicates across categories or items
- Output valid JSON ONLY - no prose, no markdown, no trailing commas

OUTPUT FORMAT
[
  { "category": "Distinctive Category Name", "category_items": ["Item 1, Item 2, Item 3"] },
  { "category": "Distinctive Category Name", "category_items": ["Item 1, Item 2, Item 3"] },
  { "category": "Distinctive Category Name", "category_items": ["Item 1, Item 2, Item 3"] },
  { "category": "Distinctive Category Name", "category_items": ["Item 1, Item 2, Item 3"] },
  { "category": "Distinctive Category Name", "category_items": ["Item 1, Item 2, Item 3"] },
  { "category": "Distinctive Category Name", "category_items": ["Item 1, Item 2, Item 3"] }
]

EXAMPLE (for reference only; do NOT include unless input is exactly "Paris, France"):
Input: Paris, France
Output:
[
  { "category": "Art & Museums", "category_items": ["Louvre, Musée d'Orsay, Centre Pompidou"] },
  { "category": "Café Culture", "category_items": ["Café de Flore, Les Deux Magots, Café Procope"] },
  { "category": "Iconic Landmarks", "category_items": ["Eiffel Tower, Arc de Triomphe, Notre-Dame"] },
  { "category": "Michelin Dining", "category_items": ["L'Ambroisie, Guy Savoy, Le Bristol"] },
  { "category": "Bohemian Quarters", "category_items": ["Montmartre, Le Marais, Saint-Germain"] },
  { "category": "Seine Experiences", "category_items": ["Bateaux Parisiens, Pont Neuf, Île Saint-Louis"] }
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
