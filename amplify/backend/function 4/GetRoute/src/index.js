/* Amplify Params - DO NOT EDIT
	API_WISHLISTAPI_GRAPHQLAPIENDPOINTOUTPUT
	API_WISHLISTAPI_GRAPHQLAPIIDOUTPUT
	API_WISHLISTAPI_GRAPHQLAPIKEYOUTPUT
	API_WISHLISTAPI_WISHLISTANALYSISTABLE_ARN
	API_WISHLISTAPI_WISHLISTANALYSISTABLE_NAME
	ENV
	FUNCTION_GETLOCATIONCOORDINATES_NAME
	FUNCTION_WISHLISTANALYZER_NAME
	REGION
Amplify Params - DO NOT EDIT */

const https = require('https');

const apiKey = process.env.GOOGLE_PLACES_API_KEY;

// Helper function to make HTTPS requests
const makeRequest = (url) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    console.error('Error parsing JSON response:', e);
                    reject(e);
                }
            });
        });
        req.on('error', (err) => {
            console.error('HTTPS request error:', err);
            reject(err);
        });
    });
};

// Function to get route between multiple points using Google Routes API
const getRoute = async (waypoints) => {
    if (!apiKey) {
        throw new Error('GOOGLE_PLACES_API_KEY environment variable not set');
    }

    if (!waypoints || waypoints.length < 2) {
        throw new Error('At least 2 waypoints are required');
    }

    // Format waypoints for the API
    const waypointParams = waypoints.map(point => `${point.lat},${point.lng}`).join('|');
    
    // Build the URL for Google Routes API
    const url = `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`;
    
    // Prepare the request body
    const requestBody = {
        origin: {
            location: {
                latLng: {
                    latitude: waypoints[0].lat,
                    longitude: waypoints[0].lng
                }
            }
        },
        destination: {
            location: {
                latLng: {
                    latitude: waypoints[waypoints.length - 1].lat,
                    longitude: waypoints[waypoints.length - 1].lng
                }
            }
        },
        intermediates: waypoints.slice(1, -1).map(point => ({
            location: {
                latLng: {
                    latitude: point.lat,
                    longitude: point.lng
                }
            }
        })),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        routeModifiers: {
            avoidTolls: false,
            avoidHighways: false
        },
        languageCode: "en-US",
        units: "METRIC"
    };

    // Make the request using POST method
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(requestBody);
        
        const options = {
            hostname: 'routes.googleapis.com',
            path: `/directions/v2:computeRoutes?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.error) {
                        console.error('Google Routes API error:', result.error);
                        reject(new Error(result.error.message || 'Route calculation failed'));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    console.error('Error parsing routes response:', e);
                    reject(e);
                }
            });
        });

        req.on('error', (err) => {
            console.error('HTTPS request error:', err);
            reject(err);
        });

        req.write(postData);
        req.end();
    });
};

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log('EVENT:', JSON.stringify(event));
    
    try {
        if (!apiKey) {
            return {
                statusCode: 500,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*"
                },
                body: JSON.stringify({ error: 'API Key is not configured.' })
            };
        }

        // Parse the input from the event
        let waypoints;
        if (event.body) {
            const body = JSON.parse(event.body);
            waypoints = body.waypoints;
        } else if (event.arguments && event.arguments.waypoints) {
            waypoints = event.arguments.waypoints;
        } else {
            waypoints = event.waypoints;
        }

        console.log('WAYPOINTS:', JSON.stringify(waypoints));

        if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
            const errorObj = { error: 'At least 2 waypoints are required. Each waypoint should have lat and lng properties.' };
            if (event.arguments && event.arguments.waypoints) {
                return errorObj;
            } else {
                return {
                    statusCode: 400,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Headers": "*"
                    },
                    body: JSON.stringify(errorObj)
                };
            }
        }

        // Validate waypoints format
        for (let i = 0; i < waypoints.length; i++) {
            const point = waypoints[i];
            if (typeof point.lat !== 'number' || typeof point.lng !== 'number') {
                const errorObj = { error: `Invalid waypoint at index ${i}. Each waypoint must have numeric lat and lng properties.` };
                if (event.arguments && event.arguments.waypoints) {
                    return errorObj;
                } else {
                    return {
                        statusCode: 400,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Headers": "*"
                        },
                        body: JSON.stringify(errorObj)
                    };
                }
            }
        }

        // Get the route
        const routeData = await getRoute(waypoints);
        console.log('GOOGLE ROUTES API RESPONSE:', JSON.stringify(routeData));
        
        // Extract the relevant information
        const routes = routeData.routes || [];
        if (routes.length === 0) {
            const errorObj = { error: 'No route found for the given waypoints.' };
            if (event.arguments && event.arguments.waypoints) {
                return errorObj;
            } else {
                return {
                    statusCode: 404,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Headers": "*"
                    },
                    body: JSON.stringify(errorObj)
                };
            }
        }

        const route = routes[0];
        const result = {
            polyline: route.polyline?.encodedPolyline || '',
            totalDistance: route.distanceMeters || 0,
            totalDuration: route.duration || '',
            legs: route.legs?.map(leg => ({
                distance: leg.distanceMeters || 0,
                duration: leg.duration || '',
                polyline: leg.polyline?.encodedPolyline || ''
            })) || []
        };

        if (event.arguments && event.arguments.waypoints) {
            // Called from AppSync/GraphQL
            return result;
        } else {
            // Called from API Gateway or direct Lambda test
            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*"
                },
                body: JSON.stringify(result)
            };
        }

    } catch (error) {
        console.error('Error in GetRoute Lambda:', error);
        const errorObj = { error: 'Internal server error', message: error.message };
        if (event.arguments && event.arguments.waypoints) {
            return errorObj;
        } else {
            return {
                statusCode: 500,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*"
                },
                body: JSON.stringify(errorObj)
            };
        }
    }
};
