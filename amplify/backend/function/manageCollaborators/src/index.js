/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_TRIPSTORAGE_ARN
	STORAGE_TRIPSTORAGE_NAME
	STORAGE_TRIPSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

// Helper function to normalize tripPhotoReference to array format
const normalizePhotoReferences = (photoRef) => {
  if (!photoRef) return [];
  if (Array.isArray(photoRef)) return photoRef;
  return [photoRef]; // Convert old string format to array
};

/**
 * Manage trip collaborators - add, remove, update roles
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Get fieldName from event (AppSync provides it at the top level)
  const { fieldName } = event;

  const { tripId } = event.arguments;

  // Validate required parameters
  if (!tripId) {
    throw new Error('Missing required parameter: tripId');
  }

  console.log('Operation:', fieldName, 'for tripId:', tripId);

  const tableName = process.env.STORAGE_TRIPSTORAGE_NAME;

  try {
    // Get current user from context (requester) - optional for now
    const requesterId = event.identity?.claims?.sub;
    console.log('Requester ID:', requesterId);

    // Since we don't know the owner's userID, we need to scan for the trip
    // This is not ideal but necessary for this structure
    const trip = await findTripById(tripId, tableName);
    if (!trip) {
      throw new Error('Trip not found');
    }

    // Validate permissions if we have a requester ID
    let requesterRole = null;
    if (requesterId) {
      requesterRole = getUserRoleInTrip(trip, requesterId);
      if (!requesterRole) {
        throw new Error('Access denied: You are not a collaborator on this trip');
      }
      console.log('Requester role:', requesterRole);
    } else {
      console.log('No authentication provided - proceeding with caution');
      // For now, allow the operation but log it
      // In production, you might want to add additional validation
    }

    // Handle different operations
    switch (fieldName) {
      case 'addCollaborator':
        return await handleAddCollaborator(trip, event.arguments, requesterId, requesterRole, tableName);

      case 'removeCollaborator':
        return await handleRemoveCollaborator(trip, event.arguments, requesterId, requesterRole, tableName);

      case 'updateCollaboratorRole':
        return await handleUpdateCollaboratorRole(trip, event.arguments, requesterId, requesterRole, tableName);

      default:
        throw new Error(`Unknown operation: ${fieldName}`);
    }

  } catch (error) {
    console.error('manageCollaborators error:', error);
    throw error;
  }
};

// Helper function to find trip by ID (scan operation)
async function findTripById(tripId, tableName) {
  const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

  const params = {
    TableName: tableName,
    FilterExpression: 'tripID = :tripId',
    ExpressionAttributeValues: {
      ':tripId': tripId
    }
  };

  const result = await docClient.send(new ScanCommand(params));
  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

// Helper function to get user's role in trip
function getUserRoleInTrip(trip, userId) {
  if (!trip.collaborators || !Array.isArray(trip.collaborators)) {
    return null;
  }

  const collaborator = trip.collaborators.find(c => c.userID === userId);
  return collaborator ? collaborator.role : null;
}

// Helper function to check if user can perform action
function canPerformAction(requesterRole, targetRole, action) {
  // If no authentication provided, allow for now (temporary for testing)
  if (!requesterRole) {
    console.log('No requester role - allowing action for testing purposes');
    return true;
  }

  switch (action) {
    case 'add':
      // Owner can add anyone, Editor can only add viewers
      return requesterRole === 'owner' || (requesterRole === 'editor' && targetRole === 'viewer');

    case 'remove':
      // Only owner can remove collaborators
      return requesterRole === 'owner';

    case 'updateRole':
      // Only owner can change roles
      return requesterRole === 'owner';

    default:
      return false;
  }
}

// Add collaborator handler
async function handleAddCollaborator(trip, args, requesterId, requesterRole, tableName) {
  const { userID, userEmail, fullName, role, addedBy } = args;

  // Validate permissions
  if (!canPerformAction(requesterRole, role, 'add')) {
    throw new Error('Permission denied: You cannot add collaborators with this role');
  }

  // Check if user is already a collaborator
  const existingCollaborator = trip.collaborators.find(c => c.email === userEmail);
  if (existingCollaborator) {
    throw new Error('User is already a collaborator on this trip');
  }

  const newCollaborator = {
    email: userEmail,
    fullName: fullName,
    userID: userID,
    role: role,
    addedBy: addedBy || 'Self'
  };

  // Add to collaborators array
  const updatedCollaborators = [...trip.collaborators, newCollaborator];

  // Update DynamoDB
  const updateParams = {
    TableName: tableName,
    Key: {
      userID: trip.userID,
      tripID: trip.tripID
    },
    UpdateExpression: 'SET collaborators = :collaborators',
    ExpressionAttributeValues: {
      ':collaborators': updatedCollaborators
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await docClient.send(new UpdateCommand(updateParams));
  return convertDynamoItemToTrip(result.Attributes);
}

// Remove collaborator handler
async function handleRemoveCollaborator(trip, args, requesterId, requesterRole, tableName) {
  const { userEmail } = args;

  // Validate permissions
  if (!canPerformAction(requesterRole, null, 'remove')) {
    throw new Error('Permission denied: Only trip owners can remove collaborators');
  }

  // Cannot remove the owner
  const targetCollaborator = trip.collaborators.find(c => c.email === userEmail);
  if (!targetCollaborator) {
    throw new Error('User is not a collaborator on this trip');
  }

  if (targetCollaborator.role === 'owner') {
    throw new Error('Cannot remove the trip owner');
  }

  // Remove from collaborators array
  const updatedCollaborators = trip.collaborators.filter(c => c.email !== userEmail);

  // Update DynamoDB
  const updateParams = {
    TableName: tableName,
    Key: {
      userID: trip.userID,
      tripID: trip.tripID
    },
    UpdateExpression: 'SET collaborators = :collaborators',
    ExpressionAttributeValues: {
      ':collaborators': updatedCollaborators
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await docClient.send(new UpdateCommand(updateParams));
  return convertDynamoItemToTrip(result.Attributes);
}

// Update collaborator role handler
async function handleUpdateCollaboratorRole(trip, args, requesterId, requesterRole, tableName) {
  const { userEmail, role } = args;

  // Validate permissions
  if (!canPerformAction(requesterRole, role, 'updateRole')) {
    throw new Error('Permission denied: Only trip owners can change collaborator roles');
  }

  // Cannot set role to owner
  if (role === 'owner') {
    throw new Error('Cannot change collaborator role to owner. There can only be one trip owner.');
  }

  // Find the collaborator
  const collaboratorIndex = trip.collaborators.findIndex(c => c.email === userEmail);
  if (collaboratorIndex === -1) {
    throw new Error('User is not a collaborator on this trip');
  }

  // Cannot change owner role
  if (trip.collaborators[collaboratorIndex].role === 'owner') {
    throw new Error('Cannot change the role of the trip owner');
  }

  // Update the role
  const updatedCollaborators = [...trip.collaborators];
  updatedCollaborators[collaboratorIndex] = {
    ...updatedCollaborators[collaboratorIndex],
    role: role
  };

  // Update DynamoDB
  const updateParams = {
    TableName: tableName,
    Key: {
      userID: trip.userID,
      tripID: trip.tripID
    },
    UpdateExpression: 'SET collaborators = :collaborators',
    ExpressionAttributeValues: {
      ':collaborators': updatedCollaborators
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await docClient.send(new UpdateCommand(updateParams));
  return convertDynamoItemToTrip(result.Attributes);
}



// Helper function to convert DynamoDB item to GraphQL Trip format
function convertDynamoItemToTrip(item) {
  return {
    tripId: item.tripID,
    days: item.days || [],
    wishlist: item.wishlist || [],
    tripLength: item.tripLength,
    selectedCity: item.selectedCity,
    tripPhotoReference: normalizePhotoReferences(item.tripPhotoReference),
    createdAt: item.createdAt,
    collaborators: item.collaborators || []
  };
}