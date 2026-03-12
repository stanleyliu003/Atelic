/* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT */

const AVIATIONSTACK_API_BASE = 'http://api.aviationstack.com/v1/flights';
const AVIATIONSTACK_API_KEY = process.env.AviationStack_API_Key;

// Import airlines data for enrichment
const airlines = require('./airlines.json');

/**
 * Get airline info from local dataset
 */
function getAirlineInfo(iataCode) {
  const airline = airlines.find(a => a.iata === iataCode && a.active === 'Y');
  return airline || { iata: iataCode, icao: null, name: `${iataCode} Airlines` };
}

/**
 * Parse flight identifier into carrier code and flight number
 * Supports formats: "AA100", "B6123", "DL477"
 */
function parseFlightIdent(flightIdent) {
  const trimmed = flightIdent.trim().toUpperCase().replace(/[-\s]/g, '');

  // Try 2-character airline code first (standard IATA)
  let match = trimmed.match(/^([A-Z0-9]{2})(\d+)$/);

  // If no match, try 3-character code (ICAO)
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
 * Format date to YYYY-MM-DD
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Transform AviationStack API response to app format
 */
function transformResponse(apiData, carrierCode, flightNumber) {
  if (!apiData || !apiData.data || apiData.data.length === 0) {
    return null;
  }

  const flight = apiData.data[0];
  const dep = flight.departure || {};
  const arr = flight.arrival || {};
  const airlineData = flight.airline || {};
  const aircraftData = flight.aircraft || {};

  // Enrich with local airline data
  const airlineInfo = getAirlineInfo(airlineData.iata || carrierCode);

  return {
    flightId: `${carrierCode}${flightNumber}`,
    flightNumber: flight.flight?.iata || `${carrierCode}${flightNumber}`,
    airline: {
      name: airlineData.name || airlineInfo.name,
      iataCode: airlineData.iata || carrierCode,
      icaoCode: airlineData.icao || airlineInfo.icao || null
    },
    aircraft: {
      type: aircraftData.iata || aircraftData.icao || null,
      registration: aircraftData.registration || null
    },
    origin: {
      code: dep.iata || null,
      name: dep.airport || null,
      city: null,
      timezone: dep.timezone || null,
      gate: dep.gate || null,
      terminal: dep.terminal || null
    },
    destination: {
      code: arr.iata || null,
      name: arr.airport || null,
      city: null,
      timezone: arr.timezone || null,
      gate: arr.gate || null,
      terminal: arr.terminal || null
    },
    schedule: {
      departureScheduled: dep.scheduled || null,
      departureEstimated: dep.estimated || null,
      departureActual: dep.actual || null,
      arrivalScheduled: arr.scheduled || null,
      arrivalEstimated: arr.estimated || null,
      arrivalActual: arr.actual || null
    },
    status: {
      text: flight.flight_status || 'scheduled',
      cancelled: flight.flight_status === 'cancelled',
      diverted: flight.flight_status === 'diverted',
      progressPercent: null
    },
    delays: {
      departure: dep.delay ? `${dep.delay} min` : null,
      arrival: arr.delay ? `${arr.delay} min` : null
    }
  };
}

/**
 * Helper to create response
 */
function makeResponse(isGraphQL, statusCode, body) {
  if (isGraphQL) return JSON.stringify(body);
  return {
    statusCode,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  try {
    console.log(`[getFlightInfo] Event: ${JSON.stringify(event)}`);

    // Support both REST API and GraphQL @function formats
    const isGraphQL = !!event.arguments;
    let flightIdent, flightDate;
    if (isGraphQL) {
      flightIdent = event.arguments.flightIdent;
      flightDate = event.arguments.flightDate;
    } else {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      flightIdent = body.flightIdent;
      flightDate = body.flightDate;
    }

    if (!flightIdent) {
      return makeResponse(isGraphQL, 400, { success: false, error: 'Flight number is required' });
    }

    if (!flightDate) {
      return makeResponse(isGraphQL, 400, { success: false, error: 'Flight date is required' });
    }

    // Parse flight identifier
    let parsedFlight;
    try {
      parsedFlight = parseFlightIdent(flightIdent);
    } catch (err) {
      return makeResponse(isGraphQL, 400, { success: false, error: err.message });
    }

    const flightIata = `${parsedFlight.carrierCode}${parsedFlight.flightNumber}`;
    const scheduledDate = formatDate(flightDate);
    console.log(`[getFlightInfo] Looking up flight: ${flightIata} on ${scheduledDate}`);

    // Build AviationStack API URL
    // Note: flight_date is not supported on free plan, omit it
    const queryParams = new URLSearchParams({
      access_key: AVIATIONSTACK_API_KEY,
      flight_iata: flightIata
    });

    const apiUrl = `${AVIATIONSTACK_API_BASE}?${queryParams.toString()}`;
    console.log(`[getFlightInfo] API URL: ${apiUrl.replace(AVIATIONSTACK_API_KEY, '***')}`);

    // Call AviationStack API
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[getFlightInfo] API error: ${response.status}, body: ${errorBody}`);
      throw new Error(`AviationStack API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[getFlightInfo] API response:`, JSON.stringify(data));

    // Check for API-level errors
    if (data.error) {
      console.error(`[getFlightInfo] API error response:`, JSON.stringify(data.error));
      return makeResponse(isGraphQL, 400, {
        success: false,
        error: data.error.message || 'Flight data provider returned an error'
      });
    }

    // Transform response to app format
    const flightData = transformResponse(data, parsedFlight.carrierCode, parsedFlight.flightNumber);

    if (!flightData) {
      return makeResponse(isGraphQL, 404, {
        success: false,
        error: 'No flight data available for the specified date'
      });
    }

    console.log(`[getFlightInfo] Successfully fetched flight: ${flightIata}`);

    return makeResponse(isGraphQL, 200, { success: true, flight: flightData });

  } catch (error) {
    console.error('[getFlightInfo] Error:', error);

    const isGraphQL = event && event.arguments;
    return makeResponse(isGraphQL, 500, {
      success: false,
      error: 'Failed to fetch flight information',
      message: error.message
    });
  }
};
