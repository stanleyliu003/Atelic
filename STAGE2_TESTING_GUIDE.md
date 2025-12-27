# Stage 2: Testing Guide

**Quick reference for testing the reconstruction logic implementation**

## Prerequisites

1. Ensure Stage 1 is working (operations are being saved to DynamoDB)
2. Open React Native Debugger or Metro console
3. Have a trip loaded in the app

## Manual Testing Commands

### 1. Run Verification
```javascript
await global.verifyTrip()
```

**Expected output if passing**:
```
[verifyTripReconstruction] 🔍 Starting verification for trip: abc-123
[verifyTripReconstruction] Loaded 15 operations from DynamoDB
[verifyTripReconstruction] ✅ VERIFICATION PASSED - Reconstruction matches actual state!
```

### 2. View Operation Log
```javascript
global.getOperationLog()
```

**Expected output**:
```
=== Current Operation Log ===
Total operations: 15
Applied operations: 15
Pending operations: 0
┌─────────┬──────────┬──────────┬───────────┬─────────┬──────────┐
│ (index) │   type   │  target  │ dayNumber │ applied │timestamp │
├─────────┼──────────┼──────────┼───────────┼─────────┼──────────┤
│    0    │  'add'   │'wishlist'│ undefined │  true   │ 10:30:15 │
│    1    │  'add'   │  'day'   │     1     │  true   │ 10:30:42 │
│    2    │'reorder' │  'day'   │     1     │  true   │ 10:31:05 │
└─────────┴──────────┴──────────┴───────────┴─────────┴──────────┘
```

### 3. View Save Queue
```javascript
global.getSaveQueue()
```

**Expected output**:
```
=== Current Save Queue ===
Queued operations: 0
Is processing: false
```

## Automated Testing Scenarios

### Test 1: Empty Trip
**Steps**:
1. Create a new trip
2. Don't add any activities
3. Run `global.verifyTrip()`

**Expected**: "No operations yet - skipping verification"

### Test 2: Add to Wishlist
**Steps**:
1. Add 3 activities to wishlist
2. Wait for operations to save (watch console)
3. Run `global.verifyTrip()`

**Expected**: ✅ VERIFICATION PASSED

### Test 3: Remove from Wishlist
**Steps**:
1. Delete 1 activity from wishlist
2. Wait for operation to save
3. Run `global.verifyTrip()`

**Expected**: ✅ VERIFICATION PASSED

### Test 4: Add to Day
**Steps**:
1. Transfer 2 activities from wishlist to Day 1
2. Wait for operations to save
3. Run `global.verifyTrip()`

**Expected**: ✅ VERIFICATION PASSED

### Test 5: Reorder Day
**Steps**:
1. Reorder activities in Day 1 (drag and drop)
2. Wait for operation to save
3. Run `global.verifyTrip()`

**Expected**: ✅ VERIFICATION PASSED

### Test 6: Rapid Actions (100 operations)
**Steps**:
1. Perform many rapid actions (add/remove/reorder)
2. Wait for all operations to save
3. Run `global.verifyTrip()`

**Expected**: ✅ VERIFICATION PASSED

### Test 7: Modify Activity (Notes/Times)
**Steps**:
1. Edit activity notes or start/end times
2. Wait for operation to save
3. Run `global.verifyTrip()`

**Expected**: ✅ VERIFICATION PASSED (when modify operation is implemented)

## Verification After Each Save

**Automatic verification** runs after operations are successfully saved:

1. Perform any action (add/remove/reorder)
2. Watch console - you should see:
```
[processSaveQueue] Saved 1/1 operations
[processSaveQueue] ✅ All operations saved - running verification
[verifyTripReconstruction] 🔍 Starting verification for trip: abc-123
[verifyTripReconstruction] Loaded 5 operations from DynamoDB
[verifyTripReconstruction] ✅ VERIFICATION PASSED - Reconstruction matches actual state!
```

## Troubleshooting

### Issue: "No operations yet"
**Cause**: Trip has no operations in DynamoDB
**Fix**: Perform some actions (add/remove activities) to create operations

### Issue: Verification fails
**Cause**: Mismatch between actual state and reconstructed state
**Steps to debug**:
1. Run `global.getOperationLog()` to see all operations
2. Check which operation type is failing
3. Review the differences logged in console
4. Check if Stage 1 is capturing all user actions

### Issue: Debug commands not available
**Cause**: Not in dev mode or component not mounted
**Fix**:
- Ensure you're running `npx expo start` (dev mode)
- Navigate to trip-view screen
- Check console for: "🛠️ Debug utilities available"

### Issue: TypeScript errors
**Cause**: Type mismatches in reconstruction service
**Fix**:
```bash
npx tsc --noEmit
```
Check for errors and fix them

## DynamoDB Verification

### Check Operations in DynamoDB Console

1. Open AWS Console → DynamoDB
2. Find table: `TripOperation-<env>-dev`
3. Click "Explore table items"
4. Filter by your tripID
5. Verify operations have:
   - ✅ Correct `timestamp` (sort key)
   - ✅ Correct `opId` format
   - ✅ Correct `type` (add/remove/modify/reorder/move)
   - ✅ Valid `operationData` JSON
   - ✅ TTL set to ~1 hour from creation

### Sample Operation in DynamoDB

```json
{
  "tripID": "abc-123",
  "timestamp": 1733184523456,
  "opId": "user_add_wishlist_none_1733184523456_x3k9",
  "userId": "user123",
  "sequenceNumber": 5,
  "type": "add",
  "target": "wishlist",
  "dayNumber": null,
  "operationData": "{\"tripID\":\"abc-123\",\"timestamp\":1733184523456,...}",
  "ttl": 1733188123
}
```

## Expected Behavior Summary

✅ **Operations are created** when user performs actions
✅ **Operations are queued** with 100-300ms coalescing
✅ **Operations are saved** to DynamoDB in batches
✅ **Verification runs automatically** after successful save
✅ **Verification passes** if reconstruction matches actual state
✅ **Verification fails gracefully** with detailed error logs (non-blocking)
✅ **Manual verification** available via `global.verifyTrip()`
✅ **Operation inspection** available via console commands

## Success Criteria

Stage 2 is considered successful when:

1. ✅ All user actions create operations (verified in Stage 1)
2. ✅ Operations are saved to DynamoDB with correct schema
3. ✅ Reconstruction produces identical state to actual app state
4. ✅ Verification passes for all test scenarios
5. ✅ Edge cases handled gracefully (empty trip, rapid actions, etc.)
6. ✅ Console debugging commands work correctly
7. ✅ No TypeScript errors
8. ✅ No runtime errors in reconstruction logic

When all criteria are met, **Stage 2 is complete** and ready for Stage 3!
