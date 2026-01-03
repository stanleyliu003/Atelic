/**
 * Test script to diagnose TripOperation mutation issues in production
 * Run with: node scripts/test-tripoperation-mutation.js
 */

const https = require('https');

// Production GraphQL endpoint and API key from amplify status
const GRAPHQL_ENDPOINT = 'https://oeep6fv7ajd7njiggfs6475b2u.appsync-api.us-east-1.amazonaws.com/graphql';
const API_KEY = 'da2-r6srdoxttffrbdtsegrv5fm3sy';

const createTripOperationMutation = `
  mutation CreateTripOperation($input: CreateTripOperationInput!) {
    createTripOperation(input: $input) {
      id
      tripID
      timestamp
      opId
      userId
      sequenceNumber
      type
      target
      dayNumber
      operationData
      ttl
      createdAt
      updatedAt
    }
  }
`;

const testOperation = {
  tripID: 'test-trip-' + Date.now(),
  timestamp: Date.now(),
  opId: 'test-op-' + Date.now(),
  userId: 'test-user-123',
  sequenceNumber: 1,
  type: 'move',
  target: 'wishlist',
  dayNumber: null,
  operationData: JSON.stringify({
    type: 'move',
    target: 'wishlist',
    activityId: 'test-activity-123'
  }),
  ttl: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours from now
};

console.log('🔍 Testing TripOperation mutation in production...');
console.log('Test operation:', JSON.stringify(testOperation, null, 2));

const postData = JSON.stringify({
  query: createTripOperationMutation,
  variables: {
    input: testOperation
  }
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(GRAPHQL_ENDPOINT, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📊 Response Status:', res.statusCode);

    try {
      const response = JSON.parse(data);
      console.log('\n📋 Response Body:', JSON.stringify(response, null, 2));

      if (response.errors) {
        console.error('\n❌ GraphQL Errors:', response.errors);
      } else if (response.data?.createTripOperation) {
        console.log('\n✅ SUCCESS! Mutation worked!');
        console.log('Created operation ID:', response.data.createTripOperation.id);
        console.log('Trip ID:', response.data.createTripOperation.tripID);
        console.log('\n🎉 The resolver is now properly attached and working!');
        console.log('\n🔍 Next: Check DynamoDB table to verify data was written:');
        console.log('Table name: TripOperation-2n5twyhusfch5bo6tq5swz3azq-production');
        console.log('Item ID:', response.data.createTripOperation.id);
      } else if (response.data?.createTripOperation === null) {
        console.error('\n❌ STILL BROKEN: Mutation returned null');
        console.log('The resolver might not be properly attached yet.');
        console.log('Double-check that you clicked "Create" in the AppSync console.');
      }
    } catch (e) {
      console.error('Failed to parse response:', data);
      console.error('Parse error:', e);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
});

req.write(postData);
req.end();
