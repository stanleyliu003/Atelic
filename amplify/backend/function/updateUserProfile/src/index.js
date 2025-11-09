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
    let result;
    switch (action) {
      case 'ADD_OWNED_TRIP':
        result = await addOwnedTrip(username, tripData);
        break;

      case 'REMOVE_OWNED_TRIP':
        result = await removeOwnedTrip(username, tripData.tripId);
        break;

      case 'UPDATE_OWNED_TRIP':
        result = await updateOwnedTrip(username, tripData);
        break;

      case 'ADD_SHARED_TRIP':
        result = await addSharedTrip(username, tripData);
        break;

      case 'REMOVE_SHARED_TRIP':
        result = await removeSharedTrip(username, tripData.tripId);
        break;

      case 'UPDATE_LAST_ACTIVE':
        result = await updateLastActive(username);
        break;

      case 'UPDATE_DEMOGRAPHICS':
        result = await updateDemographics(username, tripData);
        break;

      case 'UPDATE_PROFILE_INFO':
        result = await updateProfileInfo(username, tripData);
        break;

      case 'UPDATE_PREFERENCES':
        result = await updatePreferences(username, tripData);
        break;

      case 'UPDATE_LOGIN':
        result = await updateLogin(username, tripData);
        break;

      case 'UPDATE_SUBSCRIPTION':
        result = await updateSubscription(username, tripData);
        break;

      case 'ADD_FRIEND':
        result = await addFriend(username, tripData);
        break;

      case 'REMOVE_FRIEND':
        result = await removeFriend(username, tripData);
        break;

      case 'UPDATE_SOCIAL_COUNTS':
        result = await updateSocialCounts(username, tripData);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
    console.log('updateUserProfile COMPLETED:', JSON.stringify({
      username,
      action,
      output: result
    }));
    return result;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

/**
 * Helper: compute travel insights across owned + shared trips
 */
function computeTravelInsights(profile) {
  const now = new Date();
  const ownedTrips = Array.isArray(profile.ownedTrips) ? profile.ownedTrips : [];
  const sharedTrips = Array.isArray(profile.sharedTrips) ? profile.sharedTrips : [];
  const allTrips = [...ownedTrips, ...sharedTrips];

  let totalTripsCompleted = 0;
  let totalTripsUpcoming = 0;
  let totalTripsInProgress = 0;
  let totalDaysTraveled = 0;
  let tripsWithLength = 0;
  const cityCounts = {};
  let lastTripDate = null; // latest past endDate
  let nextTripDate = null; // earliest future startDate

  for (const trip of allTrips) {
    const city = trip?.selectedCity;
    if (city) {
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }

    const tripLength = Number(trip?.tripLength);
    if (!Number.isNaN(tripLength) && tripLength > 0) {
      totalDaysTraveled += tripLength;
      tripsWithLength += 1;
    }

    const start = trip?.startDate ? new Date(trip.startDate) : null;
    const end = trip?.endDate ? new Date(trip.endDate) : null;

    if (start && end) {
      if (end < now) {
        totalTripsCompleted += 1;
        // last trip date is the max past endDate
        if (!lastTripDate || end > new Date(lastTripDate)) {
          lastTripDate = trip.endDate;
        }
      } else if (start > now) {
        totalTripsUpcoming += 1;
        // next trip date is the min future startDate
        if (!nextTripDate || start < new Date(nextTripDate)) {
          nextTripDate = trip.startDate;
        }
      } else {
        totalTripsInProgress += 1;
      }
    } else if (start && !end) {
      // If only start is present, treat future or in-progress relative to today
      if (start > now) {
        totalTripsUpcoming += 1;
        if (!nextTripDate || start < new Date(nextTripDate)) {
          nextTripDate = trip.startDate;
        }
      } else {
        totalTripsInProgress += 1;
      }
    } else if (!start && end) {
      // If only end is present, treat as completed if before now
      if (end < now) {
        totalTripsCompleted += 1;
        if (!lastTripDate || end > new Date(lastTripDate)) {
          lastTripDate = trip.endDate;
        }
      }
    }
  }

  const avgTripDuration = tripsWithLength > 0 ? totalDaysTraveled / tripsWithLength : 0;

  return {
    totalTripsCompleted,
    totalTripsUpcoming,
    totalTripsInProgress,
    mostVisitedCities: cityCounts,
    totalDaysTraveled,
    avgTripDuration,
    lastTripDate: lastTripDate || null,
    nextTripDate: nextTripDate || null
  };
}

/**
 * Helper: persist travel insights back to the profile
 */
async function persistTravelInsights(username, insights) {
  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `
      SET totalTripsCompleted = :completed,
          totalTripsUpcoming = :upcoming,
          totalTripsInProgress = :inprogress,
          mostVisitedCities = :cities,
          totalDaysTraveled = :days,
          avgTripDuration = :avgDuration,
          lastTripDate = :lastTrip,
          nextTripDate = :nextTrip,
          updatedAt = :now
    `,
    ExpressionAttributeValues: {
      ':completed': insights.totalTripsCompleted,
      ':upcoming': insights.totalTripsUpcoming,
      ':inprogress': insights.totalTripsInProgress,
      ':cities': insights.mostVisitedCities,
      ':days': insights.totalDaysTraveled,
      ':avgDuration': insights.avgTripDuration,
      ':lastTrip': insights.lastTripDate,
      ':nextTrip': insights.nextTripDate,
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));
  console.log('Persisted travel insights:', JSON.stringify({
    username,
    insights,
    updatedAt: result.Attributes?.updatedAt
  }));
  return result.Attributes;
}

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

  // Recalculate aggregates and travel insights
  let updated = result.Attributes;
  if (updated.ownedTripsCount > 0) {
    updated.avgActivitiesPerTrip = updated.totalActivitiesOwned / updated.ownedTripsCount;
    updated.avgCollaboratorsPerTrip = updated.totalCollaboratorsAcrossTrips / updated.ownedTripsCount;
  } else {
    updated.avgActivitiesPerTrip = 0;
    updated.avgCollaboratorsPerTrip = 0;
  }
  const insights = computeTravelInsights(updated);
  updated = await persistTravelInsights(username, insights);

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
  let updated = result.Attributes;
  if (updated.ownedTripsCount > 0) {
    updated.avgActivitiesPerTrip = updated.totalActivitiesOwned / updated.ownedTripsCount;
    updated.avgCollaboratorsPerTrip = updated.totalCollaboratorsAcrossTrips / updated.ownedTripsCount;
  } else {
    updated.avgActivitiesPerTrip = 0;
    updated.avgCollaboratorsPerTrip = 0;
  }

  const insights = computeTravelInsights(updated);
  updated = await persistTravelInsights(username, insights);

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

  let updated = result.Attributes;
  const insights = computeTravelInsights(updated);
  updated = await persistTravelInsights(username, insights);

  console.log('Updated owned trip, updated profile:', updated);
  return updated;
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

  let updated = result.Attributes;
  const insights = computeTravelInsights(updated);
  updated = await persistTravelInsights(username, insights);

  console.log('Added shared trip, updated profile:', updated);
  return updated;
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

  let updated = result.Attributes;
  const insights = computeTravelInsights(updated);
  updated = await persistTravelInsights(username, insights);

  console.log('Removed shared trip, updated profile:', updated);
  return updated;
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

