const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);
const lambdaClient = new LambdaClient();

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Get trip data from GraphQL input
  const input = event.arguments.input;
  if (!input || !input.tripId) {
    throw new Error('Missing tripId in input');
  }

  // Get userId from the input instead of authentication
  const userId = input.userID;
  if (!userId) {
    throw new Error('userID is required in input');
  }

  console.log('==== CreateTripStorage START ====');
  console.log('[CreateTripStorage] Full input object:', JSON.stringify(input, null, 2));
  console.log('[CreateTripStorage] userId:', userId);
  console.log('[CreateTripStorage] 📝 Received tripTitle:', input.tripTitle);
  console.log('[CreateTripStorage] 📝 tripTitle type:', typeof input.tripTitle);
  console.log('[CreateTripStorage] 📝 tripTitle is null?:', input.tripTitle === null);
  console.log('[CreateTripStorage] 📝 tripTitle is undefined?:', input.tripTitle === undefined);
  console.log('[CreateTripStorage] 📝 tripTitle length:', input.tripTitle?.length);

  // Normalize tripPhotoReference to ensure it's an array with max 5 elements
  let normalizedPhotoRefs = [];
  if (input.tripPhotoReference) {
    if (Array.isArray(input.tripPhotoReference)) {
      // Already an array, limit to 5 elements
      normalizedPhotoRefs = input.tripPhotoReference.slice(0, 5);
    } else if (typeof input.tripPhotoReference === 'string') {
      // Legacy string format, convert to array
      normalizedPhotoRefs = [input.tripPhotoReference];
    }
  }

  // Compose the item to store
  const nowIso = new Date().toISOString();
  let existingCreatedAt = null;
  try {
    const existing = await docClient.send(new GetCommand({
      TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
      Key: { userID: userId, tripID: input.tripId }
    }));
    if (existing?.Item) {
      existingCreatedAt = existing.Item.createdAt || existing.Item.updatedAt || null;
    }
  } catch (e) {
    console.warn('Warning: failed to fetch existing trip for createdAt preservation:', e?.message || e);
  }
  const computedCreatedAt = existingCreatedAt || input.createdAt || nowIso;
  const item = {
    userID: userId,
    tripID: input.tripId,
    tripTitle: input.tripTitle || null,
    days: input.days,
    tripLength: input.tripLength,
    selectedCity: input.selectedCity,
    wishlist: input.wishlist,
    tripPhotoReference: normalizedPhotoRefs,
    createdAt: computedCreatedAt,
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    collaborators: input.collaborators || [],
    version: input.version || 1,
    updatedAt: input.updatedAt || nowIso,
    lastUpdatedBy: input.lastUpdatedBy || 'unknown',
    // Persist cityCategories if provided
    cityCategories: Array.isArray(input.cityCategories) ? input.cityCategories : [],
    // New fields for future features (empty for now)
    notes: input.notes || null,
    duration: input.duration || null,
    arrivalTime: input.arrivalTime || null,
    photos: input.photos || null,
    hotel: input.hotel || null,
    flight: input.flight || null,
    savedActivities: input.savedActivities || null,
    // Deleted saved places tracking
    deletedSavedPlaceIds: Array.isArray(input.deletedSavedPlaceIds) ? input.deletedSavedPlaceIds : [],
    // Recent searches
    recentSearches: Array.isArray(input.recentSearches) ? input.recentSearches : [],
    // Multi-city support
    cities: Array.isArray(input.cities) ? input.cities : []
  };

  console.log('[CreateTripStorage] 💾 Item to save - tripTitle:', item.tripTitle);
  console.log('[CreateTripStorage] 💾 Item to save - userID:', item.userID);
  console.log('[CreateTripStorage] 💾 Item to save - tripID:', item.tripID);
  console.log('[CreateTripStorage] 💾 Full item:', JSON.stringify(item, null, 2));

  // Store in DynamoDB with optimistic locking (if version provided)
  const params = {
    TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
    Item: item,
  };

  // Add conditional expression for version checking if version > 1
  if (input.version && input.version > 1) {
    params.ConditionExpression = 'attribute_not_exists(version) OR version = :expectedVersion';
    params.ExpressionAttributeValues = {
      ':expectedVersion': input.version - 1
    };
    console.log('[CreateTripStorage] 🔒 Version check - expecting DynamoDB version:', input.version - 1, 'sending version:', input.version);
  } else {
    console.log('[CreateTripStorage] ⚠️ No version check - first save or version <= 1');
  }

  console.log('[CreateTripStorage] 🔍 About to save to DynamoDB');
  console.log('[CreateTripStorage] 🔍 Params:', JSON.stringify(params, null, 2));

  try {
    const putResult = await docClient.send(new PutCommand(params));
    console.log('Trip saved successfully to DynamoDB');
    console.log('[CreateTripStorage] ✅ Saved tripTitle to DynamoDB:', item.tripTitle);
    console.log('[CreateTripStorage] ✅ Saved tripID:', item.tripID);
    console.log('[CreateTripStorage] ✅ Saved version:', item.version);
    console.log('[CreateTripStorage] ✅ PutCommand result:', putResult);

    // Fire-and-forget updates to UserProfiles
    try {
      console.log('Calling updateUserProfile Lambda for trip creation...');
      const owner = (input.collaborators || []).find(c => c.role === 'owner');
      const nonOwnerCollaborators = (input.collaborators || []).filter(c => c.role !== 'owner');
      const combinedActivities = [
        ...(input.wishlist || []),
        ...((input.days || []).flatMap(d => d.activities || []))
      ];

      if (owner && owner.username) {
        console.log('Invoking updateUserProfile for owner:', owner.username, 'action=ADD_OWNED_TRIP');
        await updateOwnerProfile(owner.username, {
          tripId: input.tripId,
          selectedCity: input.selectedCity,
          tripPhotoReference: normalizedPhotoRefs,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
          tripLength: input.tripLength || null,
          createdAt: computedCreatedAt,
          version: input.version || 1,
          activities: combinedActivities,
          collaborators: input.collaborators || []
        });
      }

      if (nonOwnerCollaborators.length > 0) {
        await Promise.all(
          nonOwnerCollaborators
            .filter(c => !!c.username)
            .map(collab =>
              (async () => {
                console.log('Invoking updateUserProfile for collaborator:', collab.username, 'action=ADD_SHARED_TRIP', 'role=', collab.role);
              updateCollaboratorProfile(collab.username, {
                tripId: input.tripId,
                selectedCity: input.selectedCity,
                tripPhotoReference: normalizedPhotoRefs,
                startDate: input.startDate || null,
                endDate: input.endDate || null,
                tripLength: input.tripLength || null,
                role: collab.role,
                  ownerUsername: owner?.username || '',
                  createdAt: computedCreatedAt,
                  version: input.version || 1,
                  // Pass identity to allow baseline initialization
                  userID: collab.userID,
                  email: collab.email,
                  fullName: collab.fullName
              });
              })()
            )
        );
      }
    } catch (invokeErr) {
      console.error('Failed to invoke updateUserProfile Lambda(s):', invokeErr);
      // Do not fail trip creation due to profile update issues
    }

    // Return a Trip object as required by the GraphQL schema
    console.log('[CreateTripStorage] 📤 Returning tripTitle:', item.tripTitle);
    return {
      tripId: input.tripId,
      tripTitle: item.tripTitle,
      days: input.days || [],
      wishlist: input.wishlist || [],
      tripLength: input.tripLength,
      selectedCity: input.selectedCity,
      tripPhotoReference: normalizedPhotoRefs,
      createdAt: item.createdAt,
      startDate: item.startDate,
      endDate: item.endDate,
      collaborators: item.collaborators,
      version: item.version,
      updatedAt: item.updatedAt,
      lastUpdatedBy: item.lastUpdatedBy,
      cityCategories: item.cityCategories || [],
      notes: item.notes,
      duration: item.duration,
      arrivalTime: item.arrivalTime,
      photos: item.photos,
      hotel: item.hotel,
      flight: item.flight,
      savedActivities: item.savedActivities,
      recentSearches: item.recentSearches || [],
      deletedSavedPlaceIds: item.deletedSavedPlaceIds || [],
      cities: item.cities || []
    };
  } catch (error) {
    console.error('DynamoDB put error:', error);

    // Check if it's a conditional check failure (version conflict)
    if (error.name === 'ConditionalCheckFailedException') {
      console.error('Version conflict detected - Attempted version:', input.version, 'Expected DB version:', input.version - 1);
      throw new Error(`Version conflict: Attempted to save version ${input.version} but database has a different version. This usually happens when multiple save requests occur simultaneously. Please try again.`);
    }

    throw new Error('Failed to save trip: ' + error.message);
  }
};

async function updateOwnerProfile(username, tripData) {
  const payload = {
    username,
    action: 'ADD_OWNED_TRIP',
    tripData
  };

  console.log('updateOwnerProfile payload:', JSON.stringify(payload));
  await lambdaClient.send(new InvokeCommand({
    FunctionName: process.env.FUNCTION_UPDATEUSERPROFILE_NAME,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify(payload))
  }));
}

async function updateCollaboratorProfile(username, tripData) {
  const payload = {
    username,
    action: 'ADD_SHARED_TRIP',
    tripData
  };

  console.log('updateCollaboratorProfile payload:', JSON.stringify(payload));
  await lambdaClient.send(new InvokeCommand({
    FunctionName: process.env.FUNCTION_UPDATEUSERPROFILE_NAME,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify(payload))
  }));
}
