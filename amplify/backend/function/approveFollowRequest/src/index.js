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

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const FOLLOW_REQUESTS_TABLE = process.env.STORAGE_FOLLOWREQUESTSSTORAGE_NAME;
const USER_FOLLOWS_TABLE = process.env.STORAGE_USERFOLLOWSSTORAGE_NAME;
const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;

/**
 * Approve or Reject Follow Request Lambda Function
 *
 * Handles approval/rejection of follow requests for private accounts
 *
 * @param {object} event - Lambda event with targetUsername, requesterUsername, and action
 * @returns {object} Result with success status
 */
exports.handler = async (event) => {
  console.log('approveFollowRequest event:', JSON.stringify(event));

  const args = event?.arguments || event;
  const { targetUsername, requesterUsername, action } = args;

  if (!targetUsername || !requesterUsername || !action) {
    throw new Error('targetUsername, requesterUsername, and action are required');
  }

  if (action !== 'approve' && action !== 'reject') {
    throw new Error('action must be "approve" or "reject"');
  }

  try {
    // 1. Get the pending request
    const request = await getFollowRequest(targetUsername, requesterUsername);

    if (!request) {
      return {
        success: false,
        status: 'not_found',
        message: 'Follow request not found'
      };
    }

    if (request.status !== 'pending') {
      return {
        success: false,
        status: 'already_processed',
        message: 'Request has already been processed'
      };
    }

    if (action === 'approve') {
      // 2a. Create follow relationship
      const follow = {
        followerUsername: requesterUsername,
        followingUsername: targetUsername,
        followerUserID: request.requesterUserID,
        followingUserID: request.targetUserID,
        followedAt: new Date().toISOString(),
        status: 'active'
      };

      await docClient.send(new PutCommand({
        TableName: USER_FOLLOWS_TABLE,
        Item: follow
      }));

      console.log(`Created follow relationship: ${requesterUsername} -> ${targetUsername}`);

      // 2b. Update counts atomically
      await Promise.all([
        updateFollowingCount(requesterUsername, +1),
        updateFollowersCount(targetUsername, +1)
      ]);

      // 2c. Update request status to approved
      await updateRequestStatus(targetUsername, requesterUsername, 'approved');

      console.log(`Approved follow request: ${requesterUsername} -> ${targetUsername}`);

      return {
        success: true,
        status: 'approved',
        action,
        message: 'Follow request approved successfully'
      };
    } else {
      // 3. Delete rejected request immediately (no clutter)
      await deleteFollowRequest(targetUsername, requesterUsername);

      console.log(`Rejected and deleted follow request: ${requesterUsername} -> ${targetUsername}`);

      return {
        success: true,
        status: 'rejected',
        action,
        message: 'Follow request rejected'
      };
    }
  } catch (error) {
    console.error('Error in approveFollowRequest:', error);
    throw error;
  }
};

/**
 * Get a follow request from the database
 */
async function getFollowRequest(targetUsername, requesterUsername) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: FOLLOW_REQUESTS_TABLE,
      Key: { targetUsername, requesterUsername }
    }));

    return result.Item;
  } catch (error) {
    console.error('Error getting follow request:', error);
    return null;
  }
}

/**
 * Update the status of a follow request
 */
async function updateRequestStatus(targetUsername, requesterUsername, status) {
  try {
    await docClient.send(new UpdateCommand({
      TableName: FOLLOW_REQUESTS_TABLE,
      Key: { targetUsername, requesterUsername },
      UpdateExpression: 'SET #status = :status, respondedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':now': new Date().toISOString()
      }
    }));
  } catch (error) {
    console.error('Error updating request status:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Delete a follow request
 */
async function deleteFollowRequest(targetUsername, requesterUsername) {
  try {
    await docClient.send(new DeleteCommand({
      TableName: FOLLOW_REQUESTS_TABLE,
      Key: { targetUsername, requesterUsername }
    }));
  } catch (error) {
    console.error('Error deleting follow request:', error);
    throw error;
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
