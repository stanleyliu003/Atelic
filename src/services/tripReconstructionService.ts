import { Activity, DayWithPolyline, TravelMode } from '../types/activity.types';
import {
  Operation,
  OperationAdd,
  OperationRemove,
  OperationModify,
  OperationModifyTrip,
  OperationReorder,
  OperationMove,
  OperationUpdateTransportMode,
  AnyOperation,
} from '../types/operation.types';
import { enforceLodgingAnchors } from '../utils/lodging_enforcement';

/**
 * Transportation mode override for a route leg
 * Key format: `${dayNumber}_${originInstanceId}` -> TravelMode
 */
export type TransportModeOverrides = {
  [legKey: string]: TravelMode;
};

/**
 * Trip state that can be reconstructed from operations
 */
export type ReconstructedTripState = {
  wishlist: Activity[];
  dayActivities: { [dayNumber: number]: DayWithPolyline };
  transportModes?: TransportModeOverrides; // Optional for backward compatibility
  tripTitle?: string | null; // Trip title from modify operations
};

/**
 * Result of state verification comparing actual vs reconstructed
 */
export type VerificationResult = {
  isMatch: boolean;
  differences: string[];
  actualState: ReconstructedTripState;
  reconstructedState: ReconstructedTripState;
};

/**
 * Applies a single operation to the current trip state
 * This is a pure function - does not mutate the input state
 *
 * @param state Current trip state
 * @param operation Operation to apply
 * @returns New trip state after applying operation
 */
export function applyOperation(
  state: ReconstructedTripState,
  operation: AnyOperation
): ReconstructedTripState {
  console.log('[applyOperation] Applying:', operation.type, operation.opId);

  switch (operation.type) {
    case 'add':
      return applyAddOperation(state, operation as OperationAdd);
    case 'remove':
      return applyRemoveOperation(state, operation as OperationRemove);
    case 'modify':
      return applyModifyOperation(state, operation as OperationModify);
    case 'reorder':
      return applyReorderOperation(state, operation as OperationReorder);
    case 'move':
      return applyMoveOperation(state, operation as OperationMove);
    case 'update_transport_mode':
      return applyUpdateTransportModeOperation(state, operation as OperationUpdateTransportMode);
    default:
      console.warn('[applyOperation] Unknown operation type:', (operation as any).type);
      return state;
  }
}

/**
 * Applies an ADD operation
 * Adds activities to wishlist or a specific day
 * Also handles special "addDay" action to create empty days
 */
function applyAddOperation(
  state: ReconstructedTripState,
  operation: OperationAdd
): ReconstructedTripState {
  // Special case: Adding a new day (creates empty day)
  if (operation.target === 'day' && operation.data?.action === 'addDay') {
    const dayNumber = operation.dayNumber;

    if (dayNumber === undefined) {
      console.warn('[applyAddOperation] addDay action missing dayNumber:', operation);
      return state;
    }

    // Create empty day if it doesn't exist
    const existingDay = state.dayActivities[dayNumber];
    if (existingDay) {
      console.log('[applyAddOperation] Day', dayNumber, 'already exists - skipping addDay');
      return state;
    }

    return {
      ...state,
      dayActivities: {
        ...state.dayActivities,
        [dayNumber]: {
          dayNumber,
          activities: [],
          encodedPolyline: undefined,
        },
      },
    };
  }

  // Normal case: Adding activities
  // Check if data has the new shape: { activities: [...], insertAfter: instanceId }
  const isNewShape = operation.data && typeof operation.data === 'object' && !Array.isArray(operation.data) && operation.data.activities;
  const activitiesToAdd = isNewShape ? operation.data.activities : (Array.isArray(operation.data) ? operation.data : [operation.data]);
  const insertAfter = isNewShape ? operation.data.insertAfter : undefined;

  if (operation.target === 'wishlist') {
    // If insertAfter is specified, insert after that activity
    if (insertAfter) {
      const insertIndex = state.wishlist.findIndex(a => a.instanceId === insertAfter);
      if (insertIndex >= 0) {
        const newWishlist = [...state.wishlist];
        newWishlist.splice(insertIndex + 1, 0, ...activitiesToAdd);
        return {
          ...state,
          wishlist: newWishlist,
        };
      }
    }
    // Default: append to end
    return {
      ...state,
      wishlist: [...state.wishlist, ...activitiesToAdd],
    };
  } else if (operation.target === 'day' && operation.dayNumber !== undefined) {
    const dayNumber = operation.dayNumber;
    const existingDay = state.dayActivities[dayNumber] || {
      dayNumber,
      activities: [],
      encodedPolyline: undefined,
    };

    // If insertAfter is specified, insert after that activity
    if (insertAfter) {
      const insertIndex = existingDay.activities.findIndex(a => a.instanceId === insertAfter);
      if (insertIndex >= 0) {
        const newActivities = [...existingDay.activities];
        newActivities.splice(insertIndex + 1, 0, ...activitiesToAdd);
        // Enforce lodging anchors when adding activities during reconstruction
        const enforcedActivities = enforceLodgingAnchors(newActivities);
        return {
          ...state,
          dayActivities: {
            ...state.dayActivities,
            [dayNumber]: {
              ...existingDay,
              activities: enforcedActivities,
            },
          },
        };
      }
    }

    // Default: append to end
    const updatedActivities = [...existingDay.activities, ...activitiesToAdd];
    // Enforce lodging anchors when adding activities during reconstruction
    const enforcedActivities = enforceLodgingAnchors(updatedActivities);
    return {
      ...state,
      dayActivities: {
        ...state.dayActivities,
        [dayNumber]: {
          ...existingDay,
          activities: enforcedActivities,
        },
      },
    };
  }

  console.warn('[applyAddOperation] Invalid target or missing dayNumber:', operation);
  return state;
}

