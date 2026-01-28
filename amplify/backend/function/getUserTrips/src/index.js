/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_TRIPOPERATIONSSTORAGE_ARN
	STORAGE_TRIPOPERATIONSSTORAGE_NAME
	STORAGE_TRIPOPERATIONSSTORAGE_STREAMARN
	STORAGE_TRIPSTORAGE_ARN
	STORAGE_TRIPSTORAGE_NAME
	STORAGE_TRIPSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

// Cache for TripOperation table name
let cachedTableName = null;

/**
 * Find the TripOperation table name dynamically
 * Table name pattern: TripOperation-<api-id>-<env>
 */
async function getTripOperationTableName() {
  if (cachedTableName) {
    return cachedTableName;
  }

  // IMPORTANT: Don't use STORAGE_TRIPOPERATIONSSTORAGE_NAME - it returns "TripOperations-staging" which is wrong
  // The actual table name is "TripOperation-<api-id>-<env>" (singular, with API ID suffix)

  // Get current environment from Lambda env vars
  const currentEnv = process.env.ENV || 'staging';
  console.log('[getTripOperationTableName] Current environment:', currentEnv);

  // List tables and find the one matching TripOperation pattern FOR THIS ENVIRONMENT
  try {
    const listCommand = new ListTablesCommand({});
    const result = await client.send(listCommand);
    const tables = result.TableNames || [];

    // Find table starting with "TripOperation-" AND ending with current environment
    const tripOpTable = tables.find(name =>
      name.startsWith('TripOperation-') && name.endsWith(`-${currentEnv}`)
    );

    if (tripOpTable) {
      cachedTableName = tripOpTable;
      console.log('[getTripOperationTableName] Found table via ListTables:', cachedTableName);
      return cachedTableName;
    }
  } catch (error) {
    console.warn('[getTripOperationTableName] Failed to list tables:', error.message);
  }

  console.error('[getTripOperationTableName] ❌ Could not find TripOperation table for environment:', currentEnv);
  return null;
}

// Helper function to normalize tripPhotoReference to array format
const normalizePhotoReferences = (photoRef) => {
  if (!photoRef) return [];
  if (Array.isArray(photoRef)) return photoRef;
  return [photoRef]; // Convert old string format to array
};

/**
 * Load operations from TripOperation table that are newer than a given timestamp
 * @param {string} tripID - The trip ID
 * @param {number} sinceTimestamp - Only load operations after this timestamp (in milliseconds)
 * @returns {Promise<Array>} Array of parsed operations sorted by timestamp
 */
async function loadOperationsSince(tripID, sinceTimestamp = 0) {
  const tableName = await getTripOperationTableName();

  if (!tableName) {
    console.warn('[loadOperationsSince] TripOperation table not found - skipping operation load (trip will use snapshot only)');
    return [];
  }

  try {
    console.log('[loadOperationsSince] Loading operations for trip:', tripID, 'since:', new Date(sinceTimestamp).toISOString());

    // Query the byTripID GSI (tripID is partition key, timestamp is sort key)
    // The main table has 'id' as partition key, so we need the GSI for tripID queries
    const params = {
      TableName: tableName,
      IndexName: 'byTripID', // GSI with tripID as partition key, timestamp as sort key
      KeyConditionExpression: 'tripID = :tripID AND #timestamp > :sinceTimestamp',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':tripID': tripID,
        ':sinceTimestamp': sinceTimestamp
      },
      Limit: 1000 // Adjust if needed
    };

    const result = await docClient.send(new QueryCommand(params));
    const items = result.Items || [];

    console.log('[loadOperationsSince] Found', items.length, 'operations newer than snapshot');

    // Parse operationData and sort by timestamp + sequenceNumber
    const operations = items
      .map(item => {
        try {
          // operationData might be a string (needs parsing) or already an object (DynamoDB DocumentClient)
          const operation = typeof item.operationData === 'string'
            ? JSON.parse(item.operationData)
            : item.operationData;

          return operation;
        } catch (error) {
          console.error('[loadOperationsSince] Failed to parse operation:', item.opId, error);
          return null;
        }
      })
      .filter(op => op !== null)
      .sort((a, b) => {
        if (a.timestamp !== b.timestamp) {
          return a.timestamp - b.timestamp;
        }
        return a.sequenceNumber - b.sequenceNumber;
      });

    return operations;
  } catch (error) {
    console.error('[loadOperationsSince] Error loading operations:', error);
    return [];
  }
}

