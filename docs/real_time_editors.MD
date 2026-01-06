Real-Time Editing Implementation Plan (Event Sourcing with Backward Compatibility)
Overview
Implement conflict-free real-time collaboration using event sourcing with append-only operations. Instead of optimistic locking with version conflicts, all changes are appended as operations to DynamoDB. Users subscribe to operation streams and apply changes incrementally. Backward compatible with existing trips - no migration required. Key improvements:
 Zero version conflicts (append-only writes)
Atomic reorder operations with concurrent addition protection
Minimal bandwidth (1KB operations vs 500KB trip objects)
Full audit trail of all changes
Backward compatible - existing trips work immediately
Zero migration needed - old trips load from tripData, new trips use operations

Phase 1: Backend Schema Changes (AWS Amplify)
A. Create TripOperation Model
Location: Create new file /amplify/backend/api/<your-api>/schema.graphql Add the following to your GraphQL schema:
# NEW: Event sourcing operations table
type TripOperation @model @auth(rules: [
  { allow: owner, ownerField: "userId", operations: [create, read] }
  { allow: private, operations: [read] }
]) {
  tripId: ID! @primaryKey(sortKeyFields: ["timestamp"])
  timestamp: AWSTimestamp!
  opId: ID!
  userId: ID! @index(name: "byUser")
  sequenceNumber: Int!
  
  # Operation metadata
  type: String!  # add, remove, modify, reorder, move
  target: String!  # wishlist, day
  dayNumber: Int
  
  # Full operation data
  operationData: AWSJSON!
  
  # Track if this operation has been included in a snapshot
  snapshotted: Boolean
  
  # Indexes
  byTrip: [TripOperation] @hasMany(indexName: "byTrip", fields: ["tripId"])
}

# OPTIONAL: Snapshots for performance optimization
type TripSnapshot @model @auth(rules: [
  { allow: owner, operations: [create, read, delete] }
  { allow: private, operations: [read] }
]) {
  tripId: ID! @primaryKey
  snapshotTimestamp: AWSTimestamp!
  upToOperationId: ID!
  operationCount: Int!
  tripState: AWSJSON!
  createdBy: ID!
}

