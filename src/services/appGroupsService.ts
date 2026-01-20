/**
 * App Groups Service
 * 
 * Provides access to iOS App Groups shared storage for authentication data.
 * This allows the Share Extension to access user authentication state.
 * 
 * Keys stored:
 * - userID: Cognito user ID (sub claim)
 * - cognitoIdToken: JWT ID token for Lambda authentication
 * - isLoggedIn: Boolean flag for quick auth check
 */

import { NativeModules, Platform } from 'react-native';

interface AppGroupsStorageModule {
  setValue: (value: string, key: string) => void;
  getValue: (key: string) => Promise<string | null>;
  removeValue: (key: string) => void;
  clearAll: () => void;
}

const AppGroupsStorage: AppGroupsStorageModule | null = 
  Platform.OS === 'ios' ? NativeModules.AppGroupsStorage : null;

/**
 * Store user authentication data in App Groups.
 * Call this after successful login.
 */
export const storeAuthData = async (userID: string, idToken: string): Promise<void> => {
  if (!AppGroupsStorage) {
    console.warn('[AppGroups] Not available on this platform');
    return;
  }

  try {
    AppGroupsStorage.setValue(userID, 'userID');
    AppGroupsStorage.setValue(idToken, 'cognitoIdToken');
    AppGroupsStorage.setValue('true', 'isLoggedIn');
    console.log('[AppGroups] Stored auth data for userID:', userID);
  } catch (error) {
    console.error('[AppGroups] Failed to store auth data:', error);
  }
};

/**
 * Get stored userID from App Groups.
 */
export const getUserID = async (): Promise<string | null> => {
  if (!AppGroupsStorage) {
    return null;
  }

  try {
    const userID = await AppGroupsStorage.getValue('userID');
    return userID;
  } catch (error) {
    console.error('[AppGroups] Failed to get userID:', error);
    return null;
  }
};

/**
 * Get stored ID token from App Groups.
 */
export const getIdToken = async (): Promise<string | null> => {
  if (!AppGroupsStorage) {
    return null;
  }

  try {
    const idToken = await AppGroupsStorage.getValue('cognitoIdToken');
    return idToken;
  } catch (error) {
    console.error('[AppGroups] Failed to get ID token:', error);
    return null;
  }
};

/**
 * Check if user is logged in via App Groups.
 */
export const isLoggedIn = async (): Promise<boolean> => {
  if (!AppGroupsStorage) {
    return false;
  }

  try {
    const loggedIn = await AppGroupsStorage.getValue('isLoggedIn');
    return loggedIn === 'true';
  } catch (error) {
    console.error('[AppGroups] Failed to check login status:', error);
    return false;
  }
};

/**
 * Clear all authentication data from App Groups.
 * Call this on logout.
 */
export const clearAuthData = (): void => {
  if (!AppGroupsStorage) {
    console.warn('[AppGroups] Not available on this platform');
    return;
  }

  try {
    AppGroupsStorage.clearAll();
    console.log('[AppGroups] Cleared all auth data');
  } catch (error) {
    console.error('[AppGroups] Failed to clear auth data:', error);
  }
};

/**
 * Update ID token in App Groups.
 * Call this after token refresh.
 */
export const updateIdToken = async (idToken: string): Promise<void> => {
  if (!AppGroupsStorage) {
    console.warn('[AppGroups] Not available on this platform');
    return;
  }

  try {
    AppGroupsStorage.setValue(idToken, 'cognitoIdToken');
    console.log('[AppGroups] Updated ID token');
  } catch (error) {
    console.error('[AppGroups] Failed to update ID token:', error);
  }
};
