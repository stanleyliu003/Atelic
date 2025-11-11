/* Amplify Params - DO NOT EDIT
	AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID
	ENV
	REGION
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);
const cognitoClient = new CognitoIdentityProviderClient();

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;
const USER_POOL_ID = process.env.AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log('updateUserProfile event:', JSON.stringify(event));

  // Support both direct Lambda invoke payloads and AppSync resolver events
  const args = event?.arguments || event;
  const { username, action } = args;
  let tripData = args?.tripData;
  // Parse AWSJSON (string) into object if needed
  if (typeof tripData === 'string') {
    try {
      tripData = JSON.parse(tripData);
    } catch {
      // leave as-is if not valid JSON; downstream paths handle undefined safely
    }
  }
  // Capture caller identity from AppSync (if present)
  const callerIdentityUserId = event?.identity?.username || event?.identity?.sub || null;

  if ((!username && action !== 'DELETE_ACCOUNT') || !action) {
    throw new Error('username and action are required');
  }

  try {
    // Ensure profile exists with baseline fields for trip-related mutations
    if (action === 'ADD_OWNED_TRIP' || action === 'ADD_SHARED_TRIP' || action === 'SET_ACCOUNT_CREATED_AT') {
      await ensureProfileInitialized(username, tripData, callerIdentityUserId);
    }

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

      case 'SET_ACCOUNT_CREATED_AT':
        result = await setAccountCreatedAt(username, tripData);
        break;

      case 'DELETE_ACCOUNT':
        result = await deleteAccountProfile(username, tripData, callerIdentityUserId);
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
  let totalTripDuration = 0;
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
      totalTripDuration += tripLength;
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

  const avgTripDuration = tripsWithLength > 0 ? totalTripDuration / tripsWithLength : 0;

  return {
    totalTripsCompleted,
    totalTripsUpcoming,
    totalTripsInProgress,
    mostVisitedCities: cityCounts,
    totalTripDuration,
    avgTripDuration,
    lastTripDate: lastTripDate || null,
    nextTripDate: nextTripDate || null
  };
}

/**
 * Delete the user's profile from UserProfilesStorage
 */
async function deleteAccountProfile(username, data, identityUserId) {
  // Resolve username if not provided
  let resolvedUsername = username;
  if (!resolvedUsername) {
    const userId = data?.userID || identityUserId;
    if (!userId) {
      throw new Error('DELETE_ACCOUNT requires username or userID');
    }
    // Lookup by GSI userID-index
    const { QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
    const queryRes = await docClient.send(new QueryCommand({
      TableName: USER_PROFILES_TABLE,
      IndexName: 'userID-index',
      KeyConditionExpression: 'userID = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      Limit: 1
    }));
    const item = queryRes.Items?.[0];
    if (!item?.username) {
      // Nothing to delete
      return { success: true, message: 'Profile not found' };
    }
    resolvedUsername = item.username;
    await docClient.send(new DeleteCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username: resolvedUsername }
    }));
    console.log('Deleted profile by userID lookup:', { userId, username: resolvedUsername });
    return { success: true, username: resolvedUsername };
  } else {
    const { DeleteCommand } = require('@aws-sdk/lib-dynamodb');
    await docClient.send(new DeleteCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username: resolvedUsername }
    }));
    console.log('Deleted profile by username:', { username: resolvedUsername });
    return { success: true, username: resolvedUsername };
  }
}

/**
 * Helper: persist travel insights back to the profile
 */
async function persistTravelInsights(username, insights, averages) {
  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `
      SET totalTripsCompleted = :completed,
          totalTripsUpcoming = :upcoming,
          totalTripsInProgress = :inprogress,
          mostVisitedCities = :cities,
          totalTripDuration = :days,
          avgTripDuration = :avgDuration,
          avgActivitiesPerTrip = :avgActivitiesPerTrip,
          avgCollaboratorsPerTrip = :avgCollaboratorsPerTrip,
          lastTripDate = :lastTrip,
          nextTripDate = :nextTrip,
          lastActiveAt = :now
    `,
    ExpressionAttributeValues: {
      ':completed': insights.totalTripsCompleted,
      ':upcoming': insights.totalTripsUpcoming,
      ':inprogress': insights.totalTripsInProgress,
      ':cities': insights.mostVisitedCities,
      ':days': insights.totalTripDuration,
      ':avgDuration': insights.avgTripDuration,
      ':avgActivitiesPerTrip': averages?.avgActivitiesPerTrip ?? 0,
      ':avgCollaboratorsPerTrip': averages?.avgCollaboratorsPerTrip ?? 0,
      ':lastTrip': insights.lastTripDate,
      ':nextTrip': insights.nextTripDate,
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));
  console.log('Persisted travel insights:', JSON.stringify({
    username,
    insights,
    averages,
    lastActiveAt: result.Attributes?.lastActiveAt
  }));
  return result.Attributes;
}