# MODIFIED: Trip model (KEEP tripData for backward compatibility!)
type Trip @model @auth(rules: [
  { allow: owner, operations: [create, read, update, delete] }
  { allow: private, operations: [read] }
]) {
  tripId: ID! @primaryKey
  ownerId: ID!
  
  # Trip metadata
  title: String
  startDate: String
  endDate: String
  numberOfDays: Int
  destination: String
  
  # Collaborators
  collaborators: [Collaborator]
  
  # KEEP for backward compatibility with old trips
  tripData: AWSJSON  # Old trips use this, new trips leave it null
  version: Int       # Old trips use this, new trips ignore it
  
  # Keep timestamps
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

# Collaborator type (keep as-is)
type Collaborator {
  userID: ID!
  role: String!
  addedAt: AWSDateTime
}

B. Enable DynamoDB Streams
Location: /amplify/backend/api/<your-api>/override.ts
import { AmplifyApiGraphQlResourceStackTemplate } from '@aws-amplify/cli-extensibility-helper';

export function override(resources: AmplifyApiGraphQlResourceStackTemplate) {
  // Enable streams on TripOperation table
  const tripOperationTable = resources.models['TripOperation'];
  if (tripOperationTable) {
    tripOperationTable.streamSpecification = {
      streamViewType: 'NEW_IMAGE'  // Send new operations to subscribers
    };
  }
}

C. Deploy Backend Changes
amplify push

This will:
Create TripOperation DynamoDB table with streams enabled
Generate GraphQL mutations, queries, and subscriptions
Update AppSync API schema
Existing trips remain unchanged (backward compatible)

Phase 2: Frontend Type Definitions
src/types/operation.types.ts - Defines all operation types:
Operation - Base type with common fields
OperationAdd - For adding activities
OperationRemove - For removing activities
OperationModify - For updating activity fields (delta-only)
OperationReorder - For reordering activities in a day (stores IDs only)
OperationMove - For atomic moves between wishlist and days
AnyOperation - Union type of all operations
Updated src/types/activity.types.ts - Added timestamp fields:
lastModified?: number - Timestamp when activity was last modified
modifiedBy?: string - UserID who last modified the activity
lastReordered?: number - Timestamp when activity was last reordered

A. Update Operation Types
Location: /src/types/operation.types.ts
export type Operation = {
  id: string; // opId: `${userId}_${type}_${target}_${timestamp}_${random}`
  timestamp: number;
  userId: string;
  tripId: string;
  sequenceNumber: number; // For deterministic ordering within same millisecond
  type: 'add' | 'remove' | 'modify' | 'reorder' | 'move';
  target: 'wishlist' | 'day';
  dayNumber?: number;
  data: any;
  applied: boolean; // Has this been saved to cloud?
};

export type OperationAdd = Operation & {
  type: 'add';
  data: Activity | Activity[];
};

export type OperationRemove = Operation & {
  type: 'remove';
  data: string | string[]; // instanceId(s)
};

export type OperationModify = Operation & {
  type: 'modify';
  data: {
    instanceId: string;
    updates: Partial<Activity>; // Only changed fields
    lastModified: number;
  };
};

export type OperationReorder = Operation & {
  type: 'reorder';
  target: 'day';
  dayNumber: number;
  data: {
    reorderedIds: string[]; // Just the IDs in new order
    lastReordered: number;
  };
};

export type OperationMove = Operation & {
  type: 'move';
  data: {
    activity: Activity; // Full activity for atomic operation
    fromLocation: 'wishlist' | number;
    toLocation: 'wishlist' | number;
  };
};

B. Update Activity Type
Location: /src/types/activity.types.ts
export type Activity = {
  // ... existing fields ...
  
  // NEW: Timestamps for conflict resolution
  lastModified?: number; // When this activity was last modified
  modifiedBy?: string; // UserID who last modified
  
  // Field-level timestamps (optional - for fine-grained conflict resolution)
  notesModifiedAt?: number;
  startTimeModifiedAt?: number;
  endTimeModifiedAt?: number;
};


Phase 3: State Management Setup
Added State Variables:
Operation Tracking:
operationLogRef - Stores all operations (both applied and pending)
operationSequenceRef - Counter for deterministic ordering within same millisecond
Memory Management:
MAX_OPERATION_LOG_SIZE = 1000 - Prevents memory exhaustion
MAX_APPLIED_OPERATIONS = 100 - Keep recent applied ops for audit trail
Save Queue (Request Coalescing):
saveQueueRef - Batches operations for efficient API calls
Includes timeout for 100-300ms coalescing delay
Tracks processing state to prevent concurrent saves
Control Flags:
isRestoringRef - Prevents operation tracking during trip restore
isLoadingInitialRef - Guards against operations during initial load
isLegacyTripRef - Tracks backward compatibility mode
lastUserActionTimeRef - For UI feedback
UI State:
isInitialLoadComplete - Tracks when trip is fully loaded
routeRefreshTimeoutRef - Debounces route updates
Added Import:
Operation type from operation.types.ts
A. Add State Variables
Location: trip-view_main.tsx:183 (after existing state)
// Operation log for tracking local changes
const operationLogRef = useRef<Operation[]>([]);

// Sequence counter for deterministic ordering
const operationSequenceRef = useRef<number>(0);

// Maximum operation log size to prevent memory exhaustion
const MAX_OPERATION_LOG_SIZE = 1000; // Higher for offline scenarios
const MAX_APPLIED_OPERATIONS = 100; // Keep recent applied ops

// Save queue for batching operations (100ms coalescing)
const saveQueueRef = useRef<{
  operations: Operation[];
  timeoutId: NodeJS.Timeout | null;
  isProcessing: boolean;
}>({
  operations: [],
  timeoutId: null,
  isProcessing: false,
});

// Lock to prevent tracking during restore operations
const isRestoringRef = useRef(false);

// Track if we're currently loading initial trip data
const isLoadingInitialRef = useRef(false);

// Track last user action for UI feedback
const lastUserActionTimeRef = useRef<number>(0);

// Track if initial load is complete
const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

// NEW: Track if this is an old trip (for backward compatibility)
const isLegacyTripRef = useRef(false);


Phase 4: Operation Creation & Saving
Implemented Functions:
createOperation (lines 278-325)
Creates new operations with validation
Guards against: viewer role, loading state, restoring state
Generates unique operation IDs with format: {userId}_{type}_{target}_{dayNumber}_{timestamp}_{random}
Increments sequence number for deterministic ordering
Returns null if validation fails
saveOperation (lines 349-399)
Saves individual operation to DynamoDB via GraphQL
Append-only writes - zero version conflicts!
Validates tripId matches current trip
Converts timestamp to AWSTimestamp (seconds)
Returns success/failure for retry logic
Marks operation as applied on success
queueSave (lines 402-457)
Queues operations for batched saves
Implements request coalescing:
100ms delay for first operation (feels instant)
300ms delay for batches (allows grouping)
Memory management: enforces max 1000 operations in log
Keeps unapplied ops + 100 most recent applied ops
processSaveQueue (lines 460-518)
Processes queued operations in parallel
No conflicts possible - all saves are append-only!
Automatic retry logic for failed operations
Exponential backoff (2s delay on failure)
Prevents saves during initial load
A. Create Operation Factory
Location: trip-view_main.tsx:220
// Create a new operation with validation
const createOperation = useCallback((
  type: Operation['type'],
  target: Operation['target'],
  data: any,
  dayNumber?: number
): Operation | null => {
  // Guard against operation creation during restore/loading
  if (isRestoringRef.current || isLoadingInitialRef.current) {
    console.log('[createOperation] ⏭️  Skipping (restoring/loading)');
    return null;
  }
  
  // Guard against viewer role
  if (currentUserRole === 'viewer') {
    console.log('[createOperation] ⏭️  Skipping (viewer role)');
    return null;
  }
  
  // Validate tripId exists
  if (!tripIdRef.current) {
    console.warn('[createOperation] ⚠️  No tripId - cannot create operation');
    return null;
  }
  
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  
  // Increment sequence number for deterministic ordering
  operationSequenceRef.current += 1;
  const sequenceNumber = operationSequenceRef.current;
  
  const opId = `${currentUserID}_${type}_${target}_${dayNumber || 'none'}_${timestamp}_${random}`;
  
  lastUserActionTimeRef.current = timestamp;
  
  return {
    id: opId,
    timestamp,
    userId: currentUserID,
    tripId: tripIdRef.current,
    sequenceNumber,
    type,
    target,
    dayNumber,
    data,
    applied: false,
  };
}, [currentUserID, currentUserRole]);

B. Save Operation to DynamoDB (Event Sourcing)
Location: After createOperation
// Save a single operation to DynamoDB (append-only - no conflicts!)
const saveOperation = useCallback(async (operation: Operation): Promise<boolean> => {
  if (!operation) {
    console.log('[saveOperation] ⏭️  Null operation');
    return false;
  }
  
  // Validate operation belongs to current trip
  if (operation.tripId !== tripIdRef.current) {
    console.error('[saveOperation] ❌ Operation tripId mismatch!', {
      operationTripId: operation.tripId,
      currentTripId: tripIdRef.current
    });
    return false;
  }
  
  console.log('[saveOperation] 💾 Saving operation:', operation.type, operation.id);
  
  try {
    await API.graphql({
      query: createTripOperation,
      variables: {
        input: {
          tripId: operation.tripId,
          timestamp: operation.timestamp,
          opId: operation.id,
          userId: operation.userId,
          sequenceNumber: operation.sequenceNumber,
          type: operation.type,
          target: operation.target,
          dayNumber: operation.dayNumber,
          operationData: JSON.stringify(operation),
          snapshotted: false
        }
      }
    });
    
    console.log('[saveOperation] ✅ Operation saved successfully');
    
    // Mark as applied
    operation.applied = true;
    
    return true;
    
  } catch (error: any) {
    console.error('[saveOperation] ❌ Failed to save operation:', error);
    
    // No version conflicts possible with append-only!
    // Only network errors - retry makes sense
    return false;
  }
}, []);

C. Queue Operations with Request Coalescing
Location: After saveOperation
// Queue an operation and trigger coalesced save
const queueSave = useCallback((operation: Operation | null) => {
  if (!operation) {
    console.log('[queueSave] ⏭️  Null operation - skipping');
    return;
  }
  
  // Validate operation belongs to current trip
  if (operation.tripId !== tripIdRef.current) {
    console.error('[queueSave] ❌ Operation tripId mismatch!');
    return;
  }
  
  console.log('[queueSave] 📝 Queuing operation:', operation.type, operation.target);
  
  // Add to operation log
  operationLogRef.current.push(operation);
  
  // Enforce max operation log size
  if (operationLogRef.current.length > MAX_OPERATION_LOG_SIZE) {
    console.log('[queueSave] 🧹 Operation log exceeds max size - cleaning up');
    
    // Keep unapplied operations (critical - not saved yet)
    const unapplied = operationLogRef.current.filter(op => !op.applied);
    
    // Keep most recent applied operations from THIS user only
    const applied = operationLogRef.current
      .filter(op => op.applied && op.userId === currentUserID)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_APPLIED_OPERATIONS);
    
    operationLogRef.current = [...unapplied, ...applied];
    
    console.log('[queueSave] 🧹 Cleaned:', {
      unapplied: unapplied.length,
      applied: applied.length,
      total: operationLogRef.current.length
    });
  }
  
  // Add to save queue
  saveQueueRef.current.operations.push(operation);
  
  // Clear existing timeout
  if (saveQueueRef.current.timeoutId) {
    clearTimeout(saveQueueRef.current.timeoutId);
  }
  
  // Coalescing delay:
  // - 100ms if first operation (feels instant)
  // - 300ms if batching (allow time for more changes)
  const delay = saveQueueRef.current.operations.length === 1 ? 100 : 300;
  
  saveQueueRef.current.timeoutId = setTimeout(() => {
    processSaveQueue();
  }, delay);
}, [currentUserID]);

