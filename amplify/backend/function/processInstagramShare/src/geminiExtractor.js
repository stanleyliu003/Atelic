/**
 * Gemini Extractor Module
 * Uses Gemini 2.0 Flash to extract place names from Instagram content
 *
 * Media type dependent processing:
 * - Video/Reel: Prompted to analyze audio, frames, and on-screen text
 * - Image/Carousel: Prompted to analyze text on images
 * Both combined with caption text for context
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Build the extraction prompt for VIDEO content (Reels)
 * @param {string} caption - Instagram caption
 * @param {string|null} locationName - Tagged location from Instagram (if any)
 * @returns {string} - Prompt for Gemini
 */
function buildVideoPrompt(caption, locationName = null) {
    let prompt = `You are a travel content analyzer. Extract all specific, visitable places from this Instagram REEL/VIDEO.

ANALYZE THE VIDEO FOR:
1. AUDIO: Listen for place names mentioned verbally (restaurants, hotels, landmarks, etc.)
2. FRAMES: Look for visual landmarks, signs, storefronts, or recognizable locations
3. ON-SCREEN TEXT: Extract any text overlays showing place names, addresses, or locations
4. CAPTION: Use the caption text for additional context

IMPORTANT RULES:
- Only extract REAL, SPECIFIC places that someone can visit
- Include the city/region associated with each place
- Do NOT include generic descriptions ("beautiful beach", "amazing cafe")
- Do NOT include countries without specific places
- Do NOT include hashtags or user mentions unless they are actual place names

CAPTION:
${caption || '(no caption)'}
`;

    if (locationName) {
        prompt += `\nTAGGED LOCATION: ${locationName}`;
    }

    prompt += `

Return ONLY a JSON array. No markdown, no explanation.

RESPONSE FORMAT:
[
  {
    "name": "Place Name",
    "city": "City or Region"
  }
]

If no specific places are found, return: []`;

    return prompt;
}

/**
 * Build the extraction prompt for IMAGE content (Posts/Carousels)
 * @param {string} caption - Instagram caption
 * @param {string|null} locationName - Tagged location from Instagram (if any)
 * @returns {string} - Prompt for Gemini
 */
function buildImagePrompt(caption, locationName = null) {
    let prompt = `You are a travel content analyzer. Extract all specific, visitable places from this Instagram POST/IMAGE(S).

ANALYZE THE IMAGE(S) FOR:
1. TEXT ON IMAGES: Look for place names, addresses, or location text overlays
2. VISUAL LANDMARKS: Identify recognizable places (Eiffel Tower, Colosseum, famous restaurants, etc.)
3. SIGNS & STOREFRONTS: Read any visible business names or location signs
4. CAPTION: Use the caption text for additional context

IMPORTANT RULES:
- Only extract REAL, SPECIFIC places that someone can visit
- Include the city/region associated with each place
- Do NOT include generic descriptions ("beautiful beach", "amazing cafe")
- Do NOT include countries without specific places
- Do NOT include hashtags or user mentions unless they are actual place names

CAPTION:
${caption || '(no caption)'}
`;

    if (locationName) {
        prompt += `\nTAGGED LOCATION: ${locationName}`;
    }

    prompt += `

Return ONLY a JSON array. No markdown, no explanation.

RESPONSE FORMAT:
[
  {
    "name": "Place Name",
    "city": "City or Region"
  }
]

If no specific places are found, return: []`;

    return prompt;
}

/**
 * Convert media buffers to Gemini inline data format
 * @param {Array<{buffer: Buffer, mimeType: string}>} mediaBuffers
 * @returns {Array<object>} - Gemini inlineData parts
 */
function mediaToGeminiParts(mediaBuffers) {
    return mediaBuffers.map((media) => ({
        inlineData: {
            mimeType: media.mimeType,
            data: media.buffer.toString('base64')
        }
    }));
}

/**
 * Extract places from Instagram content using Gemini
 * @param {string} caption - Instagram caption
 * @param {Array<{buffer: Buffer, mimeType: string}>} mediaBuffers - Downloaded media
 * @param {string} mediaType - 'Video', 'Image', or 'Sidecar' from Apify
 * @param {string|null} locationName - Tagged location from Instagram
 * @returns {Promise<Array<{name: string, city: string}>>}
 */
async function extractPlacesWithGemini(caption, mediaBuffers = [], mediaType, locationName = null) {
    console.log('[geminiExtractor] Starting place extraction...');
    console.log(`[geminiExtractor] Media type: ${mediaType}, Caption length: ${caption?.length || 0}, Media count: ${mediaBuffers.length}`);

    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    // Select prompt based on media type
    const isVideo = mediaType === 'Video';
    const prompt = isVideo
        ? buildVideoPrompt(caption, locationName)
        : buildImagePrompt(caption, locationName);

    console.log(`[geminiExtractor] Using ${isVideo ? 'VIDEO' : 'IMAGE'} prompt`);

    // Build request parts
    const parts = [];

    // Add text prompt first
    parts.push({ text: prompt });

    // Add media (images/videos) if available
    if (mediaBuffers.length > 0) {
        const mediaParts = mediaToGeminiParts(mediaBuffers);
        parts.push(...mediaParts);
        console.log(`[geminiExtractor] Added ${mediaParts.length} media parts to request`);
    }

    // Build request body
    const requestBody = {
        contents: [
            {
                parts
            }
        ],
        generationConfig: {
            temperature: 0.2, // Low temperature for more consistent extraction
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
        },
        safetySettings: [
            {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE'
            },
            {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE'
            },
            {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE'
            },
            {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE'
            }
        ]
    };

    console.log('[geminiExtractor] Calling Gemini API...');

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[geminiExtractor] Gemini API error:', response.status, errorText);
        throw new Error(`Gemini API request failed: ${response.status}`);
    }

    const result = await response.json();

    // Extract text from response
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
        console.warn('[geminiExtractor] No response text from Gemini');
        return [];
    }

    console.log('[geminiExtractor] Raw Gemini response:', responseText.substring(0, 500));

    // Parse JSON response
    try {
        // Clean up response (remove markdown code blocks if present)
        let cleanedResponse = responseText.trim();
        if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.slice(7);
        }
        if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.slice(3);
        }
        if (cleanedResponse.endsWith('```')) {
            cleanedResponse = cleanedResponse.slice(0, -3);
        }
        cleanedResponse = cleanedResponse.trim();

        const places = JSON.parse(cleanedResponse);

        if (!Array.isArray(places)) {
            console.warn('[geminiExtractor] Response is not an array:', typeof places);
            return [];
        }

        // Validate and filter places - only require name and city
        const validPlaces = places.filter((place) => {
            if (!place.name || typeof place.name !== 'string') {
                return false;
            }
            // Filter out generic or invalid entries
            const invalidNames = ['unknown', 'n/a', 'none', 'not specified', 'no places found'];
            if (invalidNames.includes(place.name.toLowerCase())) {
                return false;
            }
            return true;
        });

        console.log(`[geminiExtractor] Extracted ${validPlaces.length} valid places from content`);
        validPlaces.forEach((place, i) => {
            console.log(`[geminiExtractor] Place ${i + 1}: ${place.name}, ${place.city || 'unknown city'}`);
        });

        return validPlaces;
    } catch (parseError) {
        console.error('[geminiExtractor] Failed to parse Gemini response as JSON:', parseError.message);
        console.error('[geminiExtractor] Response was:', responseText);
        return [];
    }
}

module.exports = {
    extractPlacesWithGemini,
    buildVideoPrompt,
    buildImagePrompt
};
