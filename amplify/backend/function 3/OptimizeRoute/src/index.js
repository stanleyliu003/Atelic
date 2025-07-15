/* Amplify Params - DO NOT EDIT
	API_WISHLISTAPI_GRAPHQLAPIENDPOINTOUTPUT
	API_WISHLISTAPI_GRAPHQLAPIIDOUTPUT
	API_WISHLISTAPI_GRAPHQLAPIKEYOUTPUT
	API_WISHLISTAPI_WISHLISTANALYSISTABLE_ARN
	API_WISHLISTAPI_WISHLISTANALYSISTABLE_NAME
	ENV
	REGION
Amplify Params - DO NOT EDIT */

const https = require('https');

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */

// Helper to call Google Routes API computeRouteMatrix
async function callComputeRouteMatrix(locations, apiKey) {
  const requestBody = {
    origins: locations.map(loc => ({
      waypoint: { location: { latLng: { latitude: loc.lat, longitude: loc.lng } } }
    })),
    destinations: locations.map(loc => ({
      waypoint: { location: { latLng: { latitude: loc.lat, longitude: loc.lng } } }
    })),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
  };

  const postData = JSON.stringify(requestBody);
  const options = {
    hostname: 'routes.googleapis.com',
    path: '/distanceMatrix/v2:computeRouteMatrix',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'X-Goog-Api-Key': apiKey, //X-Google Field Mask
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,condition' // Add this line
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error('Google API returned status', res.statusCode, data);
          reject(new Error(`Google API error: ${res.statusCode}`));
          return;
        }
        try {
          console.log('Google API raw response:', data);
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          console.error('Error parsing Google API response:', e, data);
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Nearest Neighbor TSP algorithm
function nearestNeighborOrder(matrix) {
  const n = matrix.length;
  const visited = Array(n).fill(false);
  const order = [0];
  visited[0] = true;
  for (let step = 1; step < n; step++) {
    const last = order[order.length - 1];
    let minDist = Infinity;
    let nextIdx = -1;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && matrix[last][j] != null && matrix[last][j] < minDist) {
        minDist = matrix[last][j];
        nextIdx = j;
      }
    }
    if (nextIdx === -1) break; // No unvisited nodes
    order.push(nextIdx);
    visited[nextIdx] = true;
  }
  return order;
}

exports.handler = async (event) => {
  try {
    const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
    let activities = event.arguments?.activities || event.activities || [];
    if (!Array.isArray(activities) || activities.length < 2) {
      return { error: 'At least 2 activities required.' };
    }
    // Call Google computeRouteMatrix
    const matrixResponse = await callComputeRouteMatrix(activities, apiKey);
    if (!Array.isArray(matrixResponse)) {
      return { error: 'Invalid response from Google computeRouteMatrix.' };
    }
    // Build duration matrix (seconds)
    const n = activities.length;
    const durationMatrix = Array.from({ length: n }, () => Array(n).fill(null));
    for (const row of matrixResponse) {
      if (row.condition === 'ROUTE_EXISTS') {
        const i = row.originIndex;
        const j = row.destinationIndex;
        // Parse duration string (e.g., '160s')
        const seconds = parseInt(row.duration.replace('s', ''));
        durationMatrix[i][j] = seconds;
      }
    }
    // Compute optimized order
    const order = nearestNeighborOrder(durationMatrix);
    // Reorder activities
    const reordered = order.map(idx => activities[idx]);
    return reordered;
  } catch (err) {
    console.error('RouteOptimization error:', err);
    return { error: 'Internal error', message: err.message };
  }
};
