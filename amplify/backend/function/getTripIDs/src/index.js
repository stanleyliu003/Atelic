const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Get userID from GraphQL arguments
  const { userID } = event.arguments;

  // Validate required parameters
  if (!userID) {
    throw new Error('Missing required parameter: userID is required');
  }

  console.log('userID:', userID);

  // DynamoDB query parameters - query by partition key only to get all user trips
  const params = {
    TableName: 'Trips-dev',
    KeyConditionExpression: 'userID = :userID',
    ExpressionAttributeValues: {
      ':userID': userID
    },
    // Project only the fields needed for trip summary
    ProjectionExpression: 'tripID, selectedCity, tripPhotoReference, createdAt'
  };

  console.log('DynamoDB query params:', JSON.stringify(params));

  try {
    const result = await docClient.send(new QueryCommand(params));

    console.log('Retrieved trips:', JSON.stringify(result.Items));

    // Return array of trip summaries
    const tripSummaries = result.Items.map(item => ({
      tripId: item.tripID,
      selectedCity: item.selectedCity,
      tripPhotoReference: item.tripPhotoReference,
      createdAt: item.createdAt
    }));

    return tripSummaries;

  } catch (error) {
    console.error('DynamoDB query error:', error);
    throw new Error('Failed to retrieve user trips');
  }
};
