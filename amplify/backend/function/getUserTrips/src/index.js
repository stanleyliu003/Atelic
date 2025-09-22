const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Get input from GraphQL arguments
  const { userID, tripID } = event.arguments;

  // Validate required parameters
  if (!userID || !tripID) {
    throw new Error('Missing required parameters: userID and tripID are required');
  }

  console.log('userID:', userID);
  console.log('tripID:', tripID);

  // DynamoDB get parameters
  const params = {
    TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
    Key: {
      userID: userID,
      tripID: tripID
    }
  };

  console.log('DynamoDB get params:', JSON.stringify(params));

  try {
    const result = await docClient.send(new GetCommand(params));

    if (!result.Item) {
      throw new Error(`Trip not found for userID: ${userID}, tripID: ${tripID}`);
    }

    console.log('Retrieved trip:', JSON.stringify(result.Item));

    // Return the complete trip data including tripPhotoReference
    return {
      tripId: result.Item.tripID,
      days: result.Item.days || [],
      wishlist: result.Item.wishlist || [],
      tripLength: result.Item.tripLength,
      selectedCity: result.Item.selectedCity,
      tripPhotoReference: result.Item.tripPhotoReference,
      createdAt: result.Item.createdAt,
    };

  } catch (error) {
    console.error('DynamoDB get error:', error);
    throw new Error('Failed to retrieve trip');
  }
};
