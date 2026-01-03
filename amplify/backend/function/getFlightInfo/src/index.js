/* Amplify Params - DO NOT EDIT
	API_WISHLISTRESTAPI_APIID
	API_WISHLISTRESTAPI_APINAME
	ENV
	REGION
	FLIGHTAWARE_API_KEY
Amplify Params - DO NOT EDIT */

const AEROAPI_BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';
const AEROAPI_KEY = process.env.FLIGHTAWARE_API_KEY;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  try {
    console.log(`[getFlightInfo] Event: ${JSON.stringify(event)}`);

    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { flightIdent } = body;

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

    console.log(`[getFlightInfo] Fetching flight: ${flightIdent}`);

    // Direct API call - no caching (unlikely 2 users search same flight)
    const response = await fetch(
      `${AEROAPI_BASE_URL}/flights/${flightIdent}?max_pages=1`,
      {
        headers: {
          'x-apikey': AEROAPI_KEY
        }
      }
    );

    if (!response.ok) {
      console.error(`[getFlightInfo] API error: ${response.status}`);

      if (response.status === 404) {
        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: 'Flight not found'
          })
        };
      }

      throw new Error(`FlightAware API error: ${response.status}`);
    }

    const data = await response.json();

    // Get most recent/upcoming flight
    const flights = data.flights || [];
    if (flights.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'No flight data available'
        })
      };
    }

    const flight = flights[0];

    // Transform to app's format
    const flightData = {
      flightId: flight.fa_flight_id,
      flightNumber: flight.ident,
      airline: {
        name: flight.operator || extractAirlineName(flight.ident),
        iataCode: flight.operator_iata || flight.ident.substring(0, 2),
        icaoCode: flight.operator_icao
      },
      aircraft: {
        type: flight.aircraft_type,
        registration: flight.registration
      },
      origin: {
        code: flight.origin?.code,
        name: flight.origin?.name,
        city: flight.origin?.city,
        timezone: flight.origin?.timezone,
        gate: flight.gate_origin,
        terminal: flight.terminal_origin
      },
      destination: {
        code: flight.destination?.code,
        name: flight.destination?.name,
        city: flight.destination?.city,
        timezone: flight.destination?.timezone,
        gate: flight.gate_destination,
        terminal: flight.terminal_destination
      },
      schedule: {
        departureScheduled: flight.scheduled_out,
        departureEstimated: flight.estimated_out,
        departureActual: flight.actual_out,
        arrivalScheduled: flight.scheduled_in,
        arrivalEstimated: flight.estimated_in,
        arrivalActual: flight.actual_in
      },
      status: {
        text: flight.status,
        cancelled: flight.cancelled || false,
        diverted: flight.diverted || false,
        progressPercent: flight.progress_percent
      },
      delays: {
        departure: flight.departure_delay,
        arrival: flight.arrival_delay
      }
    };

    console.log(`[getFlightInfo] Successfully fetched flight: ${flight.ident}`);

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

// Helper function to extract airline name from flight identifier
function extractAirlineName(ident) {
  const iata = ident.substring(0, 2).toUpperCase();

  // Common airlines mapping (can expand as needed)
  const airlineMap = {
    'AA': 'American Airlines',
    'DL': 'Delta Air Lines',
    'UA': 'United Airlines',
    'WN': 'Southwest Airlines',
    'B6': 'JetBlue Airways',
    'AS': 'Alaska Airlines',
    'NK': 'Spirit Airlines',
    'F9': 'Frontier Airlines',
    'G4': 'Allegiant Air',
    'BA': 'British Airways',
    'LH': 'Lufthansa',
    'AF': 'Air France',
    'KL': 'KLM',
    'EK': 'Emirates',
    'QR': 'Qatar Airways',
    'SQ': 'Singapore Airlines',
    'CX': 'Cathay Pacific',
    'NH': 'ANA',
    'JL': 'Japan Airlines'
  };

  return airlineMap[iata] || `${iata} Airlines`;
}
