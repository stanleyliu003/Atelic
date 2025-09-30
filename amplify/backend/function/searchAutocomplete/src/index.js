/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	GEMINI_API_KEY
Amplify Params - DO NOT EDIT */

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Lambda function to generate search autocomplete suggestions using Gemini AI
 * Returns 5 autocomplete suggestions based on user query and active filters
 */
exports.handler = async (event) => {
    console.log('searchAutocomplete input:', JSON.stringify(event, null, 2));

    try {
        const { selectedCity, query, filters = [] } = event.arguments || event;

        if (!selectedCity) {
            throw new Error('selectedCity is required');
        }

        if (!query || query.trim().length === 0) {
            return {
                suggestions: []
            };
        }

        // Check for API key
        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY environment variable not set');
            throw new Error('GEMINI_API_KEY not configured');
        }

        // Initialize Gemini with API key from environment
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        // Create prompt for Gemini with filter context
        const prompt = buildAutocompletePrompt(selectedCity, query, filters);
        console.log(`Calling Gemini API for autocomplete: "${query}" in ${selectedCity} with filters: [${filters.join(', ')}]`);

        // Call Gemini API using the SDK
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const geminiResponse = response.text();

        console.log(`Raw Gemini response for "${query}": ${geminiResponse}`);

        // Parse the response from Gemini
        let analysisResult;
        try {
            // Extract JSON from response (similar to CityCategories pattern)
            const jsonString = geminiResponse.match(/{.*}/s)?.[0] || geminiResponse.trim();
            analysisResult = JSON.parse(jsonString);
        } catch (parseError) {
            console.error(`Error parsing Gemini response for "${query}":`, parseError);
            console.error(`Raw response: ${geminiResponse}`);
            throw new Error('Failed to parse autocomplete suggestions from AI response.');
        }

        const { suggestions } = analysisResult;

        if (!suggestions || !Array.isArray(suggestions)) {
            console.error(`Invalid suggestions structure for "${query}"`);
            throw new Error('Invalid JSON structure from AI. Missing "suggestions" array.');
        }

        console.log(`Successfully generated ${suggestions.length} autocomplete suggestions for query: ${query}`);

        return {
            suggestions: suggestions
        };

    } catch (error) {
        console.error('Error in searchAutocomplete:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to generate autocomplete suggestions',
                details: error.message
            })
        };
    }
};

/**
 * Build autocomplete-specific prompt for Gemini AI
 * Includes user query, city context, and active filters
 */
function buildAutocompletePrompt(selectedCity, query, filters) {
    const filtersContext = filters.length > 0
        ? `\nACTIVE FILTERS: ${filters.join(', ')}\nYour suggestions should reflect these filters where relevant.\n`
        : '';

    return `
You are a travel search assistant for ${selectedCity}. The user has typed: "${query}".
${filtersContext}
Generate exactly 5 autocomplete suggestions that:
1. Complete or expand on the user's query "${query}"
2. Are specific to ${selectedCity}
3. Respect the active filters if applicable
4. Are suitable for searching with Google Places API
5. Progress from general to more specific suggestions
6. Are diverse and cover different interpretations of the query

CRITICAL CONSTRAINTS:
- Generate exactly 5 suggestions
- Each suggestion should be a search query string (not a specific place name)
- Suggestions should be relevant to travel and activities in ${selectedCity}
- Keep suggestions no longer than 3 words
- Do not include the city name in the suggestions 
- Order from most likely to least likely completion

STRICT OUTPUT FORMAT:
Return ONLY this JSON structure with no additional text:
{"suggestions":["suggestion1","suggestion2","suggestion3","suggestion4","suggestion5"]}

Generate 5 autocomplete suggestions for "${query}" in ${selectedCity} now:
    `;
}