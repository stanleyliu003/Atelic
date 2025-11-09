/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log('updateUserProfile event:', JSON.stringify(event));

  const { username, action, tripData } = event;

  if (!username || !action) {
    throw new Error('username and action are required');
  }

  try {
    switch (action) {
      case 'ADD_OWNED_TRIP':
        return await addOwnedTrip(username, tripData);

      case 'REMOVE_OWNED_TRIP':
        return await removeOwnedTrip(username, tripData.tripId);

      case 'UPDATE_OWNED_TRIP':
        return await updateOwnedTrip(username, tripData);

      case 'ADD_SHARED_TRIP':
        return await addSharedTrip(username, tripData);

      case 'REMOVE_SHARED_TRIP':
        return await removeSharedTrip(username, tripData.tripId);

      case 'UPDATE_LAST_ACTIVE':
        return await updateLastActive(username);

      case 'UPDATE_DEMOGRAPHICS':
        return await updateDemographics(username, tripData);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

/**
 * Add an owned trip to the user's profile
 */
async function addOwnedTrip(username, tripData) {
  const {
    tripId,
    selectedCity,
    tripPhotoReference,
    startDate,
    endDate,
    tripLength,
    activities,
    collaborators
  } = tripData;

  const tripSummary = {
    tripId,
    selectedCity,
    tripPhotoReference: tripPhotoReference || [],
    startDate,
    endDate,
    tripLength,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const activityCount = activities?.length || 0;
  const collaboratorCount = collaborators?.length || 0;
  const viewersCount = collaborators?.filter(c => c.role === 'viewer').length || 0;
  const editorsCount = collaborators?.filter(c => c.role === 'editor').length || 0;

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `
      SET ownedTripsCount = if_not_exists(ownedTripsCount, :zero) + :one,
          ownedTrips = list_append(if_not_exists(ownedTrips, :emptyList), :trip),
          activitiesPerTrip.#tripId = :activityCount,
          totalActivitiesOwned = if_not_exists(totalActivitiesOwned, :zero) + :activityCount,
          collaboratorsPerTrip.#tripId = :collaboratorData,
          totalCollaboratorsAcrossTrips = if_not_exists(totalCollaboratorsAcrossTrips, :zero) + :collaboratorCount,
          updatedAt = :now,
          version = if_not_exists(version, :zero) + :one
    `,
    ExpressionAttributeNames: {
      '#tripId': tripId
    },
    ExpressionAttributeValues: {
      ':zero': 0,
      ':one': 1,
      ':emptyList': [],
      ':trip': [tripSummary],
      ':activityCount': activityCount,
      ':collaboratorCount': collaboratorCount,
      ':collaboratorData': {
        total: collaboratorCount,
        viewers: viewersCount,
        editors: editorsCount
      },
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));

  // Recalculate averages
  const updated = result.Attributes;
  if (updated.ownedTripsCount > 0) {
    updated.avgActivitiesPerTrip = updated.totalActivitiesOwned / updated.ownedTripsCount;
    updated.avgCollaboratorsPerTrip = updated.totalCollaboratorsAcrossTrips / updated.ownedTripsCount;
  }

  console.log('Added owned trip, updated profile:', updated);
  return updated;
}

/**
 * Remove an owned trip from the user's profile
 */
async function removeOwnedTrip(username, tripId) {
  // First, get the current profile to find the trip
  const getResult = await docClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username }
  }));

  const profile = getResult.Item;
  if (!profile) {
    throw new Error(`Profile not found for username: ${username}`);
  }

  // Find the trip index
  const tripIndex = profile.ownedTrips?.findIndex(trip => trip.tripId === tripId);
  if (tripIndex === -1 || tripIndex === undefined) {
    throw new Error(`Trip ${tripId} not found in owned trips`);
  }

  const trip = profile.ownedTrips[tripIndex];
  const activityCount = profile.activitiesPerTrip?.[tripId] || 0;
  const collaboratorCount = profile.collaboratorsPerTrip?.[tripId]?.total || 0;

  // Remove the trip
  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `
      REMOVE ownedTrips[${tripIndex}],
             activitiesPerTrip.#tripId,
             collaboratorsPerTrip.#tripId
      SET ownedTripsCount = ownedTripsCount - :one,
          totalActivitiesOwned = totalActivitiesOwned - :activityCount,
          totalCollaboratorsAcrossTrips = totalCollaboratorsAcrossTrips - :collaboratorCount,
          updatedAt = :now
    `,
    ExpressionAttributeNames: {
      '#tripId': tripId
    },
    ExpressionAttributeValues: {
      ':one': 1,
      ':activityCount': activityCount,
      ':collaboratorCount': collaboratorCount,
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));

  // Recalculate averages
  const updated = result.Attributes;
  if (updated.ownedTripsCount > 0) {
    updated.avgActivitiesPerTrip = updated.totalActivitiesOwned / updated.ownedTripsCount;
    updated.avgCollaboratorsPerTrip = updated.totalCollaboratorsAcrossTrips / updated.ownedTripsCount;
  } else {
    updated.avgActivitiesPerTrip = 0;
    updated.avgCollaboratorsPerTrip = 0;
  }

  console.log('Removed owned trip, updated profile:', updated);
  return updated;
}

