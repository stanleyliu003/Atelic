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

  // Get userID and optional viewerUserID from GraphQL arguments
  const { userID, viewerUserID } = event.arguments;

  // Validate required parameters
  if (!userID) {
    throw new Error('Missing required parameter: userID is required');
  }

  console.log('userID:', userID);
  console.log('viewerUserID:', viewerUserID);

  // Determine if this is the user viewing their own profile or someone else's
  const isViewingOwnProfile = !viewerUserID || viewerUserID === userID;
  console.log('isViewingOwnProfile:', isViewingOwnProfile);

  try {
    // 1. Query for trips owned by the user (existing logic)
    const ownedTripsParams = {
      TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
      KeyConditionExpression: 'userID = :userID',
      ExpressionAttributeValues: {
        ':userID': userID
      },
      ProjectionExpression: 'tripID, tripTitle, selectedCity, tripPhotoReference, createdAt, startDate, endDate, tripLength, collaborators, isVisibleOnProfile'
    };

    console.log('Querying owned trips:', JSON.stringify(ownedTripsParams));
    const ownedTripsResult = await docClient.send(new QueryCommand(ownedTripsParams));

    // 2. Scan for trips where user is a collaborator
    // Note: DynamoDB FilterExpression can't easily search nested arrays, so we'll scan all trips
    // and filter in JavaScript code below
    // IMPORTANT: Handle pagination to ensure we scan ALL trips in the table
    const collaboratedTripsParams = {
      TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
      FilterExpression: 'attribute_exists(collaborators) AND userID <> :userID',
      ExpressionAttributeValues: {
        ':userID': userID
      },
      ProjectionExpression: 'tripID, tripTitle, selectedCity, tripPhotoReference, createdAt, startDate, endDate, tripLength, collaborators, userID, isVisibleOnProfile'
    };

    console.log('Scanning for collaborated trips with pagination...');

    // Collect all items across paginated scan results
    let allCollaboratedItems = [];
    let lastEvaluatedKey = null;
    let scanCount = 0;

    do {
      scanCount++;
      const scanParams = { ...collaboratedTripsParams };
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      console.log(`[Scan ${scanCount}] Fetching batch...`);
      const collaboratedTripsResult = await docClient.send(new ScanCommand(scanParams));

      console.log(`[Scan ${scanCount}] Found ${collaboratedTripsResult.Items?.length || 0} items in this batch, ScannedCount: ${collaboratedTripsResult.ScannedCount}`);

      if (collaboratedTripsResult.Items && collaboratedTripsResult.Items.length > 0) {
        allCollaboratedItems = allCollaboratedItems.concat(collaboratedTripsResult.Items);
      }

      lastEvaluatedKey = collaboratedTripsResult.LastEvaluatedKey;

      if (lastEvaluatedKey) {
        console.log(`[Scan ${scanCount}] More results available, continuing pagination...`);
      } else {
        console.log(`[Scan ${scanCount}] No more results, pagination complete`);
      }
    } while (lastEvaluatedKey);

    console.log(`[Pagination Complete] Total items collected: ${allCollaboratedItems.length} after ${scanCount} scan(s)`);
    console.log('Sample of collaborated trips scan results:', JSON.stringify(allCollaboratedItems.slice(0, 3), null, 2));

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
    let ownedTripSummaries = ownedTripsResult.Items.map(item => ({
      tripId: item.tripID,
      tripTitle: item.tripTitle || null,
      selectedCity: item.selectedCity,
      tripPhotoReference: normalizePhotoReferences(item.tripPhotoReference),
      createdAt: item.createdAt,
      startDate: item.startDate || null,
      endDate: item.endDate || null,
      tripLength: item.tripLength,
      userRole: getUserRole(item, userID),
      isVisibleOnProfile: item.isVisibleOnProfile || false
    }));

    // If viewing someone else's profile, filter to only visible trips
    if (!isViewingOwnProfile) {
      console.log(`[Visibility Filter] Filtering trips for viewer. Before: ${ownedTripSummaries.length}`);
      ownedTripSummaries = ownedTripSummaries.filter(trip => trip.isVisibleOnProfile === true);
      console.log(`[Visibility Filter] After filtering: ${ownedTripSummaries.length} visible trips`);
    }

    // Process collaborated trips - filter to only include trips where user is actually a collaborator
    console.log(`[Processing] Checking ${allCollaboratedItems.length} scanned trips for collaborations`);

    let collaboratedTripSummaries = allCollaboratedItems
      .filter(item => {
        const role = getUserRole(item, userID);
        console.log(`[Filter] Trip ${item.tripID}: role = ${role}`);
        return role !== null && role !== 'owner'; // Exclude if already an owner (covered in owned trips)
      })
      .map(item => ({
        tripId: item.tripID,
        tripTitle: item.tripTitle || null,
        selectedCity: item.selectedCity,
        tripPhotoReference: normalizePhotoReferences(item.tripPhotoReference),
        createdAt: item.createdAt,
        startDate: item.startDate || null,
        endDate: item.endDate || null,
        tripLength: item.tripLength,
        userRole: getUserRole(item, userID),
        isVisibleOnProfile: item.isVisibleOnProfile || false
      }));

    console.log(`[Processing] Found ${collaboratedTripSummaries.length} collaborated trips`);

    // If viewing someone else's profile, filter collaborated trips to only visible ones
    // (shared trips should only show on your profile if the owner made them visible)
    if (!isViewingOwnProfile) {
      console.log(`[Visibility Filter] Filtering collaborated trips for viewer. Before: ${collaboratedTripSummaries.length}`);
      collaboratedTripSummaries = collaboratedTripSummaries.filter(trip => trip.isVisibleOnProfile === true);
      console.log(`[Visibility Filter] After filtering collaborated trips: ${collaboratedTripSummaries.length} visible`);
    }

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
