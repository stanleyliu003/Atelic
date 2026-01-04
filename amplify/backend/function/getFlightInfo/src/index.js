/* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT */

// Use production API for real flight data (test API has limited data)
const AMADEUS_AUTH_URL = 'https://api.amadeus.com/v1/security/oauth2/token';
const AMADEUS_API_BASE = 'https://api.amadeus.com/v2/schedule/flights';
const AMADEUS_API_KEY = process.env.Amadeus_API_Key;
const AMADEUS_API_SECRET = process.env.Amadeus_API_Secret_Key;

// Import airlines data for IATA to ICAO conversion
const airlines = require('./airlines.json');

// Token cache (Lambda container reuse)
let cachedToken = null;
let tokenExpiry = null;

/**
 * Get OAuth access token from Amadeus
 * Caches token until expiry
 */
async function getAmadeusAccessToken() {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    console.log('[getAmadeusAccessToken] Using cached token');
    return cachedToken;
  }

  console.log('[getAmadeusAccessToken] Fetching new token');

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: AMADEUS_API_KEY,
    client_secret: AMADEUS_API_SECRET
  });

  const response = await fetch(AMADEUS_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[getAmadeusAccessToken] Auth failed:', response.status, errorText);
    throw new Error(`Amadeus authentication failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;

  // Set expiry to 5 minutes before actual expiry for safety
  const expiresIn = (data.expires_in - 300) * 1000; // Convert to ms and subtract 5 min
  tokenExpiry = new Date(Date.now() + expiresIn);

  console.log('[getAmadeusAccessToken] New token acquired, expires in', data.expires_in, 'seconds');
  return cachedToken;
}

/**
 * Convert IATA airline code to ICAO code
 * Amadeus uses IATA codes, so we keep original but log for reference
 */
function getAirlineInfo(iataCode) {
  const airline = airlines.find(a => a.iata === iataCode && a.active === 'Y');
  return airline || { iata: iataCode, icao: null, name: `${iataCode} Airlines` };
}

/**
 * Parse flight identifier into carrier code and flight number
 * Supports formats: "AA100", "B6123", "DL477"
 * Prioritizes 2-char IATA codes (standard), falls back to 3-char if needed
 */
function parseFlightIdent(flightIdent) {
  const trimmed = flightIdent.trim().toUpperCase().replace(/[-\s]/g, '');

  // Try 2-character airline code first (standard IATA: AA, B6, DL, etc.)
  let match = trimmed.match(/^([A-Z0-9]{2})(\d+)$/);

  // If no match, try 3-character code (ICAO or extended: AAL, DAL, etc.)
  if (!match) {
    match = trimmed.match(/^([A-Z0-9]{3})(\d+)$/);
  }

  if (!match) {
    throw new Error(`Invalid flight number format: ${flightIdent}`);
  }

  return {
    carrierCode: match[1],
    flightNumber: match[2],
    original: trimmed
  };
}

/**
 * Format date to YYYY-MM-DD for Amadeus API
 */
function formatDateForAmadeus(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Transform Amadeus API response to app format
 */
function transformAmadeusResponse(amadeusData, carrierCode, flightNumber) {
  if (!amadeusData || !amadeusData.data || amadeusData.data.length === 0) {
    return null;
  }

  // Get the first flight from results
  const flight = amadeusData.data[0];
  const flightPoints = flight.flightPoints || [];
  const legs = flight.legs || [];

  // Find departure and arrival points
  const departure = flightPoints.find(p => p.departure) || {};
  const arrival = flightPoints.find(p => p.arrival) || {};

  // Get airline info
  const airlineInfo = getAirlineInfo(carrierCode);

  return {
    flightId: `${carrierCode}${flightNumber}`,
    flightNumber: `${carrierCode}${flightNumber}`,
    airline: {
      name: airlineInfo.name,
      iataCode: carrierCode,
      icaoCode: airlineInfo.icao || null
    },
    aircraft: {
      type: legs[0]?.aircraftEquipment?.aircraftType || null,
      registration: null // Amadeus Schedule API doesn't provide registration
    },
    origin: {
      code: departure.iataCode || null,
      name: null, // Not in schedule API response
      city: null,
      timezone: null,
      gate: departure.departure?.gate || null,
      terminal: departure.departure?.terminal?.code || null
    },
    destination: {
      code: arrival.iataCode || null,
      name: null,
      city: null,
      timezone: null,
      gate: arrival.arrival?.gate || null,
      terminal: arrival.arrival?.terminal?.code || null
    },
    schedule: {
      departureScheduled: departure.departure?.timings?.find(t => t.qualifier === 'STD')?.value || null,
      departureEstimated: departure.departure?.timings?.find(t => t.qualifier === 'ETD')?.value || null,
      departureActual: departure.departure?.timings?.find(t => t.qualifier === 'ATD')?.value || null,
      arrivalScheduled: arrival.arrival?.timings?.find(t => t.qualifier === 'STA')?.value || null,
      arrivalEstimated: arrival.arrival?.timings?.find(t => t.qualifier === 'ETA')?.value || null,
      arrivalActual: arrival.arrival?.timings?.find(t => t.qualifier === 'ATA')?.value || null
    },
    status: {
      text: legs[0]?.flightStatusCode || 'Scheduled',
      cancelled: legs[0]?.flightStatusCode === 'CNX',
      diverted: legs[0]?.flightStatusCode === 'DIV',
      progressPercent: null // Not available in Amadeus schedule API
    },
    delays: {
      departure: departure.departure?.timings?.find(t => t.qualifier === 'DLY')?.value || null,
      arrival: arrival.arrival?.timings?.find(t => t.qualifier === 'DLY')?.value || null
    }
  };
}

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  try {
    console.log(`[getFlightInfo] Event: ${JSON.stringify(event)}`);

    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { flightIdent, flightDate } = body;

    if (!flightIdent) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Flight number is required'
        })
      };
    }

    if (!flightDate) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Flight date is required'
        })
      };
    }

    // Parse flight identifier
    let parsedFlight;
    try {
      parsedFlight = parseFlightIdent(flightIdent);
    } catch (err) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: err.message
        })
      };
    }

    console.log(`[getFlightInfo] Parsed flight: ${parsedFlight.carrierCode}${parsedFlight.flightNumber} on ${flightDate}`);

    // Get Amadeus access token
    let accessToken;
    try {
      accessToken = await getAmadeusAccessToken();
    } catch (err) {
      console.error('[getFlightInfo] Authentication error:', err);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Failed to authenticate with flight data provider'
        })
      };
    }

    // Format date for Amadeus (YYYY-MM-DD)
    const scheduledDate = formatDateForAmadeus(flightDate);
    console.log(`[getFlightInfo] Formatted date: ${scheduledDate}`);

    // Build API URL with query parameters
    const queryParams = new URLSearchParams({
      carrierCode: parsedFlight.carrierCode,
      flightNumber: parsedFlight.flightNumber,
      scheduledDepartureDate: scheduledDate
    });

    const apiUrl = `${AMADEUS_API_BASE}?${queryParams.toString()}`;
    console.log(`[getFlightInfo] API URL: ${apiUrl}`);

    // Call Amadeus API
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      console.error(`[getFlightInfo] API error: ${response.status}`);

      // Try to get error details
      let errorDetails = '';
      try {
        const errorBody = await response.json();
        errorDetails = errorBody.errors?.[0]?.detail || errorBody.error_description || '';
        console.error(`[getFlightInfo] API error details:`, JSON.stringify(errorBody));
      } catch (e) {
        // Ignore parse errors
      }

      if (response.status === 404) {
        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: 'Flight not found for the specified date'
          })
        };
      }

      if (response.status === 400) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: errorDetails || 'Invalid flight request. Please check the flight number and date.'
          })
        };
      }

      throw new Error(`Amadeus API error: ${response.status}${errorDetails ? ` - ${errorDetails}` : ''}`);
    }

    const data = await response.json();
    console.log(`[getFlightInfo] API response:`, JSON.stringify(data));

    // Transform response to app format
    const flightData = transformAmadeusResponse(data, parsedFlight.carrierCode, parsedFlight.flightNumber);

    if (!flightData) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'No flight data available for the specified date'
        })
      };
    }

    console.log(`[getFlightInfo] Successfully fetched flight: ${parsedFlight.carrierCode}${parsedFlight.flightNumber}`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        flight: flightData
      })
    };

  } catch (error) {
    console.error('[getFlightInfo] Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch flight information',
        message: error.message
      })
    };
  }
};
