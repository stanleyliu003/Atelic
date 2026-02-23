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
const { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_FOLLOWS_TABLE = process.env.STORAGE_USERFOLLOWSSTORAGE_NAME;
const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;

/**
 * Get Followers Lambda Function
 *
 * Retrieves all followers for a user with pagination
 *
 * @param {object} event - Lambda event with username, nextToken, and limit
 * @returns {object} Followers result with profiles and pagination token
 */
exports.handler = async (event) => {
  console.log('getFollowers event:', JSON.stringify(event));

  const args = event?.arguments || event;
  const { username, nextToken, limit = 20 } = args;

  if (!username) {
    throw new Error('username is required');
  }

  try {
    // Query UserFollowsStorage using followingUsername-index GSI
    const params = {
      TableName: USER_FOLLOWS_TABLE,
      IndexName: 'followingUsername-index',
      KeyConditionExpression: 'followingUsername = :username',
      ExpressionAttributeValues: {
        ':username': username
      },
      Limit: limit
    };

    // Add pagination token if provided
    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    console.log('Querying followers with params:', JSON.stringify(params));

    const result = await docClient.send(new QueryCommand(params));

    console.log(`Found ${result.Items?.length || 0} followers`);

    // Extract follower usernames
    const followerUsernames = result.Items?.map(item => item.followerUsername) || [];

    // Enrich with profile data
    const followerProfiles = await getProfilesByUsernames(followerUsernames);

    // Create pagination token
    const newNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null;

    return {
      followers: followerProfiles,
      nextToken: newNextToken
    };
  } catch (error) {
    console.error('Error in getFollowers:', error);
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
