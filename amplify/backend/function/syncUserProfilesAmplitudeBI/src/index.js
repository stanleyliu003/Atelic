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
 * SCALABLE ARCHITECTURE:
 * This function uses a "Page-by-Page" processing pattern.
 * Instead of loading all users into memory (which causes crashes on large tables),
 * it scans one page of DynamoDB results, sends them to Amplitude, 
 * clears the memory, and then moves to the next page.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const https = require('https');

// Initialize without explicit region - Lambda uses its execution environment region
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;
const AMPLITUDE_API_KEY = process.env.AMPLITUDE_API_KEY;
// Use HTTP API v2 for real-time data visibility
const AMPLITUDE_BATCH_ENDPOINT = 'api2.amplitude.com';
const AMPLITUDE_BATCH_PATH = '/2/httpapi';
const ENV = process.env.ENV || 'dev';

/**
 * @type {import('@types/aws-lambda').Handler}
 */
exports.handler = async (event) => {
  console.log('[Amplitude Sync] Starting scalable user data sync...');
  console.log(`[Amplitude Sync] Environment: ${ENV}`);
  console.log(`[Amplitude Sync] Table: ${USER_PROFILES_TABLE}`);
  
  // Validate required environment variables
  if (!USER_PROFILES_TABLE) {
    throw new Error('STORAGE_USERPROFILESSTORAGE_NAME environment variable is not set');
  }
  if (!AMPLITUDE_API_KEY) {
    throw new Error('AMPLITUDE_API_KEY environment variable is not set');
  }

  // Statistics trackers
  let totalUsersScanned = 0;
  let totalUsersSynced = 0;
  let totalEventsSent = 0;
  let totalInvalidUsers = 0;
  let pageCount = 0;
  
  // Pagination key for DynamoDB
  let lastEvaluatedKey = null;

  try {
    // LOOP: Process DynamoDB pages one by one
    do {
      pageCount++;
      
      // 1. Scan a single page of users (approx 1MB of data)
      const scanParams = {
        TableName: USER_PROFILES_TABLE,
        Limit: 200 // explicit limit to control memory chunk size
      };
      
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      console.log(`[Amplitude Sync] Scanning page ${pageCount}...`);
      const response = await docClient.send(new ScanCommand(scanParams));
      const items = response.Items || [];
      
      totalUsersScanned += items.length;
      console.log(`[Amplitude Sync] Page ${pageCount} fetched ${items.length} items`);

      // 2. Process this page immediately
      if (items.length > 0) {
        const { events, validUserCount, invalidCount } = processUserBatch(items);
        
        totalUsersSynced += validUserCount;
        totalInvalidUsers += invalidCount;

        // 3. Send events from this page to Amplitude
        if (events.length > 0) {
          await sendBatchToAmplitude(events);
          totalEventsSent += events.length;
        }
      }

      // 4. Update cursor for next loop
      lastEvaluatedKey = response.LastEvaluatedKey;
      
      // Optional: Safety check for Lambda timeout
      // if (context.getRemainingTimeInMillis() < 10000) { ... }

    } while (lastEvaluatedKey);

    // END LOOP

    console.log(`[Amplitude Sync] ✅ Sync completed successfully!`);
    console.log(`[Amplitude Sync] Summary:`);
    console.log(`- Total Scanned: ${totalUsersScanned}`);
    console.log(`- Valid Users:   ${totalUsersSynced}`);
    console.log(`- Invalid/Skip:  ${totalInvalidUsers}`);
    console.log(`- Events Sent:   ${totalEventsSent}`);
    console.log(`- Pages:         ${pageCount}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Sync completed successfully',
        stats: {
          scanned: totalUsersScanned,
          synced: totalUsersSynced,
          events: totalEventsSent,
          skipped: totalInvalidUsers,
          pages: pageCount
        }
      })
    };

  } catch (error) {
    console.error('[Amplitude Sync] ❌ Error:', error);
    throw error;
  }
};

/**
 * Process a batch of raw DynamoDB items into Amplitude events
 */
function processUserBatch(items) {
  const events = [];
  let validUserCount = 0;
  let invalidCount = 0;

  for (const user of items) {
    // Filter logic
    if (user && user.username && typeof user.username === 'string' && user.username.length >= 2 && !user.username.startsWith('AF_')) {
      // Map to events
      const userEvents = mapUserToAmplitudeEvent(user);
      events.push(...userEvents);
      validUserCount++;
    } else {
      invalidCount++;
    }
  }

  return { events, validUserCount, invalidCount };
}

/**
 * Send events to Amplitude in sub-batches (API limit is usually 100-2000 events per req)
 */
async function sendBatchToAmplitude(allEvents) {
  const BATCH_SIZE = 50; // Conservative batch size for HTTP API
  
  for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
    const batch = allEvents.slice(i, i + BATCH_SIZE);
    
    // Log first event of the first batch for debugging
    if (i === 0) {
      // console.log(`[Amplitude Sync] Sample event:`, JSON.stringify(batch[0], null, 2));
    }

    await sendToAmplitudeApi(batch);
  }
}

/**
 * Map DynamoDB user to Amplitude events
 * Returns an array of events: [$identify, user_profile_synced]
 */
function mapUserToAmplitudeEvent(user) {
  const userProperties = {
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
  };

  // Event 1: Identify (Update User Properties)
  const identifyEvent = {
    user_id: user.username,
    event_type: '$identify',
    time: Date.now(),
    user_properties: userProperties
  };

  // Event 2: Visible Event for Event Stream
  const syncEvent = {
    user_id: user.username,
    event_type: 'user_profile_synced',
    time: Date.now(),
    event_properties: userProperties,
    user_properties: userProperties
  };

  return [identifyEvent, syncEvent];
}

/**
 * Low-level send to Amplitude HTTP API
 */
async function sendToAmplitudeApi(events) {
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
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          console.warn(`[Amplitude Sync] API Warning: ${res.statusCode}`, data);
          // Don't crash the whole sync for one bad batch, but log it
          resolve(data); 
        }
      });
    });

    req.on('error', (error) => {
      console.error('[Amplitude Sync] Network Request error:', error);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}