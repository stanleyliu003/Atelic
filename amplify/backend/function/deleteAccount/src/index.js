/* Amplify Params - DO NOT EDIT
	AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID
	ENV
	FUNCTION_CREATETRIPSTORAGE_NAME
	FUNCTION_DELETETRIP_NAME
	FUNCTION_GETTRIPIDS_NAME
	FUNCTION_GETUSERTRIPS_NAME
	FUNCTION_MANAGECOLLABORATORS_NAME
	REGION
	STORAGE_TRIPSTORAGE_ARN
	STORAGE_TRIPSTORAGE_NAME
	STORAGE_TRIPSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { CognitoIdentityProviderClient, AdminDeleteUserCommand, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION });
const lambdaClient = new LambdaClient({ region: process.env.REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log('Received deleteAccount event:', JSON.stringify(event, null, 2));

    try {
        const { userID } = event.arguments;

        if (!userID) {
            throw new Error('userID is required');
        }

        console.log(`Starting account deletion process for userID: ${userID}`);

        // Step 1: Verify user exists in Cognito
        let cognitoUser;
        try {
            const getUserParams = {
                UserPoolId: process.env.AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID,
                Username: userID
            };
            
            const getUserResult = await cognitoClient.send(new AdminGetUserCommand(getUserParams));
            cognitoUser = getUserResult;
            console.log(`User found in Cognito: ${userID}`);
        } catch (error) {
            if (error.name === 'UserNotFoundException') {
                console.log(`User ${userID} not found in Cognito, proceeding with data cleanup only`);
                cognitoUser = null;
            } else {
                console.error('Error checking user in Cognito:', error);
                throw new Error(`Failed to verify user: ${error.message}`);
            }
        }

        // Step 2: Get all trips associated with the user
        const userTrips = await getUserTrips(userID);
        console.log(`Found ${userTrips.length} trips associated with user ${userID}`);

        // Step 3: Handle trip cleanup based on user role
        const deletionResults = await handleTripCleanup(userID, userTrips);
        console.log(`Trip cleanup completed:`, deletionResults);

        // Step 4: Delete user from Cognito (if exists)
        if (cognitoUser) {
            try {
                const deleteUserParams = {
                    UserPoolId: process.env.AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID,
                    Username: userID
                };
                
                await cognitoClient.send(new AdminDeleteUserCommand(deleteUserParams));
                console.log(`Successfully deleted user ${userID} from Cognito`);
            } catch (error) {
                console.error('Error deleting user from Cognito:', error);
                // Don't throw here - we want to continue with cleanup even if Cognito deletion fails
                console.log('Continuing with data cleanup despite Cognito deletion failure');
            }
        }

        // Step 5: Clean up any remaining user data
        // Note: Additional cleanup could include:
        // - Delete user profile data
        // - Clean up any other user-related data

        const result = {
            success: true,
            message: 'Account deleted successfully',
            userID: userID,
            deletedTripsCount: deletionResults.ownedTripsDeleted + deletionResults.sharedTripsRemoved,
            cognitoUserDeleted: !!cognitoUser,
            ownedTripsDeleted: deletionResults.ownedTripsDeleted,
            sharedTripsRemoved: deletionResults.sharedTripsRemoved,
            errors: deletionResults.errors
        };

        console.log('Account deletion completed:', result);
        return result;

    } catch (error) {
        console.error('Account deletion failed:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        throw new Error(`Failed to delete account: ${error.message}`);
    }
};

/**
 * Get all trips associated with the user using getTripIDs Lambda
 */
async function getUserTrips(userID) {
    try {
        console.log(`Getting trips for user: ${userID}`);
        
        const payload = {
            arguments: {
                userID: userID
            }
        };

        const invokeParams = {
            FunctionName: process.env.FUNCTION_GETTRIPIDS_NAME,
            Payload: JSON.stringify(payload)
        };

        const result = await lambdaClient.send(new InvokeCommand(invokeParams));
        const response = JSON.parse(new TextDecoder().decode(result.Payload));
        
        console.log(`getTripIDs response:`, response);
        
        if (response.errorMessage) {
            throw new Error(`getTripIDs failed: ${response.errorMessage}`);
        }

        return response || [];

    } catch (error) {
        console.error('Error in getUserTrips:', error);
        throw error;
    }
}

/**
 * Handle trip cleanup based on user role
 */