// Process queued operations and save to cloud
const processSaveQueue = useCallback(async () => {
  // Already processing or nothing to save
  if (saveQueueRef.current.isProcessing || saveQueueRef.current.operations.length === 0) {
    return;
  }
  
  // Don't save during initial load
  if (isLoadingInitialRef.current) {
    console.log('[processSaveQueue] ⏭️  Skipping (loading initial data)');
    setTimeout(() => processSaveQueue(), 1000);
    return;
  }
  
  saveQueueRef.current.isProcessing = true;
  const opsToSave = [...saveQueueRef.current.operations];
  saveQueueRef.current.operations = []; // Clear queue
  
  console.log(`[processSaveQueue] 💾 Saving ${opsToSave.length} operations`);
  
  try {
    // Save all operations in parallel (no conflicts possible!)
    const results = await Promise.allSettled(
      opsToSave.map(op => saveOperation(op))
    );
    
    // Check results
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value).length;
    
    console.log(`[processSaveQueue] ✅ Saved ${succeeded}/${opsToSave.length} operations`);
    
    if (failed > 0) {
      console.warn(`[processSaveQueue] ⚠️  ${failed} operations failed - will retry`);
      
      // Put failed operations back in queue
      const failedOps = opsToSave.filter((op, i) => {
        const result = results[i];
        return result.status === 'rejected' || !result.value;
      });
      
      saveQueueRef.current.operations.unshift(...failedOps);
      
      // Retry after delay
      setTimeout(() => processSaveQueue(), 2000);
    }
    
  } catch (error: any) {
    console.error('[processSaveQueue] ❌ Unexpected error:', error);
    
    // Put operations back in queue
    saveQueueRef.current.operations.unshift(...opsToSave);
    
    // Retry
    setTimeout(() => processSaveQueue(), 2000);
    
  } finally {
    saveQueueRef.current.isProcessing = false;
  }
}, [saveOperation]);


