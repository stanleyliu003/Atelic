/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_SAVEDPLACESSTORAGE_NAME
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  const { userID, savedPlaceId } = event.arguments;
  const tableName = process.env.STORAGE_SAVEDPLACESSTORAGE_NAME;

  const params = {
    TableName: tableName,
    Key: { userID, savedPlaceId }
  };

  try {
    await docClient.send(new DeleteCommand(params));
    return { savedPlaceId, userID };
  } catch (err) {
    console.error('DynamoDB Delete Error:', err);
    throw new Error(err.message);
  }
};