/**
 * Update profile information (bio, photo, location, website, social links)
 */
async function updateProfileInfo(username, data) {
  const { bio, profilePhotoUrl, location, website, socialLinks } = data;

  const updateParts = [];
  const expressionAttributeValues = {
    ':now': new Date().toISOString()
  };

  if (bio !== undefined) {
    updateParts.push('bio = :bio');
    expressionAttributeValues[':bio'] = bio;
  }

  if (profilePhotoUrl !== undefined) {
    updateParts.push('profilePhotoUrl = :photo');
    expressionAttributeValues[':photo'] = profilePhotoUrl;
  }

  if (location !== undefined) {
    updateParts.push('#location = :location');
    expressionAttributeValues[':location'] = location;
  }

  if (website !== undefined) {
    updateParts.push('website = :website');
    expressionAttributeValues[':website'] = website;
  }

  if (socialLinks !== undefined) {
    updateParts.push('socialLinks = :socialLinks');
    expressionAttributeValues[':socialLinks'] = socialLinks;
  }

  if (updateParts.length === 0) {
    throw new Error('At least one profile field must be provided');
  }

  updateParts.push('updatedAt = :now');

  const expressionAttributeNames = location !== undefined ? { '#location': 'location' } : undefined;

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Updated profile info:', result.Attributes);
  return result.Attributes;
}

/**
 * Update user preferences
 */
async function updatePreferences(username, data) {
  const { preferences } = data;

  if (!preferences || Object.keys(preferences).length === 0) {
    throw new Error('Preferences object must be provided');
  }

  // Get current preferences first
  const getResult = await docClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username }
  }));

  const currentPreferences = getResult.Item?.preferences || {};
  const updatedPreferences = { ...currentPreferences, ...preferences };

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: 'SET preferences = :preferences, updatedAt = :now',
    ExpressionAttributeValues: {
      ':preferences': updatedPreferences,
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Updated preferences:', result.Attributes);
  return result.Attributes;
}

