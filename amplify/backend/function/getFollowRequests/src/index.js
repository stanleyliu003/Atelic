/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_FOLLOWREQUESTSSTORAGE_ARN
	STORAGE_FOLLOWREQUESTSSTORAGE_NAME
	STORAGE_FOLLOWREQUESTSSTORAGE_STREAMARN
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const FOLLOW_REQUESTS_TABLE = process.env.STORAGE_FOLLOWREQUESTSSTORAGE_NAME;
const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;

/**
 * Get Follow Requests Lambda Function
 *
 * Retrieves pending follow requests for a private account with pagination
 *
 * @param {object} event - Lambda event with targetUsername, nextToken, and limit
 * @returns {object} Follow requests result with requester profiles and pagination token
 */
exports.handler = async (event) => {
  console.log('getFollowRequests event:', JSON.stringify(event));

  const args = event?.arguments || event;
  const { targetUsername, nextToken, limit = 20 } = args;

  if (!targetUsername) {
    throw new Error('targetUsername is required');
  }

  try {
    // Query FollowRequestsStorage using partition key (targetUsername)
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
      },
      Limit: limit
    };

    // Add pagination token if provided
    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    console.log('Querying follow requests with params:', JSON.stringify(params));

    const result = await docClient.send(new QueryCommand(params));

    console.log(`Found ${result.Items?.length || 0} pending follow requests`);

    // Map to follow request objects
    const followRequests = result.Items?.map(item => ({
      requesterUsername: item.requesterUsername,
      targetUsername: item.targetUsername,
      createdAt: item.createdAt,
      status: item.status
    })) || [];

    // Extract requester usernames for profile enrichment
    const requesterUsernames = followRequests.map(req => req.requesterUsername);

    // Enrich with requester profile data
    const requesterProfiles = await getProfilesByUsernames(requesterUsernames);

    // Create a map of username -> profile
    const profileMap = new Map(
      requesterProfiles.map(p => [p.username, p])
    );

    // Enrich follow requests with requester profile data
    const enrichedRequests = followRequests.map(request => ({
      ...request,
      requesterProfile: profileMap.get(request.requesterUsername) || null
    }));

    // Create pagination token
    const newNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null;

    return {
      requests: enrichedRequests,
      nextToken: newNextToken
    };
  } catch (error) {
    console.error('Error in getFollowRequests:', error);
    throw error;
  }
};

/**
 * Get user profiles by usernames (batch lookup)
 */
async function getProfilesByUsernames(usernames) {
  if (!usernames || usernames.length === 0) {
    return [];
  }

  try {
    // DynamoDB BatchGetItem has a limit of 100 items per request
    const batchSize = 100;
    const profiles = [];

    for (let i = 0; i < usernames.length; i += batchSize) {
      const batch = usernames.slice(i, i + batchSize);

      const result = await docClient.send(new BatchGetCommand({
        RequestItems: {
          [USER_PROFILES_TABLE]: {
            Keys: batch.map(username => ({ username })),
            ProjectionExpression: 'username, fullName, profilePhotoUrl, bio, isPrivateAccount, followersCount, followingCount'
          }
        }
      }));

      if (result.Responses && result.Responses[USER_PROFILES_TABLE]) {
        const batchProfiles = result.Responses[USER_PROFILES_TABLE].map(profile => ({
          username: profile.username,
          fullName: profile.fullName || '',
          profilePhotoUrl: profile.profilePhotoUrl || null,
          bio: profile.bio || null,
          isPrivate: profile.isPrivateAccount || false,
          followersCount: profile.followersCount || 0,
          followingCount: profile.followingCount || 0
        }));

        profiles.push(...batchProfiles);
      }
    }

    return profiles;
  } catch (error) {
    console.error('Error getting profiles by usernames:', error);
    return [];
  }
}
