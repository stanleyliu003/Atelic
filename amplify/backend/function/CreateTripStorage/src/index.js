const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
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

  console.log('input:', input);
  console.log('userId:', userId);

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
  const item = {
    userID: userId,
    tripID: input.tripId,
    days: input.days,
    tripLength: input.tripLength,
    selectedCity: input.selectedCity,
    wishlist: input.wishlist,
    tripPhotoReference: normalizedPhotoRefs,
    createdAt: input.createdAt,
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    collaborators: input.collaborators || [],
    version: input.version || 1,
    updatedAt: input.updatedAt || new Date().toISOString(),
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
    savedActivities: input.savedActivities || null
  };

  console.log('item to put:', item);

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
  }

  try {
    await docClient.send(new PutCommand(params));
    console.log('Trip saved successfully to DynamoDB');

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
    return {
      tripId: input.tripId,
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
      savedActivities: item.savedActivities
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
