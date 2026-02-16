/**
 * Version Check Service
 * Fetches minimum version requirements from backend (DynamoDB via AppSync)
 * This ensures version enforcement works even for users with outdated app bundles
 */

import { Platform } from 'react-native';
import { API, graphqlOperation } from 'aws-amplify';
import { CURRENT_ENV } from '../../constants/AppConfig';
import DeviceInfo from 'react-native-device-info';
import { isVersionOutdated } from '../utils/versionComparison';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VERSION_CACHE_KEY = '@version_check_cache';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 6 hours

const GET_VERSION_CONFIG = /* GraphQL */ `
  query GetVersionConfig($platform: String!, $environment: String!) {
    getVersionConfig(platform: $platform, environment: $environment) {
      id
      platform
      minimumVersion
      environment
      lastUpdated
    }
  }
`;

export interface VersionConfig {
  id: string;
  platform: string;
  minimumVersion: string;
  environment: string;
  lastUpdated?: string;
}

/**
 * Check if app update is required by fetching minimum version from backend
 * Returns the minimum version if update is required, or null if app is up to date
 *
 * @returns Promise<string | null> - Minimum version string if update required, null otherwise
 *
 * @example
 * const minimumVersion = await checkUpdateRequired();
 * if (minimumVersion) {
 *   // Show UpdateRequired modal with currentVersion and minimumVersion
 * }
 */
export const checkUpdateRequired = async (): Promise<string | null> => {
  try {
    const currentVersion = DeviceInfo.getVersion(); // e.g., "1.0.3"
    const platform = Platform.OS; // 'ios' or 'android'
    const environment = CURRENT_ENV; // 'dev', 'staging', or 'prod'

    // Check AsyncStorage cache first to avoid network call on most launches
    try {
      const cached = await AsyncStorage.getItem(VERSION_CACHE_KEY);
      if (cached) {
        const { minimumVersion, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < CACHE_TTL_MS) {
          console.log('[VersionCheck] Using cached result (age:', Math.round(age / 60000), 'min)');
          const updateRequired = isVersionOutdated(currentVersion, minimumVersion);
          return updateRequired ? minimumVersion : null;
        }
      }
    } catch (cacheErr) {
      // Cache read failed, proceed with network fetch
    }

    console.log('[VersionCheck] Checking version requirements:', {
      currentVersion,
      platform,
      environment
    });

    // Fetch minimum version from backend (DynamoDB via Lambda)
    const response: any = await API.graphql(
      graphqlOperation(GET_VERSION_CONFIG, {
        platform,
        environment
      })
    );

    const config: VersionConfig = response.data.getVersionConfig;

    console.log('[VersionCheck] Received config from backend:', config);

    // Cache the result for subsequent launches
    try {
      await AsyncStorage.setItem(VERSION_CACHE_KEY, JSON.stringify({
        minimumVersion: config.minimumVersion,
        timestamp: Date.now(),
      }));
    } catch (cacheErr) {
      // Cache write failed, non-critical
    }

    // Compare versions
    const updateRequired = isVersionOutdated(currentVersion, config.minimumVersion);

    if (updateRequired) {
      console.log('[VersionCheck] Update required:', {
        current: currentVersion,
        minimum: config.minimumVersion
      });
      return config.minimumVersion;
    }

    console.log('[VersionCheck] App is up to date');
    return null;

  } catch (error) {
    console.error('[VersionCheck] Error checking version requirements:', error);

    // Fail open - don't block users if version check fails
    // This prevents users from being locked out due to backend issues
    console.warn('[VersionCheck] Failing open - allowing access despite error');
    return null;
  }
};

/**
 * Get current app version
 * @returns Current version string (e.g., "1.0.4")
 */
export const getCurrentAppVersion = (): string => {
  return DeviceInfo.getVersion();
};
