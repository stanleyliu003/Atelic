/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_SAVEDPLACESSTORAGE_ARN
	STORAGE_SAVEDPLACESSTORAGE_NAME
	STORAGE_SAVEDPLACESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  const { userID, city } = event.arguments;
  const tableName = process.env.STORAGE_SAVEDPLACESSTORAGE_NAME;

  try {
    // 1. Query all items for this user and city
    // We query by userID (Partition Key) and filter by city
    let itemsToDelete = [];
    let lastEvaluatedKey = undefined;

    do {
      const params = {
        TableName: tableName,
        KeyConditionExpression: 'userID = :uid',
        FilterExpression: 'city = :city',
        ExpressionAttributeValues: {
          ':uid': userID,
          ':city': city
        },
        ExclusiveStartKey: lastEvaluatedKey
      };
      const data = await docClient.send(new QueryCommand(params));
      itemsToDelete = [...itemsToDelete, ...(data.Items || [])];
      lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    if (itemsToDelete.length === 0) {
      return { success: true, count: 0 };
    }

    // 2. Batch Delete (DynamoDB allows max 25 items per batchWrite)
    const chunks = [];
    for (let i = 0; i < itemsToDelete.length; i += 25) {
      chunks.push(itemsToDelete.slice(i, i + 25));
    }

    for (const chunk of chunks) {
      const deleteRequests = chunk.map(item => ({
        DeleteRequest: {
          Key: {
            userID: item.userID,
            savedPlaceId: item.savedPlaceId
          }
        }
      }));

      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [tableName]: deleteRequests
        }
      }));
    }

    return { success: true, count: itemsToDelete.length };

  } catch (err) {
    console.error('Delete City Error:', err);
    throw new Error(err.message);
  }
};
