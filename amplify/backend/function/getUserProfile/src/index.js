/* Amplify Params - DO NOT EDIT
	AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID
	ENV
	REGION
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
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

  const now = new Date().toISOString();

  // Attempt to enrich from Cognito (email, fullName, preferred_username, birthdate -> age, gender)
  let email = '';
  let fullName = '';
  let preferredUsername = username;
  let age = null;
  let gender = null;
  try {
    if (USER_POOL_ID && (userID || username)) {
      const cognitoUser = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userID || username
      }));
      const attrs = cognitoUser?.UserAttributes || [];
      const getAttr = (name) => attrs.find(a => a.Name === name)?.Value;
      email = getAttr('email') || '';
      fullName = getAttr('name') || '';
      preferredUsername = getAttr('preferred_username') || preferredUsername;
      gender = getAttr('gender') || null;
      const birthdateStr = getAttr('birthdate'); // format: YYYY-MM-DD
      if (birthdateStr) {
        age = computeAgeFromBirthdate(birthdateStr);
      }
    }
  } catch (e) {
    console.warn('Warning: Failed to enrich initial profile from Cognito:', e?.message || e);
  }

  const newProfile = {
    // Basic info
    username: preferredUsername || username || userID,
    userID: userID || username,
    email,
    fullName,
    age,
    gender,

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
    subscriptionStartDate: now,
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

  console.log('Created new profile:', newProfile);
  return newProfile;
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