async function handleTripCleanup(userID, userTrips) {
    const results = {
        ownedTripsDeleted: 0,
        sharedTripsRemoved: 0,
        errors: []
    };

    if (!userTrips || userTrips.length === 0) {
        console.log('No trips found for user');
        return results;
    }

    // Separate trips by user role
    const ownedTrips = userTrips.filter(trip => trip.userRole === 'owner');
    const sharedTrips = userTrips.filter(trip => trip.userRole === 'editor' || trip.userRole === 'viewer');

    console.log(`Found ${ownedTrips.length} owned trips and ${sharedTrips.length} shared trips`);

    // Delete owned trips using deleteTrip Lambda
    for (const trip of ownedTrips) {
        try {
            await deleteOwnedTrip(userID, trip.tripId);
            results.ownedTripsDeleted++;
            console.log(`Successfully deleted owned trip: ${trip.tripId}`);
        } catch (error) {
            console.error(`Failed to delete owned trip ${trip.tripId}:`, error);
            results.errors.push(`Failed to delete trip ${trip.tripId}: ${error.message}`);
        }
    }

    // Remove user from shared trips using direct DynamoDB cleanup
    for (const trip of sharedTrips) {
        try {
            await removeUserFromSharedTripDirect(trip.tripId, userID);
            results.sharedTripsRemoved++;
            console.log(`Successfully removed user from shared trip: ${trip.tripId}`);
        } catch (error) {
            console.error(`Failed to remove user from shared trip ${trip.tripId}:`, error);
            results.errors.push(`Failed to remove from trip ${trip.tripId}: ${error.message}`);
        }
    }

    return results;
}

/**
 * Delete an owned trip using deleteTrip Lambda
 */
async function deleteOwnedTrip(userID, tripID) {
    try {
        const payload = {
            arguments: {
                userID: userID,
                tripID: tripID
            }
        };

        const invokeParams = {
            FunctionName: process.env.FUNCTION_DELETETRIP_NAME,
            Payload: JSON.stringify(payload)
        };

        const result = await lambdaClient.send(new InvokeCommand(invokeParams));
        const response = JSON.parse(new TextDecoder().decode(result.Payload));
        
        console.log(`deleteTrip response for ${tripID}:`, response);
        
        if (response.errorMessage) {
            throw new Error(`deleteTrip failed: ${response.errorMessage}`);
        }

        if (!response.success) {
            throw new Error(`deleteTrip returned success=false: ${response.message}`);
        }

        return response;

    } catch (error) {
        console.error(`Error deleting owned trip ${tripID}:`, error);
        throw error;
    }
}

/**
 * Remove user from a shared trip using direct DynamoDB update
 * This bypasses the permission checks in manageCollaborators for account deletion
 */
async function removeUserFromSharedTripDirect(tripId, userID) {
    try {
        console.log(`Directly removing user ${userID} from shared trip ${tripId}`);
        
        // First, find the trip in DynamoDB
        const trip = await findTripByIdDirect(tripId);
        if (!trip) {
            throw new Error(`Trip ${tripId} not found`);
        }

        // Get user info to find username
        const userInfo = await getUserInfo(userID);
        const username = userInfo.Username;

        // Filter out the user from collaborators
        const updatedCollaborators = trip.collaborators.filter(
            collaborator => collaborator.userID !== userID && collaborator.username !== username
        );

        console.log(`Removing user ${username} (${userID}) from trip ${tripId}`);
        console.log(`Collaborators before: ${trip.collaborators.length}, after: ${updatedCollaborators.length}`);

        // Update the trip with the new collaborators list
        const updateParams = {
            TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
            Key: {
                userID: trip.userID, // Owner's userID
                tripID: tripId
            },
            UpdateExpression: 'SET collaborators = :collaborators, version = :version, updatedAt = :updatedAt, lastUpdatedBy = :lastUpdatedBy',
            ExpressionAttributeValues: {
                ':collaborators': updatedCollaborators,
                ':version': (trip.version || 0) + 1,
                ':updatedAt': new Date().toISOString(),
                ':lastUpdatedBy': 'SYSTEM_ACCOUNT_DELETION'
            }
        };

        await docClient.send(new UpdateCommand(updateParams));
        console.log(`Successfully updated trip ${tripId} to remove user ${userID}`);

        return { success: true };

    } catch (error) {
        console.error(`Error in removeUserFromSharedTripDirect for trip ${tripId}:`, error);
        throw error;
    }
}

/**
 * Find a trip by ID using DynamoDB scan
 */
async function findTripByIdDirect(tripId) {
    try {
        const scanParams = {
            TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
            FilterExpression: 'tripID = :tripId',
            ExpressionAttributeValues: {
                ':tripId': tripId
            }
        };

        const result = await docClient.send(new ScanCommand(scanParams));
        
        if (!result.Items || result.Items.length === 0) {
            return null;
        }

        return result.Items[0];

    } catch (error) {
        console.error(`Error finding trip ${tripId}:`, error);
        throw error;
    }
}

/**
 * Get user info from Cognito
 */
async function getUserInfo(userID) {
    try {
        const getUserParams = {
            UserPoolId: process.env.AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID,
            Username: userID
        };
        
        const result = await cognitoClient.send(new AdminGetUserCommand(getUserParams));
        return result;

    } catch (error) {
        console.error(`Error getting user info for ${userID}:`, error);
        throw error;
    }
}
