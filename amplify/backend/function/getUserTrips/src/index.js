const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

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
    // First, try to get the trip as the owner (existing logic)
    const result = await docClient.send(new GetCommand(params));

    if (result.Item) {
      console.log('Retrieved trip as owner:', JSON.stringify(result.Item));

      // Return the complete trip data including tripPhotoReference, collaborators, version, and cityCategories
      return {
        tripId: result.Item.tripID,
        days: result.Item.days || [],
        wishlist: result.Item.wishlist || [],
        tripLength: result.Item.tripLength,
        selectedCity: result.Item.selectedCity,
        tripPhotoReference: normalizePhotoReferences(result.Item.tripPhotoReference),
        createdAt: result.Item.createdAt,
        startDate: result.Item.startDate || null,
        endDate: result.Item.endDate || null,
        collaborators: result.Item.collaborators || [],
        version: result.Item.version || 1,
        updatedAt: result.Item.updatedAt,
        lastUpdatedBy: result.Item.lastUpdatedBy,
        cityCategories: Array.isArray(result.Item.cityCategories) ? result.Item.cityCategories : [],
        notes: result.Item.notes || null,
        duration: result.Item.duration || null,
        arrivalTime: result.Item.arrivalTime || null,
        photos: result.Item.photos || null,
        hotel: result.Item.hotel || null,
        flight: result.Item.flight || null,
        savedActivities: result.Item.savedActivities || null
      };
    }

    // If not found as owner, try to find as collaborator
    console.log('Trip not found as owner, searching as collaborator...');

    const scanParams = {
      TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
      FilterExpression: 'tripID = :tripID AND attribute_exists(collaborators)',
      ExpressionAttributeValues: {
        ':tripID': tripID
      }
    };

    console.log('Scanning for trip as collaborator:', JSON.stringify(scanParams));
    const scanResult = await docClient.send(new ScanCommand(scanParams));

    if (scanResult.Items && scanResult.Items.length > 0) {
      // Check if the user is actually a collaborator on any of these trips
      for (const item of scanResult.Items) {
        if (item.collaborators && Array.isArray(item.collaborators)) {
          const isCollaborator = item.collaborators.some(c => c.userID === userID);
          if (isCollaborator) {
            console.log('Retrieved trip as collaborator:');

            return {
              tripId: item.tripID,
              days: item.days || [],
              wishlist: item.wishlist || [],
              tripLength: item.tripLength,
              selectedCity: item.selectedCity,
              tripPhotoReference: normalizePhotoReferences(item.tripPhotoReference),
              createdAt: item.createdAt,
              startDate: item.startDate || null,
              endDate: item.endDate || null,
              collaborators: item.collaborators || [],
              version: item.version || 1,
              updatedAt: item.updatedAt,
              lastUpdatedBy: item.lastUpdatedBy,
              cityCategories: Array.isArray(item.cityCategories) ? item.cityCategories : [],
              notes: item.notes || null,
              duration: item.duration || null,
              arrivalTime: item.arrivalTime || null,
              photos: item.photos || null,
              hotel: item.hotel || null,
              flight: item.flight || null,
              savedActivities: item.savedActivities || null
            };
          }
        }
      }
    }

    // If still not found, throw error
    throw new Error(`Trip not found for userID: ${userID}, tripID: ${tripID} (checked as owner and collaborator)`);

  } catch (error) {
    console.error('DynamoDB error:', error);
    throw new Error('Failed to retrieve trip');
  }
};
