/* Amplify Params - DO NOT EDIT
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

// Updated: Added cancel pending follow request support

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, UpdateCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_FOLLOWS_TABLE = process.env.STORAGE_USERFOLLOWSSTORAGE_NAME;
const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;
const FOLLOW_REQUESTS_TABLE = process.env.STORAGE_FOLLOWREQUESTSSTORAGE_NAME;

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
    // Get the actual username from the database (handles case sensitivity)
    const followerProfile = await getProfileByUsername(followerUsername);
    const targetProfile = await getProfileByUsername(targetUsername);

    // Use the exact usernames from the database
    const actualFollowerUsername = followerProfile?.username || followerUsername;
    const actualTargetUsername = targetProfile?.username || targetUsername;

    console.log('Username resolution:', {
      input: { followerUsername, targetUsername },
      resolved: { actualFollowerUsername, actualTargetUsername }
    });

    // 1. Check if there's a pending follow request first
    const pendingRequest = await checkPendingRequest(actualTargetUsername, actualFollowerUsername);
    if (pendingRequest) {
      // Delete the pending request
      await docClient.send(new DeleteCommand({
        TableName: FOLLOW_REQUESTS_TABLE,
        Key: {
          targetUsername: actualTargetUsername,
          requesterUsername: actualFollowerUsername
        }
      }));

      console.log(`Successfully canceled follow request: ${actualFollowerUsername} -> ${actualTargetUsername}`);

      return {
        success: true,
        status: 'request_canceled',
        message: 'Follow request canceled'
      };
    }

    // 2. Check if follow relationship exists
    const existingFollow = await checkExistingFollow(actualFollowerUsername, actualTargetUsername);

    if (!existingFollow) {
      // Try case-insensitive search as fallback
      console.log('No exact match found, trying case-insensitive search...');
      const followRecord = await findFollowRelationship(followerUsername, targetUsername);

      if (!followRecord) {
        return {
          success: true,
          status: 'not_following',
          message: 'Not following this user'
        };
      }

      // Use the keys from the found record
      console.log('Found follow record with keys:', {
        followerUsername: followRecord.followerUsername,
        followingUsername: followRecord.followingUsername
      });

      // Delete using the actual keys from the record
      await docClient.send(new DeleteCommand({
        TableName: USER_FOLLOWS_TABLE,
        Key: {
          followerUsername: followRecord.followerUsername,
          followingUsername: followRecord.followingUsername
        }
      }));

      // Decrement counts using the actual usernames
      await Promise.all([
        updateFollowingCount(followRecord.followerUsername, -1),
        updateFollowersCount(followRecord.followingUsername, -1)
      ]);

      console.log(`Successfully removed follow (case-insensitive): ${followRecord.followerUsername} -> ${followRecord.followingUsername}`);

      return {
        success: true,
        status: 'unfollowed',
        message: 'Successfully unfollowed user'
      };
    }

    // 2. Delete follow relationship
    await docClient.send(new DeleteCommand({
      TableName: USER_FOLLOWS_TABLE,
      Key: { followerUsername: actualFollowerUsername, followingUsername: actualTargetUsername }
    }));

    // 3. Decrement counts
    await Promise.all([
      updateFollowingCount(actualFollowerUsername, -1),
      updateFollowersCount(actualTargetUsername, -1)
    ]);

    console.log(`Successfully removed follow: ${actualFollowerUsername} -> ${actualTargetUsername}`);

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
 * Get user profile by username (case-insensitive lookup)
 */
async function getProfileByUsername(username) {
  try {
    // Try exact match first
    const result = await docClient.send(new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username }
    }));

    if (result.Item) {
      return result.Item;
    }

    // If not found, try case-insensitive scan
    const scanResult = await docClient.send(new ScanCommand({
      TableName: USER_PROFILES_TABLE,
      FilterExpression: 'contains(#u, :search)',
      ExpressionAttributeNames: { '#u': 'username' },
      ExpressionAttributeValues: { ':search': username.toLowerCase() },
      Limit: 10
    }));

    // Find case-insensitive match
    const match = scanResult.Items?.find(
      item => item.username?.toLowerCase() === username.toLowerCase()
    );

    return match || null;
  } catch (error) {
    console.error('Error getting profile:', error);
    return null;
  }
}

/**
 * Find follow relationship with case-insensitive search
 */
async function findFollowRelationship(followerUsername, targetUsername) {
  try {
    // Scan all pages for follow relationships matching case-insensitively
    let lastEvaluatedKey = undefined;

    do {
      const result = await docClient.send(new ScanCommand({
        TableName: USER_FOLLOWS_TABLE,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      }));

      // Find case-insensitive match in this page
      const match = result.Items?.find(item =>
        item.followerUsername?.toLowerCase() === followerUsername.toLowerCase() &&
        item.followingUsername?.toLowerCase() === targetUsername.toLowerCase()
      );

      if (match) {
        return match;
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return null;
  } catch (error) {
    console.error('Error finding follow relationship:', error);
    return null;
  }
}

/**
 * Check if a pending follow request exists
 */
async function checkPendingRequest(targetUsername, requesterUsername) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: FOLLOW_REQUESTS_TABLE,
      Key: { targetUsername, requesterUsername }
    }));

    return result.Item;
  } catch (error) {
    console.error('Error checking pending request:', error);
    return null;
  }
}

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
