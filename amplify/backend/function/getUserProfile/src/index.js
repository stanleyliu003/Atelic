/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log('getUserProfile event:', JSON.stringify(event));

  const { username, userID } = event.arguments;

  if (!username && !userID) {
    throw new Error('Either username or userID is required');
  }

  try {
    let profile;

    if (username) {
      // Query by username (partition key - fastest)
      const result = await docClient.send(new GetCommand({
        TableName: USER_PROFILES_TABLE,
        Key: { username }
      }));
      profile = result.Item;

    } else if (userID) {
      // Query by userID using GSI
      const result = await docClient.send(new QueryCommand({
        TableName: USER_PROFILES_TABLE,
        IndexName: 'userID-index',
        KeyConditionExpression: 'userID = :uid',
        ExpressionAttributeValues: {
          ':uid': userID
        },
        Limit: 1
      }));
      profile = result.Items?.[0];
    }

    if (!profile) {
      console.log('Profile not found, creating new profile...');
      // Profile doesn't exist - create it on-the-fly
      return await createInitialProfile(username, userID);
    }

    console.log('Profile found:', profile);
    return profile;

  } catch (error) {
    console.error('Error fetching profile:', error);
    throw new Error(`Failed to get user profile: ${error.message}`);
  }
};

/**
 * Helper: Create initial profile if doesn't exist
 */
async function createInitialProfile(username, userID) {
  console.log('Creating initial profile for:', { username, userID });

  const newProfile = {
    username: username || userID, // Fallback to userID if username not provided
    userID: userID || username, // Fallback to username if userID not provided
    email: '',
    fullName: '',
    createdAt: new Date().toISOString(),
    ownedTripsCount: 0,
    ownedTrips: [],
    sharedTripsCount: 0,
    sharedTrips: [],
    activitiesPerTrip: {},
    totalActivitiesOwned: 0,
    avgActivitiesPerTrip: 0,
    collaboratorsPerTrip: {},
    totalCollaboratorsAcrossTrips: 0,
    avgCollaboratorsPerTrip: 0,
    lastActiveAt: new Date().toISOString(),
    accountStatus: 'active',
    preferences: {
      notifications: true,
      theme: 'light',
      language: 'en'
    },
    updatedAt: new Date().toISOString(),
    version: 1
  };

  await docClient.send(new PutCommand({
    TableName: USER_PROFILES_TABLE,
    Item: newProfile
  }));

  console.log('Created new profile:', newProfile);
  return newProfile;
}