/**
 * Ensure a baseline profile exists with identity fields before applying updates.
 * Attempts to derive identity from tripData.collaborators (owner or matching username)
 * or from explicit fields in tripData (userID, email, fullName).
 */
async function ensureProfileInitialized(username, tripData, identityUserId) {
  const getResult = await docClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username }
  }));
  if (getResult.Item) return; // Already exists

  const now = new Date().toISOString();

  // Try to find identity in collaborators array
  let derivedUserID = tripData?.userID || identityUserId || null;
  let derivedEmail = tripData?.email || null;
  let derivedFullName = tripData?.fullName || null;
  let derivedGender = null;
  let derivedAge = null;

  if ((!derivedUserID || !derivedEmail || !derivedFullName) && Array.isArray(tripData?.collaborators)) {
    const fromCollaborators =
      tripData.collaborators.find(c => c?.username === username) ||
      tripData.collaborators.find(c => c?.role === 'owner');
    if (fromCollaborators) {
      derivedUserID = derivedUserID || fromCollaborators.userID || null;
      derivedEmail = derivedEmail || fromCollaborators.email || null;
      derivedFullName = derivedFullName || fromCollaborators.fullName || null;
      derivedGender = fromCollaborators.gender || null;
    }
  }

  // Fallback: try to enrich from Cognito if user pool id is available
  try {
    if (USER_POOL_ID && (derivedUserID || username)) {
      const cognitoUser = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: derivedUserID || username
      }));
      const attrs = cognitoUser?.UserAttributes || [];
      const getAttr = (name) => attrs.find(a => a.Name === name)?.Value;
      derivedEmail = derivedEmail || getAttr('email') || null;
      derivedFullName = derivedFullName || getAttr('name') || null;
      derivedGender = derivedGender || getAttr('gender') || null;
      const birthdateStr = getAttr('birthdate'); // YYYY-MM-DD
      if (birthdateStr && derivedAge == null) {
        derivedAge = computeAgeFromBirthdate(birthdateStr);
      }
      // Also consider preferred_username as canonical username if present
      const preferred = getAttr('preferred_username');
      if (preferred) {
        username = preferred;
      }
    }
  } catch (e) {
    console.warn('Warning: Failed to enrich baseline profile from Cognito:', e?.message || e);
  }

  const newProfile = {
    // Basic info
    username,
    userID: derivedUserID || username,
    email: derivedEmail || '',
    fullName: derivedFullName || '',
    age: derivedAge,
    gender: derivedGender,

    // Trip metrics
    ownedTripsCount: 0,
    ownedTrips: [],
    sharedTripsCount: 0,
    sharedTrips: [],
    totalTripsCompleted: 0,
    totalTripsUpcoming: 0,
    totalTripsInProgress: 0,

    // Activity metrics
    activitiesPerTrip: {},
    totalActivitiesOwned: 0,
    avgActivitiesPerTrip: 0,

    // Collaborator metrics
    collaboratorsPerTrip: {},
    totalCollaboratorsAcrossTrips: 0,
    avgCollaboratorsPerTrip: 0,

    // Travel insights
    mostVisitedCities: {},
    totalTripDuration: 0,
    avgTripDuration: 0,
    lastTripDate: null,
    nextTripDate: null,

    // Social features
    followersCount: 0,
    followingCount: 0,
    friends: [],

    // Profile information
    bio: null,
    profilePhotoUrl: null,
    socialLinks: {},

    // Usage stats
    accountCreatedAt: now,
    appVersion: null,
    deviceType: null,
    modelName: null,
    osVersion: null,

    // Subscription info
    subscriptionTier: 'free',
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    subscriptionStatus: 'active',
    trialEndsAt: null,

    // System fields
    lastActiveAt: now,
    accountStatus: 'active',
    preferences: {
      notifications: true,
      theme: 'light',
      language: 'en',
      defaultCurrency: 'USD',
      preferredTravelMode: 'driving',
      distanceUnit: 'miles',
      timeFormat: '12h',
      dateFormat: 'MM/DD/YYYY',
      profileVisibility: 'public',
      allowCollaborationRequests: true,
      shareActivityHistory: true
    },
    // lastActiveAt already set above; remove old updatedAt
    version: 1
  };

  await docClient.send(new PutCommand({
    TableName: USER_PROFILES_TABLE,
    Item: newProfile
  }));
  console.log('Initialized baseline profile for user:', username, 'with identity:', {
    userID: newProfile.userID,
    email: newProfile.email,
    fullName: newProfile.fullName,
    age: newProfile.age,
    gender: newProfile.gender
  });
}

