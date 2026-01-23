/**
 * Instagram Scraper Module
 * Uses Apify Instagram Scraper API to extract post data
 *
 * Reference: docs/apify_instagram_scrapper.md
 */

const APIFY_API_KEY = process.env.APIFY_API_KEY;

/**
 * Extract Instagram shortcode from URL
 * Supports: /p/, /reel/, /tv/ URL formats
 * @param {string} url - Instagram URL
 * @returns {string|null} - Shortcode or null
 */
function extractShortcode(url) {
    // Match patterns like:
    // https://www.instagram.com/p/ABC123/
    // https://www.instagram.com/reel/ABC123/
    // https://www.instagram.com/tv/ABC123/
    const match = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : null;
}

/**
 * Scrape Instagram post/reel data using Apify API
 * @param {string} instagramUrl - Instagram post or reel URL
 * @returns {Promise<object>} - Scraped post data
 */
async function scrapeInstagram(instagramUrl) {
    console.log('[instagramScraper] Starting scrape for:', instagramUrl);

    if (!APIFY_API_KEY) {
        throw new Error('APIFY_API_KEY environment variable is not set');
    }

    const shortCode = extractShortcode(instagramUrl);
    if (!shortCode) {
        throw new Error(`Invalid Instagram URL format: ${instagramUrl}`);
    }

    // Use synchronous endpoint to get results immediately
    const apiUrl = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;

    const requestBody = {
        directUrls: [instagramUrl],
        resultsType: 'details',
        resultsLimit: 1
    };

    console.log('[instagramScraper] Calling Apify API...');

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[instagramScraper] Apify API error:', response.status, errorText);
        throw new Error(`Apify API request failed: ${response.status} ${errorText}`);
    }

    const results = await response.json();

    if (!results || results.length === 0) {
        throw new Error('No results returned from Apify scraper');
    }

    const post = results[0];

    // Extract media URLs - Apify returns carousel images in childPosts or images array
    let mediaUrls = [];

    if (post.type === 'Video') {
        mediaUrls = [post.videoUrl];
    } else if (post.childPosts && post.childPosts.length > 0) {
        // Sidecar posts: extract from childPosts
        mediaUrls = post.childPosts
            .map(child => child.displayUrl || child.videoUrl)
            .filter(url => url);
    } else if (post.images && post.images.length > 0) {
        // Alternative: images array
        mediaUrls = post.images;
    } else if (post.displayUrl) {
        // Single image post
        mediaUrls = [post.displayUrl];
    }

    console.log('[instagramScraper] Scraped post:', {
        type: post.type,
        shortCode: post.shortCode,
        mediaCount: mediaUrls.length,
        ownerUsername: post.ownerUsername
    });

    // Normalize the response to consistent format
    return {
        // Core identifiers
        shortCode: post.shortCode,
        url: post.url || `https://www.instagram.com/p/${post.shortCode}/`,

        // Content
        caption: post.caption || '',
        type: post.type, // 'Image', 'Video', 'Sidecar'

        // Media URLs (CDN URLs - will expire)
        displayUrl: post.type === 'Video' ? post.videoUrl : post.displayUrl,
        displayResourceUrls: mediaUrls,

        // Owner info
        ownerUsername: post.ownerUsername,

        // Location (if tagged)
        locationName: post.locationName || null
    };
}

module.exports = {
    scrapeInstagram,
    extractShortcode
};
