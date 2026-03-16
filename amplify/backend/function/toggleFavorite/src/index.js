/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_SAVEDPLACESSTORAGE_ARN
	STORAGE_SAVEDPLACESSTORAGE_NAME
	STORAGE_SAVEDPLACESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('[toggleFavorite] Event:', JSON.stringify(event));

  const { userID, savedPlaceId, isFavorite } = event.arguments;
  const tableName = process.env.STORAGE_SAVEDPLACESSTORAGE_NAME;

  if (!userID || !savedPlaceId || isFavorite === undefined) {
    throw new Error('userID, savedPlaceId, and isFavorite are required');
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: tableName,
      Key: { userID, savedPlaceId },
      UpdateExpression: 'SET isFavorite = :val',
      ExpressionAttributeValues: {
        ':val': isFavorite,
      },
      ConditionExpression: 'attribute_exists(userID)',
    }));

    console.log(`[toggleFavorite] Set isFavorite=${isFavorite} for savedPlaceId: ${savedPlaceId}`);
    return { userID, savedPlaceId, isFavorite };
  } catch (err) {
    console.error('[toggleFavorite] DynamoDB error:', err);
    throw new Error(err.message);
  }
};