/**
 * Apply a single operation to trip state
 * This is a simplified version of the frontend applyOperation logic
 */
function applyOperation(state, operation) {
  const newState = { ...state };

  switch (operation.type) {
    case 'add':
      return applyAddOperation(newState, operation);
    case 'remove':
      return applyRemoveOperation(newState, operation);
    case 'modify':
      return applyModifyOperation(newState, operation);
    case 'reorder':
      return applyReorderOperation(newState, operation);
    case 'move':
      return applyMoveOperation(newState, operation);
    default:
      console.warn('[applyOperation] Unknown operation type:', operation.type);
      return newState;
  }
}

function applyAddOperation(state, operation) {
  const activitiesToAdd = Array.isArray(operation.data) ? operation.data : [operation.data];

  // Handle special case: adding a new day
  if (operation.target === 'day' && operation.data?.action === 'addDay') {
    const dayNumber = operation.dayNumber;
    if (!dayNumber) return state;

    const existingDay = state.days?.find(d => d.dayNumber === dayNumber);
    if (existingDay) return state; // Day already exists

    state.days = state.days || [];
    state.days.push({
      dayNumber,
      activities: [],
      encodedPolyline: undefined
    });
    state.days.sort((a, b) => a.dayNumber - b.dayNumber);
    return state;
  }

  // Normal add operation
  if (operation.target === 'wishlist') {
    state.wishlist = state.wishlist || [];
    state.wishlist = [...state.wishlist, ...activitiesToAdd];
  } else if (operation.target === 'day' && operation.dayNumber !== undefined) {
    state.days = state.days || [];
    let day = state.days.find(d => d.dayNumber === operation.dayNumber);
    if (!day) {
      day = { dayNumber: operation.dayNumber, activities: [], encodedPolyline: undefined };
      state.days.push(day);
      state.days.sort((a, b) => a.dayNumber - b.dayNumber);
    }
    day.activities = [...day.activities, ...activitiesToAdd];
  }

  return state;
}

function applyRemoveOperation(state, operation) {
  const idsToRemove = Array.isArray(operation.data) ? operation.data : [operation.data];

  // Handle special case: deleting entire day
  if (operation.target === 'day' && operation.data?.action === 'deleteDay') {
    const dayNumber = operation.dayNumber;
    if (!dayNumber) return state;

    state.days = (state.days || [])
      .filter(d => d.dayNumber !== dayNumber)
      .map(d => {
        // Renumber days after deleted day
        if (d.dayNumber > dayNumber) {
          return { ...d, dayNumber: d.dayNumber - 1 };
        }
        return d;
      });
    return state;
  }

  // Normal remove operation
  if (operation.target === 'wishlist') {
    state.wishlist = (state.wishlist || []).filter(
      a => !a.instanceId || !idsToRemove.includes(a.instanceId)
    );
  } else if (operation.target === 'day' && operation.dayNumber !== undefined) {
    const day = (state.days || []).find(d => d.dayNumber === operation.dayNumber);
    if (day) {
      day.activities = day.activities.filter(
        a => !a.instanceId || !idsToRemove.includes(a.instanceId)
      );
    }
  }

  return state;
}

function applyModifyOperation(state, operation) {
  // Handle trip-level modifications (e.g., tripTitle, startDate, endDate)
  if (operation.target === 'trip' && operation.data && operation.data.field) {
    const { field, value } = operation.data;
    console.log(`[applyModifyOperation] Applying trip-level modification: ${field} = ${value}`);
    state[field] = value;
    return state;
  }

  // Handle activity modifications
  const { instanceId, updates, lastModified } = operation.data;

  const updateActivity = (activity) => {
    if (activity.instanceId === instanceId) {
      // Last-Write-Wins: only apply if newer
      if (activity.lastModified && activity.lastModified > lastModified) {
        return activity;
      }
      return { ...activity, ...updates, lastModified };
    }
    return activity;
  };

  if (operation.target === 'wishlist') {
    state.wishlist = (state.wishlist || []).map(updateActivity);
  } else if (operation.target === 'day' && operation.dayNumber !== undefined) {
    const day = (state.days || []).find(d => d.dayNumber === operation.dayNumber);
    if (day) {
      day.activities = day.activities.map(updateActivity);
    }
  }

  return state;
}

