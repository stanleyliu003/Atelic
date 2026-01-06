/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_STREAMARN
	AMPLITUDE_API_KEY
Amplify Params - DO NOT EDIT */

/**
 * Lambda Function: Sync UserProfiles to Amplitude
 *
 * Reads all users from DynamoDB UserProfiles table and sends their data
 * to Amplitude as user properties for analytics and BI dashboards.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const https = require('https');

// Initialize without explicit region - Lambda uses its execution environment region
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;
const AMPLITUDE_API_KEY = process.env.AMPLITUDE_API_KEY;
const AMPLITUDE_BATCH_ENDPOINT = 'api2.amplitude.com';
const AMPLITUDE_BATCH_PATH = '/batch';
const ENV = process.env.ENV || 'dev';

/**
 * @type {import('@types/aws-lambda').Handler}
 */
exports.handler = async (event) => {
  console.log('[Amplitude Sync] Starting user data sync...');
  console.log(`[Amplitude Sync] Environment: ${ENV}`);
  console.log(`[Amplitude Sync] Table: ${USER_PROFILES_TABLE}`);
  console.log(`[Amplitude Sync] API Key present: ${AMPLITUDE_API_KEY ? 'Yes' : 'No'}`);
  console.log(`[Amplitude Sync] API Key (first 8 chars): ${AMPLITUDE_API_KEY ? AMPLITUDE_API_KEY.substring(0, 8) + '...' : 'MISSING'}`);
  console.log(`[Amplitude Sync] Expected API Key: 3279109a...`);
  
  // Validate required environment variables
  if (!USER_PROFILES_TABLE) {
    throw new Error('STORAGE_USERPROFILESSTORAGE_NAME environment variable is not set');
  }
  if (!AMPLITUDE_API_KEY) {
    throw new Error('AMPLITUDE_API_KEY environment variable is not set');
  }
  
  // Verify API key matches expected value
  if (AMPLITUDE_API_KEY !== '3279109aad9e03ba305c1621058551b1') {
    console.warn(`[Amplitude Sync] ⚠️ WARNING: API Key does not match expected value!`);
    console.warn(`[Amplitude Sync] Expected: 3279109aad9e03ba305c1621058551b1`);
    console.warn(`[Amplitude Sync] Actual: ${AMPLITUDE_API_KEY}`);
  }

  try {
    // Scan all users from DynamoDB
    const users = await scanAllUsers();
    console.log(`[Amplitude Sync] Scanned ${users.length} users from DynamoDB`);

    if (users.length === 0) {
      console.log('[Amplitude Sync] No users found to sync');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No users to sync',
          users_synced: 0
        })
      };
    }

    // Filter out users with invalid usernames (null, undefined, or too short for Amplitude)
    const validUsers = [];
    const invalidUsers = [];
    
    for (const user of users) {
      if (user.username && typeof user.username === 'string' && user.username.length >= 5) {
        validUsers.push(user);
      } else {
        invalidUsers.push({
          username: user.username || 'null',
          email: user.email || 'N/A'
        });
      }
    }
    
    if (invalidUsers.length > 0) {
      console.log(`[Amplitude Sync] ⚠️ Skipping ${invalidUsers.length} users with invalid usernames:`);
      invalidUsers.forEach(invalid => {
        console.log(`  - username: "${invalid.username}", email: ${invalid.email}`);
      });
    }
    
    if (validUsers.length === 0) {
      console.log('[Amplitude Sync] No valid users to sync');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No valid users to sync',
          users_synced: 0,
          users_skipped: invalidUsers.length
        })
      };
    }
    
    // Convert to Amplitude Identify events
    const amplitudeEvents = validUsers.map(user => mapUserToAmplitudeEvent(user));
    console.log(`[Amplitude Sync] Mapped ${amplitudeEvents.length} valid user events (skipped ${invalidUsers.length} invalid)`);

    // Send to Amplitude in batches of 100
    const batchSize = 100;
    let totalSent = 0;
    const batchCount = Math.ceil(amplitudeEvents.length / batchSize);

    for (let i = 0; i < amplitudeEvents.length; i += batchSize) {
      const batch = amplitudeEvents.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(`[Amplitude Sync] Sending batch ${batchNumber}/${batchCount} (${batch.length} users)`);
      
      // Log first event structure for debugging
      if (batchNumber === 1 && batch.length > 0) {
        console.log(`[Amplitude Sync] Sample event structure:`, JSON.stringify(batch[0], null, 2));
      }

      const response = await sendToAmplitude(batch);
      totalSent += batch.length;

      console.log(`[Amplitude Sync] Batch ${batchNumber} response:`, JSON.stringify(response, null, 2));
    }

    console.log(`[Amplitude Sync] ✅ Sync completed successfully: ${totalSent} users synced`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Sync completed successfully',
        users_synced: totalSent,
        users_skipped: invalidUsers.length,
        batches_sent: batchCount,
        environment: ENV,
        table: USER_PROFILES_TABLE
      })
    };

  } catch (error) {
    console.error('[Amplitude Sync] ❌ Error:', error);
    throw error;
  }
};