/**
 * Applies a REMOVE operation
 * Removes activities by instanceId from wishlist or a specific day
 * Also handles special "deleteDay" action to remove entire days
 *
 * IDEMPOTENT: If activity doesn't exist, no error - just continue
 */
function applyRemoveOperation(
  state: ReconstructedTripState,
  operation: OperationRemove
): ReconstructedTripState {
  // Special case: Deleting an entire day
  if (operation.target === 'day' && (operation.data as any)?.action === 'deleteDay') {
    const dayNumber = operation.dayNumber;

    if (dayNumber === undefined) {
      console.warn('[applyRemoveOperation] deleteDay action missing dayNumber:', operation);
      return state;
    }

    const existingDay = state.dayActivities[dayNumber];
    if (!existingDay) {
      console.log('[applyRemoveOperation] Day', dayNumber, 'does not exist - skipping deleteDay');
      return state;
    }

    // Remove the day and renumber subsequent days
    const newDayActivities: { [dayNumber: number]: DayWithPolyline } = {};
    Object.entries(state.dayActivities).forEach(([dayStr, dayObj]) => {
      const dayNum = Number(dayStr);

      // Skip the day we're deleting
      if (dayNum === dayNumber) return;

      // Renumber days that come after the deleted day
      const newDayNum = dayNum > dayNumber ? dayNum - 1 : dayNum;
      newDayActivities[newDayNum] = {
        ...dayObj,
        dayNumber: newDayNum,
      };
    });

    return {
      ...state,
      dayActivities: newDayActivities,
    };
  }

  // Normal case: Removing activities
  const idsToRemove = Array.isArray(operation.data) ? operation.data : [operation.data];

  if (operation.target === 'wishlist') {
    return {
      ...state,
      wishlist: state.wishlist.filter(
        (activity) => !activity.instanceId || !idsToRemove.includes(activity.instanceId)
      ),
    };
  } else if (operation.target === 'day' && operation.dayNumber !== undefined) {
    const dayNumber = operation.dayNumber;
    const existingDay = state.dayActivities[dayNumber];

    if (!existingDay) {
      // Day doesn't exist - operation is idempotent, just skip
      console.log('[applyRemoveOperation] Day', dayNumber, 'does not exist - skipping');
      return state;
    }

    return {
      ...state,
      dayActivities: {
        ...state.dayActivities,
        [dayNumber]: {
          ...existingDay,
          activities: existingDay.activities.filter(
            (activity) => !activity.instanceId || !idsToRemove.includes(activity.instanceId)
          ),
        },
      },
    };
  }

  console.warn('[applyRemoveOperation] Invalid target or missing dayNumber:', operation);
  return state;
}

