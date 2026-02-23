/* Amplify Params - DO NOT EDIT
	AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID
	ENV
	REGION
	STORAGE_FOLLOWREQUESTSSTORAGE_ARN
	STORAGE_FOLLOWREQUESTSSTORAGE_NAME
	STORAGE_FOLLOWREQUESTSSTORAGE_STREAMARN
	STORAGE_USERFOLLOWSSTORAGE_ARN
	STORAGE_USERFOLLOWSSTORAGE_NAME
	STORAGE_USERFOLLOWSSTORAGE_STREAMARN
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_FOLLOWS_TABLE = process.env.STORAGE_USERFOLLOWSSTORAGE_NAME;
const FOLLOW_REQUESTS_TABLE = process.env.STORAGE_FOLLOWREQUESTSSTORAGE_NAME;
const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;

/**
 * Follow User Lambda Function
 *
 * Handles user follow requests with privacy checks:
 * - For public accounts: creates follow relationship immediately
 * - For private accounts: creates a follow request that needs approval
 *
 * @param {object} event - Lambda event with followerUsername and targetUsername
 * @returns {object} Result with success status and follow status
 */
exports.handler = async (event) => {
  console.log('followUser event:', JSON.stringify(event));

  const args = event?.arguments || event;
  const { followerUsername, targetUsername } = args;

  if (!followerUsername || !targetUsername) {
    throw new Error('followerUsername and targetUsername are required');
  }

  // Can't follow yourself
  if (followerUsername === targetUsername) {
    return {
      success: false,
      status: 'error',
      message: 'Cannot follow yourself'
    };
  }

  try {
    // 1. Get target user's profile
    const targetProfile = await getProfile(targetUsername);

    if (!targetProfile) {
      return {
        success: false,
        status: 'error',
        message: 'User not found'
      };
    }

    // 2. Check if already following
    const existingFollow = await checkExistingFollow(followerUsername, targetUsername);
    if (existingFollow) {
      return {
        success: false,
        status: 'already_following',
        message: 'Already following this user'
      };
    }

    // 3. Check if account is private
    if (targetProfile.isPrivateAccount) {
      // Check for existing pending request
      const existingRequest = await checkExistingRequest(targetUsername, followerUsername);
      if (existingRequest && existingRequest.status === 'pending') {
        return {
          success: false,
          status: 'already_requested',
          message: 'Follow request already sent'
        };
      }

      // Create follow request for private account
      return await createFollowRequest(followerUsername, targetUsername, targetProfile.userID);
    }

    // 4. For public accounts: create follow relationship directly
    const followerProfile = await getProfile(followerUsername);
    const follow = {
      followerUsername,
      followingUsername: targetUsername,
      followerUserID: followerProfile?.userID || followerUsername,
      followingUserID: targetProfile.userID,
      followedAt: new Date().toISOString(),
      status: 'active'
    };

    await docClient.send(new PutCommand({
      TableName: USER_FOLLOWS_TABLE,
      Item: follow,
      ConditionExpression: 'attribute_not_exists(followerUsername)' // Prevent duplicates
    }));

    // 5. Update follower/following counts atomically
    await Promise.all([
      updateFollowingCount(followerUsername, 1),
      updateFollowersCount(targetUsername, 1)
    ]);

    console.log(`Successfully created follow: ${followerUsername} -> ${targetUsername}`);

    // TODO: Send push notification to target user
    // await sendNotification(targetUsername, {
    //   title: 'New Follower',
    //   body: `${followerUsername} started following you`
    // });

    return {
      success: true,
      status: 'following',
      message: 'Successfully followed user'
    };
  } catch (error) {
    console.error('Error in followUser:', error);

    // Handle duplicate follow attempts gracefully
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        success: false,
        status: 'already_following',
        message: 'Already following this user'
      };
    }

    throw error;
  }
};

/**
 * Get user profile from DynamoDB
 */
async function getProfile(username) {
  const result = await docClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username }
  }));

  return result.Item;
}

/**
 * Check if a follow relationship already exists
 */
async function checkExistingFollow(followerUsername, followingUsername) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USER_FOLLOWS_TABLE,
      Key: { followerUsername, followingUsername }
    }));

    return result.Item;
  } catch (error) {
    console.error('Error checking existing follow:', error);
    return null;
  }
}

/**
 * Check if a follow request already exists
 */
async function checkExistingRequest(targetUsername, requesterUsername) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: FOLLOW_REQUESTS_TABLE,
      Key: { targetUsername, requesterUsername }
    }));

    return result.Item;
  } catch (error) {
    console.error('Error checking existing request:', error);
    return null;
  }
}

/**
 * Create a follow request for a private account
 */
async function createFollowRequest(requesterUsername, targetUsername, targetUserID) {
  const requesterProfile = await getProfile(requesterUsername);

  const request = {
    targetUsername,
    requesterUsername,
    targetUserID,
    requesterUserID: requesterProfile?.userID || requesterUsername,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  await docClient.send(new PutCommand({
    TableName: FOLLOW_REQUESTS_TABLE,
    Item: request
  }));

  console.log(`Created follow request: ${requesterUsername} -> ${targetUsername}`);

  // TODO: Send push notification
  // await sendNotification(targetUsername, {
  //   title: 'New Follow Request',
  //   body: `${requesterUsername} wants to follow you`
  // });

  return {
    success: true,
    status: 'requested',
    message: 'Follow request sent'
  };
}

/**
 * Update following count for a user
 */
async function updateFollowingCount(username, delta) {
  try {
    await docClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username },
      UpdateExpression: 'SET followingCount = if_not_exists(followingCount, :zero) + :delta, lastActiveAt = :now',
      ExpressionAttributeValues: {
        ':delta': delta,
        ':zero': 0,
        ':now': new Date().toISOString()
      }
    }));
  } catch (error) {
    console.error('Error updating following count:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Update followers count for a user
 */
async function updateFollowersCount(username, delta) {
  try {
    await docClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username },
      UpdateExpression: 'SET followersCount = if_not_exists(followersCount, :zero) + :delta, lastActiveAt = :now',
      ExpressionAttributeValues: {
        ':delta': delta,
        ':zero': 0,
        ':now': new Date().toISOString()
      }
    }));
  } catch (error) {
    console.error('Error updating followers count:', error);
    // Don't throw - this is a non-critical operation
  }
}
