# Fix Missing Subscription Resolver

## The Problem

TripOperations are now saving to DynamoDB ✅, but collaborators aren't seeing the changes in real-time ❌.

This is because the **subscription resolver** for `onCreateTripOperation` is also missing due to the same CloudFormation bug that affected the mutation resolver.

## How Real-Time Sync Works

1. User A creates/moves an activity → `createTripOperation` mutation
2. AppSync saves to DynamoDB
3. AppSync triggers `onCreateTripOperation` subscription
4. User B's app receives the event via subscription
5. User B's app calls `syncNewOperations()` to apply the changes

Currently steps 3-5 are broken because the subscription resolver doesn't exist.

## Check if Subscription Resolver Exists

### In AppSync Console

1. Go to: AWS Console → AppSync → WishListAPI-production → **Schema**
2. Find `type Subscription`
3. Look for `onCreateTripOperation` field
4. Check if there's a resolver attached (or "Attach" button)

**If you see "Attach" button** → Resolver is missing (this is the problem)

---

## Fix: Manually Create Subscription Resolver

The subscription resolver for `@model` types is auto-generated and should already exist as a **function**, but it's not attached to the schema field.

### Option 1: Check Functions First

1. AppSync → **Functions** (left sidebar)
2. Search for: `onCreateTripOperation`
3. Look for: `SubscriptionOnCreateTripOperationDataResolverFn`

**If it exists:**
- The function is there, we just need to attach it via a pipeline resolver

**If it doesn't exist:**
- We need to create a simple "pass-through" resolver

---

### Option 2: Create Simple Subscription Resolver

Since subscriptions for `@model` types are usually just pass-through (they don't need complex logic), we can create a simple one:

1. AppSync Console → Schema
2. Find `onCreateTripOperation` under `type Subscription`
3. Click **"Attach"** button
4. Choose **"Unit resolver"**
5. Resolver runtime: **"VTL"**
6. Data source: **"NONE_DS"** (subscriptions don't query data sources directly)
7. Request mapping template:

```vtl
{
  "version": "2017-02-28",
  "payload": {}
}
```

8. Response mapping template:

```vtl
$util.toJson(null)
```

9. Click **"Create"**

**Note**: This creates a "stub" resolver. The actual subscription magic happens at the AppSync layer, not in the resolver templates. The resolver just needs to exist for the subscription to be active.

---

### Option 3: Use Pipeline Resolver with Existing Function

If `SubscriptionOnCreateTripOperationDataResolverFn` exists in Functions:

1. AppSync Console → Schema
2. Find `onCreateTripOperation` under `type Subscription`
3. Click **"Attach"** button
4. Choose **"Pipeline resolver"**
5. Click **"Add function"**
6. Select: `SubscriptionOnCreateTripOperationDataResolverFn`
7. Before mapping template:

```vtl
{}
```

8. After mapping template:

```vtl
$util.toJson($ctx.prev.result)
```

9. Click **"Create"**

---

## Test the Subscription

After creating the resolver, test real-time sync:

### Test Setup

1. **Device A** (your device): Open a trip in the app
2. **Device B** (collaborator or simulator): Open the same trip
3. **Device A**: Move an activity or add to wishlist
4. **Device B**: Should see the change appear automatically

### Expected Behavior

- Device B's console should show:
  ```
  [trip-view_main] TripOperation created by another user - syncing operations...
  ```
- The UI should update with the new changes

### If Still Not Working

Check the app logs on Device B:

```javascript
[trip-view_main] Subscribing to TripOperation events for trip: ...
```

If you see:
- `Skipping operation subscription - screen not focused` → Bring app to foreground
- `TripOperation subscription error: ...` → Check the error message
- Nothing → Subscription might not be firing

---

## Alternative: Polling Instead of Subscriptions

If subscriptions continue to be problematic, you can implement polling as a fallback:

The app already has `syncNewOperations()` which fetches new operations from DynamoDB. You can call this periodically:

```typescript
// In trip-view_main.tsx, add polling
useEffect(() => {
  if (!tripId || !isScreenFocused) return;

  // Poll every 5 seconds for new operations
  const interval = setInterval(() => {
    console.log('[trip-view_main] Polling for new operations...');
    syncNewOperations();
  }, 5000);

  return () => clearInterval(interval);
}, [tripId, isScreenFocused, syncNewOperations]);
```

This is less elegant than subscriptions but works reliably.

---

## Summary

**Quick Fix:**
1. Check if `onCreateTripOperation` subscription has a resolver attached
2. If not, create a simple NONE_DS resolver (Option 2)
3. Test with two devices

**Expected Result:**
- Collaborators see changes in real-time
- Console shows subscription events firing

The subscription resolver is likely missing for the same reason the mutation resolver was (CloudFormation bug). Creating it manually will fix real-time collaboration.
