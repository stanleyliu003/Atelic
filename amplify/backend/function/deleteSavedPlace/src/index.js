/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_SAVEDPLACESSTORAGE_NAME
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('[deleteSavedPlace] Full event:', JSON.stringify(event));

  const { userID, savedPlaceId, deleteType } = event.arguments;
  const tableName = process.env.STORAGE_SAVEDPLACESSTORAGE_NAME;

  console.log('[deleteSavedPlace] Parsed arguments:', { userID, savedPlaceId, deleteType });
  console.log('[deleteSavedPlace] Table name:', tableName);

  try {
    if (deleteType === 'city') {
      // Attempt to remove 'city' attribute.
      // Condition: 'country' attribute must exist to keep the item.
      try {
        await docClient.send(new UpdateCommand({
          TableName: tableName,
          Key: { userID, savedPlaceId },
          UpdateExpression: "REMOVE city",
          ConditionExpression: "attribute_exists(country)"
        }));
        console.log('[deleteSavedPlace] Removed city attribute from place:', savedPlaceId);
        return { savedPlaceId, userID };
      } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
          console.log('[deleteSavedPlace] No country attribute, deleting item completely');
          // Fall through to full delete below
        } else {
          throw err;
        }
      }
    } else if (deleteType === 'country') {
      // Attempt to remove 'country' attribute.
      // Condition: 'city' attribute must exist to keep the item.
      try {
        await docClient.send(new UpdateCommand({
          TableName: tableName,
          Key: { userID, savedPlaceId },
          UpdateExpression: "REMOVE country",
          ConditionExpression: "attribute_exists(city)"
        }));
        console.log('[deleteSavedPlace] Removed country attribute from place:', savedPlaceId);
        return { savedPlaceId, userID };
      } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
          console.log('[deleteSavedPlace] No city attribute, deleting item completely');
          // Fall through to full delete below
        } else {
          throw err;
        }
      }
    }

    // Full delete (legacy behavior or if condition failed above)
    const params = {
      TableName: tableName,
      Key: { userID, savedPlaceId }
    };
    console.log('[deleteSavedPlace] Sending DeleteCommand with params:', JSON.stringify(params));
    const result = await docClient.send(new DeleteCommand(params));
    console.log('[deleteSavedPlace] DeleteCommand result:', JSON.stringify(result));
    console.log('[deleteSavedPlace] Successfully deleted savedPlaceId:', savedPlaceId, 'for userID:', userID);
    return { savedPlaceId, userID };
  } catch (err) {
    console.error('[deleteSavedPlace] DynamoDB Delete Error:', err);
    throw new Error(err.message);
  }
};
