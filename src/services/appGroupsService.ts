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
  setGroupValue: (value: string, key: string) => void;
  getValue: (key: string) => Promise<string | null>;
  removeValue: (key: string) => void;
  clearAll: () => void;
}

// Diagnostic logging for native module availability
console.log('[AppGroups] Platform.OS:', Platform.OS);
console.log('[AppGroups] NativeModules.AppGroupsStorage exists:', !!NativeModules.AppGroupsStorage);

if (Platform.OS === 'ios' && !NativeModules.AppGroupsStorage) {
  console.warn('[AppGroups] Running on iOS but AppGroupsStorage native module not found!');
  console.warn('[AppGroups] Available native modules:', Object.keys(NativeModules).filter(key => key.includes('App') || key.includes('Group')));
  console.warn('[AppGroups] This usually means:');
  console.warn('[AppGroups]   1. Running in Expo Go (not a dev build)');
  console.warn('[AppGroups]   2. Native module not linked (need to rebuild)');
  console.warn('[AppGroups]   3. Build cache issue (try cleaning DerivedData)');
}

const AppGroupsStorage: AppGroupsStorageModule | null = 
  Platform.OS === 'ios' ? NativeModules.AppGroupsStorage : null;

if (AppGroupsStorage) {
  console.log('[AppGroups] ✅ Native module loaded successfully');
} else {
  console.log('[AppGroups] ❌ Native module not available');
}

/**
 * Store user authentication data in App Groups.
 * Call this after successful login.
 * 
 * @returns {Promise<boolean>} true if storage succeeded, false if unavailable
 */
export const storeAuthData = async (userID: string, idToken: string): Promise<boolean> => {
  console.log('[AppGroups] storeAuthData() called with userID:', userID?.substring(0, 8) + '...');
  
  if (!AppGroupsStorage) {
    console.warn('[AppGroups] ❌ Cannot store auth data - native module not available');
    console.warn('[AppGroups]    Platform:', Platform.OS);
    console.warn('[AppGroups]    Running in development build?', __DEV__ ? 'YES' : 'NO');
    return false;
  }

  try {
    console.log('[AppGroups] Attempting to store 3 keys: userID, cognitoIdToken, isLoggedIn');
    
    AppGroupsStorage.setGroupValue(userID, 'userID');
    console.log('[AppGroups]   ✅ Stored userID');
    
    AppGroupsStorage.setGroupValue(idToken, 'cognitoIdToken');
    console.log('[AppGroups]   ✅ Stored cognitoIdToken');
    
    AppGroupsStorage.setGroupValue('true', 'isLoggedIn');
    console.log('[AppGroups]   ✅ Stored isLoggedIn flag');
    
    console.log('[AppGroups] ✅ Successfully stored all auth data for userID:', userID?.substring(0, 8) + '...');
    return true;
  } catch (error) {
    console.error('[AppGroups] ❌ Failed to store auth data:', error);
    console.error('[AppGroups]    Error type:', error?.constructor?.name);
    console.error('[AppGroups]    Error message:', error?.message);
    return false;
  }
};

/**
 * Get stored userID from App Groups.
 */
export const getUserID = async (): Promise<string | null> => {
  console.log('[AppGroups] getUserID() called');
  
  if (!AppGroupsStorage) {
    console.warn('[AppGroups] ❌ Cannot get userID - native module not available');
    return null;
  }

  try {
    const userID = await AppGroupsStorage.getValue('userID');
    if (userID) {
      console.log('[AppGroups] ✅ Retrieved userID:', userID.substring(0, 8) + '...');
    } else {
      console.log('[AppGroups] ⚠️ No userID found in App Groups');
    }
    return userID;
  } catch (error) {
    console.error('[AppGroups] ❌ Failed to get userID:', error);
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
 * 
 * @returns {boolean} true if clear succeeded, false if unavailable
 */
export const clearAuthData = (): boolean => {
  console.log('[AppGroups] clearAuthData() called');
  
  if (!AppGroupsStorage) {
    console.warn('[AppGroups] ❌ Cannot clear auth data - native module not available');
    return false;
  }

  try {
    AppGroupsStorage.clearAll();
    console.log('[AppGroups] ✅ Cleared all auth data from App Groups');
    return true;
  } catch (error) {
    console.error('[AppGroups] ❌ Failed to clear auth data:', error);
    return false;
  }
};

/**
 * Update ID token in App Groups.
 * Call this after token refresh.
 * 
 * @returns {Promise<boolean>} true if update succeeded, false if unavailable
 */
export const updateIdToken = async (idToken: string): Promise<boolean> => {
  console.log('[AppGroups] updateIdToken() called');
  
  if (!AppGroupsStorage) {
    console.warn('[AppGroups] ❌ Cannot update ID token - native module not available');
    return false;
  }

  try {
    AppGroupsStorage.setGroupValue(idToken, 'cognitoIdToken');
    console.log('[AppGroups] ✅ Updated ID token in App Groups');
    return true;
  } catch (error) {
    console.error('[AppGroups] ❌ Failed to update ID token:', error);
    return false;
  }
};
