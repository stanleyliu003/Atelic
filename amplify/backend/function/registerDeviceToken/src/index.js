/* Amplify Params - DO NOT EDIT
	AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID
	ENV
	REGION
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, CreatePlatformEndpointCommand, SetEndpointAttributesCommand } = require('@aws-sdk/client-sns');

const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const snsClient = new SNSClient();

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;
const SNS_PLATFORM_APPLICATION_ARN = process.env.SNS_PLATFORM_APPLICATION_ARN || 'arn:aws:sns:us-east-1:036284794661:app/APNS_SANDBOX/Atelic-iOS-Production';

/**
 * Register a device token with AWS SNS and store the endpoint ARN in DynamoDB
 *
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log('registerDeviceToken event:', JSON.stringify(event));

  const { username, userID } = event.arguments;

  if (!username && !userID) {
    throw new Error('Either username or userID is required');
  }

  try {
    // 1. Get user profile from DynamoDB to retrieve devicePushToken
    let userProfile;
    if (username) {
      const result = await docClient.send(new GetCommand({
        TableName: USER_PROFILES_TABLE,
        Key: { username }
      }));
      userProfile = result.Item;
    } else {
      // Query by userID using GSI
      const result = await docClient.send(new QueryCommand({
        TableName: USER_PROFILES_TABLE,
        IndexName: 'userID-index',
        KeyConditionExpression: 'userID = :uid',
        ExpressionAttributeValues: {
          ':uid': userID
        },
        Limit: 1
      }));
      userProfile = result.Items?.[0];
    }

    if (!userProfile) {
      throw new Error(`User profile not found for ${username || userID}`);
    }

    const { devicePushToken, notificationsEnabled } = userProfile;

    // 2. Validate that notifications are enabled and device token exists
    if (!notificationsEnabled) {
      return {
        success: false,
        message: 'Notifications are not enabled for this user'
      };
    }

    if (!devicePushToken) {
      throw new Error('No device push token found for user');
    }

    console.log('Registering device token with SNS:', devicePushToken);

    // 3. Create or update SNS Platform Endpoint
    let endpointArn;
    try {
      // Try to create a new endpoint
      const createResult = await snsClient.send(new CreatePlatformEndpointCommand({
        PlatformApplicationArn: SNS_PLATFORM_APPLICATION_ARN,
        Token: devicePushToken,
        CustomUserData: JSON.stringify({
          userID: userProfile.userID,
          username: userProfile.username
        })
      }));
      endpointArn = createResult.EndpointArn;
      console.log('Created new SNS endpoint:', endpointArn);

    } catch (error) {
      // If endpoint already exists, extract the ARN from the error message
      if (error.message && error.message.includes('Endpoint') && error.message.includes('already exists')) {
        // Parse the existing endpoint ARN from error message
        const arnMatch = error.message.match(/arn:aws:sns:[^"]+/);
        if (arnMatch) {
          endpointArn = arnMatch[0];
          console.log('Endpoint already exists:', endpointArn);

          // Update the endpoint to ensure it's enabled
          await snsClient.send(new SetEndpointAttributesCommand({
            EndpointArn: endpointArn,
            Attributes: {
              Enabled: 'true',
              Token: devicePushToken
            }
          }));
          console.log('Updated existing endpoint');
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (!endpointArn) {
      throw new Error('Failed to get SNS endpoint ARN');
    }

    // 4. Store the SNS endpoint ARN in DynamoDB
    await docClient.send(new UpdateCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { username: userProfile.username },
      UpdateExpression: 'SET snsEndpointArn = :arn',
      ExpressionAttributeValues: {
        ':arn': endpointArn
      }
    }));

    console.log('Successfully registered device token and stored endpoint ARN');

    return {
      success: true,
      message: 'Device token registered successfully',
      endpointArn
    };

  } catch (error) {
    console.error('Error registering device token:', error);
    throw new Error(`Failed to register device token: ${error.message}`);
  }
};
