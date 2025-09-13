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

// Function to get route between multiple points using Google Routes API with fallback travel modes
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
    
    // Try different travel modes in order: DRIVE -> WALK -> TRANSIT
    const travelModes = ['DRIVE', 'WALK', 'TRANSIT'];
    let lastError = null;
    
    for (const travelMode of travelModes) {
        try {
            console.log(`Attempting route calculation with travel mode: ${travelMode}`);
            
            // Prepare the request body for current travel mode
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
                travelMode: travelMode,
                routingPreference: travelMode === 'DRIVE' ? "TRAFFIC_AWARE" : undefined,
                computeAlternativeRoutes: false,
                routeModifiers: travelMode === 'DRIVE' ? {
                    avoidTolls: false,
                    avoidHighways: false
                } : undefined,
                languageCode: "en-US",
                units: "METRIC"
            };

            // Remove undefined properties
            Object.keys(requestBody).forEach(key => {
                if (requestBody[key] === undefined) {
                    delete requestBody[key];
                }
            });

            const result = await makeRouteRequest(requestBody);
            
            // If we get a successful result with routes, return it
            if (result && result.routes && result.routes.length > 0) {
                console.log(`Successfully calculated route with travel mode: ${travelMode}`);
                return { ...result, usedTravelMode: travelMode };
            } else {
                console.log(`No routes found for travel mode: ${travelMode}`);
                
                // Special handling for TRANSIT with 3+ waypoints - try segment-based approach immediately
                if (travelMode === 'TRANSIT' && waypoints.length > 2) {
                    console.log('TRANSIT mode failed for multi-waypoint route, trying segment-based fallback');
                    try {
                        return await getSegmentBasedRoute(waypoints, travelMode);
                    } catch (segmentError) {
                        console.log('Segment-based TRANSIT routing failed:', segmentError.message);
                        lastError = segmentError;
                    }
                } else {
                    lastError = new Error(`No routes available for ${travelMode} mode`);
                }
            }
        } catch (error) {
            console.log(`Failed to get route with travel mode ${travelMode}:`, error.message);
            
            // Special handling for TRANSIT with 3+ waypoints when Google API explicitly rejects intermediate waypoints
            if (travelMode === 'TRANSIT' && waypoints.length > 2 && 
                (error.message.includes('Intermediate waypoints are not supported') || 
                 error.message.includes('intermediate waypoints'))) {
                console.log('TRANSIT mode rejected intermediate waypoints, trying segment-based fallback');
                try {
                    return await getSegmentBasedRoute(waypoints, travelMode);
                } catch (segmentError) {
                    console.log('Segment-based TRANSIT routing failed:', segmentError.message);
                    lastError = segmentError;
                }
            } else {
                lastError = error;
            }
            // Continue to next travel mode
        }
    }
    
    // If we get here, all travel modes failed
    throw new Error(`Route calculation failed for all travel modes. Last error: ${lastError?.message || 'Unknown error'}`);
};

// Function to calculate route using segment-based approach (point-to-point)
const getSegmentBasedRoute = async (waypoints, travelMode = 'TRANSIT') => {
    console.log(`Using segment-based routing fallback for multi-waypoint ${travelMode} route`);
    
    const segments = [];
    const routeLegs = [];
    let totalDistance = 0;
    let totalDurationSeconds = 0;
    const usedTravelModes = [];
    
    // Calculate route for each consecutive pair of waypoints
    for (let i = 0; i < waypoints.length - 1; i++) {
        const origin = waypoints[i];
        const destination = waypoints[i + 1];
        
        console.log(`Calculating segment ${i + 1}: ${origin.lat},${origin.lng} to ${destination.lat},${destination.lng} using ${travelMode}`);
        
        try {
            const requestBody = {
                origin: {
                    location: {
                        latLng: {
                            latitude: origin.lat,
                            longitude: origin.lng
                        }
                    }
                },
                destination: {
                    location: {
                        latLng: {
                            latitude: destination.lat,
                            longitude: destination.lng
                        }
                    }
                },
                travelMode: travelMode,
                routingPreference: travelMode === 'DRIVE' ? "TRAFFIC_AWARE" : undefined,
                computeAlternativeRoutes: false,
                routeModifiers: travelMode === 'DRIVE' ? {
                    avoidTolls: false,
                    avoidHighways: false
                } : undefined,
                languageCode: "en-US",
                units: "METRIC"
            };

            // Remove undefined properties
            Object.keys(requestBody).forEach(key => {
                if (requestBody[key] === undefined) {
                    delete requestBody[key];
                }
            });

            const segmentResult = await makeRouteRequest(requestBody);
            
            if (!segmentResult || !segmentResult.routes || segmentResult.routes.length === 0) {
                throw new Error(`No routes found for segment ${i + 1}`);
            }
            
            // Extract segment data
            const route = segmentResult.routes[0];
            segments.push({
                polyline: route.polyline?.encodedPolyline || '',
                distance: route.distanceMeters || 0,
                duration: route.duration || '',
                travelMode: travelMode
            });
            
            // Add to route legs
            if (route.legs && route.legs.length > 0) {
                const legData = {
                    distance: route.legs[0].distanceMeters || 0,
                    duration: route.legs[0].duration || '',
                    polyline: route.legs[0].polyline?.encodedPolyline || ''
                };
                console.log(`Adding route leg ${i + 1}: distance=${legData.distance}, duration=${legData.duration}`);
                routeLegs.push(legData);
            } else {
                console.log(`No legs found in segment ${i + 1} result`);
            }
            
            // Accumulate totals
            totalDistance += route.distanceMeters || 0;
            
            // Parse duration and add to total
            const durationSeconds = parseDurationToSeconds(route.duration);
            totalDurationSeconds += durationSeconds;
            
            usedTravelModes.push(travelMode);
        } catch (error) {
            console.log(`Failed to calculate route for segment ${i + 1}:`, error.message);
            throw new Error(`Failed to calculate route for segment ${i + 1}: ${error.message}`);
        }
    }
    
    // Properly combine segment polylines by decoding, merging coordinates, and re-encoding
    let combinedCoordinates = [];
    
    for (let i = 0; i < segments.length; i++) {
        const segmentCoordinates = decodePolyline(segments[i].polyline);
        
        if (i === 0) {
            // For the first segment, add all coordinates
            combinedCoordinates = [...segmentCoordinates];
        } else {
            // For subsequent segments, skip the first coordinate to avoid duplication
            // (the last coordinate of previous segment should be the same as first of current)
            combinedCoordinates = [...combinedCoordinates, ...segmentCoordinates.slice(1)];
        }
    }
    
    const combinedPolyline = encodePolyline(combinedCoordinates);
    console.log(`Combined ${segments.length} segments into polyline with ${combinedCoordinates.length} coordinates`);
    console.log(`Route legs summary: ${routeLegs.length} legs with distances: [${routeLegs.map(leg => leg.distance).join(', ')}]`);
    console.log(`Final legs array:`, JSON.stringify(routeLegs, null, 2));
    
    const finalResult = {
        routes: [{
            polyline: { encodedPolyline: combinedPolyline },
            distanceMeters: totalDistance,
            duration: formatSecondsToGoogleDuration(totalDurationSeconds),
            legs: routeLegs
        }],
        usedTravelMode: travelMode,
        isSegmentBased: true,
        segmentDetails: segments
    };
    
    console.log(`Final result structure:`, JSON.stringify({
        routesCount: finalResult.routes.length,
        legsCount: finalResult.routes[0].legs.length,
        legDistances: finalResult.routes[0].legs.map(leg => leg.distance),
        usedTravelMode: finalResult.usedTravelMode
    }, null, 2));
    
    return finalResult;
};

