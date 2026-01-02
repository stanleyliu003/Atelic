import { Activity } from './activity.types';

import { TravelMode } from './activity.types';

/**
 * Base operation type with common fields
 * All operations are append-only writes to DynamoDB
 */
export type Operation = {
  tripID: string; // Partition key in DynamoDB
  timestamp: number; // Sort key in DynamoDB (milliseconds since epoch)
  opId: string; // Unique operation ID: `${userId}_${type}_${target}_${timestamp}_${random}`
  userId: string; // User who performed the operation
  sequenceNumber: number; // For deterministic ordering within same millisecond
  type: 'add' | 'remove' | 'modify' | 'reorder' | 'move' | 'update_transport_mode';
  target: 'wishlist' | 'day';
  dayNumber?: number; // Required if target is 'day'
  data: any; // Operation-specific data
  applied: boolean; // Has this been saved to cloud?
};

/**
 * Add operation - adds activities to wishlist or day
 */
export type OperationAdd = Operation & {
  type: 'add';
  data: Activity | Activity[];
};

/**
 * Remove operation - removes activities by instanceId
 */
export type OperationRemove = Operation & {
  type: 'remove';
  data: string | string[]; // instanceId(s)
};

/**
 * Modify operation - updates specific fields of an activity (delta-only)
 */
export type OperationModify = Operation & {
  type: 'modify';
  data: {
    instanceId: string;
    updates: Partial<Activity>; // Only changed fields
    lastModified: number;
  };
};

/**
 * Reorder operation - reorders activities within a day
 * Stores only IDs to minimize payload size
 */
export type OperationReorder = Operation & {
  type: 'reorder';
  target: 'day';
  dayNumber: number;
  data: {
    reorderedIds: string[]; // Just the IDs in new order
    lastReordered: number;
  };
};

/**
 * Move operation - atomic move between wishlist and days
 */
// MOVE operation
// Supports BOTH legacy (Stage 1/2) and new (Stage 3) payload shapes.
//
// Legacy shape (what the frontend currently writes):
//  - Moving from day -> wishlist:
//      target: 'wishlist'
//      dayNumber: undefined
//      data: { instanceId: string, fromDay: number }
//  - Moving from wishlist/day -> day:
//      target: 'day'
//      dayNumber: <destination day>
//      data: { instanceId: string, fromWishlist?: boolean, fromDay?: number }
//
// New shape (future-proof, atomic):
//  - data: { activity, fromLocation, toLocation }
export type OperationMove = Operation & {
  type: 'move';
  data:
    | {
        activity: Activity;
        fromLocation: 'wishlist' | number;
        toLocation: 'wishlist' | number;
      }
    | {
        instanceId: string;
        fromDay?: number;
        fromWishlist?: boolean;
      };
};

/**
 * Update transport mode operation - changes the transportation mode for a route leg
 * The leg is identified by the origin activity's instanceId (destination is the next activity in order)
 */
export type OperationUpdateTransportMode = Operation & {
  type: 'update_transport_mode';
  target: 'day';
  dayNumber: number;
  data: {
    originInstanceId: string; // The instanceId of the origin activity for this leg
    mode: TravelMode; // The new transportation mode (WALK, DRIVE, TRANSIT)
    lastModified: number; // Timestamp for LWW conflict resolution
  };
};

/**
 * Union type of all operations
 */
export type AnyOperation =
  | OperationAdd
  | OperationRemove
  | OperationModify
  | OperationReorder
  | OperationMove
  | OperationUpdateTransportMode;
