/**
 * Media Processor Module
 * Downloads images and videos from Instagram CDN URLs into memory buffers
 *
 * Note: CDN URLs expire within hours, so this must be called immediately
 * after scraping. Media is held in memory (no S3) for Gemini processing.
 */

const https = require('https');
const http = require('http');

/**
 * Download a single media file to buffer
 * @param {string} url - CDN URL for the media
 * @param {number} index - Index for logging
 * @returns {Promise<{buffer: Buffer, mimeType: string, index: number}>}
 */
async function downloadMedia(url, index = 0) {
    console.log(`[mediaProcessor] Downloading media ${index + 1}: ${url.substring(0, 80)}...`);

    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.get(url, (res) => {
            // Handle redirects
            if (res.statusCode === 301 || res.statusCode === 302) {
                const redirectUrl = res.headers.location;
                console.log(`[mediaProcessor] Following redirect to: ${redirectUrl?.substring(0, 80)}...`);
                downloadMedia(redirectUrl, index).then(resolve).catch(reject);
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download media: HTTP ${res.statusCode}`));
                return;
            }

            const chunks = [];
            let totalSize = 0;

            res.on('data', (chunk) => {
                chunks.push(chunk);
                totalSize += chunk.length;
            });

            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const contentType = res.headers['content-type'] || 'application/octet-stream';

                // Determine mime type
                let mimeType = contentType.split(';')[0].trim();

                // Infer from URL if content-type is generic
                if (mimeType === 'application/octet-stream') {
                    if (url.includes('.jpg') || url.includes('.jpeg')) {
                        mimeType = 'image/jpeg';
                    } else if (url.includes('.png')) {
                        mimeType = 'image/png';
                    } else if (url.includes('.mp4')) {
                        mimeType = 'video/mp4';
                    } else if (url.includes('.webp')) {
                        mimeType = 'image/webp';
                    }
                }

                console.log(`[mediaProcessor] Downloaded media ${index + 1}: ${(totalSize / 1024).toFixed(1)}KB, type: ${mimeType}`);

                resolve({
                    buffer,
                    mimeType,
                    index,
                    size: totalSize
                });
            });

            res.on('error', reject);
        });

        req.on('error', (err) => {
            console.error(`[mediaProcessor] Error downloading media ${index + 1}:`, err.message);
            reject(err);
        });

        // Set timeout for large media files (60 seconds)
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error(`Download timeout for media ${index + 1}`));
        });
    });
}

/**
 * Download all media from scraped Instagram data
 * @param {object} scrapedData - Data from instagramScraper
 * @returns {Promise<Array<{buffer: Buffer, mimeType: string, index: number}>>}
 */
async function downloadAllMedia(scrapedData) {
    const { displayResourceUrls, displayUrl, type } = scrapedData;

    // Get list of URLs to download
    let urls = [];

    if (displayResourceUrls && displayResourceUrls.length > 0) {
        // Sidecar (carousel) posts have multiple images
        urls = displayResourceUrls;
    } else if (displayUrl) {
        urls = [displayUrl];
    }

    if (urls.length === 0) {
        console.warn('[mediaProcessor] No media URLs found in scraped data');
        return [];
    }

    console.log(`[mediaProcessor] Downloading ${urls.length} media file(s), type: ${type}`);

    // Download all media in parallel with error handling
    const downloadPromises = urls.map((url, index) =>
        downloadMedia(url, index).catch((err) => {
            console.error(`[mediaProcessor] Failed to download media ${index + 1}:`, err.message);
            return null; // Return null for failed downloads
        })
    );

    const results = await Promise.all(downloadPromises);

    // Filter out failed downloads
    const successfulDownloads = results.filter((r) => r !== null);

    console.log(`[mediaProcessor] Successfully downloaded ${successfulDownloads.length}/${urls.length} media files`);

    // Calculate total size
    const totalSize = successfulDownloads.reduce((sum, m) => sum + m.size, 0);
    console.log(`[mediaProcessor] Total media size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

    return successfulDownloads;
}

/**
 * Check if media type is video
 * @param {string} mimeType - MIME type
 * @returns {boolean}
 */
function isVideo(mimeType) {
    return mimeType && mimeType.startsWith('video/');
}

/**
 * Check if media type is image
 * @param {string} mimeType - MIME type
 * @returns {boolean}
 */
function isImage(mimeType) {
    return mimeType && mimeType.startsWith('image/');
}

module.exports = {
    downloadMedia,
    downloadAllMedia,
    isVideo,
    isImage
};