/**
 * Applies a MODIFY operation
 * Updates specific fields of an activity (delta-only)
 * Uses Last Write Wins (LWW) conflict resolution based on lastModified timestamp
 *
 * IDEMPOTENT: If activity doesn't exist, no error - just continue
 */
function applyModifyOperation(
  state: ReconstructedTripState,
  operation: OperationModify | OperationModifyTrip
): ReconstructedTripState {
  // Handle trip-level modifications (like tripTitle) first
  if (operation.target === 'trip') {
    const { field, value } = operation.data as { field: string; value: any };
    console.log('[applyModifyOperation] Trip-level modification:', field, '=', value);

    if (field === 'tripTitle') {
      return {
        ...state,
        tripTitle: value,
      };
    }
    // Handle other trip-level fields here in the future
    return state;
  }

  // For activity modifications, extract the activity-specific data
  const { instanceId, updates, lastModified } = operation.data as {
    instanceId: string;
    updates: Partial<Activity>;
    lastModified: number;
  };

  // Helper function to update an activity in a list
  const updateActivityInList = (activities: Activity[]): Activity[] => {
    return activities.map((activity) => {
      if (activity.instanceId === instanceId) {
        // Check if this modification is newer than existing
        if (activity.lastModified && activity.lastModified > lastModified) {
          console.log(
            '[applyModifyOperation] Skipping stale update for',
            instanceId,
            '- existing timestamp:',
            activity.lastModified,
            'operation timestamp:',
            lastModified
          );
          return activity; // Keep existing (newer) data
        }

        // Apply the updates
        return {
          ...activity,
          ...updates,
          lastModified, // Update the modification timestamp
        };
      }
      return activity;
    });
  };

  // Try to find and update in wishlist
  if (operation.target === 'wishlist') {
    return {
      ...state,
      wishlist: updateActivityInList(state.wishlist),
    };
  }

  // Try to find and update in specific day
  if (operation.target === 'day' && operation.dayNumber !== undefined) {
    const dayNumber = operation.dayNumber;
    const existingDay = state.dayActivities[dayNumber];

    if (!existingDay) {
      console.log('[applyModifyOperation] Day', dayNumber, 'does not exist - skipping');
      return state;
    }

    return {
      ...state,
      dayActivities: {
        ...state.dayActivities,
        [dayNumber]: {
          ...existingDay,
          activities: updateActivityInList(existingDay.activities),
        },
      },
    };
  }

  console.warn('[applyModifyOperation] Invalid target or missing dayNumber:', operation);
  return state;
}

/**
 * Applies a REORDER operation
 * Reorders activities within a day based on the new order of IDs
 * Uses Last Write Wins (LWW) conflict resolution based on lastReordered timestamp
 */
function applyReorderOperation(
  state: ReconstructedTripState,
  operation: OperationReorder
): ReconstructedTripState {
  const dayNumber = operation.dayNumber;
  const { reorderedIds, lastReordered } = operation.data;
  const existingDay = state.dayActivities[dayNumber];

  if (!existingDay) {
    console.log('[applyReorderOperation] Day', dayNumber, 'does not exist - skipping');
    return state;
  }

  // Check if any activity has a newer reorder timestamp
  const hasNewerReorder = existingDay.activities.some(
    (activity) => activity.lastReordered && activity.lastReordered > lastReordered
  );

  if (hasNewerReorder) {
    console.log(
      '[applyReorderOperation] Skipping stale reorder for day',
      dayNumber,
      '- newer reorder exists'
    );
    return state;
  }

  // Create a map of instanceId -> activity for O(1) lookup
  const activityMap = new Map<string, Activity>();
  existingDay.activities.forEach((activity) => {
    if (activity.instanceId) {
      activityMap.set(activity.instanceId, activity);
    }
  });

  // Rebuild the activities array in the new order
  const reorderedActivities: Activity[] = [];
  reorderedIds.forEach((instanceId) => {
    const activity = activityMap.get(instanceId);
    if (activity) {
      // Update the lastReordered timestamp
      reorderedActivities.push({
        ...activity,
        lastReordered,
      });
      activityMap.delete(instanceId); // Remove from map to track processed activities
    }
  });

  // Add any activities that weren't in the reorderedIds list (edge case)
  activityMap.forEach((activity) => {
    console.warn(
      '[applyReorderOperation] Activity',
      activity.instanceId,
      'not in reorder list - appending to end'
    );
    reorderedActivities.push(activity);
  });

  return {
    ...state,
    dayActivities: {
      ...state.dayActivities,
      [dayNumber]: {
        ...existingDay,
        activities: reorderedActivities,
      },
    },
  };
}

