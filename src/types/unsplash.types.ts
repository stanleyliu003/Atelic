/**
 * Type definitions for Unsplash API integration
 *
 * These types support Unsplash API compliance requirements:
 * - Photographer attribution with clickable links
 * - Download tracking
 * - UTM parameter handling
 */

export interface UnsplashPhotoData {
  id: string;
  urls: {
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    username: string;
    links: {
      html: string; // Photographer profile URL
    };
  };
  links: {
    html: string; // Photo page URL
    download_location: string; // For tracking downloads
  };
}

export interface UnsplashAttribution {
  photographerName: string;
  photographerProfileUrl: string;
  photoPageUrl: string;
  downloadLocationUrl: string;
}

export interface UnsplashImageWithAttribution {
  imageUrl: string;
  attribution: UnsplashAttribution;
}
