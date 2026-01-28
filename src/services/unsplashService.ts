/**
 * Unsplash API Service
 *
 * Handles Unsplash-specific operations including download tracking.
 * Required for Unsplash API compliance.
 */

import { UNSPLASH_ACCESS_KEY } from '../constants/api';

/**
 * Track Unsplash photo download
 *
 * Unsplash requires this endpoint to be called when a user "downloads" (uses) a photo.
 * This helps photographers track their work's impact and is required for API compliance.
 *
 * @param downloadLocationUrl - The download_location URL from the Unsplash API response
 */
export const trackUnsplashDownload = async (
  downloadLocationUrl: string
): Promise<void> => {
  try {
    const response = await fetch(downloadLocationUrl, {
      method: 'GET',
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      },
    });

    if (!response.ok) {
      console.warn('[Unsplash] Download tracking failed:', response.status, response.statusText);
    } else {
      console.log('[Unsplash] Download tracked successfully');
    }
  } catch (error) {
    console.error('[Unsplash] Failed to track download:', error);
    // Don't throw - tracking failure shouldn't break user experience
  }
};