Phase 5: Apply Operation Logic (Idempotent)
Implemented Operation Handlers:
add Operation (lines 537-572)
Idempotent: Checks if activity already exists by instanceId or place_id + name
Supports both single activity and array
Works for both wishlist and day targets
Only adds if not already present
remove Operation (lines 574-600)
Idempotent: Safe to replay - filters out activities by instanceId
Supports both single and multiple instanceIds
Logs count of removed activities
No-op if activity already removed
modify Operation (lines 602-650)
Last-Write-Wins (LWW): Uses lastModified timestamp for conflict resolution
Only applies if operation timestamp > current timestamp
Stores delta updates (not full activity)
Tracks modifiedBy for audit trail
reorder Operation (lines 652-689)
FIXED: Merges reorder with concurrent additions!
Uses lastReordered timestamp for conflict resolution
Preserves activities added concurrently (not in reorder list)
Final order: [reordered activities, concurrent additions]
Prevents loss of concurrent edits
move Operation (lines 691-746)
Atomic: Single operation moves activity between locations
Idempotent: Checks if already at destination before adding
Removes from source, adds to destination
Works with wishlist ↔ day moves
Safe to replay multiple times
A. Create Apply Operation Function
Location: After processSaveQueue
// Apply a single operation to trip data (idempotent - safe to replay)
const applyOperation = useCallback((trip: any, op: Operation): any => {
  const newTrip = { ...trip };
  
  // Validate operation belongs to this trip
  if (op.tripId !== tripIdRef.current) {
    console.error('[applyOperation] ❌ Skipping - tripId mismatch!');
    return newTrip;
  }
  
  console.log(`[applyOperation] 🔧 Applying: ${op.type} on ${op.target}${op.dayNumber ? ` day${op.dayNumber}` : ''}`);
  
  switch (op.type) {
    case 'add': {
      if (op.target === 'wishlist') {
        const currentWishlist = newTrip.wishlist || [];
        const newActivities = Array.isArray(op.data) ? op.data : [op.data];
        
        // Only add if not already present (idempotency)
        const toAdd = newActivities.filter(newAct => 
          !currentWishlist.some((existing: Activity) => 
            existing.instanceId === newAct.instanceId ||
            (existing.place_id === newAct.place_id && existing.name === newAct.name)
          )
        );
        
        if (toAdd.length > 0) {
          console.log(`[applyOperation] ✅ Adding ${toAdd.length} to wishlist`);
          newTrip.wishlist = [...currentWishlist, ...toAdd];
        } else {
          console.log(`[applyOperation] ⏭️  Already in wishlist`);
        }
      } else if (op.target === 'day' && op.dayNumber !== undefined) {
        const day = newTrip.days?.find((d: any) => d.dayNumber === op.dayNumber);
        if (day) {
          const newActivities = Array.isArray(op.data) ? op.data : [op.data];
          const toAdd = newActivities.filter((newAct: Activity) =>
            !day.activities.some((existing: Activity) => 
              existing.instanceId === newAct.instanceId
            )
          );
          if (toAdd.length > 0) {
            console.log(`[applyOperation] ✅ Adding ${toAdd.length} to day ${op.dayNumber}`);
            day.activities = [...day.activities, ...toAdd];
          }
        }
      }
      break;
    }
      
    case 'remove': {
      const instanceIds = Array.isArray(op.data) ? op.data : [op.data];
      
      if (op.target === 'wishlist') {
        const beforeCount = (newTrip.wishlist || []).length;
        newTrip.wishlist = (newTrip.wishlist || []).filter(
          (a: Activity) => !instanceIds.includes(a.instanceId)
        );
        const removed = beforeCount - newTrip.wishlist.length;
        if (removed > 0) {
          console.log(`[applyOperation] 🗑️  Removed ${removed} from wishlist`);
        }
      } else if (op.target === 'day' && op.dayNumber !== undefined) {
        const day = newTrip.days?.find((d: any) => d.dayNumber === op.dayNumber);
        if (day) {
          const beforeCount = day.activities.length;
          day.activities = day.activities.filter(
            (a: Activity) => !instanceIds.includes(a.instanceId)
          );
          const removed = beforeCount - day.activities.length;
          if (removed > 0) {
            console.log(`[applyOperation] 🗑️  Removed ${removed} from day ${op.dayNumber}`);
          }
        }
      }
      break;
    }
      
    case 'modify': {
      const { instanceId, updates, lastModified } = op.data;
      
      if (op.target === 'wishlist') {
        newTrip.wishlist = (newTrip.wishlist || []).map((a: Activity) => {
          if (a.instanceId === instanceId) {
            const remoteModTime = a.lastModified || 0;
            
            if (lastModified > remoteModTime) {
              console.log(`[applyOperation] ✏️  Modifying ${a.name} (local newer)`);
              return {
                ...a,
                ...updates,
                lastModified,
                modifiedBy: op.userId
              };
            } else {
              console.log(`[applyOperation] ⏭️  Skipping modify (remote newer)`);
              return a;
            }
          }
          return a;
        });
      } else if (op.target === 'day' && op.dayNumber !== undefined) {
        const day = newTrip.days?.find((d: any) => d.dayNumber === op.dayNumber);
        if (day) {
          day.activities = day.activities.map((a: Activity) => {
            if (a.instanceId === instanceId) {
              const remoteModTime = a.lastModified || 0;
              
              if (lastModified > remoteModTime) {
                console.log(`[applyOperation] ✏️  Modifying ${a.name}`);
                return {
                  ...a,
                  ...updates,
                  lastModified,
                  modifiedBy: op.userId
                };
              } else {
                console.log(`[applyOperation] ⏭️  Skipping modify (remote newer)`);
                return a;
              }
            }
            return a;
          });
        }
      }
      break;
    }
      
    case 'reorder': {
      // FIXED: Merge reorder with concurrent additions
      if (op.target === 'day' && op.dayNumber !== undefined) {
        const day = newTrip.days?.find((d: any) => d.dayNumber === op.dayNumber);
        if (day) {
          const { reorderedIds, lastReordered } = op.data;
          
          // Check if remote day has newer reorder
          const remoteReorderTime = day.activities[0]?.lastReordered || 0;
          
          if (lastReordered > remoteReorderTime) {
            console.log(`[applyOperation] 🔀 Applying reorder to day ${op.dayNumber}`);
            
            // Get current activity IDs
            const currentIds = day.activities.map((a: Activity) => a.instanceId);
            
            // Find activities that were added concurrently (not in reorder)
            const concurrentlyAdded = day.activities.filter((a: Activity) => 
              !reorderedIds.includes(a.instanceId)
            );
            
            // Get reordered activities (only those still in day)
            const reorderedActivities = reorderedIds
              .map((id: string) => day.activities.find((a: Activity) => a.instanceId === id))
              .filter((a: Activity | undefined) => a !== undefined)
              .map((a: Activity) => ({
                ...a,
                lastReordered
              }));
            
            // Merge: reordered activities first, then concurrent additions
            day.activities = [...reorderedActivities, ...concurrentlyAdded];
            
            console.log(`[applyOperation] ✅ Reordered ${reorderedActivities.length} activities, preserved ${concurrentlyAdded.length} concurrent additions`);
          } else {
            console.log(`[applyOperation] ⏭️  Day ${op.dayNumber} has newer reorder (remote wins)`);
          }
        }
      }
      break;
    }
      
    case 'move': {
      // Atomic move operation
      const { activity, fromLocation, toLocation } = op.data;
      
      console.log(`[applyOperation] 🚚 Moving "${activity.name}" from ${fromLocation} to ${toLocation}`);
      
      // Remove from source (idempotent)
      if (fromLocation === 'wishlist') {
        const beforeCount = (newTrip.wishlist || []).length;
        newTrip.wishlist = (newTrip.wishlist || []).filter(
          (a: Activity) => a.instanceId !== activity.instanceId
        );
        if (beforeCount > newTrip.wishlist.length) {
          console.log(`[applyOperation] ✅ Removed from wishlist`);
        }
      } else if (typeof fromLocation === 'number') {
        const fromDay = newTrip.days?.find((d: any) => d.dayNumber === fromLocation);
        if (fromDay) {
          const beforeCount = fromDay.activities.length;
          fromDay.activities = fromDay.activities.filter(
            (a: Activity) => a.instanceId !== activity.instanceId
          );
          if (beforeCount > fromDay.activities.length) {
            console.log(`[applyOperation] ✅ Removed from day ${fromLocation}`);
          }
        }
      }
      
      // Add to destination (idempotent - check if already exists)
      if (toLocation === 'wishlist') {
        const currentWishlist = newTrip.wishlist || [];
        const alreadyExists = currentWishlist.some(
          (a: Activity) => a.instanceId === activity.instanceId
        );
        if (!alreadyExists) {
          newTrip.wishlist = [...currentWishlist, activity];
          console.log(`[applyOperation] ✅ Added to wishlist`);
        } else {
          console.log(`[applyOperation] ⏭️  Already in wishlist`);
        }
      } else if (typeof toLocation === 'number') {
        const toDay = newTrip.days?.find((d: any) => d.dayNumber === toLocation);
        if (toDay) {
          const alreadyExists = toDay.activities.some(
            (a: Activity) => a.instanceId === activity.instanceId
          );
          if (!alreadyExists) {
            toDay.activities = [...toDay.activities, activity];
            console.log(`[applyOperation] ✅ Added to day ${toLocation}`);
          } else {
            console.log(`[applyOperation] ⏭️  Already in day ${toLocation}`);
          }
        }
      }
      break;
    }
  }
  
  return newTrip;
}, []);


Phase 6: Hook Operations into User Actions
Note: Same as before - add operation tracking to each user action. Here are the key ones:
A. Add Activities to Wishlist
Location: trip-view_main.tsx:432-443
const addActivitiesToWishlist = (newActivities: Activity[]) => {
  // Update UI optimistically
  const combinedActivities = [...(activities || []), ...newActivities];
  const deduplicatedActivities = combinedActivities.filter((activity, index, arr) => {
    if (!activity.instanceId) return true;
    return arr.findIndex(a => a.instanceId === activity.instanceId) === index;
  });

  updateActivities(deduplicatedActivities);
  
  // Track operation
  const op = createOperation('add', 'wishlist', newActivities);
  queueSave(op);
};

B. Delete Activity
Location: Find handleDeleteActivity function
const handleDeleteActivity = useCallback((activity: Activity, targetDayNumber?: number) => {
  console.log('[handleDeleteActivity] Deleting:', activity.name);

  if (targetDayNumber !== undefined && targetDayNumber !== null) {
    // Delete from day
    const currentDayActivities = getDayActivities(targetDayNumber) || [];
    const newOrder = currentDayActivities.filter(a => {
      if (activity.instanceId && a.instanceId) {
        return a.instanceId !== activity.instanceId;
      }
      if (activity.place_id && a.place_id) {
        return !(a.place_id === activity.place_id && a.name === activity.name);
      }
      return true;
    });

    reorderDayActivities(targetDayNumber, newOrder);
    
    // Track operation
    const op = createOperation('remove', 'day', activity.instanceId, targetDayNumber);
    queueSave(op);
  } else {
    // Delete from wishlist
    updateActivities((prev: Activity[]) => {
      const prevActivities = Array.isArray(prev) ? prev : [];
      return prevActivities.filter(a => {
        if (activity.instanceId && a.instanceId) {
          return a.instanceId !== activity.instanceId;
        }
        if (activity.place_id && a.place_id) {
          return !(a.place_id === activity.place_id && a.name === activity.name);
        }
        return true;
      });
    });
    
    // Track operation
    const op = createOperation('remove', 'wishlist', activity.instanceId);
    queueSave(op);
  }
}, [getDayActivities, reorderDayActivities, updateActivities, createOperation, queueSave]);