/**
 * Applies a MOVE operation
 * Atomically moves an activity from one location to another
 * fromLocation/toLocation can be 'wishlist' or a day number
 */
function applyMoveOperation(
  state: ReconstructedTripState,
  operation: OperationMove
): ReconstructedTripState {
  const data: any = operation.data;

  // Helper to perform the actual move once we know activity + locations
  const moveActivity = (
    curState: ReconstructedTripState,
    activity: Activity,
    fromLocation: 'wishlist' | number,
    toLocation: 'wishlist' | number,
    insertIndex?: number
  ): ReconstructedTripState => {
    let newState: ReconstructedTripState = {
      wishlist: [...curState.wishlist],
      dayActivities: { ...curState.dayActivities },
    };

    // Remove from source
    if (fromLocation === 'wishlist') {
      newState.wishlist = newState.wishlist.filter(
        (act) => act.instanceId !== activity.instanceId
      );
    } else {
      const fromDay = newState.dayActivities[fromLocation];
      if (fromDay) {
        newState.dayActivities = {
          ...newState.dayActivities,
          [fromLocation]: {
            ...fromDay,
            activities: fromDay.activities.filter(
              (act) => act.instanceId !== activity.instanceId
            ),
          },
        };
      }
    }

    // Add to destination (idempotently – avoid duplicate instanceIds)
    if (toLocation === 'wishlist') {
      const existsInWishlist = newState.wishlist.some(
        (act) => act.instanceId === activity.instanceId
      );
      if (!existsInWishlist) {
        // If insertIndex is provided, insert at that specific position
        // This preserves order when multiple activities are moved as a batch
        if (insertIndex !== undefined) {
          const newWishlist = [...newState.wishlist];
          newWishlist.splice(insertIndex, 0, activity);
          newState.wishlist = newWishlist;
        } else {
          // No index specified - prepend to top (default behavior)
          newState.wishlist = [activity, ...newState.wishlist];
        }
      }
    } else {
      const toDay = newState.dayActivities[toLocation] || {
        dayNumber: toLocation,
        activities: [],
        encodedPolyline: undefined,
      };

      const existsInDay = toDay.activities.some(
        (act) => act.instanceId === activity.instanceId
      );

      const updatedActivities = existsInDay
        ? toDay.activities
        : [...toDay.activities, activity];
      // Enforce lodging anchors when moving activities to a day during reconstruction
      const enforcedActivities = enforceLodgingAnchors(updatedActivities);

      newState.dayActivities = {
        ...newState.dayActivities,
        [toLocation]: {
          ...toDay,
          activities: enforcedActivities,
        },
      };
    }

    return newState;
  };

  // NEW SHAPE: activity + fromLocation/toLocation present
  if (data && data.activity && data.fromLocation !== undefined && data.toLocation !== undefined) {
    return moveActivity(state, data.activity, data.fromLocation, data.toLocation, data.insertIndex);
  }

  // LEGACY SHAPE: instanceId + fromDay/fromWishlist
  if (!data || !data.instanceId) {
    console.warn('[applyMoveOperation] Invalid move data - missing instanceId:', operation);
    return state;
  }

  const instanceId: string = data.instanceId;

  // Derive from/to locations from legacy fields
  let fromLocation: 'wishlist' | number | null = null;
  let toLocation: 'wishlist' | number | null = null;

  if (operation.target === 'wishlist' && typeof (data as any).fromDay === 'number') {
    // Moving from a specific day back to wishlist
    fromLocation = (data as any).fromDay;
    toLocation = 'wishlist';
  } else if (operation.target === 'day' && typeof operation.dayNumber === 'number') {
    // Moving TO a specific day
    toLocation = operation.dayNumber;

    if (data.fromWishlist) {
      fromLocation = 'wishlist';
    } else if (typeof data.fromDay === 'number') {
      fromLocation = data.fromDay;
    } else {
      // Fallback: find the day that currently contains this instanceId
      const containingDayEntry = Object.entries(state.dayActivities).find(
        ([, day]) => day.activities.some((a) => a.instanceId === instanceId)
      );
      if (containingDayEntry) {
        fromLocation = Number(containingDayEntry[0]);
      } else {
        // If we can't find it in any day, assume wishlist as source
        fromLocation = 'wishlist';
      }
    }
  }

  if (fromLocation === null || toLocation === null) {
    console.warn(
      '[applyMoveOperation] Could not determine from/to locations for legacy move operation:',
      operation
    );
    return state;
  }

  // Look up the activity from the source location
  let activity: Activity | undefined;

  if (fromLocation === 'wishlist') {
    activity = state.wishlist.find((a) => a.instanceId === instanceId);
  } else {
    const fromDay = state.dayActivities[fromLocation];
    activity = fromDay?.activities.find((a) => a.instanceId === instanceId);
  }

  if (!activity) {
    console.warn(
      '[applyMoveOperation] Activity not found in source location for legacy move:',
      instanceId
    );
    return state;
  }

  return moveActivity(state, activity, fromLocation, toLocation, undefined);
}

