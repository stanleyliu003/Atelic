/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;
const APPSFLYER_WEBHOOK_SECRET = process.env.APPSFLYER_WEBHOOK_SECRET;

/**
 * AppsFlyer Attribution Webhook Handler
 * Receives install attribution data from AppsFlyer and stores it in UserProfilesStorage
 *
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log('[AppsFlyer Webhook] Event received:', JSON.stringify(event));

  try {
    // Parse request body
    let requestBody;
    try {
      requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (parseError) {
      console.error('[AppsFlyer Webhook] Failed to parse request body:', parseError);
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    // Verify AppsFlyer webhook signature (HMAC-SHA256) if secret is configured
    if (APPSFLYER_WEBHOOK_SECRET) {
      const signature = event.headers['X-AppsFlyer-Signature'] || event.headers['x-appsflyer-signature'];

      if (signature) {
        const computedSignature = crypto
          .createHmac('sha256', APPSFLYER_WEBHOOK_SECRET)
          .update(event.body)
          .digest('hex');

        if (computedSignature !== signature) {
          console.error('[AppsFlyer Webhook] Invalid signature:', { expected: computedSignature, received: signature });
          return {
            statusCode: 401,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Invalid signature' })
          };
        }
        console.log('[AppsFlyer Webhook] Signature verified successfully');
      } else {
        console.warn('[AppsFlyer Webhook] No signature provided, but secret is configured');
      }
    }

    // Extract attribution data from AppsFlyer webhook payload
    const {
      appsflyer_id,      // AppsFlyer device ID (unique identifier)
      media_source,      // Traffic source: "facebook", "instagram", "google_ads", etc.
      campaign,          // Campaign name
      campaign_id,       // Campaign ID
      install_time,      // Install timestamp (ISO format)
      is_organic         // true if organic install, false if paid
    } = requestBody;

    console.log('[AppsFlyer Webhook] Parsed attribution data:', {
      appsflyer_id,
      media_source,
      campaign,
      campaign_id,
      install_time,
      is_organic
    });

    // Validate required field
    if (!appsflyer_id) {
      console.error('[AppsFlyer Webhook] Missing required field: appsflyer_id');
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required field: appsflyer_id' })
      };
    }

    // Determine attribution source
    const attributionSource = (is_organic === true || is_organic === 'true')
      ? 'organic'
      : (media_source || 'unknown');

    const now = new Date().toISOString();

    // Store anonymous attribution record with temporary username = AF_{device_id}
    // This will be linked to the actual user account when they sign up
    const attributionRecord = {
      // Temporary username (will be replaced when user signs up)
      username: `AF_${appsflyer_id}`,

      // Attribution fields
      attributionDeviceId: appsflyer_id,
      attributionSource: attributionSource,
      attributionCampaign: campaign || null,
      attributionCampaignId: campaign_id || null,
      attributionInstallDate: install_time || now,
      attributionStatus: 'pending', // Will become 'linked' when user signs up

      // Required UserProfilesStorage fields (minimal values for anonymous record)
      userID: `AF_${appsflyer_id}`, // Temporary userID
      email: null,
      fullName: null,
      age: null,
      gender: null,

      // Trip metrics (initialized)
      ownedTripsCount: 0,
      ownedTrips: [],
      sharedTripsCount: 0,
      sharedTrips: [],
      totalTripsCompleted: 0,
      totalTripsUpcoming: 0,
      totalTripsInProgress: 0,

      // Activity metrics
      activitiesPerTrip: {},
      totalActivitiesOwned: 0,
      avgActivitiesPerTrip: 0,

      // Collaborator metrics
      collaboratorsPerTrip: {},
      totalCollaboratorsAcrossTrips: 0,
      avgCollaboratorsPerTrip: 0,

      // Travel insights
      mostVisitedCities: {},
      totalTripDuration: 0,
      avgTripDuration: 0,
      lastTripDate: null,
      nextTripDate: null,

      // Social features
      followersCount: 0,
      followingCount: 0,
      friends: [],

      // Profile information
      bio: null,
      profilePhotoUrl: null,
      socialLinks: {},

      // Usage stats
      accountCreatedAt: now,
      appVersion: null,
      deviceType: null,
      modelName: null,
      osVersion: null,

      // Onboarding preferences
      activityPreferences: [],
      selectedUseCases: [],

      // Push notifications
      notificationsEnabled: null,
      devicePushToken: null,
      snsEndpointArn: null,

      // Subscription info
      subscriptionTier: 'free',
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      subscriptionStatus: 'active',
      trialEndsAt: null,

      // System fields
      lastActiveAt: now,
      accountStatus: 'pending_attribution', // Special status for anonymous attribution records
      preferences: {
        theme: 'light',
        language: 'en',
        defaultCurrency: 'USD',
        preferredTravelMode: 'driving',
        distanceUnit: 'miles',
        timeFormat: '12h',
        dateFormat: 'MM/DD/YYYY',
        profileVisibility: 'public',
        allowCollaborationRequests: true,
        shareActivityHistory: true
      },
      version: 1
    };

    await docClient.send(new PutCommand({
      TableName: USER_PROFILES_TABLE,
      Item: attributionRecord
    }));

    console.log('[AppsFlyer Webhook] Successfully stored attribution record:', {
      username: attributionRecord.username,
      deviceId: appsflyer_id,
      source: attributionSource,
      campaign: campaign,
      status: 'pending'
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        deviceId: appsflyer_id,
        status: 'pending',
        message: 'Attribution data stored successfully'
      })
    };

  } catch (error) {
    console.error('[AppsFlyer Webhook] Error processing webhook:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