/**
 * Update an existing owned trip's metadata
 */
async function updateOwnedTrip(username, tripData) {
  const { tripId, selectedCity, tripPhotoReference, startDate, endDate, tripLength } = tripData;

  // First, get the current profile to find the trip
  const getResult = await docClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username }
  }));

  const profile = getResult.Item;
  if (!profile) {
    throw new Error(`Profile not found for username: ${username}`);
  }

  // Find the trip index
  const tripIndex = profile.ownedTrips?.findIndex(trip => trip.tripId === tripId);
  if (tripIndex === -1 || tripIndex === undefined) {
    throw new Error(`Trip ${tripId} not found in owned trips`);
  }

  // Update the trip
  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `
      SET ownedTrips[${tripIndex}].selectedCity = :city,
          ownedTrips[${tripIndex}].tripPhotoReference = :photos,
          ownedTrips[${tripIndex}].startDate = :startDate,
          ownedTrips[${tripIndex}].endDate = :endDate,
          ownedTrips[${tripIndex}].tripLength = :tripLength,
          ownedTrips[${tripIndex}].updatedAt = :now,
          updatedAt = :now
    `,
    ExpressionAttributeValues: {
      ':city': selectedCity,
      ':photos': tripPhotoReference || [],
      ':startDate': startDate,
      ':endDate': endDate,
      ':tripLength': tripLength,
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Updated owned trip, updated profile:', result.Attributes);
  return result.Attributes;
}

/**
 * Add a shared trip to the user's profile
 */
async function addSharedTrip(username, tripData) {
  const {
    tripId,
    selectedCity,
    tripPhotoReference,
    startDate,
    endDate,
    tripLength,
    role,
    ownerUsername
  } = tripData;

  const tripSummary = {
    tripId,
    selectedCity,
    tripPhotoReference: tripPhotoReference || [],
    startDate,
    endDate,
    tripLength,
    role,
    ownerUsername,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `
      SET sharedTripsCount = if_not_exists(sharedTripsCount, :zero) + :one,
          sharedTrips = list_append(if_not_exists(sharedTrips, :emptyList), :trip),
          updatedAt = :now
    `,
    ExpressionAttributeValues: {
      ':zero': 0,
      ':one': 1,
      ':emptyList': [],
      ':trip': [tripSummary],
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Added shared trip, updated profile:', result.Attributes);
  return result.Attributes;
}

/**
 * Remove a shared trip from the user's profile
 */
async function removeSharedTrip(username, tripId) {
  // First, get the current profile to find the trip
  const getResult = await docClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username }
  }));

  const profile = getResult.Item;
  if (!profile) {
    throw new Error(`Profile not found for username: ${username}`);
  }

  // Find the trip index
  const tripIndex = profile.sharedTrips?.findIndex(trip => trip.tripId === tripId);
  if (tripIndex === -1 || tripIndex === undefined) {
    throw new Error(`Trip ${tripId} not found in shared trips`);
  }

  // Remove the trip
  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `
      REMOVE sharedTrips[${tripIndex}]
      SET sharedTripsCount = sharedTripsCount - :one,
          updatedAt = :now
    `,
    ExpressionAttributeValues: {
      ':one': 1,
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Removed shared trip, updated profile:', result.Attributes);
  return result.Attributes;
}

/**
 * Update the user's last active timestamp
 */
async function updateLastActive(username) {
  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: 'SET lastActiveAt = :now',
    ExpressionAttributeValues: {
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Updated last active, updated profile:', result.Attributes);
  return result.Attributes;
}

/**
 * Update the user's demographic information (age and gender)
 */
async function updateDemographics(username, data) {
  const { age, gender } = data;

  if (age === undefined && gender === undefined) {
    throw new Error('At least one of age or gender must be provided');
  }

  // Build dynamic update expression
  const updateParts = [];
  const expressionAttributeValues = {
    ':now': new Date().toISOString()
  };

  if (age !== undefined) {
    updateParts.push('age = :age');
    expressionAttributeValues[':age'] = age;
  }

  if (gender !== undefined) {
    updateParts.push('gender = :gender');
    expressionAttributeValues[':gender'] = gender;
  }

  updateParts.push('updatedAt = :now');

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Updated demographics, updated profile:', result.Attributes);
  return result.Attributes;
}
