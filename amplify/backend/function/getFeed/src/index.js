/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_TRIPSTORAGE_ARN
	STORAGE_TRIPSTORAGE_NAME
	STORAGE_TRIPSTORAGE_STREAMARN
	STORAGE_USERFOLLOWSSTORAGE_ARN
	STORAGE_USERFOLLOWSSTORAGE_NAME
	STORAGE_USERFOLLOWSSTORAGE_STREAMARN
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, BatchGetCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const TRIP_STORAGE_TABLE = process.env.STORAGE_TRIPSTORAGE_NAME;
const USER_FOLLOWS_TABLE = process.env.STORAGE_USERFOLLOWSSTORAGE_NAME;
const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;

// Helper function to normalize tripPhotoReference to array format
const normalizePhotoReferences = (photoRef) => {
  if (!photoRef) return [];
  if (Array.isArray(photoRef)) return photoRef;
  return [photoRef];
};

/**
 * Get Feed Lambda Function
 *
 * Retrieves a personalized feed of trips from the current user and followed users
 *
 * @param {object} event - Lambda event with username, nextToken, and limit
 * @returns {object} Feed result with trips array and pagination token
 */
exports.handler = async (event) => {
  console.log('getFeed event:', JSON.stringify(event));

  const args = event?.arguments || event;
  const { username, nextToken, limit = 10 } = args;

  if (!username) {
    throw new Error('username is required');
  }

  try {
    // 1. Get the user's profile to retrieve userID
    const userProfile = await getUserProfile(username);
    if (!userProfile) {
      throw new Error(`User profile not found for username: ${username}`);
    }

    const currentUserID = userProfile.userID;

    // 2. Get list of users the current user follows
    const following = await getAllFollowing(username);
    console.log(`User ${username} follows ${following.length} users`);

    // 3. Get userIDs for all followed users
    const followedUserIDs = await getUserIDsFromUsernames(following.map(f => f.followingUsername));
    console.log(`Retrieved ${followedUserIDs.length} userIDs for followed users`);

    // 4. Get current user's own trips
    const ownTrips = await getUserTrips(currentUserID);
    console.log(`Retrieved ${ownTrips.length} trips for current user`);

    // 5. Get trips from all followed users (batch query)
    const followedTrips = [];
    for (const userID of followedUserIDs) {
      const trips = await getUserTrips(userID);
      trips.forEach(trip => {
        trip.ownerUserID = userID;
        followedTrips.push(trip);
      });
    }
    console.log(`Retrieved ${followedTrips.length} trips from followed users`);

    // 6. Combine and mark own trips
    const allTrips = [
      ...ownTrips.map(trip => ({ ...trip, ownerUserID: currentUserID, isOwnTrip: true })),
      ...followedTrips.map(trip => ({ ...trip, isOwnTrip: false }))
    ];

    // 7. Sort by updatedAt or createdAt (most recent first)
    allTrips.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0);
      const dateB = new Date(b.updatedAt || b.createdAt || 0);
      return dateB - dateA;
    });

    console.log(`Total trips in feed: ${allTrips.length}`);

    // 8. Apply pagination
    const startIndex = nextToken ? parseInt(Buffer.from(nextToken, 'base64').toString()) : 0;
    const endIndex = startIndex + limit;
    const paginatedTrips = allTrips.slice(startIndex, endIndex);

    console.log(`Returning ${paginatedTrips.length} trips (from index ${startIndex} to ${endIndex})`);

    // 9. Enrich with owner profile data
    const enrichedTrips = await enrichWithOwnerProfiles(paginatedTrips);

    // 10. Calculate next token
    const hasMore = endIndex < allTrips.length;
    const nextPageToken = hasMore ? Buffer.from(endIndex.toString()).toString('base64') : null;

    return {
      trips: enrichedTrips,
      nextToken: nextPageToken
    };
  } catch (error) {
    console.error('Error in getFeed:', error);
    throw error;
  }
};

/**
 * Get user profile by username
 */
async function getUserProfile(username) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username }
    }));

    return result.Item;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

/**
 * Get all users that the current user follows
 */