function applyReorderOperation(state, operation) {
  const dayNumber = operation.dayNumber;
  const { reorderedIds, lastReordered } = operation.data;

  const day = (state.days || []).find(d => d.dayNumber === dayNumber);
  if (!day) return state;

  // Check if we have a newer reorder already
  const hasNewerReorder = day.activities.some(
    a => a.lastReordered && a.lastReordered > lastReordered
  );
  if (hasNewerReorder) return state;

  // Create map for quick lookup
  const activityMap = new Map();
  day.activities.forEach(a => {
    if (a.instanceId) activityMap.set(a.instanceId, a);
  });

  // Rebuild in new order
  const reorderedActivities = [];
  reorderedIds.forEach(id => {
    const activity = activityMap.get(id);
    if (activity) {
      reorderedActivities.push({ ...activity, lastReordered });
      activityMap.delete(id);
    }
  });

  // Append any activities not in reorder list (concurrent additions)
  activityMap.forEach(activity => {
    reorderedActivities.push(activity);
  });

  day.activities = reorderedActivities;
  return state;
}

function applyMoveOperation(state, operation) {
  const data = operation.data;

  // Extract activity and locations
  let activity, fromLocation, toLocation;

  if (data.activity && data.fromLocation !== undefined && data.toLocation !== undefined) {
    // New format
    activity = data.activity;
    fromLocation = data.fromLocation;
    toLocation = data.toLocation;
  } else if (data.instanceId) {
    // Legacy format - try to determine from/to
    const instanceId = data.instanceId;

    if (operation.target === 'wishlist' && typeof data.fromDay === 'number') {
      fromLocation = data.fromDay;
      toLocation = 'wishlist';
    } else if (operation.target === 'day' && typeof operation.dayNumber === 'number') {
      toLocation = operation.dayNumber;
      fromLocation = data.fromWishlist ? 'wishlist' : (data.fromDay || 'wishlist');
    } else {
      return state; // Can't determine locations
    }

    // Find the activity
    if (fromLocation === 'wishlist') {
      activity = (state.wishlist || []).find(a => a.instanceId === instanceId);
    } else {
      const fromDay = (state.days || []).find(d => d.dayNumber === fromLocation);
      activity = fromDay?.activities.find(a => a.instanceId === instanceId);
    }

    if (!activity) return state; // Activity not found
  } else {
    return state; // Invalid operation data
  }

  // Remove from source
  if (fromLocation === 'wishlist') {
    state.wishlist = (state.wishlist || []).filter(
      a => a.instanceId !== activity.instanceId
    );
  } else {
    const fromDay = (state.days || []).find(d => d.dayNumber === fromLocation);
    if (fromDay) {
      fromDay.activities = fromDay.activities.filter(
        a => a.instanceId !== activity.instanceId
      );
    }
  }

  // Add to destination (idempotent - check if already exists)
  if (toLocation === 'wishlist') {
    state.wishlist = state.wishlist || [];
    const exists = state.wishlist.some(a => a.instanceId === activity.instanceId);
    if (!exists) {
      state.wishlist.push(activity);
    }
  } else {
    state.days = state.days || [];
    let toDay = state.days.find(d => d.dayNumber === toLocation);
    if (!toDay) {
      toDay = { dayNumber: toLocation, activities: [], encodedPolyline: undefined };
      state.days.push(toDay);
      state.days.sort((a, b) => a.dayNumber - b.dayNumber);
    }
    const exists = toDay.activities.some(a => a.instanceId === activity.instanceId);
    if (!exists) {
      toDay.activities.push(activity);
    }
  }

  return state;
}

/**
 * Validate that an activity has all required fields according to GraphQL schema
 * @param {Object} activity - The activity to validate
 * @returns {boolean} True if activity is valid
 */
function isValidActivity(activity) {
  // According to schema.graphql line 12, 'name' is required (String!)
  if (!activity || typeof activity.name !== 'string' || activity.name.trim() === '') {
    console.warn('[isValidActivity] Invalid activity - missing or empty name:', activity);
    return false;
  }
  return true;
}

