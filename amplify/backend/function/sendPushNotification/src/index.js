/* Amplify Params - DO NOT EDIT
	AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID
	ENV
	REGION
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const snsClient = new SNSClient();

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;
const IS_PRODUCTION = process.env.ENV === 'prod';

/**
 * Send push notification to a user via AWS SNS
 *
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log('sendPushNotification event:', JSON.stringify(event));

  const { username, userID, title, body, data } = event.arguments;

  if (!username && !userID) {
    throw new Error('Either username or userID is required');
  }

  if (!title || !body) {
    throw new Error('Title and body are required');
  }

  try {
    // 1. Get user profile from DynamoDB to retrieve snsEndpointArn
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

    const { snsEndpointArn, notificationsEnabled } = userProfile;

    // 2. Validate that notifications are enabled and endpoint exists
    if (!notificationsEnabled) {
      return {
        success: false,
        message: 'Notifications are not enabled for this user'
      };
    }

    if (!snsEndpointArn) {
      throw new Error('No SNS endpoint ARN found for user. Please register device token first.');
    }

    console.log('Sending notification to endpoint:', snsEndpointArn);

    // 3. Format the APNs payload
    // For sandbox (development), use APNS_SANDBOX
    // For production, use APNS
    const platform = IS_PRODUCTION ? 'APNS' : 'APNS_SANDBOX';

    const apnsPayload = {
      aps: {
        alert: {
          title: title,
          body: body
        },
        badge: 1,
        sound: 'default',
        'mutable-content': 1
      }
    };

    // Add custom data if provided
    if (data) {
      Object.assign(apnsPayload, typeof data === 'string' ? JSON.parse(data) : data);
    }

    const message = {
      [platform]: JSON.stringify(apnsPayload)
    };

    console.log('APNs message:', JSON.stringify(message, null, 2));

    // 4. Send notification via SNS
    const publishResult = await snsClient.send(new PublishCommand({
      Message: JSON.stringify(message),
      MessageStructure: 'json',
      TargetArn: snsEndpointArn
    }));

    console.log('Notification sent successfully:', publishResult.MessageId);

    return {
      success: true,
      message: 'Notification sent successfully',
      messageId: publishResult.MessageId
    };

  } catch (error) {
    console.error('Error sending notification:', error);

    // Handle specific SNS errors
    if (error.name === 'EndpointDisabled' || error.message?.includes('Endpoint is disabled')) {
      return {
        success: false,
        message: 'Device endpoint is disabled. User may need to re-register their device.',
        error: 'ENDPOINT_DISABLED'
      };
    }

    if (error.name === 'InvalidParameter' || error.message?.includes('Invalid parameter')) {
      return {
        success: false,
        message: 'Invalid notification parameters',
        error: 'INVALID_PARAMETER'
      };
    }

    throw new Error(`Failed to send notification: ${error.message}`);
  }
};
