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
      console.log(`[getUserRole] Checking trip ${trip.tripID} for user ${userId}`);
      console.log(`[getUserRole] Trip owner: ${trip.userID}`);

      if (trip.userID === userId) {
        console.log(`[getUserRole] User is the owner`);
        return 'owner';
      }

      if (trip.collaborators && Array.isArray(trip.collaborators)) {
        console.log(`[getUserRole] Trip has ${trip.collaborators.length} collaborators:`,
          trip.collaborators.map(c => ({ userID: c.userID, email: c.email, role: c.role })));

        const collaborator = trip.collaborators.find(c => c.userID === userId);

        if (collaborator) {
          console.log(`[getUserRole] Found user as collaborator with role: ${collaborator.role}`);
          return collaborator.role;
        } else {
          console.log(`[getUserRole] User not found in collaborators array`);
        }
      } else {
        console.log(`[getUserRole] Trip has no collaborators array`);
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
    console.log(`[Processing] Checking ${collaboratedTripsResult.Items.length} scanned trips for collaborations`);

    const collaboratedTripSummaries = collaboratedTripsResult.Items
      .filter(item => {
        const role = getUserRole(item, userID);
        console.log(`[Filter] Trip ${item.tripID}: role = ${role}`);
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

    console.log(`[Processing] Found ${collaboratedTripSummaries.length} collaborated trips`);

    // Combine results
    const allTripSummaries = [...ownedTripSummaries, ...collaboratedTripSummaries];

    console.log(`[Final Results] Total trips: ${allTripSummaries.length} (${ownedTripSummaries.length} owned + ${collaboratedTripSummaries.length} collaborated)`);
    console.log('Final trip summaries:', JSON.stringify(allTripSummaries, null, 2));
    return allTripSummaries;

  } catch (error) {
    console.error('DynamoDB error:', error);
    throw new Error('Failed to retrieve user trips');
  }
};
