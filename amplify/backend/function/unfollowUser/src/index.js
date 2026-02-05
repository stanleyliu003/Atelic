/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_USERFOLLOWSSTORAGE_ARN
	STORAGE_USERFOLLOWSSTORAGE_NAME
	STORAGE_USERFOLLOWSSTORAGE_STREAMARN
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_FOLLOWS_TABLE = process.env.STORAGE_USERFOLLOWSSTORAGE_NAME;
const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;

/**
 * Unfollow User Lambda Function
 *
 * Removes a follow relationship and updates follower/following counts
 *
 * @param {object} event - Lambda event with followerUsername and targetUsername
 * @returns {object} Result with success status
 */
exports.handler = async (event) => {
  console.log('unfollowUser event:', JSON.stringify(event));

  const args = event?.arguments || event;
  const { followerUsername, targetUsername } = args;

  if (!followerUsername || !targetUsername) {
    throw new Error('followerUsername and targetUsername are required');
  }

  try {
    // 1. Check if follow relationship exists
    const existingFollow = await checkExistingFollow(followerUsername, targetUsername);

    if (!existingFollow) {
      return {
        success: true,
        status: 'not_following',
        message: 'Not following this user'
      };
    }

    // 2. Delete follow relationship
    await docClient.send(new DeleteCommand({
      TableName: USER_FOLLOWS_TABLE,
      Key: { followerUsername, followingUsername: targetUsername }
    }));

    // 3. Decrement counts
    await Promise.all([
      updateFollowingCount(followerUsername, -1),
      updateFollowersCount(targetUsername, -1)
    ]);

    console.log(`Successfully removed follow: ${followerUsername} -> ${targetUsername}`);

    return {
      success: true,
      status: 'unfollowed',
      message: 'Successfully unfollowed user'
    };
  } catch (error) {
    console.error('Error in unfollowUser:', error);
    throw error;
  }
};

/**
 * Check if a follow relationship exists
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
