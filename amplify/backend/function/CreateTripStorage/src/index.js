const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Get userId from Cognito identity - authentication required
  // When using @auth with Lambda resolvers, the identity is passed in event.identity.username or event.identity.sub
  let userId;

  if (event.identity) {
    userId = event.identity.sub || event.identity.username || event.identity.claims?.sub;
  }

  if (!userId) {
    console.error('No user identity found in event:', JSON.stringify(event.identity));
    throw new Error('Authentication required to create trips');
  }

  // Get trip data from GraphQL input
  const input = event.arguments.input;
  if (!input || !input.tripId) {
    throw new Error('Missing tripId in input');
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
    createdAt: input.createdAt
  };

  console.log('item to put:', item);

  // Store in DynamoDB
  const params = {
    TableName: 'Trips-dev',
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
      createdAt: item.createdAt,
    };
  } catch (error) {
    console.error('DynamoDB put error:', error);
    throw new Error('Failed to save trip');
  }
};
