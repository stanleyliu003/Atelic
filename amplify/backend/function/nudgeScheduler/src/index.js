/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_TRIPSTORAGE_NAME
	STORAGE_TRIPSTORAGE_ARN
	FUNCTION_SENDPUSHNOTIFICATION_NAME
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const lambdaClient = new LambdaClient();

const USER_PROFILES_TABLE = process.env.STORAGE_USERPROFILESSTORAGE_NAME;
const TRIP_STORAGE_TABLE = process.env.STORAGE_TRIPSTORAGE_NAME;
const SEND_PUSH_NOTIFICATION_FN = process.env.FUNCTION_SENDPUSHNOTIFICATION_NAME;

const MAX_NUDGES_PER_WEEK = 2;
const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;
const MS_48_HOURS = 48 * 60 * 60 * 1000;
const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const MIN_EMPTY_DAYS_FOR_NUDGE = 2;

/**
 * Scheduled Lambda (EventBridge daily trigger) that evaluates nudge conditions
 * for all opted-in users and sends push notifications.
 *
 * Nudge types implemented:
 *  1. Open Day Warning  – trip <30 days away, 2+ empty days, inactive 48h
 *  2. Planning Drift    – trip >30 days away, inactive 7+ days
 *
 * Rate limit: max 2 nudges per user per 7-day rolling window.
 */
exports.handler = async (event) => {
  console.log('nudgeScheduler triggered:', JSON.stringify(event));

  const now = new Date();
  let lastEvaluatedKey;
  let totalProcessed = 0;
  let totalNudgesSent = 0;

  do {
    const scanResult = await docClient.send(new ScanCommand({
      TableName: USER_PROFILES_TABLE,
      FilterExpression: 'notificationsEnabled = :enabled AND accountStatus = :active',
      ExpressionAttributeValues: {
        ':enabled': true,
        ':active': 'active'
      },
      // Only fetch fields needed for nudge evaluation
      ProjectionExpression: 'username, userID, lastActiveAt, nextTripDate, ownedTrips, sharedTrips, nudgeSentDates',
      ExclusiveStartKey: lastEvaluatedKey
    }));

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
    const users = scanResult.Items || [];

    for (const user of users) {
      try {
        const nudgeSent = await processUserNudge(user, now);
        if (nudgeSent) totalNudgesSent++;
        totalProcessed++;
      } catch (err) {
        console.error(`Error processing nudge for ${user.username}:`, err);
      }
    }
  } while (lastEvaluatedKey);

  console.log(`nudgeScheduler complete: processed=${totalProcessed}, sent=${totalNudgesSent}`);
  return { processed: totalProcessed, nudgesSent: totalNudgesSent };
};

/**
 * Evaluate and optionally send a nudge for one user.
 * Returns true if a nudge was sent.
 */
async function processUserNudge(user, now) {
  if (!user.username || !user.userID) return false;

  // Rolling 7-day rate limit: max 2 nudges per week
  const sevenDaysAgo = new Date(now - MS_7_DAYS);
  const recentNudges = (user.nudgeSentDates || [])
    .filter(d => new Date(d) > sevenDaysAgo);

  if (recentNudges.length >= MAX_NUDGES_PER_WEEK) {
    return false;
  }

  // Priority 1: Open Day Warning (trip is imminent)
  const openDayNudge = await checkOpenDayWarning(user, now);
  if (openDayNudge) {
    await sendNudge(user, openDayNudge, recentNudges, now.toISOString());
    return true;
  }

  // Priority 2: Planning Drift (trip is far out, user has gone quiet)
  const driftNudge = checkPlanningDrift(user, now);
  if (driftNudge) {
    await sendNudge(user, driftNudge, recentNudges, now.toISOString());
    return true;
  }

  return false;
}

/**
 * Open Day Warning:
 *   - User inactive 48+ hours
 *   - Has an owned trip starting within the next 30 days
 *   - That trip has 2+ days with no activities
 */
