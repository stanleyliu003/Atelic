/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_APPVERSIONMANAGER_ARN
	STORAGE_APPVERSIONMANAGER_NAME
	STORAGE_APPVERSIONMANAGER_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.STORAGE_APPVERSIONMANAGER_NAME;
const CURRENT_ENV = process.env.ENV;

/**
 * Get minimum version requirements for a specific platform and environment
 * @type {import('@types/aws-lambda').AppSyncResolverHandler}
 */
exports.handler = async (event) => {
  console.log('getVersionConfig event:', JSON.stringify(event, null, 2));

  const { platform, environment } = event.arguments;

  // Validate inputs
  if (!platform || !['ios', 'android'].includes(platform)) {
    throw new Error('Invalid platform. Must be "ios" or "android"');
  }

  if (!environment || !['dev', 'staging', 'prod'].includes(environment)) {
    throw new Error('Invalid environment. Must be "dev", "staging", or "prod"');
  }

  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        id: 'VERSION_CONFIG',
        platform: platform
      }
    };

    console.log('DynamoDB get params:', JSON.stringify(params, null, 2));

    const result = await docClient.send(new GetCommand(params));

    console.log('DynamoDB result:', JSON.stringify(result, null, 2));

    // If no config found, return safe defaults
    if (!result.Item) {
      console.warn(`No version config found for platform: ${platform}, environment: ${environment}`);
      return {
        id: 'VERSION_CONFIG',
        platform,
        minimumVersion: '1.0.0',
        environment,
        lastUpdated: new Date().toISOString()
      };
    }

    // Verify the environment matches (additional safety check)
    if (result.Item.environment !== environment) {
      console.warn(`Environment mismatch. Expected: ${environment}, Got: ${result.Item.environment}`);
      return {
        id: 'VERSION_CONFIG',
        platform,
        minimumVersion: '1.0.0',
        environment,
        lastUpdated: new Date().toISOString()
      };
    }

    return result.Item;

  } catch (error) {
    console.error('Error fetching version config:', error);

    // Fail open - return safe defaults so users aren't blocked if Lambda fails
    return {
      id: 'VERSION_CONFIG',
      platform,
      minimumVersion: '1.0.0',
      environment,
      lastUpdated: new Date().toISOString()
    };
  }
};