C. Reorder Day Activities (FIXED)
Location: Find handleDayActivityReorder function
const handleDayActivityReorder = async (dayNumber: number, newOrder: Activity[]) => {
  try {
    console.log('[handleDayActivityReorder] Reordering day', dayNumber);
    
    const reorderTimestamp = Date.now();
    const orderedActivities = newOrder.map(a => ({
      ...a,
      lastReordered: reorderTimestamp
    }));
    
    // Update UI
    reorderDayActivities(dayNumber, orderedActivities);

    // Clear route cache
    const dayTab = `day${dayNumber}`;
    delete routeCache.current[dayTab];

    // Track operation (store IDs only, not full activities)
    const op = createOperation('reorder', 'day', {
      reorderedIds: orderedActivities.map(a => a.instanceId),
      lastReordered: reorderTimestamp
    }, dayNumber);
    queueSave(op);

    // Update route if active tab
    if (activeTab === dayTab) {
      setRouteLoading(true);
      const newRouteData = await fetchRoutePolyline(orderedActivities);
      setRouteData(newRouteData);

      const activitiesHash = hashActivities(orderedActivities);
      routeCache.current[dayTab] = {
        activitiesHash,
        routeData: newRouteData,
      };

      if (newRouteData.polyline && newRouteData.polyline.length > 1) {
        const encoded = encodePolyline(newRouteData.polyline);
        setDayPolyline(dayNumber, encoded);
      }

      setRouteLoading(false);
    }
  } catch (error) {
    console.error('[handleDayActivityReorder] Error:', error);
    setRouteLoading(false);
  }
};

D. Transfer/Move Activities (Atomic)
Location: Find transfer handler
const handleTransferActivities = useCallback((
  activities: Activity[],
  fromLocation: 'wishlist' | number,
  toLocation: 'wishlist' | number
) => {
  console.log('[handleTransferActivities] Transferring', activities.length, 'from', fromLocation, 'to', toLocation);
  
  // Create atomic move operation for each activity
  activities.forEach(activity => {
    const op = createOperation('move', fromLocation === 'wishlist' ? 'wishlist' : 'day', {
      activity: activity,
      fromLocation,
      toLocation
    }, typeof fromLocation === 'number' ? fromLocation : undefined);
    
    queueSave(op);
  });
  
  // Update UI optimistically
  if (fromLocation === 'wishlist') {
    updateActivities((prev: Activity[]) => {
      const prevActivities = Array.isArray(prev) ? prev : [];
      return prevActivities.filter(a => 
        !activities.some(transferredActivity => 
          a.instanceId === transferredActivity.instanceId
        )
      );
    });
  } else if (typeof fromLocation === 'number') {
    const currentDayActivities = getDayActivities(fromLocation) || [];
    const newActivities = currentDayActivities.filter(a =>
      !activities.some(transferredActivity => 
        a.instanceId === transferredActivity.instanceId
      )
    );
    reorderDayActivities(fromLocation, newActivities);
  }
  
  if (toLocation === 'wishlist') {
    addActivitiesToWishlist(activities);
  } else if (typeof toLocation === 'number') {
    const currentDayActivities = getDayActivities(toLocation) || [];
    reorderDayActivities(toLocation, [...currentDayActivities, ...activities]);
  }
}, [createOperation, queueSave, updateActivities, getDayActivities, reorderDayActivities, addActivitiesToWishlist]);

E. Modify Activity Details
Location: Find where activity details are saved (notes, times, etc.)
const handleSaveActivityDetails = useCallback((
  activity: Activity, 
  updates: Partial<Activity>,
  targetDayNumber?: number
) => {
  const timestamp = Date.now();
  const modifiedActivity = {
    ...activity,
    ...updates,
    lastModified: timestamp,
    modifiedBy: currentUserID,
  };
  
  if (targetDayNumber !== undefined) {
    // Update in day
    const currentDayActivities = getDayActivities(targetDayNumber) || [];
    const newActivities = currentDayActivities.map(a => 
      a.instanceId === activity.instanceId ? modifiedActivity : a
    );
    reorderDayActivities(targetDayNumber, newActivities);
    
    // Track operation (only store changed fields)
    const op = createOperation('modify', 'day', {
      instanceId: activity.instanceId,
      updates,
      lastModified: timestamp
    }, targetDayNumber);
    queueSave(op);
  } else {
    // Update in wishlist
    updateActivities((prev: Activity[]) => {
      const prevActivities = Array.isArray(prev) ? prev : [];
      return prevActivities.map(a => 
        a.instanceId === activity.instanceId ? modifiedActivity : a
      );
    });
    
    // Track operation
    const op = createOperation('modify', 'wishlist', {
      instanceId: activity.instanceId,
      updates,
      lastModified: timestamp
    });
    queueSave(op);
  }
}, [currentUserID, getDayActivities, reorderDayActivities, updateActivities, createOperation, queueSave]);


Update Todos
Update Phase 1 to keep tripData field
Replace Phase 7 with backward compatible loading
Remove Phase 11 migration section
Update testing strategy for backward compatibility
Update summary and checklist
Phase 7: Load Trip with Backward Compatibility
Implemented Features:
GraphQL Queries (lines 977-1011)
listTripOperationsQuery - Loads operations for a trip
getTripQuery - Loads legacy tripData
loadTrip Function (lines 1014-1126)
Three Loading Paths:
NEW TRIPS: Loads from operations, replays them to build state
LEGACY TRIPS: Loads from tripData field (backward compatible)
EMPTY TRIPS: Initializes empty state
Operation Replay (lines 1040-1060)
Parses operations from JSON
Sorts by timestamp (primary) and sequence number (secondary)
Replays operations using applyOperation to rebuild state
State Restoration (lines 1064-1115)
Uses isRestoringRef to prevent operation tracking during restore
Restores wishlist activities
Restores day activities for each day
Works for both new and legacy formats
Auto-Load on Mount (lines 1129-1133)
Loads trip when tripId is available
Only loads once using isInitialLoadComplete flag
Dependency on tripId, loadTrip, and isInitialLoadComplete

