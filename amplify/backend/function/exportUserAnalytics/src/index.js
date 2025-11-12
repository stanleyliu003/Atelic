/**
 * Lambda Function: Export User Analytics to S3
 * Scans UserProfiles DynamoDB table and exports selected fields to CSV in S3
 */

const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const s3Client = new S3Client({ region: 'us-east-1' });

const TABLE_NAME = 'UserProfiles-dev';
const S3_BUCKET = 'atelic-analytics';
const S3_KEY = 'user-profiles/user_analytics.csv';

// Fields to export (matching your Athena schema)
const FIELDS = [
  'age',
  'appVersion',
  'avgActivitiesPerTrip',
  'avgCollaboratorsPerTrip',
  'avgTripDuration',
  'followersCount',
  'followingCount',
  'gender',
  'ownedTripsCount',
  'totalActivitiesOwned',
  'totalCollaboratorsAcrossTrips',
  'totalTripDuration',
  'totalTripsCompleted',
  'totalTripsInProgress',
  'totalTripsUpcoming',
  'accountCreatedAt',
  'lastActiveAt'
];

/**
 * Main handler function
 */
exports.handler = async (event) => {
  console.log('Starting user analytics export...');

  try {
    // Scan DynamoDB table
    const users = await scanAllUsers();
    console.log(`Fetched ${users.length} users from DynamoDB`);

    // Convert to CSV
    const csv = convertToCSV(users);
    console.log(`Generated CSV with ${csv.split('\n').length - 1} rows`);

    // Upload to S3
    await uploadToS3(csv);
    console.log(`Successfully uploaded to s3://${S3_BUCKET}/${S3_KEY}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Export completed successfully',
        recordsExported: users.length,
        s3Location: `s3://${S3_BUCKET}/${S3_KEY}`
      })
    };

  } catch (error) {
    console.error('Error exporting analytics:', error);
    throw error;
  }
};

/**
 * Scan all users from DynamoDB (handles pagination)
 */
async function scanAllUsers() {
  const users = [];
  let lastEvaluatedKey = null;

  do {
    const params = {
      TableName: TABLE_NAME,
      ExclusiveStartKey: lastEvaluatedKey
    };

    const response = await dynamoClient.send(new ScanCommand(params));

    // Unmarshall DynamoDB items to plain JavaScript objects
    const items = response.Items.map(item => unmarshall(item));
    users.push(...items);

    lastEvaluatedKey = response.LastEvaluatedKey;

  } while (lastEvaluatedKey);

  return users;
}

/**
 * Convert user data to CSV format
 */
function convertToCSV(users) {
  // CSV Header
  const header = FIELDS.join(',');

  // CSV Rows
  const rows = users.map(user => {
    return FIELDS.map(field => {
      const value = user[field];

      // Handle different data types
      if (value === null || value === undefined) {
        return '';
      }

      if (typeof value === 'string') {
        // Escape commas and quotes in strings
        const escaped = value.replace(/"/g, '""');
        return `"${escaped}"`;
      }

      if (typeof value === 'number') {
        return value;
      }

      if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
      }

      // For timestamps, keep as-is
      return value;

    }).join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Upload CSV to S3
 */
async function uploadToS3(csvContent) {
  const params = {
    Bucket: S3_BUCKET,
    Key: S3_KEY,
    Body: csvContent,
    ContentType: 'text/csv',
    ServerSideEncryption: 'AES256'
  };

  await s3Client.send(new PutObjectCommand(params));
}