function computeAgeFromBirthdate(birthdate) {
  try {
    const [year, month, day] = birthdate.split('-').map(n => parseInt(n, 10));
    if (!year || !month || !day) return null;
    const today = new Date();
    let age = today.getFullYear() - year;
    const hasNotHadBirthdayThisYear =
      today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
    if (hasNotHadBirthdayThisYear) {
      age -= 1;
    }
    return age;
  } catch {
    return null;
  }
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

  const nowIso = new Date().toISOString();
  const tripSummary = {
    tripId,
    selectedCity,
    tripPhotoReference: tripPhotoReference || [],
    startDate,
    endDate,
    tripLength,
    createdAt: tripData?.createdAt || nowIso,
    updatedAt: nowIso
  };

  const activityCount = activities?.length || 0;
  const collaboratorCount = collaborators?.length || 0;
  const viewersCount = collaborators?.filter(c => c.role === 'viewer').length || 0;
  const editorsCount = collaborators?.filter(c => c.role === 'editor').length || 0;

  // Check whether trip already exists in ownedTrips to avoid duplicates
  const getResult = await docClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username }
  }));
  const profile = getResult.Item || {};
  const existingIndex = Array.isArray(profile.ownedTrips)
    ? profile.ownedTrips.findIndex(t => t?.tripId === tripId)
    : -1;

  let result;
  if (existingIndex !== -1) {
    // Update in-place and adjust totals by delta (no count increment, no list append)
    const prevActivityCount = (profile.activitiesPerTrip && profile.activitiesPerTrip[tripId]) || 0;
    const prevCollaboratorTotal = (profile.collaboratorsPerTrip && profile.collaboratorsPerTrip[tripId] && profile.collaboratorsPerTrip[tripId].total) || 0;
    const deltaActivity = activityCount - prevActivityCount;
    const deltaCollaborator = collaboratorCount - prevCollaboratorTotal;

    result = await docClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username },
      UpdateExpression: `
        SET ownedTrips[${existingIndex}].selectedCity = :city,
            ownedTrips[${existingIndex}].tripPhotoReference = :photos,
            ownedTrips[${existingIndex}].startDate = :startDate,
            ownedTrips[${existingIndex}].endDate = :endDate,
            ownedTrips[${existingIndex}].tripLength = :tripLength,
            ownedTrips[${existingIndex}].updatedAt = :now,
            activitiesPerTrip.#tripId = :activityCount,
            collaboratorsPerTrip.#tripId = :collaboratorData,
            totalActivitiesOwned = if_not_exists(totalActivitiesOwned, :zero) + :deltaActivity,
            totalCollaboratorsAcrossTrips = if_not_exists(totalCollaboratorsAcrossTrips, :zero) + :deltaCollaborator,
            lastActiveAt = :now
      `,
      ExpressionAttributeNames: {
        '#tripId': tripId
      },
      ExpressionAttributeValues: {
        ':city': selectedCity,
        ':photos': tripPhotoReference || [],
        ':startDate': startDate,
        ':endDate': endDate,
        ':tripLength': tripLength,
        ':activityCount': activityCount,
        ':collaboratorData': {
          total: collaboratorCount,
          viewers: viewersCount,
          editors: editorsCount
        },
        ':zero': 0,
        ':deltaActivity': deltaActivity,
        ':deltaCollaborator': deltaCollaborator,
        ':now': nowIso
      },
      ReturnValues: 'ALL_NEW'
    }));
  } else {
    // Append new trip and increment counts
    result = await docClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username },
      UpdateExpression: `
        SET ownedTripsCount = if_not_exists(ownedTripsCount, :zero) + :one,
            ownedTrips = list_append(if_not_exists(ownedTrips, :emptyList), :trip),
            activitiesPerTrip.#tripId = :activityCount,
            totalActivitiesOwned = if_not_exists(totalActivitiesOwned, :zero) + :activityCount,
            collaboratorsPerTrip.#tripId = :collaboratorData,
            totalCollaboratorsAcrossTrips = if_not_exists(totalCollaboratorsAcrossTrips, :zero) + :collaboratorCount,
            lastActiveAt = :now,
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
        ':now': nowIso
      },
      ReturnValues: 'ALL_NEW'
    }));
  }

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
  updated = await persistTravelInsights(username, insights, {
    avgActivitiesPerTrip: updated.avgActivitiesPerTrip,
    avgCollaboratorsPerTrip: updated.avgCollaboratorsPerTrip
  });

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
          lastActiveAt = :now
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
  updated = await persistTravelInsights(username, insights, {
    avgActivitiesPerTrip: updated.avgActivitiesPerTrip,
    avgCollaboratorsPerTrip: updated.avgCollaboratorsPerTrip
  });

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
          lastActiveAt = :now
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
  updated = await persistTravelInsights(username, insights, {
    avgActivitiesPerTrip: updated.avgActivitiesPerTrip,
    avgCollaboratorsPerTrip: updated.avgCollaboratorsPerTrip
  });

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
          lastActiveAt = :now
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
  updated = await persistTravelInsights(username, insights, {
    avgActivitiesPerTrip: updated.avgActivitiesPerTrip,
    avgCollaboratorsPerTrip: updated.avgCollaboratorsPerTrip
  });

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
          lastActiveAt = :now
    `,
    ExpressionAttributeValues: {
      ':one': 1,
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  }));

  let updated = result.Attributes;
  const insights = computeTravelInsights(updated);
  updated = await persistTravelInsights(username, insights, {
    avgActivitiesPerTrip: updated.avgActivitiesPerTrip,
    avgCollaboratorsPerTrip: updated.avgCollaboratorsPerTrip
  });

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

  updateParts.push('lastActiveAt = :now');

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
  const { bio, profilePhotoUrl, socialLinks } = data;

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

  if (socialLinks !== undefined) {
    updateParts.push('socialLinks = :socialLinks');
    expressionAttributeValues[':socialLinks'] = socialLinks;
  }

  if (updateParts.length === 0) {
    throw new Error('At least one profile field must be provided');
  }

  updateParts.push('lastActiveAt = :now');

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
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
    UpdateExpression: 'SET preferences = :preferences, lastActiveAt = :now',
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
 * Update login tracking (timestamps + optional appVersion/deviceType/modelName/osVersion)
 * IMPORTANT: Ensures baseline fields (email, fullName, userID, age, gender) are populated from Cognito
 * Handles both:
 * 1. First-time profile creation (profile doesn't exist yet)
 * 2. Existing profiles with missing baseline fields (backward compatibility)
 */
async function updateLogin(username, data) {
  const { appVersion, deviceType, modelName, osVersion } = data || {};
  const now = new Date().toISOString();

  // Check if profile exists
  const getResult = await docClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username }
  }));

  const profile = getResult.Item;

  // If profile doesn't exist, create it with complete baseline fields from Cognito
  if (!profile) {
    console.log('Profile does not exist, creating with Cognito data for:', username);

    // Fetch user data from Cognito
    let email = '';
    let fullName = '';
    let userID = username;
    let age = null;
    let gender = null;

    if (USER_POOL_ID) {
      try {
        // Cognito AdminGetUser accepts: preferred_username, email, phone_number, or sub
        const cognitoUser = await cognitoClient.send(new AdminGetUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: username  // preferred_username from Login.jsx
        }));
        const attrs = cognitoUser?.UserAttributes || [];
        const getAttr = (name) => attrs.find(a => a.Name === name)?.Value;

        email = getAttr('email') || '';
        fullName = getAttr('name') || '';
        userID = getAttr('sub') || username;
        gender = getAttr('gender') || null;

        const birthdateStr = getAttr('birthdate'); // YYYY-MM-DD
        if (birthdateStr) {
          age = computeAgeFromBirthdate(birthdateStr);
        }

        console.log('✅ [UPDATE_LOGIN] Fetched Cognito data for NEW profile:', {
          username,
          email,
          fullName,
          userID,
          age,
          gender,
          hasEmail: !!email,
          hasFullName: !!fullName
        });
      } catch (e) {
        console.error('❌ [UPDATE_LOGIN] Failed to fetch Cognito data:', {
          username,
          errorMessage: e?.message,
          errorCode: e?.code,
          errorName: e?.name
        });
      }
    }

    // Create complete profile with baseline fields + device info
    const newProfile = {
      // Basic info from Cognito
      username,
      userID,
      email,
      fullName,
      age,
      gender,

      // Device info from Login.jsx
      appVersion: appVersion || null,
      deviceType: deviceType || null,
      modelName: modelName || null,
      osVersion: osVersion || null,

      // Trip metrics (initialized)
      ownedTripsCount: 0,
      ownedTrips: [],
      sharedTripsCount: 0,
      sharedTrips: [],
      totalTripsCompleted: 0,
      totalTripsUpcoming: 0,
      totalTripsInProgress: 0,

      // Activity metrics
      activitiesPerTrip: {},
      totalActivitiesOwned: 0,
      avgActivitiesPerTrip: 0,

      // Collaborator metrics
      collaboratorsPerTrip: {},
      totalCollaboratorsAcrossTrips: 0,
      avgCollaboratorsPerTrip: 0,

      // Travel insights
      mostVisitedCities: {},
      totalTripDuration: 0,
      avgTripDuration: 0,
      lastTripDate: null,
      nextTripDate: null,

      // Social features
      followersCount: 0,
      followingCount: 0,
      friends: [],

      // Profile information
      bio: null,
      profilePhotoUrl: null,
      socialLinks: {},

      // Usage stats
      accountCreatedAt: now,

      // Subscription info
      subscriptionTier: 'free',
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      subscriptionStatus: 'active',
      trialEndsAt: null,

      // System fields
      lastActiveAt: now,
      accountStatus: 'active',
      preferences: {
        notifications: true,
        theme: 'light',
        language: 'en',
        defaultCurrency: 'USD',
        preferredTravelMode: 'driving',
        distanceUnit: 'miles',
        timeFormat: '12h',
        dateFormat: 'MM/DD/YYYY',
        profileVisibility: 'public',
        allowCollaborationRequests: true,
        shareActivityHistory: true
      },
      version: 1
    };

    await docClient.send(new PutCommand({
      TableName: USER_PROFILES_TABLE,
      Item: newProfile
    }));

    console.log('Created new profile with complete baseline data for:', username);
    return newProfile;
  }

  // Profile exists - update login info and backfill missing baseline fields
  const updateParts = [];
  const expressionAttributeValues = {
    ':now': now
  };

  updateParts.push('lastActiveAt = :now');

  // Backfill missing baseline fields from Cognito (for existing incomplete profiles)
  const needsEnrichment = !profile.email || !profile.fullName || !profile.userID;

  if (needsEnrichment && USER_POOL_ID) {
    try {
      const cognitoUser = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: profile?.userID || username
      }));
      const attrs = cognitoUser?.UserAttributes || [];
      const getAttr = (name) => attrs.find(a => a.Name === name)?.Value;

      // Only set if missing
      if (!profile.email) {
        const email = getAttr('email');
        if (email) {
          updateParts.push('email = if_not_exists(email, :email)');
          expressionAttributeValues[':email'] = email;
        }
      }

      if (!profile.fullName) {
        const fullName = getAttr('name');
        if (fullName) {
          updateParts.push('fullName = if_not_exists(fullName, :fullName)');
          expressionAttributeValues[':fullName'] = fullName;
        }
      }

      if (!profile.userID) {
        const sub = getAttr('sub');
        if (sub) {
          updateParts.push('userID = if_not_exists(userID, :userID)');
          expressionAttributeValues[':userID'] = sub;
        }
      }

      if (!profile.age) {
        const birthdateStr = getAttr('birthdate'); // YYYY-MM-DD
        if (birthdateStr) {
          const age = computeAgeFromBirthdate(birthdateStr);
          if (age) {
            updateParts.push('age = if_not_exists(age, :age)');
            expressionAttributeValues[':age'] = age;
          }
        }
      }

      if (!profile.gender) {
        const gender = getAttr('gender');
        if (gender) {
          updateParts.push('gender = if_not_exists(gender, :gender)');
          expressionAttributeValues[':gender'] = gender;
        }
      }

      console.log('Backfilled missing baseline fields from Cognito for:', username);
    } catch (e) {
      console.warn('Warning: Failed to backfill baseline fields from Cognito:', e?.message || e);
    }
  }

  // Update device info (always)
  if (appVersion) {
    updateParts.push('appVersion = :appVersion');
    expressionAttributeValues[':appVersion'] = appVersion;
  }

  if (deviceType) {
    updateParts.push('deviceType = :deviceType');
    expressionAttributeValues[':deviceType'] = deviceType;
  }

  if (modelName) {
    updateParts.push('modelName = :modelName');
    expressionAttributeValues[':modelName'] = modelName;
  }

  if (osVersion) {
    updateParts.push('osVersion = :osVersion');
    expressionAttributeValues[':osVersion'] = osVersion;
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  }));

  console.log('Updated login info for:', username);
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

  updateParts.push('lastActiveAt = :now');

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
 * Set accountCreatedAt once (no overwrite) – can be called from signup flows
 */
