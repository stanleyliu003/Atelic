import { randomUUID } from 'expo-crypto';
import { Activity } from '../types/activity.types';

/**
 * Ensures an activity has an instanceId, generating one if missing
 * Used for backward compatibility with old trips
 */
export const ensureActivityInstanceId = (activity: Activity): Activity => {
  if (activity.instanceId) {
    return activity;
  }

  return {
    ...activity,
    instanceId: randomUUID()
  };
};

/**
 * Ensures all activities in an array have instanceIds
 */
export const ensureActivitiesHaveInstanceIds = (activities: Activity[]): Activity[] => {
  return activities.map(ensureActivityInstanceId);
};

/**
 * Creates a duplicate of an activity with a new instanceId
 * The place_id stays the same - this allows the same place to appear multiple times
 */
export const duplicateActivity = (activity: Activity): Activity => {
  return {
    ...activity,
    instanceId: randomUUID()  // New instance ID for the duplicate
    // place_id stays the same - this is the key difference
  };
};

/**
 * Generates a new instanceId for a new activity
 */
export const createActivityInstanceId = (): string => {
  return randomUUID();
};