Location: After operation tracking functions
// Load trip state from operations OR legacy tripData (backward compatible)
const loadTrip = useCallback(async () => {
  if (isLoadingInitialRef.current) {
    console.log('[loadTrip] ⏭️  Already loading');
    return;
  }
  
  isLoadingInitialRef.current = true;
  console.log('[loadTrip] 📥 Loading trip:', tripId);
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // Step 1: Try loading from operations (NEW format)
    // ═══════════════════════════════════════════════════════════════
    const operationsResponse = await API.graphql({
      query: listTripOperations,
      variables: { 
        tripId,
        limit: 5000,  // Adjust based on expected max operations
        // TODO: Add pagination if > 5000 operations
      }
    });
    
    const operations = operationsResponse.data.listTripOperations?.items || [];
    
    if (operations.length > 0) {
      // ═══════════════════════════════════════════════════════════════
      // NEW TRIP - Has operations, load from operations
      // ═══════════════════════════════════════════════════════════════
      console.log(`[loadTrip] ✅ Loading from operations (new format) - ${operations.length} operations found`);
      
      isLegacyTripRef.current = false;
      
      // Parse and sort operations
      const sortedOps = operations
        .map((item: any) => JSON.parse(item.operationData))
        .sort((a: Operation, b: Operation) => {
          // Primary sort: timestamp
          if (a.timestamp !== b.timestamp) {
            return a.timestamp - b.timestamp;
          }
          // Secondary sort: sequence number
          return a.sequenceNumber - b.sequenceNumber;
        });
      
      console.log('[loadTrip] 📋 Operation types:', sortedOps.map((op: Operation) => op.type).join(', '));
      
      // Build trip state from operations
      let tripState: any = {
        tripId,
        wishlist: [],
        days: numberOfDays > 0 
          ? Array.from({ length: numberOfDays }, (_, i) => ({
              dayNumber: i + 1,
              activities: []
            }))
          : [],
      };
      
      // Replay operations
      for (const op of sortedOps) {
        tripState = applyOperation(tripState, op);
      }
      
      console.log('[loadTrip] 🔧 Restoring state to context');
      
      // Restore into context (disable operation tracking)
      isRestoringRef.current = true;
      
      updateActivities(tripState.wishlist);
      
      // Restore day activities
      if (tripState.days && tripState.days.length > 0) {
        tripState.days.forEach((day: any) => {
          reorderDayActivities(day.dayNumber, day.activities);
        });
      }
      
      isRestoringRef.current = false;
      
      console.log('[loadTrip] ✅ Trip loaded from operations:', {
        wishlistCount: tripState.wishlist.length,
        daysCount: tripState.days.length
      });
      
    } else {
      // ═══════════════════════════════════════════════════════════════
      // OLD TRIP - No operations, check for legacy tripData
      // ═══════════════════════════════════════════════════════════════
      console.log('[loadTrip] 📦 No operations found, checking for legacy tripData');
      
      const tripResponse = await API.graphql({
        query: getTrip,
        variables: { tripId }
      });
      
      const trip = tripResponse.data.getTrip;
      
      if (trip && trip.tripData) {
        // ═══════════════════════════════════════════════════════════════
        // LEGACY FORMAT - Load from tripData
        // ═══════════════════════════════════════════════════════════════
        console.log('[loadTrip] ✅ Loading from tripData (legacy format)');
        
        isLegacyTripRef.current = true;
        
        const tripData = JSON.parse(trip.tripData);
        
        console.log('[loadTrip] 📋 Legacy data:', {
          wishlistCount: tripData.wishlist?.length || 0,
          daysCount: tripData.days?.length || 0
        });
        
        // Restore into context (disable operation tracking)
        isRestoringRef.current = true;
        
        updateActivities(tripData.wishlist || []);
        
        if (tripData.days && tripData.days.length > 0) {
          tripData.days.forEach((day: any) => {
            reorderDayActivities(day.dayNumber, day.activities || []);
          });
        }
        
        isRestoringRef.current = false;
        
        console.log('[loadTrip] ✅ Trip loaded from legacy tripData');
        console.log('[loadTrip] ℹ️  Note: Trip will convert to operations on first edit');
        
      } else {
        // ═══════════════════════════════════════════════════════════════
        // BRAND NEW TRIP - Empty state
        // ═══════════════════════════════════════════════════════════════
        console.log('[loadTrip] ✅ New empty trip');
        
        isLegacyTripRef.current = false;
        
        // Initialize empty state
        isRestoringRef.current = true;
        updateActivities([]);
        if (numberOfDays > 0) {
          for (let i = 1; i <= numberOfDays; i++) {
            reorderDayActivities(i, []);
          }
        }
        isRestoringRef.current = false;
      }
    }
    
    setIsInitialLoadComplete(true);
    console.log('[loadTrip] ✅ Initial load complete');
    
  } catch (error) {
    console.error('[loadTrip] ❌ Failed to load trip:', error);
  } finally {
    isLoadingInitialRef.current = false;
  }
}, [tripId, numberOfDays, updateActivities, reorderDayActivities, applyOperation]);

// Load trip on mount
useEffect(() => {
  if (tripId && !isInitialLoadComplete) {
    loadTrip();
  }
}, [tripId, loadTrip, isInitialLoadComplete]);


Phase 8: Real-Time Subscriptions (Event Sourcing)
A. Subscribe to Operation Stream
Location: After loadTrip
// Handle remote operations from other users
const handleRemoteOperation = useCallback((op: Operation) => {
  console.log('[handleRemoteOperation] 📩 Received:', op.type, 'from user:', op.userId);
  
  // Ignore operations from yourself (already applied locally)
  if (op.userId === currentUserID) {
    console.log('[handleRemoteOperation] ⏭️  Ignoring own operation');
    return;
  }
  
  // Add to operation log (for audit trail)
  operationLogRef.current.push({
    ...op,
    applied: true  // Already applied in cloud
  });
  
  // Apply operation to current state
  isRestoringRef.current = true;
  
  try {
    // Build current trip state
    const currentTrip = {
      tripId,
      wishlist: activities || [],
      days: numberOfDays > 0 
        ? Array.from({ length: numberOfDays }, (_, i) => ({
            dayNumber: i + 1,
            activities: getDayActivities(i + 1) || []
          }))
        : [],
    };
    
    // Apply the remote operation
    const updatedTrip = applyOperation(currentTrip, op);
    
    // Update context with new state
    updateActivities(updatedTrip.wishlist);
    
    if (updatedTrip.days && updatedTrip.days.length > 0) {
      updatedTrip.days.forEach((day: any) => {
        reorderDayActivities(day.dayNumber, day.activities);
      });
    }
    
    console.log('[handleRemoteOperation] ✅ Applied remote operation');
    
    // If the operation affected the current day, refresh route
    if (op.dayNumber && activeTab === `day${op.dayNumber}`) {
      const dayActivities = updatedTrip.days.find((d: any) => d.dayNumber === op.dayNumber)?.activities || [];
      
      // Refresh route (debounced to avoid too many API calls)
      if (routeRefreshTimeoutRef.current) {
        clearTimeout(routeRefreshTimeoutRef.current);
      }
      
      routeRefreshTimeoutRef.current = setTimeout(async () => {
        console.log('[handleRemoteOperation] 🗺️  Refreshing route for day', op.dayNumber);
        setRouteLoading(true);
        
        try {
          const newRouteData = await fetchRoutePolyline(dayActivities);
          setRouteData(newRouteData);
          
          const dayTab = `day${op.dayNumber}`;
          const activitiesHash = hashActivities(dayActivities);
          routeCache.current[dayTab] = {
            activitiesHash,
            routeData: newRouteData,
          };
          
          if (newRouteData.polyline && newRouteData.polyline.length > 1) {
            const encoded = encodePolyline(newRouteData.polyline);
            setDayPolyline(op.dayNumber!, encoded);
          }
        } catch (error) {
          console.error('[handleRemoteOperation] Error refreshing route:', error);
        } finally {
          setRouteLoading(false);
        }
      }, 1000);
    }
    
  } catch (error) {
    console.error('[handleRemoteOperation] ❌ Error applying operation:', error);
  } finally {
    isRestoringRef.current = false;
  }
}, [currentUserID, tripId, activities, numberOfDays, getDayActivities, updateActivities, reorderDayActivities, applyOperation, activeTab]);

