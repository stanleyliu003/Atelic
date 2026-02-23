/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_TRIPSTORAGE_ARN
	STORAGE_TRIPSTORAGE_NAME
	STORAGE_TRIPSTORAGE_STREAMARN
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;
const TRIP_STORAGE_TABLE = process.env.STORAGE_TRIPSTORAGE_NAME;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds (for faster refresh during development)

/**
 * Get User Statistics Lambda Function
 *
 * Retrieves travel statistics for a user with 24-hour caching
 * Statistics include: countries visited, cities visited, total trips, etc.
 *
 * @param {object} event - Lambda event with username
 * @returns {object} User statistics
 */
exports.handler = async (event) => {
  console.log('getUserStatistics event:', JSON.stringify(event));

  const args = event?.arguments || event;
  const { username } = args;

  if (!username) {
    throw new Error('username is required');
  }

  try {
    // 1. Get user profile with cached stats
    const profile = await getUserProfile(username);

    if (!profile) {
      throw new Error(`User profile not found for username: ${username}`);
    }

    // 2. Check if stats are stale (older than 24 hours)
    const statsAge = Date.now() - new Date(profile.statsLastUpdated || 0).getTime();
    const isStatsFresh = statsAge < CACHE_TTL && profile.countriesVisited !== undefined;

    console.log(`Stats age: ${statsAge}ms, Fresh: ${isStatsFresh}`);

    if (isStatsFresh) {
      // Return cached stats, but recalculate trip count
      console.log('Returning cached statistics (with fresh trip count)');
      const ownedTrips = await getAllUserTrips(profile.userID);
      const sharedTrips = await getAllSharedTrips(profile.userID);
      const actualTripCount = ownedTrips.length + sharedTrips.length;

      return {
        countriesVisited: profile.countriesVisited || 0,
        citiesVisited: profile.citiesVisited || 0,
        totalTrips: actualTripCount,
        tripsCompleted: profile.totalTripsCompleted || 0,
        tripsUpcoming: profile.totalTripsUpcoming || 0
      };
    }

    // 3. Recalculate stats from trips (owned + shared)
    console.log('Stats stale or missing, recalculating from trips');
    const ownedTrips = await getAllUserTrips(profile.userID);
    const sharedTrips = await getAllSharedTrips(profile.userID);
    const allTrips = [...ownedTrips, ...sharedTrips];
    console.log(`Retrieved ${ownedTrips.length} owned trips and ${sharedTrips.length} shared trips for statistics calculation`);

    const countries = new Set();
    const cities = new Set();

    allTrips.forEach(trip => {
      if (trip.selectedCity) {
        // Add city
        cities.add(trip.selectedCity);

        // Extract country from city format: "Paris, France" or "New York, NY, USA"
        const cityParts = trip.selectedCity.split(',');
        if (cityParts.length > 1) {
          const country = cityParts[cityParts.length - 1].trim();
          countries.add(country);
        }
      }
    });

    const stats = {
      countriesVisited: countries.size,
      citiesVisited: cities.size,
      countriesVisitedList: Array.from(countries),
      citiesVisitedList: Array.from(cities)
    };

    console.log('Calculated stats:', stats);

    // 4. Update profile with new stats (24-hour cache)
    await updateUserStatistics(username, {
      ...stats,
      statsLastUpdated: new Date().toISOString()
    });

    console.log('Updated profile with new statistics');

    // 5. Return calculated stats
    return {
      countriesVisited: stats.countriesVisited,
      citiesVisited: stats.citiesVisited,
      totalTrips: allTrips.length,  // Use actual count of trips found
      tripsCompleted: profile.totalTripsCompleted || 0,
      tripsUpcoming: profile.totalTripsUpcoming || 0
    };
  } catch (error) {
    console.error('Error in getUserStatistics:', error);
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
 * Get all trips for a user by userID (owned trips)
 */
async function getAllUserTrips(userID) {
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
        ProjectionExpression: 'tripID, selectedCity, startDate, endDate'
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
 * Get all trips shared with a user (where user is a collaborator)
 */
async function getAllSharedTrips(userID) {
  try {
    const sharedTrips = [];
    let lastEvaluatedKey = null;

    // Scan all trips that have collaborators
    do {
      const params = {
        TableName: TRIP_STORAGE_TABLE,
        FilterExpression: 'attribute_exists(collaborators)',
        ProjectionExpression: 'tripID, selectedCity, startDate, endDate, userID, collaborators'
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new ScanCommand(params));

      if (result.Items) {
        // Filter trips where:
        // 1. User is in the collaborators array
        // 2. User is NOT the owner (to avoid double counting)
        result.Items.forEach(trip => {
          if (trip.userID === userID) {
            // Skip trips owned by this user (already counted)
            return;
          }

          // Check if user is in collaborators array
          const isCollaborator = trip.collaborators?.some(
            collab => collab.userID === userID
          );

          if (isCollaborator) {
            sharedTrips.push({
              tripID: trip.tripID,
              selectedCity: trip.selectedCity,
              startDate: trip.startDate,
              endDate: trip.endDate
            });
          }
        });
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Found ${sharedTrips.length} shared trips for user`);
    return sharedTrips;
  } catch (error) {
    console.error(`Error getting shared trips for userID ${userID}:`, error);
    return [];
  }
}

/**
 * Update user statistics in profile
 */
async function updateUserStatistics(username, data) {
  try {
    const {
      countriesVisited,
      citiesVisited,
      countriesVisitedList,
      citiesVisitedList,
      statsLastUpdated
    } = data;

    await docClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username },
      UpdateExpression: `
        SET countriesVisited = :countries,
            citiesVisited = :cities,
            countriesVisitedList = :countryList,
            citiesVisitedList = :cityList,
            statsLastUpdated = :updated,
            lastActiveAt = :now
      `,
      ExpressionAttributeValues: {
        ':countries': countriesVisited,
        ':cities': citiesVisited,
        ':countryList': countriesVisitedList,
        ':cityList': citiesVisitedList,
        ':updated': statsLastUpdated,
        ':now': new Date().toISOString()
      }
    }));

    console.log(`Updated statistics for user ${username}`);
  } catch (error) {
    console.error('Error updating user statistics:', error);
    // Don't throw - this is non-critical
  }
}
