import { Activity } from '../types/activity.types';

/**
 * Checks if an activity is a lodging activity
 */
export function isLodgingActivity(activity: Activity): boolean {
  return activity?.isLodging === true || activity?.primaryType === 'lodging';
}

/**
 * Enforces lodging anchor positioning in a day's activities array.
 * Lodging activities are automatically positioned at the start (check-in) and end (check-out) of the day.
 * All other activities are placed between them.
 *
 * @param activities - Array of activities for a day
 * @returns Reordered array with lodging at correct positions
 */
export function enforceLodgingAnchors(activities: Activity[]): Activity[] {
  if (!activities || activities.length === 0) {
    return activities;
  }

  // Separate lodging from non-lodging activities
  const lodgingActivities: Activity[] = [];
  const nonLodgingActivities: Activity[] = [];

  activities.forEach(activity => {
    if (isLodgingActivity(activity)) {
      lodgingActivities.push(activity);
    } else {
      nonLodgingActivities.push(activity);
    }
  });

  // If no lodging, return as-is
  if (lodgingActivities.length === 0) {
    return activities;
  }

  // If there's only 1 lodging, check if it's a check-out only (last day scenario)
  if (lodgingActivities.length === 1) {
    const lodging = lodgingActivities[0];

    // If this is a check-out activity (has check-out note), only place at start
    if (lodging.notes === 'Check-out') {
      return [lodging, ...nonLodgingActivities];
    }

    // Otherwise, it's a same-day check-in/check-out or middle day - place at start and end
    // Return: [check-in lodging, ...other activities..., check-out lodging]
    // Note: We keep the same reference for both check-in and check-out
    return [lodging, ...nonLodgingActivities, lodging];
  }

  // If there are 2+ lodging activities (multiple hotels or check-in/check-out as separate instances)
  // Place first lodging at start, last lodging at end, and any middle lodgings with other activities
  const firstLodging = lodgingActivities[0];
  const lastLodging = lodgingActivities[lodgingActivities.length - 1];
  const middleLodgings = lodgingActivities.slice(1, -1);

  return [
    firstLodging,
    ...nonLodgingActivities,
    ...middleLodgings,
    lastLodging,
  ];
}

/**
 * Enforces lodging anchors across all days in dayActivities object.
 *
 * @param dayActivities - Object mapping day numbers to day data with activities
 * @returns Updated dayActivities with enforced lodging positions
 */
export function enforceAllDayLodgingAnchors(dayActivities: {
  [dayNumber: number]: { dayNumber: number; activities: Activity[]; encodedPolyline?: string };
}): typeof dayActivities {
  const updatedDayActivities = { ...dayActivities };

  Object.keys(updatedDayActivities).forEach(dayKey => {
    const dayNumber = Number(dayKey);
    const dayData = updatedDayActivities[dayNumber];

    if (dayData && dayData.activities) {
      updatedDayActivities[dayNumber] = {
        ...dayData,
        activities: enforceLodgingAnchors(dayData.activities),
      };
    }
  });

  return updatedDayActivities;
}

/**
 * Finds all instance IDs of lodging activities that share the same place_id across all days.
 * Useful for removing an entire hotel stay when user deletes one lodging instance.
 *
 * @param placeId - The place_id of the lodging to find
 * @param dayActivities - Object mapping day numbers to day data
 * @returns Array of instanceIds for all lodging activities with the given place_id
 */
export function findRelatedLodgingInstances(
  placeId: string,
  dayActivities: { [dayNumber: number]: { activities: Activity[] } }
): string[] {
  const relatedInstanceIds: string[] = [];

  Object.values(dayActivities).forEach(dayData => {
    if (dayData && dayData.activities) {
      dayData.activities.forEach(activity => {
        if (
          isLodgingActivity(activity) &&
          activity.place_id === placeId &&
          activity.instanceId
        ) {
          relatedInstanceIds.push(activity.instanceId);
        }
      });
    }
  });

  return relatedInstanceIds;
}

/**
 * Finds all instance IDs and their day numbers for lodging activities that share the same place_id.
 * Useful for queueing remove operations when overwriting a hotel stay.
 *
 * @param placeId - The place_id of the lodging to find
 * @param dayActivities - Object mapping day numbers to day data
 * @returns Array of { instanceId, dayNumber } for all lodging activities with the given place_id
 */
export function findRelatedLodgingInstancesWithDays(
  placeId: string,
  dayActivities: { [dayNumber: number]: { activities: Activity[] } }
): { instanceId: string; dayNumber: number }[] {
  const result: { instanceId: string; dayNumber: number }[] = [];

  Object.entries(dayActivities).forEach(([dayStr, dayData]) => {
    const dayNumber = Number(dayStr);
    if (dayData && dayData.activities) {
      dayData.activities.forEach(activity => {
        if (
          isLodgingActivity(activity) &&
          activity.place_id === placeId &&
          activity.instanceId
        ) {
          result.push({ instanceId: activity.instanceId, dayNumber });
        }
      });
    }
  });

  return result;
}