/**
 * Clean trip state by removing invalid activities
 * @param {Object} state - The trip state to clean
 * @returns {Object} Cleaned trip state
 */
function cleanTripState(state) {
  const beforeWishlistCount = state.wishlist?.length || 0;
  const beforeDaysCount = state.days?.reduce((sum, day) => sum + (day.activities?.length || 0), 0) || 0;

  // Filter out invalid activities from wishlist
  const cleanedWishlist = (state.wishlist || []).filter(activity => {
    const valid = isValidActivity(activity);
    if (!valid) {
      console.warn('[cleanTripState] Removing invalid activity from wishlist:', {
        instanceId: activity?.instanceId,
        name: activity?.name,
        place_id: activity?.place_id
      });
    }
    return valid;
  });

  // Filter out invalid activities from days
  const cleanedDays = (state.days || []).map(day => ({
    ...day,
    activities: (day.activities || []).filter(activity => {
      const valid = isValidActivity(activity);
      if (!valid) {
        console.warn('[cleanTripState] Removing invalid activity from day', day.dayNumber, ':', {
          instanceId: activity?.instanceId,
          name: activity?.name,
          place_id: activity?.place_id
        });
      }
      return valid;
    })
  }));

  const afterWishlistCount = cleanedWishlist.length;
  const afterDaysCount = cleanedDays.reduce((sum, day) => sum + day.activities.length, 0);

  if (beforeWishlistCount !== afterWishlistCount || beforeDaysCount !== afterDaysCount) {
    console.log('[cleanTripState] ⚠️  Cleaned trip state:', {
      wishlist: { before: beforeWishlistCount, after: afterWishlistCount, removed: beforeWishlistCount - afterWishlistCount },
      days: { before: beforeDaysCount, after: afterDaysCount, removed: beforeDaysCount - afterDaysCount }
    });
  }

  return {
    ...state,
    wishlist: cleanedWishlist,
    days: cleanedDays
  };
}

/**
 * Reconstruct trip state by applying operations on top of snapshot
 * @param {Object} snapshot - The trip snapshot from Trips table
 * @param {Array} operations - Array of operations to apply
 * @returns {Object} Updated trip state
 */
