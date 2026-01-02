# CloudFormation Template Bug - Manual Fix Required

## The Bug
Amplify CLI v13.0.1 has a codegen bug where the `CreateTripOperationResolver` pipeline references **WishlistAnalysis** functions instead of **TripOperation** functions.

This causes the resolver to fail creation in CloudFormation, resulting in "Resolver Count: 0".

## Why Regeneration Didn't Work
Even after removing and re-adding the `@model` directive, Amplify's GraphQL Transformer continues to generate the incorrect CloudFormation template. This appears to be a persistent bug in this version of Amplify CLI.

## The Workaround

Since the template keeps regenerating with the bug, we have two options:

### Option 1: Manually Edit the Built CloudFormation Template (Quick Fix)

**IMPORTANT**: This fix will be overwritten next time you run `amplify api gql-compile` or `amplify push`, so only use it for immediate deployment.

1. Edit the file:
   ```
   amplify/backend/api/WishListAPI/build/stacks/TripOperation.json
   ```

2. Find the `CreateTripOperationResolver` resource (around line 665)

3. Replace the `PipelineConfig.Functions` array with the correct references.

**Current (WRONG):**
```json
"PipelineConfig": {
  "Functions": [
    {
      "Ref": "referencetotransformerrootstackWishlistAnalysisNestedStack..."
    },
    ...
  ]
}
```

**Should be (CORRECT):**
```json
"PipelineConfig": {
  "Functions": [
    {
      "Fn::GetAtt": [
        "MutationCreateTripOperationDataResolverFnMutationCreateTripOperationDataResolverFnAppSyncFunction25502663",
        "FunctionId"
      ]
    }
  ]
}
```

4. Run `amplify push` immediately without recompiling

---

### Option 2: Upgrade Amplify CLI (Recommended Long-term)

This bug may be fixed in a newer version:

```bash
npm install -g @aws-amplify/cli@latest
amplify upgrade
amplify api gql-compile
amplify push
```

If still broken, downgrade to a known working version:

```bash
npm install -g @aws-amplify/cli@12.12.6
amplify api gql-compile
amplify push
```

---

### Option 3: Simplify the Resolver (Bypass the Bug)

Instead of using the buggy pipeline resolver, create a simple unit resolver manually in AppSync console:

**This is the fastest fix and doesn't depend on CloudFormation:**

1. AWS Console → AppSync → WishListAPI-production → Schema
2. Find `createTripOperation` under Mutation
3. Click "Attach" → Choose "Unit resolver"
4. Data source: `TripOperationTable`
5. Request mapping template:

```vtl
#set($id = $util.autoId())
#set($now = $util.time.nowISO8601())

{
  "version": "2017-02-28",
  "operation": "PutItem",
  "key": {
    "id": $util.dynamodb.toDynamoDBJson($id)
  },
  "attributeValues": {
    "tripID": $util.dynamodb.toDynamoDBJson($ctx.args.input.tripID),
    "timestamp": $util.dynamodb.toDynamoDBJson($ctx.args.input.timestamp),
    "opId": $util.dynamodb.toDynamoDBJson($ctx.args.input.opId),
    "userId": $util.dynamodb.toDynamoDBJson($ctx.args.input.userId),
    "sequenceNumber": $util.dynamodb.toDynamoDBJson($ctx.args.input.sequenceNumber),
    "type": $util.dynamodb.toDynamoDBJson($ctx.args.input.type),
    "target": $util.dynamodb.toDynamoDBJson($ctx.args.input.target),
    #if($ctx.args.input.dayNumber)
      "dayNumber": $util.dynamodb.toDynamoDBJson($ctx.args.input.dayNumber),
    #end
    "operationData": $util.dynamodb.toDynamoDBJson($ctx.args.input.operationData),
    #if($ctx.args.input.ttl)
      "ttl": $util.dynamodb.toDynamoDBJson($ctx.args.input.ttl),
    #end
    "createdAt": $util.dynamodb.toDynamoDBJson($now),
    "updatedAt": $util.dynamodb.toDynamoDBJson($now)
  }
}
```

6. Response mapping template:
```vtl
$util.toJson($ctx.result)
```

7. Save and test immediately

**This bypasses the CloudFormation bug entirely and should work instantly.**

---

## Recommended Action

**Use Option 3 (Manual resolver in AppSync)**:
- Takes 5 minutes
- Works immediately
- Doesn't depend on fixing the Amplify bug
- Won't be overwritten by future `amplify push` (manual resolvers persist)

Then later, you can investigate upgrading Amplify CLI to fix the root cause.

## Test After Fix

```bash
node scripts/test-tripoperation-mutation.js
```

Should return the created object instead of null.
CloudWatch logs should show "Resolver Count: 1" or higher.
