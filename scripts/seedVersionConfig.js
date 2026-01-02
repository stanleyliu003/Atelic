/**
 * Seed DynamoDB with minimum version requirements
 * Run this script after deploying the AppVersions table
 *
 * Usage:
 *   node scripts/seedVersionConfig.js [environment] [table-name]
 *
 * Examples:
 *   node scripts/seedVersionConfig.js dev AppVersions-dev
 *   node scripts/seedVersionConfig.js prod AppVersions-prod
 */

const AWS = require('aws-sdk');

// Get environment and table name from command line args or use defaults
const targetEnv = process.argv[2] || 'dev';
const tableName = process.argv[3] || `AppVersions-${targetEnv}`;

// Configure AWS region and credentials
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: new AWS.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE || 'default' })
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * Version configurations for each environment
 * Update these values to change minimum version requirements
 */
const VERSION_CONFIGS = {
  dev: {
    ios: '1.0.0',      // No restrictions in dev
    android: '1.0.0'
  },
  staging: {
    ios: '1.0.4',      // Test update flow in staging
    android: '1.0.4'
  },
  prod: {
    ios: '1.0.4',      // Production enforcement
    android: '1.0.4'
  }
};

async function seedVersionConfig() {
  console.log(`\n🚀 Seeding version config for environment: ${targetEnv}`);
  console.log(`📊 Table name: ${tableName}\n`);

  if (!VERSION_CONFIGS[targetEnv]) {
    console.error(`❌ Invalid environment: ${targetEnv}`);
    console.log('Valid environments: dev, staging, prod');
    process.exit(1);
  }

  const config = VERSION_CONFIGS[targetEnv];
  const items = [
    {
      id: 'VERSION_CONFIG',
      platform: 'ios',
      minimumVersion: config.ios,
      environment: targetEnv,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 'VERSION_CONFIG',
      platform: 'android',
      minimumVersion: config.android,
      environment: targetEnv,
      lastUpdated: new Date().toISOString()
    }
  ];

  try {
    for (const item of items) {
      await dynamodb.put({
        TableName: tableName,
        Item: item
      }).promise();

      console.log(`✅ Added ${item.platform.toUpperCase()} config:`);
      console.log(`   Minimum Version: ${item.minimumVersion}`);
      console.log(`   Environment: ${item.environment}`);
      console.log(`   Last Updated: ${item.lastUpdated}\n`);
    }

    console.log('🎉 Successfully seeded version configuration!\n');
    console.log('Next steps:');
    console.log('1. Verify records in DynamoDB console');
    console.log('2. Deploy your backend: amplify push');
    console.log('3. Test version enforcement in your app\n');

  } catch (error) {
    console.error('❌ Error seeding version config:', error.message);
    console.log('\nTroubleshooting:');
    console.log('- Ensure AWS credentials are configured (aws configure)');
    console.log('- Verify the table exists in DynamoDB');
    console.log('- Check table name matches your Amplify environment');
    process.exit(1);
  }
}

seedVersionConfig();