async function getAllFollowing(username) {
  try {
    const following = [];
    let lastEvaluatedKey = null;

    do {
      const params = {
        TableName: USER_FOLLOWS_TABLE,
        KeyConditionExpression: 'followerUsername = :username',
        ExpressionAttributeValues: {
          ':username': username
        }
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new QueryCommand(params));

      if (result.Items) {
        following.push(...result.Items);
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return following;
  } catch (error) {
    console.error('Error getting following list:', error);
    return [];
  }
}

/**
 * Get userIDs from usernames (batch lookup)
 */
async function getUserIDsFromUsernames(usernames) {
  if (!usernames || usernames.length === 0) {
    return [];
  }

  try {
    // DynamoDB BatchGetItem has a limit of 100 items per request
    const batchSize = 100;
    const userIDs = [];

    for (let i = 0; i < usernames.length; i += batchSize) {
      const batch = usernames.slice(i, i + batchSize);

      const result = await docClient.send(new BatchGetCommand({
        RequestItems: {
          [USER_PROFILES_TABLE]: {
            Keys: batch.map(username => ({ username })),
            ProjectionExpression: 'username, userID'
          }
        }
      }));

      if (result.Responses && result.Responses[USER_PROFILES_TABLE]) {
        const batchUserIDs = result.Responses[USER_PROFILES_TABLE]
          .map(profile => profile.userID)
          .filter(id => id);
        userIDs.push(...batchUserIDs);
      }
    }

    return userIDs;
  } catch (error) {
    console.error('Error getting userIDs from usernames:', error);
    return [];
  }
}

/**
 * Get all trips for a user by userID
 */
async function getUserTrips(userID) {
  try {
    const trips = [];
    let lastEvaluatedKey = null;

    do {
      const params = {
        TableName: TRIP_STORAGE_TABLE,
        KeyConditionExpression: 'userID = :userID',
        ExpressionAttributeValues: {
          ':userID': userID
        },
        ProjectionExpression: 'tripID, tripTitle, selectedCity, tripPhotoReference, startDate, endDate, tripLength, createdAt, updatedAt, userID'
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new QueryCommand(params));

      if (result.Items) {
        trips.push(...result.Items);
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return trips;
  } catch (error) {
    console.error(`Error getting trips for userID ${userID}:`, error);
    return [];
  }
}

/**
 * Enrich trips with owner profile data (batch lookup for performance)
 */
async function enrichWithOwnerProfiles(trips) {
  if (!trips || trips.length === 0) {
    return [];
  }

  try {
    // Get unique userIDs
    const uniqueUserIDs = [...new Set(trips.map(t => t.ownerUserID))];

    // Get all profiles in batches
    const batchSize = 100;
    const profiles = [];

    for (let i = 0; i < uniqueUserIDs.length; i += batchSize) {
      const batch = uniqueUserIDs.slice(i, i + batchSize);

      // First get usernames from userIDs (we need to query by userID)
      // Since UserProfiles has username as partition key, we need to find profiles by userID
      // This requires scanning, which is expensive. Better approach: store mapping or use GSI
      // For now, let's scan with a filter (not ideal, but works for initial implementation)
      const batchProfiles = await getUserProfilesByUserIDs(batch);
      profiles.push(...batchProfiles);
    }

    // Create a map of userID -> profile
    const profileMap = new Map(
      profiles.map(p => [p.userID, p])
    );

    // Enrich trips with owner data
    return trips.map(trip => {
      const ownerProfile = profileMap.get(trip.ownerUserID) || {};

      return {
        tripId: trip.tripID,
        tripTitle: trip.tripTitle,
        selectedCity: trip.selectedCity,
        tripPhotoReference: normalizePhotoReferences(trip.tripPhotoReference),
        startDate: trip.startDate,
        endDate: trip.endDate,
        tripLength: trip.tripLength,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
        ownerUsername: ownerProfile.username || null,
        ownerFullName: ownerProfile.fullName || null,
        ownerProfilePhotoUrl: ownerProfile.profilePhotoUrl || null,
        isOwnTrip: trip.isOwnTrip || false
      };
    });
  } catch (error) {
    console.error('Error enriching trips with owner profiles:', error);
    // Return trips without enrichment if profile lookup fails
    return trips.map(trip => ({
      tripId: trip.tripID,
      tripTitle: trip.tripTitle,
      selectedCity: trip.selectedCity,
      tripPhotoReference: normalizePhotoReferences(trip.tripPhotoReference),
      startDate: trip.startDate,
      endDate: trip.endDate,
      tripLength: trip.tripLength,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      ownerUsername: null,
      ownerFullName: null,
      ownerProfilePhotoUrl: null,
      isOwnTrip: trip.isOwnTrip || false
    }));
  }
}

/**
 * Get user profiles by userIDs (requires scan since userID is not the partition key)
 * This is not ideal for performance - consider adding a GSI on userID in production
 */
async function getUserProfilesByUserIDs(userIDs) {
  try {
    const profiles = [];

    // For each userID, we need to scan the table
    // This is inefficient, but necessary without a GSI on userID
    // TODO: Add GSI on userID for better performance
    for (const userID of userIDs) {
      const profile = await getUserProfileByUserID(userID);
      if (profile) {
        profiles.push(profile);
      }
    }

    return profiles;
  } catch (error) {
    console.error('Error getting user profiles by userIDs:', error);
    return [];
  }
}

/**
 * Get a single user profile by userID
 */
async function getUserProfileByUserID(userID) {
  try {
    // Since we don't have a GSI on userID, we need to use the userID-index GSI
    // Actually, looking at existing code, UserProfilesStorage might have a userID-index GSI
    // Let me query using that
    const result = await docClient.send(new QueryCommand({
      TableName: USER_PROFILES_TABLE,
      IndexName: 'userID-index',
      KeyConditionExpression: 'userID = :userID',
      ExpressionAttributeValues: {
        ':userID': userID
      },
      ProjectionExpression: 'username, fullName, profilePhotoUrl, userID',
      Limit: 1
    }));

    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    console.error(`Error getting profile for userID ${userID}:`, error);
    return null;
  }
}