async function checkOpenDayWarning(user, now) {
  if (!user.lastActiveAt) return null;

  const lastActive = new Date(user.lastActiveAt);
  if (now - lastActive < MS_48_HOURS) return null;

  const thirtyDaysFromNow = new Date(now.getTime() + MS_30_DAYS);

  // Filter owned trips that start within the next 30 days
  const upcomingTrips = (user.ownedTrips || []).filter(trip => {
    if (!trip.startDate || !trip.tripId) return false;
    const start = new Date(trip.startDate);
    return start > now && start <= thirtyDaysFromNow;
  });

  if (upcomingTrips.length === 0) return null;

  for (const tripSummary of upcomingTrips) {
    const tripData = await getTripFromStorage(user.userID, tripSummary.tripId);
    if (!tripData || !Array.isArray(tripData.days) || tripData.days.length === 0) continue;

    const emptyDays = tripData.days.filter(
      day => !day.activities || day.activities.length === 0
    );

    if (emptyDays.length >= MIN_EMPTY_DAYS_FOR_NUDGE) {
      const city = tripSummary.selectedCity || 'your trip';
      return {
        type: 'open_day_warning',
        title: `${city} trip needs attention`,
        body: `You still have ${emptyDays.length} open days in ${city}. Need a recommendation to fill the gap?`,
        data: {
          type: 'open_day_warning',
          tripId: tripSummary.tripId,
          selectedCity: city
        }
      };
    }
  }

  return null;
}

/**
 * Planning Drift (Reactivation):
 *   - User inactive 7+ days
 *   - Next upcoming trip is more than 30 days away
 */
function checkPlanningDrift(user, now) {
  if (!user.lastActiveAt) return null;

  const lastActive = new Date(user.lastActiveAt);
  if (now - lastActive < MS_7_DAYS) return null;

  if (!user.nextTripDate) return null;
  const nextTrip = new Date(user.nextTripDate);
  if (nextTrip - now <= MS_30_DAYS) return null;

  // Find the trip entry to get the city name
  const allTrips = [
    ...(user.ownedTrips || []),
    ...(user.sharedTrips || [])
  ];
  const nextTripEntry = allTrips.find(t => t.startDate === user.nextTripDate);
  const destination = nextTripEntry?.selectedCity || 'your trip';

  return {
    type: 'planning_drift',
    title: `Your ${destination} plans are waiting.`,
    body: 'A few tweaks now means confident travel later. Pick up where you left off.',
    data: {
      type: 'planning_drift',
      selectedCity: destination,
      tripId: nextTripEntry?.tripId
    }
  };
}

/**
 * Fetch trip from TripStorage (projection: days only).
 */
async function getTripFromStorage(userID, tripId) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TRIP_STORAGE_TABLE,
      Key: { userID, tripID: tripId },
      ProjectionExpression: 'days'
    }));
    return result.Item;
  } catch (err) {
    console.error(`Error fetching trip ${tripId} for user ${userID}:`, err);
    return null;
  }
}

/**
 * Invoke sendPushNotification Lambda and record the send timestamp.
 */
async function sendNudge(user, nudge, recentNudgeDates, nowISO) {
  const payload = {
    arguments: {
      username: user.username,
      title: nudge.title,
      body: nudge.body,
      data: nudge.data
    }
  };

  const invokeResult = await lambdaClient.send(new InvokeCommand({
    FunctionName: SEND_PUSH_NOTIFICATION_FN,
    InvocationType: 'RequestResponse',
    Payload: Buffer.from(JSON.stringify(payload))
  }));

  const responsePayload = JSON.parse(Buffer.from(invokeResult.Payload).toString());
  console.log(`sendPushNotification result for ${user.username}:`, JSON.stringify(responsePayload));

  // Update nudgeSentDates — keep rolling 7-day window + new entry
  const updatedDates = [...recentNudgeDates, nowISO];
  await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { username: user.username },
    UpdateExpression: 'SET nudgeSentDates = :dates',
    ExpressionAttributeValues: {
      ':dates': updatedDates
    }
  }));

  console.log(`Nudge sent to ${user.username} [${nudge.type}]: "${nudge.title}"`);
}