/**
 * Scan all users from DynamoDB (handles pagination)
 */
async function scanAllUsers() {
  const users = [];
  let lastEvaluatedKey = null;
  let pageCount = 0;

  do {
    pageCount++;
    console.log(`[Amplitude Sync] Scanning page ${pageCount}...`);
    
    // Build scan params - only include ExclusiveStartKey if we have one
    const scanParams = {
      TableName: USER_PROFILES_TABLE
    };
    
    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const response = await docClient.send(new ScanCommand(scanParams));

    // Safely handle Items array
    const items = response.Items || [];
    console.log(`[Amplitude Sync] Page ${pageCount} returned ${items.length} items`);

    // Filter out anonymous AppsFlyer attribution records (AF_*)
    const realUsers = items.filter(user => {
      return user && user.username && !user.username.startsWith('AF_');
    });

    users.push(...realUsers);
    lastEvaluatedKey = response.LastEvaluatedKey || null;

  } while (lastEvaluatedKey);

  return users;
}

/**
 * Map DynamoDB user to Amplitude Identify event format
 */
function mapUserToAmplitudeEvent(user) {
  return {
    user_id: user.username,
    event_type: '$identify',
    time: Date.now(), // Required: timestamp in milliseconds
    user_properties: {
      // Basic info
      email: user.email || null,
      name: user.fullName || null,
      age: user.age || null,
      gender: user.gender || null,
      app_version: user.appVersion || null,

      // Trip metrics
      owned_trips_count: user.ownedTripsCount || 0,
      total_activities: user.totalActivitiesOwned || 0,
      avg_activities_per_trip: user.avgActivitiesPerTrip || 0,
      avg_collaborators_per_trip: user.avgCollaboratorsPerTrip || 0,
      avg_trip_duration: user.avgTripDuration || 0,
      total_trip_duration: user.totalTripDuration || 0,

      // Trip status
      trips_completed: user.totalTripsCompleted || 0,
      trips_in_progress: user.totalTripsInProgress || 0,
      trips_upcoming: user.totalTripsUpcoming || 0,

      // Social
      followers_count: user.followersCount || 0,
      following_count: user.followingCount || 0,

      // Attribution (AppsFlyer)
      attribution_source: user.attributionSource || 'unknown',
      attribution_campaign: user.attributionCampaign || null,
      attribution_campaign_id: user.attributionCampaignId || null,
      attribution_install_date: user.attributionInstallDate || null,
      attribution_device_id: user.attributionDeviceId || null,
      attribution_status: user.attributionStatus || null,

      // Timestamps
      account_created_at: user.accountCreatedAt || null,
      last_active_at: user.lastActiveAt || null,

      // Environment
      environment: ENV
    }
  };
}

/**
 * Send events to Amplitude HTTP Batch API
 */
async function sendToAmplitude(events) {
  const payload = JSON.stringify({
    api_key: AMPLITUDE_API_KEY,
    events: events
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: AMPLITUDE_BATCH_ENDPOINT,
      path: AMPLITUDE_BATCH_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);

          if (res.statusCode === 200) {
            resolve(parsedData);
          } else {
            console.error('[Amplitude Sync] API error:', res.statusCode, data);
            reject(new Error(`Amplitude API error: ${res.statusCode} - ${data}`));
          }
        } catch (parseError) {
          console.error('[Amplitude Sync] Response parse error:', parseError);
          reject(new Error(`Failed to parse Amplitude response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('[Amplitude Sync] Request error:', error);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}
