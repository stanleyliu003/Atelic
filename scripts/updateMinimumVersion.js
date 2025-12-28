/**
 * Update minimum version requirement in DynamoDB
 * Use this to enforce new version requirements without app release
 *
 * Usage:
 *   node scripts/updateMinimumVersion.js [platform] [version] [environment] [table-name]
 *
 * Examples:
 *   node scripts/updateMinimumVersion.js ios 1.0.5 prod AppVersions-prod
 *   node scripts/updateMinimumVersion.js android 1.0.5 prod AppVersions-prod
 *   node scripts/updateMinimumVersion.js ios 1.0.4 staging AppVersions-staging
 */

const AWS = require('aws-sdk');

// Parse command line arguments
const platform = process.argv[2];
const version = process.argv[3];
const environment = process.argv[4] || 'prod';
const tableName = process.argv[5] || `AppVersions-${environment}`;

// Configure AWS region and credentials
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: new AWS.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE || 'default' })
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function updateMinimumVersion() {
  // Validate inputs
  if (!platform || !version) {
    console.error('Missing required arguments\n');
    console.log('Usage: node scripts/updateMinimumVersion.js [platform] [version] [environment] [table-name]\n');
    process.exit(1);
  }

  if (!['ios', 'android'].includes(platform)) {
    console.error(`Invalid platform: ${platform}`);
    console.log('Valid platforms: ios, android');
    process.exit(1);
  }

  if (!['dev', 'staging', 'prod'].includes(environment)) {
    console.error(`Invalid environment: ${environment}`);
    console.log('Valid environments: dev, staging, prod');
    process.exit(1);
  }

  console.log(`\nUpdating minimum version requirement...`);
  console.log(`Table: ${tableName}`);
  console.log(`Platform: ${platform.toUpperCase()}`);
  console.log(`New Minimum Version: ${version}`);
  console.log(`Environment: ${environment}\n`);

  try {
    const item = {
      id: 'VERSION_CONFIG',
      platform,
      minimumVersion: version,
      environment,
      lastUpdated: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: tableName,
      Item: item
    }).promise();

    console.log('✅ Successfully updated minimum version!\n');
    console.log('📋 Updated Record:');
    console.log(`   Platform: ${platform}`);
    console.log(`   Minimum Version: ${version}`);
    console.log(`   Environment: ${environment}`);
    console.log(`   Last Updated: ${item.lastUpdated}\n`);

    console.log('⚠️  Important:');
    console.log(`   All users on ${platform.toUpperCase()} with version < ${version} will be`);
    console.log('   prompted to update on their next app launch.\n');

  } catch (error) {
    console.error('❌ Error updating version config:', error.message);
    console.log('\nTroubleshooting:');
    console.log('- Ensure AWS credentials are configured (aws configure)');
    console.log('- Verify the table exists in DynamoDB');
    console.log('- Check you have write permissions to the table');
    process.exit(1);
  }
}

updateMinimumVersion();