// Helper function to parse Google duration format to seconds
const parseDurationToSeconds = (duration) => {
    if (!duration) return 0;
    // Google duration format is like "PT15M30S" or just "900s"
    if (duration.includes('PT')) {
        // Parse ISO 8601 duration format
        const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
        if (matches) {
            const hours = parseInt(matches[1] || 0);
            const minutes = parseInt(matches[2] || 0);
            const seconds = parseFloat(matches[3] || 0);
            return hours * 3600 + minutes * 60 + seconds;
        }
    } else if (duration.endsWith('s')) {
        return parseFloat(duration.replace('s', ''));
    }
    return 0;
};

// Helper function to format seconds back to Google duration format
const formatSecondsToGoogleDuration = (seconds) => {
    return `${seconds}s`;
};

// Helper function to decode a polyline string to coordinate array
const decodePolyline = (encoded) => {
    if (!encoded) return [];
    
    const coordinates = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        // Decode latitude
        let shift = 0;
        let result = 0;
        let byte;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lat += deltaLat;

        // Decode longitude
        shift = 0;
        result = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lng += deltaLng;

        coordinates.push({
            latitude: lat / 1E5,
            longitude: lng / 1E5
        });
    }

    return coordinates;
};

// Helper function to encode coordinates array to polyline string
const encodePolyline = (coordinates) => {
    if (!coordinates || coordinates.length === 0) return '';

    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const coord of coordinates) {
        const lat = Math.round(coord.latitude * 1E5);
        const lng = Math.round(coord.longitude * 1E5);

        const deltaLat = lat - prevLat;
        const deltaLng = lng - prevLng;

        prevLat = lat;
        prevLng = lng;

        encoded += encodeSignedNumber(deltaLat);
        encoded += encodeSignedNumber(deltaLng);
    }

    return encoded;
};

// Helper function to encode a signed number for polyline
const encodeSignedNumber = (num) => {
    const sgnNum = num << 1;
    const unsignedNum = sgnNum < 0 ? ~sgnNum : sgnNum;
    return encodeUnsignedNumber(unsignedNum);
};

// Helper function to encode an unsigned number for polyline
const encodeUnsignedNumber = (num) => {
    let encoded = '';
    while (num >= 0x20) {
        encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
        num >>= 5;
    }
    encoded += String.fromCharCode(num + 63);
    return encoded;
};


// Helper function to make the actual route request
const makeRouteRequest = async (requestBody) => {
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
        // Check if this is a segment-based route (our custom format) or normal Google route
        const isSegmentBased = routeData.isSegmentBased || false;
        
        let processedLegs;
        if (isSegmentBased) {
            // For segment-based routes, legs are already in the correct format
            processedLegs = route.legs || [];
            console.log('Using segment-based legs (already formatted):', processedLegs.length);
        } else {
            // For normal Google routes, map from Google's format to our format
            processedLegs = route.legs?.map(leg => ({
                distance: leg.distanceMeters || 0,
                duration: leg.duration || '',
                polyline: leg.polyline?.encodedPolyline || ''
            })) || [];
            console.log('Mapped normal Google route legs:', processedLegs.length);
        }

        const result = {
            polyline: route.polyline?.encodedPolyline || '',
            totalDistance: route.distanceMeters || 0,
            totalDuration: route.duration || '',
            travelMode: routeData.usedTravelMode || 'DRIVE',
            legs: processedLegs
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