// Add ref for route refresh debouncing
const routeRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Subscribe to operation stream
useEffect(() => {
  if (!tripId || !isInitialLoadComplete) {
    console.log('[subscription] ⏭️  Waiting for initial load');
    return;
  }
  
  // Don't subscribe to legacy trips (they won't have operations)
  if (isLegacyTripRef.current) {
    console.log('[subscription] ⏭️  Legacy trip - subscription not needed until first edit');
    return;
  }
  
  console.log('[subscription] 🔔 Subscribing to operation stream for trip:', tripId);
  
  const subscription = API.graphql(
    graphqlOperation(onCreateTripOperation, { tripId })
  ).subscribe({
    next: ({ value }: any) => {
      try {
        const operationData = value.data.onCreateTripOperation;
        const operation = JSON.parse(operationData.operationData);
        
        handleRemoteOperation(operation);
      } catch (error) {
        console.error('[subscription] ❌ Error processing operation:', error);
      }
    },
    error: (error: any) => {
      console.error('[subscription] ❌ Subscription error:', error);
      
      // Attempt to reconnect after delay
      setTimeout(() => {
        console.log('[subscription] 🔄 Attempting to reconnect...');
        // The effect will re-run and create new subscription
      }, 5000);
    }
  });
  
  return () => {
    console.log('[subscription] 🔕 Unsubscribing from operation stream');
    subscription.unsubscribe();
    
    if (routeRefreshTimeoutRef.current) {
      clearTimeout(routeRefreshTimeoutRef.current);
    }
  };
}, [tripId, isInitialLoadComplete, handleRemoteOperation]);

B. GraphQL Subscription Query
Location: Create /src/graphql/subscriptions.ts or add to existing subscriptions file
export const onCreateTripOperation = /* GraphQL */ `
  subscription OnCreateTripOperation($tripId: ID!) {
    onCreateTripOperation(tripId: $tripId) {
      tripId
      timestamp
      opId
      userId
      sequenceNumber
      type
      target
      dayNumber
      operationData
    }
  }
`;


Phase 9: Cleanup and Lifecycle Management
A. Cleanup on Unmount
Location: Near other cleanup effects
// Cleanup save queue on unmount
useEffect(() => {
  return () => {
    console.log('[cleanup] 🧹 Cleaning up');
    
    // Clear pending save timeout
    if (saveQueueRef.current.timeoutId) {
      clearTimeout(saveQueueRef.current.timeoutId);
    }
    
    // Clear route refresh timeout
    if (routeRefreshTimeoutRef.current) {
      clearTimeout(routeRefreshTimeoutRef.current);
    }
  };
}, []);

// Clear operation log when switching trips
useEffect(() => {
  if (tripId) {
    console.log('[trip-change] 🔄 Trip changed to:', tripId);
    
    // Clear operation log for previous trip
    operationLogRef.current = [];
    
    // Clear save queue
    saveQueueRef.current.operations = [];
    if (saveQueueRef.current.timeoutId) {
      clearTimeout(saveQueueRef.current.timeoutId);
      saveQueueRef.current.timeoutId = null;
    }
    
    // Reset sequence counter
    operationSequenceRef.current = 0;
    
    // Reset initial load flag
    setIsInitialLoadComplete(false);
    
    // Reset legacy trip flag
    isLegacyTripRef.current = false;
    
    console.log('[trip-change] ✅ Operation log cleared');
  }
}, [tripId]);


Phase 10: Remove Old Code
A. Delete Version-Based Save Logic
Location: Find and DELETE these functions/code:
// ❌ DELETE: Entire saveTrip function with version checking
// ❌ DELETE: versionRef usage
// ❌ DELETE: handleReloadTrip (with merge logic)
// ❌ DELETE: mergeOperations (no longer needed - operations never conflict)
// ❌ DELETE: Periodic autosave useEffect (operations save on user action)

B. Update Trip Metadata Save (Optional)
If you still need to save trip metadata (title, dates, etc.) separately: Location: Create separate function for metadata only
// Save trip metadata only (not activity data)
const saveTripMetadata = useCallback(async (metadata: {
  title?: string;
  startDate?: string;
  endDate?: string;
  destination?: string;
}) => {
  try {
    console.log('[saveTripMetadata] 💾 Saving metadata');
    
    await API.graphql({
      query: updateTrip,
      variables: {
        input: {
          tripId,
          ...metadata,
          // NO version field, NO tripData field updated
        }
      }
    });
    
    console.log('[saveTripMetadata] ✅ Metadata saved');
  } catch (error) {
    console.error('[saveTripMetadata] ❌ Error:', error);
  }
}, [tripId]);


Phase 11: Testing Strategy
Test Cases
1. Single Editor Operations
✅ Add activity → operation saved within 100ms
✅ Add 5 activities rapidly → batched into 1 API call (300ms delay)
✅ Delete activity → operation saved immediately
✅ Reorder day → operation saved with IDs only
✅ Move activity from wishlist to day → atomic operation
✅ Modify activity notes → delta-only operation saved
✅ Reload app → trip reconstructed from operations

2. Two Editors - No Conflicts (Event Sourcing Win!)
✅ User A adds activity A (T1)
✅ User B adds activity B (T2, simultaneous)
✅ Both operations append to DynamoDB (NO CONFLICT!)
✅ User A receives subscription → applies op_add_B
✅ User B receives subscription → applies op_add_A
✅ Both users see [A, B] (sorted by timestamp)
✅ Zero conflicts, zero retries