function reconstructTripFromOperations(snapshot, operations) {
  if (!operations || operations.length === 0) {
    // Even without operations, clean the snapshot to remove invalid activities
    return cleanTripState(snapshot);
  }

  console.log('[reconstructTripFromOperations] Applying', operations.length, 'operations on top of snapshot');

  // Start with snapshot state
  let state = {
    wishlist: snapshot.wishlist || [],
    days: snapshot.days || []
  };

  // Apply each operation in order
  for (const operation of operations) {
    state = applyOperation(state, operation);
  }

  // Clean the state before merging back
  const cleanedState = cleanTripState(state);

  // Merge back into snapshot structure
  return {
    ...snapshot,
    wishlist: cleanedState.wishlist,
    days: cleanedState.days
  };
}

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Get input from GraphQL arguments
  const { userID, tripID } = event.arguments;

  // Validate required parameters
  if (!userID || !tripID) {
    throw new Error('Missing required parameters: userID and tripID are required');
  }

  console.log('userID:', userID);
  console.log('tripID:', tripID);

  // DynamoDB get parameters
  const params = {
    TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
    Key: {
      userID: userID,
      tripID: tripID
    }
  };

  console.log('DynamoDB get params:', JSON.stringify(params));

  try {
    // First, try to get the trip as the owner (existing logic)
    const result = await docClient.send(new GetCommand(params));

    if (result.Item) {
      console.log('Retrieved trip snapshot as owner');
      const snapshot = result.Item;

      // OPTION 1: Hybrid Loading - Load operations newer than snapshot
      const snapshotTimestamp = snapshot.updatedAt ? new Date(snapshot.updatedAt).getTime() : 0;
      console.log('[getUserTrips] Snapshot updatedAt:', snapshot.updatedAt, '(timestamp:', snapshotTimestamp, ')');

      const newOperations = await loadOperationsSince(tripID, snapshotTimestamp);

      let finalTrip = snapshot;
      if (newOperations.length > 0) {
        console.log('[getUserTrips] ✨ Applying', newOperations.length, 'operations on top of snapshot');
        finalTrip = reconstructTripFromOperations(snapshot, newOperations);
        console.log('[getUserTrips] ✅ Trip reconstructed with latest operations');
      } else {
        console.log('[getUserTrips] ✅ No new operations - returning snapshot as-is');
      }

      // Reconstruct tripTitle from ALL operations (not just new ones)
      let reconstructedTripTitle = finalTrip.tripTitle || null;

      try {
        // Query ALL operations for this trip to find the most recent tripTitle
        const allOpsParams = {
          TableName: process.env.STORAGE_TRIPOPERATIONSSTORAGE_NAME,
          IndexName: 'byTripID',
          KeyConditionExpression: 'tripID = :tripID',
          ExpressionAttributeValues: {
            ':tripID': tripID
          },
          ScanIndexForward: false, // Sort descending by timestamp (most recent first)
          Limit: 100 // Should be enough to find the title
        };

        const allOpsResult = await docClient.send(new QueryCommand(allOpsParams));
        console.log('[getUserTrips] Loaded', allOpsResult.Items?.length || 0, 'total operations for tripTitle reconstruction');

        if (allOpsResult.Items && allOpsResult.Items.length > 0) {
          // Find the most recent tripTitle modification
          for (const item of allOpsResult.Items) {
            try {
              const op = typeof item.operationData === 'string'
                ? JSON.parse(item.operationData)
                : item.operationData;

              if (op.type === 'modify' && op.target === 'trip' && op.data?.field === 'tripTitle') {
                reconstructedTripTitle = op.data.value;
                console.log('[getUserTrips] ✅ Reconstructed tripTitle from operation:', reconstructedTripTitle);
                break;
              }
            } catch (parseError) {
              console.error('[getUserTrips] Failed to parse operation:', parseError);
            }
          }
        }
      } catch (titleError) {
        console.error('[getUserTrips] Error reconstructing tripTitle:', titleError);
        // Continue with null or snapshot title
      }

      // Return the complete trip data including tripPhotoReference, collaborators, version, and cityCategories
      return {
        tripId: finalTrip.tripID,
        tripTitle: reconstructedTripTitle,
        days: finalTrip.days || [],
        wishlist: finalTrip.wishlist || [],
        tripLength: finalTrip.tripLength,
        selectedCity: finalTrip.selectedCity,
        tripPhotoReference: normalizePhotoReferences(finalTrip.tripPhotoReference),
        createdAt: finalTrip.createdAt,
        startDate: finalTrip.startDate || null,
        endDate: finalTrip.endDate || null,
        collaborators: finalTrip.collaborators || [],
        version: finalTrip.version || 1,
        updatedAt: finalTrip.updatedAt,
        lastUpdatedBy: finalTrip.lastUpdatedBy,
        cityCategories: Array.isArray(finalTrip.cityCategories) ? finalTrip.cityCategories : [],
        notes: finalTrip.notes || null,
        duration: finalTrip.duration || null,
        arrivalTime: finalTrip.arrivalTime || null,
        photos: finalTrip.photos || null,
        hotel: finalTrip.hotel || null,
        flight: finalTrip.flight || null,
        savedActivities: finalTrip.savedActivities || null,
        recentSearches: finalTrip.recentSearches || [],
        deletedSavedPlaceIds: finalTrip.deletedSavedPlaceIds || [],
        _loadedFrom: newOperations.length > 0 ? 'snapshot+operations' : 'snapshot', // Debug flag
        _operationCount: newOperations.length // Debug info
      };
    }

    // If not found as owner, try to find as collaborator
    console.log('Trip not found as owner, searching as collaborator with pagination...');

    const scanParams = {
      TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
      FilterExpression: 'tripID = :tripID AND attribute_exists(collaborators)',
      ExpressionAttributeValues: {
        ':tripID': tripID
      }
    };

    console.log('Scanning for trip as collaborator:', JSON.stringify(scanParams));

    // Handle pagination to scan the entire table
    let allItems = [];
    let lastEvaluatedKey = null;
    let scanCount = 0;

    do {
      scanCount++;
      const currentScanParams = { ...scanParams };
      if (lastEvaluatedKey) {
        currentScanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      console.log(`[Collaborator Scan ${scanCount}] Fetching batch...`);
      const scanResult = await docClient.send(new ScanCommand(currentScanParams));

      console.log(`[Collaborator Scan ${scanCount}] Found ${scanResult.Items?.length || 0} items in this batch`);

      if (scanResult.Items && scanResult.Items.length > 0) {
        allItems = allItems.concat(scanResult.Items);
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;

      if (lastEvaluatedKey) {
        console.log(`[Collaborator Scan ${scanCount}] More results available, continuing pagination...`);
      } else {
        console.log(`[Collaborator Scan ${scanCount}] No more results, pagination complete`);
      }
    } while (lastEvaluatedKey);

    console.log(`[Pagination Complete] Total items collected: ${allItems.length} after ${scanCount} scan(s)`);

    if (allItems.length > 0) {
      // Check if the user is actually a collaborator on any of these trips
      for (const item of allItems) {
        if (item.collaborators && Array.isArray(item.collaborators)) {
          const isCollaborator = item.collaborators.some(c => c.userID === userID);
          if (isCollaborator) {
            console.log('Retrieved trip snapshot as collaborator');
            const snapshot = item;

            // OPTION 1: Hybrid Loading - Load operations newer than snapshot
            const snapshotTimestamp = snapshot.updatedAt ? new Date(snapshot.updatedAt).getTime() : 0;
            console.log('[getUserTrips] Snapshot updatedAt:', snapshot.updatedAt, '(timestamp:', snapshotTimestamp, ')');

            const newOperations = await loadOperationsSince(tripID, snapshotTimestamp);

            let finalTrip = snapshot;
            if (newOperations.length > 0) {
              console.log('[getUserTrips] ✨ Applying', newOperations.length, 'operations on top of snapshot (collaborator)');
              finalTrip = reconstructTripFromOperations(snapshot, newOperations);
              console.log('[getUserTrips] ✅ Trip reconstructed with latest operations (collaborator)');
            } else {
              console.log('[getUserTrips] ✅ No new operations - returning snapshot as-is (collaborator)');
            }

            // Reconstruct tripTitle from operations if available
            let reconstructedTripTitleCollab = finalTrip.tripTitle || null;
            if (newOperations.length > 0) {
              // Find the most recent tripTitle modification
              for (let i = newOperations.length - 1; i >= 0; i--) {
                const op = newOperations[i];
                if (op.type === 'modify' && op.target === 'trip' && op.data?.field === 'tripTitle') {
                  reconstructedTripTitleCollab = op.data.value;
                  console.log('[getUserTrips] Reconstructed tripTitle from operation (collaborator):', reconstructedTripTitleCollab);
                  break;
                }
              }
            }

            return {
              tripId: finalTrip.tripID,
              tripTitle: reconstructedTripTitleCollab,
              days: finalTrip.days || [],
              wishlist: finalTrip.wishlist || [],
              tripLength: finalTrip.tripLength,
              selectedCity: finalTrip.selectedCity,
              tripPhotoReference: normalizePhotoReferences(finalTrip.tripPhotoReference),
              createdAt: finalTrip.createdAt,
              startDate: finalTrip.startDate || null,
              endDate: finalTrip.endDate || null,
              collaborators: finalTrip.collaborators || [],
              version: finalTrip.version || 1,
              updatedAt: finalTrip.updatedAt,
              lastUpdatedBy: finalTrip.lastUpdatedBy,
              cityCategories: Array.isArray(finalTrip.cityCategories) ? finalTrip.cityCategories : [],
              notes: finalTrip.notes || null,
              duration: finalTrip.duration || null,
              arrivalTime: finalTrip.arrivalTime || null,
              photos: finalTrip.photos || null,
              hotel: finalTrip.hotel || null,
              flight: finalTrip.flight || null,
              savedActivities: finalTrip.savedActivities || null,
              recentSearches: finalTrip.recentSearches || [],
              deletedSavedPlaceIds: finalTrip.deletedSavedPlaceIds || [],
              _loadedFrom: newOperations.length > 0 ? 'snapshot+operations' : 'snapshot', // Debug flag
              _operationCount: newOperations.length // Debug info
            };
          }
        }
      }
    }

    // If still not found, throw error
    throw new Error(`Trip not found for userID: ${userID}, tripID: ${tripID} (checked as owner and collaborator)`);

  } catch (error) {
    console.error('DynamoDB error:', error);
    throw new Error('Failed to retrieve trip');
  }
};