async function setAccountCreatedAt(username, data) {
  const createdAt = data?.createdAt || new Date().toISOString();
  const { appVersion, deviceType, modelName, osVersion } = data || {};
  let current;

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username },
      UpdateExpression: `
        SET accountCreatedAt = if_not_exists(accountCreatedAt, :createdAt),
            lastActiveAt = if_not_exists(lastActiveAt, :createdAt)
      `,
      ConditionExpression: 'attribute_not_exists(accountCreatedAt) AND (attribute_not_exists(version) OR version = :v1)',
      ExpressionAttributeValues: {
        ':createdAt': createdAt,
        ':v1': 1
      },
      ReturnValues: 'ALL_NEW'
    }));
    current = result.Attributes;
    console.log('Set accountCreatedAt (first-time only):', { username, accountCreatedAt: current?.accountCreatedAt });
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') {
      // accountCreatedAt already set or version > 1 – fetch current item
      const getResult = await docClient.send(new GetCommand({
        TableName: USER_PROFILES_TABLE,
        Key: { username }
      }));
      current = getResult.Item;
      console.log('Skipped setting accountCreatedAt (already set or version > 1)', { username });
    } else {
      throw err;
    }
  }

  // Optionally set device/app fields if provided
  const setDeviceParts = [];
  const values = { ':now': new Date().toISOString() };

  if (appVersion) {
    setDeviceParts.push('appVersion = :appVersion');
    values[':appVersion'] = appVersion;
  }
  if (deviceType) {
    setDeviceParts.push('deviceType = :deviceType');
    values[':deviceType'] = deviceType;
  }
  if (modelName) {
    setDeviceParts.push('modelName = :modelName');
    values[':modelName'] = modelName;
  }
  if (osVersion) {
    setDeviceParts.push('osVersion = :osVersion');
    values[':osVersion'] = osVersion;
  }

  if (setDeviceParts.length > 0) {
    setDeviceParts.push('lastActiveAt = :now');
    const update = await docClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username },
      UpdateExpression: `SET ${setDeviceParts.join(', ')}`,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW'
    }));
    return update.Attributes;
  }

  return current;
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
          lastActiveAt = :now
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
      SET lastActiveAt = :now
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

  updateParts.push('lastActiveAt = :now');

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
