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
const { DynamoDBDocumentClient, UpdateCommand, QueryCommand, PutCommand, UpdateCommand: DDBUpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;
const FOLLOW_REQUESTS_TABLE = process.env.STORAGE_FOLLOWREQUESTSSTORAGE_NAME;
const USER_FOLLOWS_TABLE = process.env.STORAGE_USERFOLLOWSSTORAGE_NAME;

/**
 * Update User Privacy Lambda Function
 *
 * Updates the privacy setting for a user account
 * Auto-approves all pending requests when switching from private to public
 *
 * @param {object} event - Lambda event with username and isPrivate
 * @returns {object} Result with success status
 */
exports.handler = async (event) => {
  console.log('updateUserPrivacy event:', JSON.stringify(event));

  const args = event?.arguments || event;
  const { username, isPrivate } = args;

  if (!username || typeof isPrivate !== 'boolean') {
    throw new Error('username and isPrivate (boolean) are required');
  }

  try {
    // 1. Update the user's privacy setting
    const updateResult = await docClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username },
      UpdateExpression: 'SET isPrivateAccount = :isPrivate, lastActiveAt = :now',
      ExpressionAttributeValues: {
        ':isPrivate': isPrivate,
        ':now': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    }));

    console.log(`Updated privacy setting for ${username} to ${isPrivate ? 'private' : 'public'}`);

    // 2. If switching from private to public, auto-approve all pending requests
    if (!isPrivate) {
      console.log('Switching to public account - auto-approving all pending requests');

      const pendingRequests = await getAllPendingRequests(username);
      console.log(`Found ${pendingRequests.length} pending requests to auto-approve`);

      // Auto-approve each request
      let approvedCount = 0;
      for (const request of pendingRequests) {
        try {
          await approveFollowRequest(request);
          approvedCount++;
        } catch (error) {
          console.error(`Failed to approve request from ${request.requesterUsername}:`, error);
          // Continue processing other requests even if one fails
        }
      }

      console.log(`Auto-approved ${approvedCount} out of ${pendingRequests.length} pending requests`);

      return {
        success: true,
        isPrivate: false,
        autoApprovedRequests: approvedCount,
        message: `Privacy updated to public. Auto-approved ${approvedCount} pending requests.`
      };
    }

    return {
      success: true,
      isPrivate: true,
      message: 'Privacy updated to private'
    };
  } catch (error) {
    console.error('Error in updateUserPrivacy:', error);
    throw error;
  }
};

/**
 * Get all pending follow requests for a user
 */
async function getAllPendingRequests(targetUsername) {
  try {
    const requests = [];
    let lastEvaluatedKey = null;

    do {
      const params = {
        TableName: FOLLOW_REQUESTS_TABLE,
        KeyConditionExpression: 'targetUsername = :username',
        FilterExpression: '#status = :pending',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':username': targetUsername,
          ':pending': 'pending'
        }
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new QueryCommand(params));

      if (result.Items) {
        requests.push(...result.Items);
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return requests;
  } catch (error) {
    console.error('Error getting pending requests:', error);
    return [];
  }
}

/**
 * Approve a follow request by creating a follow relationship
 */
async function approveFollowRequest(request) {
  try {
    const { requesterUsername, targetUsername, requesterUserID, targetUserID } = request;

    // 1. Create follow relationship
    const follow = {
      followerUsername: requesterUsername,
      followingUsername: targetUsername,
      followerUserID: requesterUserID,
      followingUserID: targetUserID,
      followedAt: new Date().toISOString(),
      status: 'active'
    };

    await docClient.send(new PutCommand({
      TableName: USER_FOLLOWS_TABLE,
      Item: follow
    }));

    console.log(`Created follow relationship: ${requesterUsername} -> ${targetUsername}`);

    // 2. Update follower/following counts
    await Promise.all([
      updateFollowingCount(requesterUsername, +1),
      updateFollowersCount(targetUsername, +1)
    ]);

    // 3. Update request status to approved
    await docClient.send(new DDBUpdateCommand({
      TableName: FOLLOW_REQUESTS_TABLE,
      Key: { targetUsername, requesterUsername },
      UpdateExpression: 'SET #status = :status, respondedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'approved',
        ':now': new Date().toISOString()
      }
    }));

    console.log(`Approved request: ${requesterUsername} -> ${targetUsername}`);
  } catch (error) {
    console.error(`Error approving request from ${request.requesterUsername}:`, error);
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