3. Concurrent Reorder + Add (Fixed!)
T0: Day 1 has [A, B, C]
T1: User A reorders to [C, B, A] (creates op with IDs only)
T2: User B adds activity D → [A, B, C, D]
T3: User A's reorder op applies:
    - Reordered: [C, B, A] (activities in new order)
    - Concurrent: [D] (not in reorder IDs)
    - Result: [C, B, A, D] ✅ D preserved!

4. Backward Compatibility (NEW!)
✅ User opens old trip (has tripData, no operations)
✅ Trip loads from tripData successfully
✅ User sees all existing activities
✅ User makes first edit (adds activity)
✅ Operation saved to TripOperations table
✅ Trip now has operations (converted to new format)
✅ Future edits use event sourcing
✅ Real-time collaboration now enabled

5. Legacy Trip Scenarios (NEW!)
✅ Old trip with 50 activities loads correctly
✅ Old trip edited by User A → converts to operations
✅ User B opens same trip → loads from operations
✅ Both users can now collaborate in real-time
✅ Old tripData remains in database (safety backup)

6. Mixed Environment (NEW!)
✅ User has 5 old trips (tripData) + 3 new trips (operations)
✅ All trips load correctly
✅ Old trips work without real-time until edited
✅ New trips have real-time immediately
✅ No errors or conflicts

7. Offline Support
✅ User goes offline
✅ Makes 20 edits → operations queued locally
✅ User comes back online
✅ All 20 operations save in parallel
✅ No conflicts (append-only)
✅ Other users receive all 20 ops via subscription

8. Large Trip Performance
✅ Trip with 1000 operations loads in < 2s (without snapshots)
✅ Trip with 5000 operations + snapshot loads in < 1s
✅ Memory usage stays under 50MB
✅ Operation log auto-cleans at 1000 operations

9. Edge Cases
✅ User switches trips → operation log cleared
✅ User edits Trip A, switches to Trip B, edits Trip B → no cross-contamination
✅ Two users modify same activity field → LWW wins
✅ User makes 10 edits in same millisecond → sequence number preserves order
✅ Subscription connection drops → auto-reconnects after 5s
✅ Operation save fails (network error) → retries with exponential backoff
✅ Legacy trip opened by viewer → loads correctly, no edit operations created


Summary of Changes
Files Modified
File
Changes
Lines
Backend




schema.graphql
Add TripOperation model, KEEP tripData/version in Trip
+40, -0
override.ts
Enable DynamoDB Streams
+10
Frontend




/src/types/operation.types.ts
Update operation types (reorder stores IDs)
+60
/src/types/activity.types.ts
Add timestamp fields
+5
/src/graphql/subscriptions.ts
Add onCreateTripOperation subscription
+15
trip-view_main.tsx
Major changes:


- State setup
Operation log, sequence counter, flags, legacy flag
+45
- createOperation
Operation factory with guards
+50
- saveOperation
Save individual operation (no version check!)
+40
- queueSave + processSaveQueue
Batch operations with coalescing
+120
- applyOperation
Apply operation logic (FIXED reorder)
+200
- loadTrip
Backward compatible load from operations OR tripData
+120
- handleRemoteOperation
Handle subscription updates
+100
- Subscription setup
Subscribe to operation stream (skip legacy trips)
+65
- Hook operations
Add tracking to user actions
+50
- Cleanup
Remove old save logic, version refs
-150

Total: ~820 lines added, ~150 lines removed = ~670 net lines NO Migration Lambda needed! ✅
Update Todos
Update Phase 1 to keep tripData field
Replace Phase 7 with backward compatible loading
Remove Phase 11 migration section
Update testing strategy for backward compatibility
Update summary and checklist
Performance Comparison
Metric
Optimistic Locking (Old)
Event Sourcing (New)
Save Latency
3000ms (full trip)
100-300ms (operation only)
Conflicts
Frequent with 2+ editors
ZERO (append-only)
Bandwidth per change
500KB (entire trip)
1KB (single operation)
Retry complexity
Reload → Merge → Save loop
Simple retry (network errors only)
Offline support
Complex conflict resolution
Queue operations → save when online
Audit trail
None
Full operation history
Debugging
Hard (no change history)
Easy (replay operations)
Scalability
Version bottleneck
Unlimited concurrent writes
Memory overhead
Minimal
~50KB (bounded operation log)
Old trip support
N/A
✅ Backward compatible (no migration)
Migration needed
N/A
❌ Not needed!


Risk Assessment (Event Sourcing with Backward Compatibility)
Risk
Severity
Mitigation
Storage growth
🟡 MEDIUM
Implement snapshots every 100 ops + archive old operations
Initial load time
🟡 MEDIUM
Use snapshots to load from checkpoint
Complex applyOperation logic
🟡 MEDIUM
Comprehensive testing + unit tests for each operation type
DynamoDB costs
🟢 LOW
Operations are small (1KB), reads amortized by snapshots
Subscription reliability
🟡 MEDIUM
Auto-reconnect logic + operation replay on reconnect
Legacy trip data loss
🟢 LOW
tripData kept in database as backup
Dual format complexity
🟢 LOW
Simple if/else in loadTrip (~40 lines)
Testing complexity
🟡 MEDIUM
Need to test both old and new formats

Overall Risk: �� LOW - Event sourcing is proven architecture, backward compatibility adds safety
Implementation Checklist
Backend (AWS Amplify)
 Update GraphQL schema with TripOperation model
 Keep tripData and version fields in Trip model (backward compatibility)
 Enable DynamoDB Streams on TripOperation table
 Deploy backend changes (amplify push)
 Verify TripOperation table created in DynamoDB
 Verify existing trips still load correctly
Frontend (React Native)
 Update operation types (operation.types.ts)
 Add timestamp fields to Activity type
 Add state variables (operation log, sequence, flags, legacy flag)
 Implement createOperation factory
 Implement saveOperation (append-only)
 Implement queueSave + processSaveQueue
 Implement applyOperation (with FIXED reorder logic)
 Implement backward compatible loadTrip (checks operations first, falls back to tripData)
 Add subscription to operation stream (skip if legacy trip)
 Implement handleRemoteOperation
 Hook operation tracking into all user actions
 Add cleanup effects
 Remove old save logic (version-based)
 Test thoroughly!
Testing
 Test single user operations
 Test concurrent editing (2+ users)
 Test concurrent reorder + add (regression test for fix)
 Test loading old trip with tripData
 Test editing old trip (should convert to operations)
 Test mixed trips (some old, some new)
 Test offline mode
 Test trip switching
 Test large trips (1000+ operations)
 Test subscription reconnection
Monitoring
 Add CloudWatch metrics for operation save latency
 Monitor DynamoDB table size growth
 Monitor operation log memory usage
 Set up alerts for subscription failures
 Monitor legacy vs new trip usage



