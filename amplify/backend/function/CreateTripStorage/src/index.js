const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Get trip data from GraphQL input
  const input = event.arguments.input;
  if (!input || !input.tripId) {
    throw new Error('Missing tripId in input');
  }

  // Get userId from the input instead of authentication
  const userId = input.userID;
  if (!userId) {
    throw new Error('userID is required in input');
  }

  console.log('input:', input);
  console.log('userId:', userId);

  // Compose the item to store
  const item = {
    userID: userId,
    tripID: input.tripId,
    days: input.days,
    tripLength: input.tripLength,
    selectedCity: input.selectedCity,
    wishlist: input.wishlist,
    tripPhotoReference: input.tripPhotoReference,
    createdAt: input.createdAt,
    collaborators: input.collaborators || []
  };

  console.log('item to put:', item);

  // Store in DynamoDB
  const params = {
    TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
    Item: item,
  };

  try {
    await docClient.send(new PutCommand(params));
    // Return a Trip object as required by the GraphQL schema
    return {
      tripId: input.tripId,
      days: input.days || [],
      wishlist: input.wishlist || [],
      tripLength: input.tripLength,
      selectedCity: input.selectedCity,
      tripPhotoReference: input.tripPhotoReference,
      createdAt: item.createdAt,
      collaborators: item.collaborators
    };
  } catch (error) {
    console.error('DynamoDB put error:', error);
    throw new Error('Failed to save trip');
  }
};