/**
 * Applies an UPDATE_TRANSPORT_MODE operation
 * Updates the transportation mode for a route leg between two activities
 * Uses Last Write Wins (LWW) conflict resolution based on lastModified timestamp
 *
 * @param state Current trip state
 * @param operation The update_transport_mode operation
 * @returns New trip state with updated transport mode
 */
function applyUpdateTransportModeOperation(
  state: ReconstructedTripState,
  operation: OperationUpdateTransportMode
): ReconstructedTripState {
  const { originInstanceId, mode, lastModified } = operation.data;
  const dayNumber = operation.dayNumber;

  // Create the leg key for this route segment
  const legKey = `${dayNumber}_${originInstanceId}`;

  // Get existing transport modes or initialize empty object
  const currentModes = state.transportModes || {};

  // Check if we already have a more recent update for this leg
  // We use a convention where the lastModified is stored in a parallel map
  // For simplicity, we'll just overwrite since operations are applied in order
  // and LWW is already handled by the operation timestamp ordering

  console.log(
    '[applyUpdateTransportModeOperation] Setting mode for leg',
    legKey,
    'to',
    mode
  );

  return {
    ...state,
    transportModes: {
      ...currentModes,
      [legKey]: mode,
    },
  };
}

/**
 * Reconstructs trip state from a list of operations
 * Operations should be sorted by timestamp + sequenceNumber (oldest first)
 *
 * @param operations Array of operations to replay
 * @param initialState Optional initial state (defaults to empty trip)
 * @returns Reconstructed trip state
 */
export function reconstructTripFromOperations(
  operations: AnyOperation[],
  initialState?: ReconstructedTripState
): ReconstructedTripState {
  console.log('[reconstructTripFromOperations] Starting reconstruction with', operations.length, 'operations');

  // Start with empty state or provided initial state
  const startState: ReconstructedTripState = initialState || {
    wishlist: [],
    dayActivities: {},
    transportModes: {},
  };

  // Sort operations by timestamp, then sequenceNumber (defensive - should already be sorted)
  const sortedOperations = [...operations].sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return a.sequenceNumber - b.sequenceNumber;
  });

  // Apply each operation in order (reduce pattern)
  const finalState = sortedOperations.reduce((state, operation) => {
    return applyOperation(state, operation);
  }, startState);

  console.log('[reconstructTripFromOperations] ✅ Reconstruction complete');
  console.log('[reconstructTripFromOperations] Final wishlist:', finalState.wishlist.length, 'activities');
  console.log('[reconstructTripFromOperations] Final days:', Object.keys(finalState.dayActivities).length);
  console.log('[reconstructTripFromOperations] Transport mode overrides:', Object.keys(finalState.transportModes || {}).length);

  return finalState;
}

/**
 * Verifies that reconstructed state matches the actual current state
 * Used for testing and validation in dual-write mode
 *
 * @param actualWishlist Current wishlist from app state
 * @param actualDayActivities Current day activities from app state
 * @param operations Array of operations to replay
 * @returns Verification result with match status and differences
 */
