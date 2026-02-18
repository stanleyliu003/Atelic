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
    console.log('Unfollow request:', { followerUsername, targetUsername });

    // ALWAYS use case-insensitive search to find the follow record
    // This is the most reliable approach to handle any case mismatches
    const followRecord = await findFollowRelationship(followerUsername, targetUsername);

    if (!followRecord) {
      // No follow record found - check for pending request
      const pendingRequest = await findPendingRequest(followerUsername, targetUsername);

      if (pendingRequest) {
        // Delete the pending request using the actual keys from the found record
        await docClient.send(new DeleteCommand({
          TableName: FOLLOW_REQUESTS_TABLE,
          Key: {
            targetUsername: pendingRequest.targetUsername,
            requesterUsername: pendingRequest.requesterUsername
          }
        }));

        console.log(`Successfully canceled follow request: ${pendingRequest.requesterUsername} -> ${pendingRequest.targetUsername}`);

        return {
          success: true,
          status: 'request_canceled',
          message: 'Follow request canceled'
        };
      }

      console.log('No follow relationship or pending request found');
      return {
        success: true,
        status: 'not_following',
        message: 'Not following this user'
      };
    }

    // Found the follow record - delete using the EXACT keys from the record
    console.log('Found follow record, deleting:', {
      followerUsername: followRecord.followerUsername,
      followingUsername: followRecord.followingUsername
    });

    await docClient.send(new DeleteCommand({
      TableName: USER_FOLLOWS_TABLE,
      Key: {
        followerUsername: followRecord.followerUsername,
        followingUsername: followRecord.followingUsername
      }
    }));

    // Verify deletion
    const verifyResult = await docClient.send(new GetCommand({
      TableName: USER_FOLLOWS_TABLE,
      Key: {
        followerUsername: followRecord.followerUsername,
        followingUsername: followRecord.followingUsername
      }
    }));

    if (verifyResult.Item) {
      console.error('DELETION FAILED - record still exists after delete!');
      throw new Error('Failed to delete follow record');
    }

    console.log('Deletion verified - record no longer exists');

    // Decrement counts using the actual usernames from the record
    await Promise.all([
      updateFollowingCount(followRecord.followerUsername, -1),
      updateFollowersCount(followRecord.followingUsername, -1)
    ]);

    console.log(`Successfully removed follow: ${followRecord.followerUsername} -> ${followRecord.followingUsername}`);

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

    // If not found, scan and filter case-insensitively in JavaScript
    // Note: DynamoDB's contains() is case-sensitive, so we scan and filter locally
    const scanResult = await docClient.send(new ScanCommand({
      TableName: USER_PROFILES_TABLE,
      ProjectionExpression: 'username, userID',
      Limit: 500
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
    // Scan for follow relationships matching case-insensitively
    // Using pagination to handle large tables
    let lastEvaluatedKey = undefined;
    const followerLower = followerUsername.toLowerCase();
    const targetLower = targetUsername.toLowerCase();

    do {
      const scanParams = {
        TableName: USER_FOLLOWS_TABLE,
        Limit: 500
      };

      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new ScanCommand(scanParams));

      // Find case-insensitive match
      const match = result.Items?.find(item =>
        item.followerUsername?.toLowerCase() === followerLower &&
        item.followingUsername?.toLowerCase() === targetLower
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
 * Find pending follow request with case-insensitive search
 */
async function findPendingRequest(requesterUsername, targetUsername) {
  try {
    const requesterLower = requesterUsername.toLowerCase();
    const targetLower = targetUsername.toLowerCase();

    // Scan for pending requests matching case-insensitively
    let lastEvaluatedKey = undefined;

    do {
      const scanParams = {
        TableName: FOLLOW_REQUESTS_TABLE,
        Limit: 500
      };

      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new ScanCommand(scanParams));

      const match = result.Items?.find(item =>
        item.requesterUsername?.toLowerCase() === requesterLower &&
        item.targetUsername?.toLowerCase() === targetLower &&
        item.status === 'pending'
      );

      if (match) {
        return match;
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return null;
  } catch (error) {
    console.error('Error finding pending request:', error);
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
