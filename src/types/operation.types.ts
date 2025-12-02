import { Activity } from './activity.types';

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
  type: 'add' | 'remove' | 'modify' | 'reorder' | 'move';
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
export type OperationMove = Operation & {
  type: 'move';
  data: {
    activity: Activity; // Full activity for atomic operation
    fromLocation: 'wishlist' | number; // number = day number
    toLocation: 'wishlist' | number;
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
  | OperationMove;
