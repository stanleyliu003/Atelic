const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE;
const USER_FOLLOWS_TABLE = process.env.USER_FOLLOWS_TABLE;
const FOLLOW_REQUESTS_TABLE = process.env.FOLLOW_REQUESTS_TABLE;

exports.handler = async (event) => {
  console.log('[searchUsersPublic] Event:', JSON.stringify(event, null, 2));

  const { searchTerm, currentUsername } = event.arguments;

  if (!searchTerm || searchTerm.trim().length < 1) {
    return [];
  }

  try {
    // Search users by username or full name
    const searchResults = await searchUsers(searchTerm.trim());

    // Enrich results with follow status
    const enrichedResults = await Promise.all(
      searchResults.map(user => enrichUserWithFollowStatus(user, currentUsername))
    );

    // Filter out the current user from results
    const filteredResults = enrichedResults.filter(
      user => user.username !== currentUsername
    );

    console.log(`[searchUsersPublic] Found ${filteredResults.length} users matching "${searchTerm}"`);
    return filteredResults;
  } catch (error) {
    console.error('[searchUsersPublic] Error:', error);
    throw error;
  }
};

async function searchUsers(searchTerm) {
  const searchLower = searchTerm.toLowerCase();

  // Scan UserProfilesStorage - retrieve all users (no filter on DynamoDB side)
  // We'll do case-insensitive filtering in-memory since DynamoDB's contains() is case-sensitive
  const scanParams = {
    TableName: USER_PROFILES_TABLE,
    ProjectionExpression: 'userID, email, fullName, username, isPrivateAccount, profilePhotoUrl, bio',
  };

  const result = await docClient.send(new ScanCommand(scanParams));
  const allUsers = result.Items || [];

  // Filter case-insensitively
  const filteredUsers = allUsers.filter(user => {
    const usernameLower = (user.username || '').toLowerCase();
    const fullNameLower = (user.fullName || '').toLowerCase();
    return usernameLower.includes(searchLower) || fullNameLower.includes(searchLower);
  });

  // Limit to 50 results
  return filteredUsers.slice(0, 50);
}

async function enrichUserWithFollowStatus(user, currentUsername) {
  if (!currentUsername) {
    return {
      ...user,
      isPrivate: !!user.isPrivateAccount,
      isFollowing: false,
      isFollower: false,
      hasPendingRequest: false,
    };
  }

  try {
    // Check if current user follows this user
    const isFollowing = await checkFollowRelationship(currentUsername, user.username);

    // Check if this user follows current user
    const isFollower = await checkFollowRelationship(user.username, currentUsername);

    // Check for pending follow request (if account is private)
    const hasPendingRequest = user.isPrivateAccount
      ? await checkPendingRequest(currentUsername, user.username)
      : false;

    return {
      ...user,
      isPrivate: !!user.isPrivateAccount,
      isFollowing: !!isFollowing,
      isFollower: !!isFollower,
      hasPendingRequest: !!hasPendingRequest,
    };
  } catch (error) {
    console.error('[enrichUserWithFollowStatus] Error:', error);
    return {
      ...user,
      isPrivate: !!user.isPrivateAccount,
      isFollowing: false,
      isFollower: false,
      hasPendingRequest: false,
    };
  }
}

async function checkFollowRelationship(followerUsername, followingUsername) {
  try {
    // Try exact match first
    const params = {
      TableName: USER_FOLLOWS_TABLE,
      Key: {
        followerUsername,
        followingUsername,
      },
    };

    const result = await docClient.send(new GetCommand(params));
    if (result.Item && result.Item.status === 'active') {
      return true;
    }

    // If exact match fails, try case-insensitive search
    // This handles legacy records that may have case mismatches
    const followerLower = followerUsername.toLowerCase();
    const followingLower = followingUsername.toLowerCase();

    const scanResult = await docClient.send(new ScanCommand({
      TableName: USER_FOLLOWS_TABLE,
      FilterExpression: 'attribute_exists(followerUsername)',
      Limit: 500
    }));

    const match = scanResult.Items?.find(item =>
      item.followerUsername?.toLowerCase() === followerLower &&
      item.followingUsername?.toLowerCase() === followingLower &&
      item.status === 'active'
    );

    return !!match;
  } catch (error) {
    console.error('[checkFollowRelationship] Error:', error);
    return false;
  }
}

async function checkPendingRequest(requesterUsername, targetUsername) {
  try {
    const params = {
      TableName: FOLLOW_REQUESTS_TABLE,
      Key: {
        targetUsername,
        requesterUsername,
      },
    };

    const result = await docClient.send(new GetCommand(params));

    // Request exists and is still pending
    return !!(result.Item && result.Item.status === 'pending');
  } catch (error) {
    console.error('[checkPendingRequest] Error:', error);
    return false;
  }
}