/**
 * Update login tracking (loginCount, lastLoginAt, appVersion, deviceType)
 */
async function updateLogin(username, data) {
  const { appVersion, deviceType } = data;

  const updateParts = [
    'loginCount = if_not_exists(loginCount, :zero) + :one',
    'lastLoginAt = :now',
    'lastActiveAt = :now',
    'updatedAt = :now'
  ];

  const expressionAttributeValues = {
    ':zero': 0,
    ':one': 1,
    ':now': new Date().toISOString()
  };

  if (appVersion) {
    updateParts.push('appVersion = :appVersion');
    expressionAttributeValues[':appVersion'] = appVersion;
  }

  if (deviceType) {
    updateParts.push('deviceType = :deviceType');
    expressionAttributeValues[':deviceType'] = deviceType;
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Updated login info:', result.Attributes);
  return result.Attributes;
}

/**
 * Update subscription information
 */
async function updateSubscription(username, data) {
  const { subscriptionTier, subscriptionStartDate, subscriptionEndDate, subscriptionStatus, trialEndsAt } = data;

  const updateParts = [];
  const expressionAttributeValues = {
    ':now': new Date().toISOString()
  };

  if (subscriptionTier !== undefined) {
    updateParts.push('subscriptionTier = :tier');
    expressionAttributeValues[':tier'] = subscriptionTier;
  }

  if (subscriptionStartDate !== undefined) {
    updateParts.push('subscriptionStartDate = :startDate');
    expressionAttributeValues[':startDate'] = subscriptionStartDate;
  }

  if (subscriptionEndDate !== undefined) {
    updateParts.push('subscriptionEndDate = :endDate');
    expressionAttributeValues[':endDate'] = subscriptionEndDate;
  }

  if (subscriptionStatus !== undefined) {
    updateParts.push('subscriptionStatus = :status');
    expressionAttributeValues[':status'] = subscriptionStatus;
  }

  if (trialEndsAt !== undefined) {
    updateParts.push('trialEndsAt = :trialEnds');
    expressionAttributeValues[':trialEnds'] = trialEndsAt;
  }

  if (updateParts.length === 0) {
    throw new Error('At least one subscription field must be provided');
  }

  updateParts.push('updatedAt = :now');

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Updated subscription:', result.Attributes);
  return result.Attributes;
}

/**
 * Add a friend to the user's friends list
 */
async function addFriend(username, data) {
  const { friendUsername } = data;

  if (!friendUsername) {
    throw new Error('friendUsername is required');
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `
      SET friends = list_append(if_not_exists(friends, :emptyList), :friend),
          updatedAt = :now
    `,
    ExpressionAttributeValues: {
      ':emptyList': [],
      ':friend': [friendUsername],
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Added friend:', result.Attributes);
  return result.Attributes;
}

/**
 * Remove a friend from the user's friends list
 */
async function removeFriend(username, data) {
  const { friendUsername } = data;

  if (!friendUsername) {
    throw new Error('friendUsername is required');
  }

  // Get current profile to find friend index
  const getResult = await docClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username }
  }));

  const profile = getResult.Item;
  if (!profile) {
    throw new Error(`Profile not found for username: ${username}`);
  }

  const friendIndex = profile.friends?.indexOf(friendUsername);
  if (friendIndex === -1 || friendIndex === undefined) {
    throw new Error(`Friend ${friendUsername} not found in friends list`);
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `
      REMOVE friends[${friendIndex}]
      SET updatedAt = :now
    `,
    ExpressionAttributeValues: {
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Removed friend:', result.Attributes);
  return result.Attributes;
}

/**
 * Update social counts (followersCount, followingCount)
 */
async function updateSocialCounts(username, data) {
  const { followersCount, followingCount } = data;

  const updateParts = [];
  const expressionAttributeValues = {
    ':now': new Date().toISOString()
  };

  if (followersCount !== undefined) {
    updateParts.push('followersCount = :followersCount');
    expressionAttributeValues[':followersCount'] = followersCount;
  }

  if (followingCount !== undefined) {
    updateParts.push('followingCount = :followingCount');
    expressionAttributeValues[':followingCount'] = followingCount;
  }

  if (updateParts.length === 0) {
    throw new Error('At least one social count must be provided');
  }

  updateParts.push('updatedAt = :now');

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Updated social counts:', result.Attributes);
  return result.Attributes;
}
