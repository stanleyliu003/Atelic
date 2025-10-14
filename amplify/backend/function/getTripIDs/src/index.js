const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

// Helper function to normalize tripPhotoReference to array format
const normalizePhotoReferences = (photoRef) => {
  if (!photoRef) return [];
  if (Array.isArray(photoRef)) return photoRef;
  return [photoRef]; // Convert old string format to array
};

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Get userID from GraphQL arguments
  const { userID } = event.arguments;

  // Validate required parameters
  if (!userID) {
    throw new Error('Missing required parameter: userID is required');
  }

  console.log('userID:', userID);

  try {
    // 1. Query for trips owned by the user (existing logic)
    const ownedTripsParams = {
      TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
      KeyConditionExpression: 'userID = :userID',
      ExpressionAttributeValues: {
        ':userID': userID
      },
      ProjectionExpression: 'tripID, selectedCity, tripPhotoReference, createdAt, startDate, endDate, tripLength, collaborators'
    };

    console.log('Querying owned trips:', JSON.stringify(ownedTripsParams));
    const ownedTripsResult = await docClient.send(new QueryCommand(ownedTripsParams));

    // 2. Scan for trips where user is a collaborator
    // Note: DynamoDB FilterExpression can't easily search nested arrays, so we'll scan all trips
    // and filter in JavaScript code below
    const collaboratedTripsParams = {
      TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
      FilterExpression: 'attribute_exists(collaborators) AND userID <> :userID',
      ExpressionAttributeValues: {
        ':userID': userID
      },
      ProjectionExpression: 'tripID, selectedCity, tripPhotoReference, createdAt, startDate, endDate, tripLength, collaborators, userID'
    };

    console.log('Scanning for collaborated trips:', JSON.stringify(collaboratedTripsParams));
    const collaboratedTripsResult = await docClient.send(new ScanCommand(collaboratedTripsParams));

    console.log('Raw collaborated trips scan results:', JSON.stringify(collaboratedTripsResult.Items, null, 2));

    // Helper function to get user's role in a trip
    const getUserRole = (trip, userId) => {
      if (trip.userID === userId) {
        return 'owner';
      }

      if (trip.collaborators && Array.isArray(trip.collaborators)) {
        const collaborator = trip.collaborators.find(c => c.userID === userId);
        return collaborator ? collaborator.role : null;
      }

      return null;
    };

    // Process owned trips
    const ownedTripSummaries = ownedTripsResult.Items.map(item => ({
      tripId: item.tripID,
      selectedCity: item.selectedCity,
      tripPhotoReference: normalizePhotoReferences(item.tripPhotoReference),
      createdAt: item.createdAt,
      startDate: item.startDate || null,
      endDate: item.endDate || null,
      tripLength: item.tripLength,
      userRole: getUserRole(item, userID)
    }));

    // Process collaborated trips - filter to only include trips where user is actually a collaborator
    const collaboratedTripSummaries = collaboratedTripsResult.Items
      .filter(item => {
        const role = getUserRole(item, userID);
        return role !== null && role !== 'owner'; // Exclude if already an owner (covered in owned trips)
      })
      .map(item => ({
        tripId: item.tripID,
        selectedCity: item.selectedCity,
        tripPhotoReference: normalizePhotoReferences(item.tripPhotoReference),
        createdAt: item.createdAt,
        startDate: item.startDate || null,
        endDate: item.endDate || null,
        tripLength: item.tripLength,
        userRole: getUserRole(item, userID)
      }));

    // Combine results
    const allTripSummaries = [...ownedTripSummaries, ...collaboratedTripSummaries];

    console.log('Final trip summaries:', JSON.stringify(allTripSummaries));
    return allTripSummaries;

  } catch (error) {
    console.error('DynamoDB error:', error);
    throw new Error('Failed to retrieve user trips');
  }
};
