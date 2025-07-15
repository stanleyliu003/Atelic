const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Get userId from Cognito identity
  const userId = event.identity && event.identity.sub ? event.identity.sub : 'unknown-user';

  // Get trip data from GraphQL input
  const input = event.arguments.input;
  if (!input || !input.tripId) {
    throw new Error('Missing tripId in input');
  }

  // Compose the item to store
  const item = {
    userId,
    tripId: input.tripId,
    days: input.days,
    wishlist: input.wishlist,
    createdAt: new Date().toISOString(),
  };

  // Store in DynamoDB
  const params = {
    TableName: 'Trips', // Update if your table name is different
    Item: item,
  };

  try {
    await dynamo.put(params).promise();
    return { tripId: input.tripId };
  } catch (error) {
    console.error('DynamoDB put error:', error);
    throw new Error('Failed to save trip');
  }
};
