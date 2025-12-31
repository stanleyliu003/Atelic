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

  // For version 1 profiles (new users), ensure all key fields from Cognito are saved
  // This ensures backward compatibility - old users who never had these fields will have them populated
  const newProfile = {
    // Basic info - IMPORTANT: These are saved for version 1 users to ensure backward compatibility
    username: preferredUsername || username || userID,
    userID: userID || username,
    email: email || '',  // Saved from Cognito for version 1 users
    fullName: fullName || '',  // Saved from Cognito for version 1 users
    age: age,  // Computed from birthdate in Cognito for version 1 users
    gender: gender,  // Saved from Cognito for version 1 users

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
    // Device info fields below will be populated by username-setup via SET_ACCOUNT_CREATED_AT
    // or can be set during subsequent UPDATE_LOGIN calls
    appVersion: null,
    deviceType: null,
    modelName: null,
    osVersion: null,

    // Onboarding preferences
    activityPreferences: [],
    selectedUseCases: [],

    // Subscription info
    subscriptionTier: 'free',
    subscriptionStartDate: now,
    subscriptionEndDate: null,
    subscriptionStatus: 'active',
    trialEndsAt: null,

    // Push notifications
    notificationsEnabled: null,
    devicePushToken: null,
    snsEndpointArn: null,

    // System fields
    lastActiveAt: now,
    accountStatus: 'active',
    preferences: {
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
    // Version 1 indicates this is a new user profile with all fields properly initialized
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