export function verifyStateReconstruction(
  actualWishlist: Activity[],
  actualDayActivities: { [dayNumber: number]: DayWithPolyline },
  operations: AnyOperation[]
): VerificationResult {
  console.log('[verifyStateReconstruction] Starting verification...');

  const actualState: ReconstructedTripState = {
    wishlist: actualWishlist,
    dayActivities: actualDayActivities,
  };

  const reconstructedState = reconstructTripFromOperations(operations);

  const differences: string[] = [];

  // Compare wishlist
  if (actualState.wishlist.length !== reconstructedState.wishlist.length) {
    differences.push(
      `Wishlist count mismatch: actual=${actualState.wishlist.length}, reconstructed=${reconstructedState.wishlist.length}`
    );
  }

  // Check each wishlist activity
  actualState.wishlist.forEach((actualActivity, index) => {
    const reconstructedActivity = reconstructedState.wishlist.find(
      (act) => act.instanceId === actualActivity.instanceId
    );

    if (!reconstructedActivity) {
      differences.push(
        `Wishlist activity missing in reconstruction: ${actualActivity.instanceId} (${actualActivity.name})`
      );
    } else {
      // Compare key fields (ignore volatile fields like photo_reference)
      const fieldsToCompare = ['name', 'lat', 'lng', 'place_id', 'notes', 'startTime', 'endTime'];
      fieldsToCompare.forEach((field) => {
        const actualValue = (actualActivity as any)[field];
        const reconstructedValue = (reconstructedActivity as any)[field];
        if (actualValue !== reconstructedValue) {
          differences.push(
            `Wishlist activity field mismatch for ${actualActivity.instanceId}: ${field} (actual=${actualValue}, reconstructed=${reconstructedValue})`
          );
        }
      });
    }
  });

  // Compare day activities
  const actualDayNumbers = Object.keys(actualState.dayActivities).map(Number);
  const reconstructedDayNumbers = Object.keys(reconstructedState.dayActivities).map(Number);

  if (actualDayNumbers.length !== reconstructedDayNumbers.length) {
    differences.push(
      `Day count mismatch: actual=${actualDayNumbers.length}, reconstructed=${reconstructedDayNumbers.length}`
    );
  }

  // Check each day
  actualDayNumbers.forEach((dayNumber) => {
    const actualDay = actualState.dayActivities[dayNumber];
    const reconstructedDay = reconstructedState.dayActivities[dayNumber];

    if (!reconstructedDay) {
      differences.push(`Day ${dayNumber} missing in reconstruction`);
      return;
    }

    if (actualDay.activities.length !== reconstructedDay.activities.length) {
      differences.push(
        `Day ${dayNumber} activity count mismatch: actual=${actualDay.activities.length}, reconstructed=${reconstructedDay.activities.length}`
      );
    }

    // Check activity order and content
    actualDay.activities.forEach((actualActivity, index) => {
      const reconstructedActivity = reconstructedDay.activities[index];

      if (!reconstructedActivity) {
        differences.push(
          `Day ${dayNumber} activity at position ${index} missing in reconstruction: ${actualActivity.instanceId}`
        );
        return;
      }

      if (actualActivity.instanceId !== reconstructedActivity.instanceId) {
        differences.push(
          `Day ${dayNumber} activity order mismatch at position ${index}: actual=${actualActivity.instanceId}, reconstructed=${reconstructedActivity.instanceId}`
        );
      }

      // Compare key fields
      const fieldsToCompare = ['name', 'lat', 'lng', 'place_id', 'notes', 'startTime', 'endTime'];
      fieldsToCompare.forEach((field) => {
        const actualValue = (actualActivity as any)[field];
        const reconstructedValue = (reconstructedActivity as any)[field];
        if (actualValue !== reconstructedValue) {
          differences.push(
            `Day ${dayNumber} activity field mismatch for ${actualActivity.instanceId}: ${field} (actual=${actualValue}, reconstructed=${reconstructedValue})`
          );
        }
      });
    });
  });

  const isMatch = differences.length === 0;

  console.log('[verifyStateReconstruction] ✅ Verification complete');
  console.log('[verifyStateReconstruction] Match:', isMatch);
  if (!isMatch) {
    console.warn('[verifyStateReconstruction] ❌ Differences found:', differences.length);
    differences.forEach((diff) => console.warn('  - ' + diff));
  }

  return {
    isMatch,
    differences,
    actualState,
    reconstructedState,
  };
}
