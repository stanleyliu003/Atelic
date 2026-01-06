# Add Flights Feature - Implementation Plan (Simplified)

## Overview
This document outlines the implementation plan for adding flight reservation functionality to the Atelic trip planning app using FlightAware AeroAPI v4 and the npow/airline-codes dataset.

**Simplified Approach:**
- ❌ **No airline logos** - Use simple airplane icons for cleaner, faster implementation
- ❌ **No DynamoDB caching** - Direct API calls only (flights rarely searched by multiple users)
- ✅ **Client-side AsyncStorage caching** - Cache user's recent searches (2-hour TTL)
- ✅ **Lambda for API security** - Keep FlightAware API key secure on backend
- ✅ **Simple, focused UI** - Fast implementation with clean design

---

## 1. API Selection: FlightAware AeroAPI v4

### Why FlightAware AeroAPI over AviationStack

**FlightAware AeroAPI Advantages:**
- More generous free tier: 500 API calls/month (vs AviationStack's 100 calls/month)
- Superior data quality with 60+ distinct endpoints
- Historical data back to 2011
- Predictive flight ETAs using Foresight technology
- Better reputation in the developer community
- More comprehensive flight data (gates, terminals, seat configurations, baggage claim)

**Pricing Comparison:**

| Provider | Free Tier | Basic Plan | Enterprise Plan |
|----------|-----------|------------|-----------------|
| **FlightAware AeroAPI** | 500 calls/month (personal use) | $100/month (10,000 calls, B2C) | $1,000/month (100,000 calls, B2B) |
| **AviationStack** | 100 calls/month | $49.99/month (10,000 calls) | $499.99/month (250,000 calls) |

**Recommendation:** FlightAware AeroAPI for better data quality, more generous free tier, and comprehensive flight information.

---

## 2. FlightAware AeroAPI v4 Details

### Authentication
- **Method:** API Key in header
- **Header:** `x-apikey: YOUR_API_KEY`
- **Signup:** https://www.flightaware.com/aeroapi/portal

### Primary Endpoint: GET /flights/{ident}

**Base URL:** `https://aeroapi.flightaware.com/aeroapi/`

**Endpoint Format:**
```
GET /flights/{ident}?max_pages=2
```

**Example Request:**
```bash
curl -X GET "https://aeroapi.flightaware.com/aeroapi/flights/AA100" \
  -H "x-apikey: YOUR_API_KEY"
```

**Flight Identifier ({ident}) Options:**
- IATA flight number: `AA100` (American Airlines flight 100)
- ICAO flight number: `AAL100`
- ATC ident

### Response Structure

**Core Flight Object Fields:**

**Flight Identification:**
- `ident` - Flight identifier (e.g., "AA100")
- `fa_flight_id` - FlightAware internal flight ID
- `operator` - Airline name
- `operator_iata` - Airline IATA code (e.g., "AA")
- `flight_number` - Numeric flight number
- `registration` - Aircraft registration number
- `atc_ident` - ATC identifier
- `codeshares` - Array of codeshare flight numbers

**Flight Status:**
- `status` - Current flight status
- `blocked` - Boolean, if flight is blocked
- `diverted` - Boolean, if flight was diverted
- `cancelled` - Boolean, if flight was cancelled
- `position_only` - Boolean

**Origin & Destination:**
- `origin` - Origin airport object with code, name, coordinates
- `destination` - Destination airport object
- `departure_delay` - Delay in minutes
- `arrival_delay` - Delay in minutes

**Aircraft & Route:**
- `aircraft_type` - Aircraft type code
- `route` - Flight route
- `route_distance` - Distance in miles
- `filed_airspeed` - Filed airspeed
- `filed_altitude` - Filed altitude
- `filed_ete` - Filed estimated time enroute
- `progress_percent` - Flight progress percentage

**Terminal & Gate Information:**
- `gate_origin` - Departure gate
- `gate_destination` - Arrival gate
- `terminal_origin` - Departure terminal
- `terminal_destination` - Arrival terminal
- `baggage_claim` - Baggage claim area

**Seat Configuration:**
- `seats_cabin_business` - Business class seats
- `seats_cabin_coach` - Economy class seats
- `seats_cabin_first` - First class seats

**OOOI Times (Out-Off-On-In):**
- `scheduled_out` - Scheduled gate departure
- `estimated_out` - Estimated gate departure
- `actual_out` - Actual gate departure
- `scheduled_off` - Scheduled runway departure
- `estimated_off` - Estimated runway departure
- `actual_off` - Actual runway departure
- `scheduled_on` - Scheduled runway arrival
- `estimated_on` - Estimated runway arrival
- `actual_on` - Actual runway arrival
- `scheduled_in` - Scheduled gate arrival
- `estimated_in` - Estimated gate arrival
- `actual_in` - Actual gate arrival

**Example Response Structure:**
```json
{
  "ident": "AA100",
  "fa_flight_id": "AAL100-1673827200-airline-0001",
  "operator": "American Airlines",
  "operator_iata": "AA",
  "flight_number": "100",
  "registration": "N12345",
  "origin": {
    "code": "LAX",
    "name": "Los Angeles International Airport",
    "city": "Los Angeles",
    "timezone": "America/Los_Angeles"
  },
  "destination": {
    "code": "JFK",
    "name": "John F Kennedy International Airport",
    "city": "New York",
    "timezone": "America/New_York"
  },
  "scheduled_out": "2026-01-15T08:00:00Z",
  "estimated_out": "2026-01-15T08:15:00Z",
  "scheduled_in": "2026-01-15T16:30:00Z",
  "estimated_in": "2026-01-15T16:45:00Z",
  "gate_origin": "45A",
  "gate_destination": "12B",
  "terminal_origin": "4",
  "terminal_destination": "5",
  "status": "Scheduled",
  "aircraft_type": "B738",
  "progress_percent": 0
}
```

### Additional Useful Endpoints

1. **GET /flights/{ident}/route** - Get flight route details
2. **GET /flights/{ident}/position** - Get current flight position
3. **GET /airports/{airport_code}/flights/scheduled_departures** - Get scheduled departures
4. **GET /airports/{airport_code}/flights/scheduled_arrivals** - Get scheduled arrivals

---

## 3. Airline Dataset: npow/airline-codes

### Repository
- **GitHub:** https://github.com/npow/airline-codes
- **NPM Package:** `airline-codes`
- **License:** Open source (check repository for specific license)

### Data Structure

**Available Fields:**
```json
{
  "id": "24",
  "name": "American Airlines",
  "alias": "\\N",
  "iata": "AA",
  "icao": "AAL",
  "callsign": "AMERICAN",
  "country": "United States",
  "active": "Y"
}
```

**Field Descriptions:**
- `id` - Unique identifier (string)
- `name` - Full airline name
- `alias` - Alternative name (often "\\N" for null)
- `iata` - 2-letter IATA code (e.g., "AA")
- `icao` - 3-letter ICAO code (e.g., "AAL")
- `callsign` - Radio callsign (e.g., "AMERICAN")
- `country` - Operating country
- `active` - "Y" or "N" status

### Data Formats Available
- **JSON:** `airlines.json`
- **CSV:** Original `airlines.dat` from OpenFlights

### Usage in React Native

**Option 1: NPM Package (Recommended for React Native)**
```javascript
// Install package
npm install airline-codes

// Import in code
import airlineCodes from 'airline-codes';

// Usage
const airlines = airlineCodes.toJSON();
const americanAirlines = airlines.find(a => a.iata === 'AA');
```

**Option 2: Direct JSON Import**
```javascript
// Copy airlines.json to your project assets
import airlines from './assets/data/airlines.json';

// Usage
const findAirlineByIATA = (iataCode) => {
  return airlines.find(a => a.iata === iataCode);
};
```

### Important Note: No Logos Included
The npow/airline-codes dataset **does NOT include airline logos**. You'll need an additional source for logos.

---

## 4. UI Design Approach (Simplified - No Logos)

**Simplified Visual Design:**
- Use `Ionicons` airplane icon for all airlines (consistent, clean look)
- Focus on typography and layout clarity
- Color coding for flight status (green=on time, orange=delayed, red=cancelled)
- Clear information hierarchy (flight number → airline → route → times)

**Benefits:**
- Faster loading (no external images)
- Consistent appearance (no missing logo issues)
- Simpler implementation
- Better offline experience
- Reduced app bundle size

**Icon Usage:**
```jsx
import Ionicons from '@expo/vector-icons/Ionicons';

// In airline autocomplete
<Ionicons name="airplane" size={20} color="#666" />

// In flight card header
<Ionicons name="airplane" size={24} color="#F36406" />

// For departure/arrival indicators
<Ionicons name="arrow-forward" size={20} color="#999" />
```

---

## 5. Implementation Architecture

### Backend (AWS Lambda)

**Create New Lambda Function: `getFlightInfo`**

**File Location:** `/amplify/backend/function/getFlightInfo/`

**Functionality:**
- Accept flight number (e.g., "AA100")
- Call FlightAware AeroAPI to fetch flight details
- Transform response to match app's data structure
- Cache flight data in DynamoDB (optional, to reduce API calls)

**Environment Variables:**
```bash
FLIGHTAWARE_API_KEY=your_api_key_here
```

**Lambda Handler Code (Simplified - No Caching):**
```javascript
const fetch = require('node-fetch');

const AEROAPI_BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';
const AEROAPI_KEY = process.env.FLIGHTAWARE_API_KEY;

exports.handler = async (event) => {
  try {
    const { flightIdent } = JSON.parse(event.body);

    if (!flightIdent) {
      return {
        statusCode: 400,
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
```

**No DynamoDB Table Needed:**
- Direct API calls keep data fresh (gates/delays change frequently)
- Low collision probability (unlikely multiple users search same flight)
- Simpler architecture with fewer dependencies
- Client-side AsyncStorage handles user's recent searches

### Frontend (React Native)

**1. Download Airline Dataset**

Download `airlines.json` from npow/airline-codes GitHub repository and save to `/src/data/airlines.json`

**2. Create Flight Service (Simplified - No Logos)**

**File:** `/src/services/flightService.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API, graphqlOperation } from 'aws-amplify';
import airlines from '../data/airlines.json';

const FLIGHT_CACHE_KEY = '@flight_cache';
const CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Get airline information by IATA code
 */
export const getAirlineByIATA = (iataCode: string) => {
  return airlines.find(airline => airline.iata === iataCode?.toUpperCase());
};

/**
 * Get airline information by name or ICAO
 */
export const getAirlineByNameOrICAO = (search: string) => {
  const searchLower = search.toLowerCase();
  return airlines.find(
    airline =>
      airline.name?.toLowerCase() === searchLower ||
      airline.icao?.toLowerCase() === searchLower
  );
};

/**
 * Search for airlines by name or code
 * Used for autocomplete in flight search (NO LOGOS)
 */
export const searchAirlines = (query: string) => {
  if (!query || query.length < 1) return [];

  const searchTerm = query.toLowerCase();

  return airlines
    .filter(
      airline =>
        airline.active === 'Y' &&
        (airline.name?.toLowerCase().includes(searchTerm) ||
          airline.iata?.toLowerCase().includes(searchTerm) ||
          airline.icao?.toLowerCase().includes(searchTerm))
    )
    .slice(0, 10); // Limit to 10 results
};

/**
 * Get flight information from backend Lambda
 * Includes AsyncStorage caching for recent user searches
 */
export const getFlightInfo = async (flightIdent: string) => {
  try {
    // Check AsyncStorage cache first
    const cachedData = await getFlightFromCache(flightIdent);
    if (cachedData) {
      console.log('[flightService] Using cached flight data');
      return cachedData;
    }

    console.log('[flightService] Fetching flight from API:', flightIdent);

    // Call Lambda function via API Gateway
    const response = await API.post('wishlistAPI', '/getFlightInfo', {
      body: {
        flightIdent: flightIdent.toUpperCase()
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch flight');
    }

    const flightData = response.flight;

    // Cache the result
    await cacheFlightData(flightIdent, flightData);

    return flightData;
  } catch (error: any) {
    console.error('[flightService] Error fetching flight:', error);

    if (error.response?.status === 404) {
      throw new Error('Flight not found. Please check the flight number.');
    }

    throw new Error(
      error.message || 'Failed to fetch flight information'
    );
  }
};

/**
 * Cache flight data in AsyncStorage
 */
const cacheFlightData = async (flightIdent: string, flightData: any) => {
  try {
    const cacheEntry = {
      flightIdent,
      data: flightData,
      timestamp: Date.now()
    };

    // Get existing cache
    const existingCache = await AsyncStorage.getItem(FLIGHT_CACHE_KEY);
    const cache = existingCache ? JSON.parse(existingCache) : {};

    // Add new entry
    cache[flightIdent.toUpperCase()] = cacheEntry;

    // Clean old entries (older than 2 hours)
    const now = Date.now();
    Object.keys(cache).forEach(key => {
      if (now - cache[key].timestamp > CACHE_DURATION_MS) {
        delete cache[key];
      }
    });

    await AsyncStorage.setItem(FLIGHT_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('[flightService] Error caching flight data:', error);
    // Non-critical error, don't throw
  }
};

/**
 * Get flight from AsyncStorage cache
 */
const getFlightFromCache = async (flightIdent: string) => {
  try {
    const cacheData = await AsyncStorage.getItem(FLIGHT_CACHE_KEY);
    if (!cacheData) return null;

    const cache = JSON.parse(cacheData);
    const entry = cache[flightIdent.toUpperCase()];

    if (!entry) return null;

    // Check if cache is still valid (within 2 hours)
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_DURATION_MS) {
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error('[flightService] Error reading cache:', error);
    return null;
  }
};

/**
 * Clear flight cache (useful for debugging/testing)
 */
export const clearFlightCache = async () => {
  try {
    await AsyncStorage.removeItem(FLIGHT_CACHE_KEY);
    console.log('[flightService] Cache cleared');
  } catch (error) {
    console.error('[flightService] Error clearing cache:', error);
  }
};

/**
 * Parse flight number input
 * Supports formats: "AA100", "AA 100", "AA-100"
 */
export const parseFlightNumber = (input: string) => {
  if (!input) return null;

  const trimmed = input.trim().toUpperCase().replace(/[-\s]/g, '');

  // Match airline code (2 letters) + flight number (digits)
  const match = trimmed.match(/^([A-Z]{2})(\d+)$/);

  if (match) {
    return {
      airlineCode: match[1],
      flightNumber: match[2],
      fullFlightNumber: `${match[1]}${match[2]}`
    };
  }

  return null;
};

/**
 * Validate flight identifier format
 */
export const isValidFlightIdent = (flightIdent: string): boolean => {
  if (!flightIdent) return false;
  const parsed = parseFlightNumber(flightIdent);
  return parsed !== null;
};
```

**3. Create Flight Types**

**File:** `/src/types/flight.types.ts`

```typescript
export interface Airline {
  id: string;
  name: string;
  iata: string;
  icao: string;
  callsign: string;
  country: string;
  active: string;
  logoUrl?: string;
}

export interface Airport {
  code: string;
  name: string;
  city: string;
  timezone?: string;
  gate?: string;
  terminal?: string;
}

export interface FlightSchedule {
  departureScheduled: string;
  departureEstimated?: string;
  departureActual?: string;
  arrivalScheduled: string;
  arrivalEstimated?: string;
  arrivalActual?: string;
}

export interface FlightStatus {
  text: string;
  cancelled: boolean;
  diverted: boolean;
  progressPercent?: number;
}

export interface FlightInfo {
  flightId: string;
  flightNumber: string;
  airline: {
    name: string;
    iataCode: string;
    icaoCode: string;
  };
  aircraft?: {
    type: string;
    registration: string;
  };
  origin: Airport;
  destination: Airport;
  schedule: FlightSchedule;
  status: FlightStatus;
  delays?: {
    departure?: number;
    arrival?: number;
  };
}

export interface FlightReservation {
  instanceId: string; // UUID, similar to Activity instanceId
  flightInfo: FlightInfo;
  confirmationNumber?: string;
  seatNumber?: string;
  notes?: string;
  addedAt: string;
}
```

**4. Create Flight Search Component**

**File:** `/src/components/FlightSearchModal.tsx`

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import {
  searchAirlines,
  getAirlineLogo,
  parseFlightNumber,
  getFlightInfo
} from '../services/flightService';
import type { Airline, FlightInfo } from '../types/flight.types';

interface FlightSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onFlightSelected: (flight: FlightInfo) => void;
}

export const FlightSearchModal: React.FC<FlightSearchModalProps> = ({
  visible,
  onClose,
  onFlightSelected
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [airlineSuggestions, setAirlineSuggestions] = useState<Airline[]>([]);
  const [flightNumber, setFlightNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAirlineSearch = (text: string) => {
    setSearchQuery(text);

    if (text.length >= 2) {
      const suggestions = searchAirlines(text);
      setAirlineSuggestions(suggestions);
    } else {
      setAirlineSuggestions([]);
    }
  };

  const handleAirlineSelect = (airline: Airline) => {
    setSearchQuery(`${airline.iata} - ${airline.name}`);
    setFlightNumber(airline.iata);
    setAirlineSuggestions([]);
  };

  const handleFlightNumberChange = (text: string) => {
    setFlightNumber(text);
    setError(null);
  };

  const handleSearchFlight = async () => {
    const parsed = parseFlightNumber(flightNumber);

    if (!parsed) {
      setError('Please enter a valid flight number (e.g., AA100)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const flightInfo = await getFlightInfo(parsed.fullFlightNumber);
      onFlightSelected(flightInfo);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flight');
    } finally {
      setLoading(false);
    }
  };

  const renderAirlineSuggestion = ({ item }: { item: Airline }) => {
    const logoUrl = getAirlineLogo(item.iata, item.icao);

    return (
      <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => handleAirlineSelect(item)}
      >
        {logoUrl && (
          <Image
            source={{ uri: logoUrl }}
            style={styles.airlineLogo}
            resizeMode="contain"
          />
        )}
        <View style={styles.airlineInfo}>
          <Text style={styles.airlineCode}>{item.iata}</Text>
          <Text style={styles.airlineName}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search Flight</Text>

      {/* Airline Search */}
      <TextInput
        style={styles.input}
        placeholder="Search airline (e.g., AA, American)"
        value={searchQuery}
        onChangeText={handleAirlineSearch}
        autoCapitalize="characters"
      />

      {/* Airline Suggestions */}
      {airlineSuggestions.length > 0 && (
        <FlatList
          data={airlineSuggestions}
          keyExtractor={(item) => item.id}
          renderItem={renderAirlineSuggestion}
          style={styles.suggestionsList}
        />
      )}

      {/* Flight Number Input */}
      <TextInput
        style={styles.input}
        placeholder="Flight number (e.g., AA100)"
        value={flightNumber}
        onChangeText={handleFlightNumberChange}
        autoCapitalize="characters"
      />

      {/* Error Message */}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Search Button */}
      <TouchableOpacity
        style={styles.searchButton}
        onPress={handleSearchFlight}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.searchButtonText}>Search Flight</Text>
        )}
      </TouchableOpacity>

      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16
  },
  suggestionsList: {
    maxHeight: 200,
    marginBottom: 15
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  airlineLogo: {
    width: 40,
    height: 40,
    marginRight: 12
  },
  airlineInfo: {
    flex: 1
  },
  airlineCode: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  airlineName: {
    fontSize: 14,
    color: '#666'
  },
  error: {
    color: 'red',
    marginBottom: 10
  },
  searchButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  closeButton: {
    padding: 15,
    alignItems: 'center'
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16
  }
});
```

**5. Integrate Flights into CreateTripContext**

**File:** `/context/CreateTripContext.js`

```javascript
// Add to existing state
const [flights, setFlights] = useState([]); // Array of FlightReservation objects

// Add flight to trip
const addFlight = (flightInfo) => {
  const newFlight = {
    instanceId: generateUUID(),
    flightInfo,
    addedAt: new Date().toISOString()
  };

  setFlights(prev => [...prev, newFlight]);
};

// Remove flight from trip
const removeFlight = (instanceId) => {
  setFlights(prev => prev.filter(f => f.instanceId !== instanceId));
};

// Update flight details
const updateFlight = (instanceId, updates) => {
  setFlights(prev =>
    prev.map(f =>
      f.instanceId === instanceId
        ? { ...f, ...updates }
        : f
    )
  );
};

// Export in context value
return (
  <CreateTripContext.Provider
    value={{
      // ... existing values
      flights,
      addFlight,
      removeFlight,
      updateFlight
    }}
  >
    {children}
  </CreateTripContext.Provider>
);
```

---

## 6. UI/UX Design Recommendations

### Flight Display Card

```typescript
// FlightCard.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { FlightReservation } from '../types/flight.types';
import { getAirlineLogo } from '../services/flightService';
import { format } from 'date-fns';

interface FlightCardProps {
  flight: FlightReservation;
}

export const FlightCard: React.FC<FlightCardProps> = ({ flight }) => {
  const { flightInfo } = flight;
  const logoUrl = getAirlineLogo(
    flightInfo.airline.iataCode,
    flightInfo.airline.icaoCode
  );

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        {logoUrl && (
          <Image
            source={{ uri: logoUrl }}
            style={styles.logo}
            resizeMode="contain"
          />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.airline}>{flightInfo.airline.name}</Text>
          <Text style={styles.flightNumber}>{flightInfo.flightNumber}</Text>
        </View>
        <View style={styles.status}>
          <Text style={styles.statusText}>{flightInfo.status.text}</Text>
        </View>
      </View>

      {/* Route */}
      <View style={styles.route}>
        <View style={styles.airport}>
          <Text style={styles.airportCode}>{flightInfo.origin.code}</Text>
          <Text style={styles.airportName}>{flightInfo.origin.city}</Text>
          <Text style={styles.time}>
            {format(new Date(flightInfo.schedule.departureScheduled), 'HH:mm')}
          </Text>
          {flightInfo.origin.gate && (
            <Text style={styles.gate}>Gate {flightInfo.origin.gate}</Text>
          )}
        </View>

        <View style={styles.arrow}>
          <Text>✈️</Text>
        </View>

        <View style={styles.airport}>
          <Text style={styles.airportCode}>{flightInfo.destination.code}</Text>
          <Text style={styles.airportName}>{flightInfo.destination.city}</Text>
          <Text style={styles.time}>
            {format(new Date(flightInfo.schedule.arrivalScheduled), 'HH:mm')}
          </Text>
          {flightInfo.destination.gate && (
            <Text style={styles.gate}>Gate {flightInfo.destination.gate}</Text>
          )}
        </View>
      </View>

      {/* Additional Info */}
      {flight.confirmationNumber && (
        <Text style={styles.confirmation}>
          Confirmation: {flight.confirmationNumber}
        </Text>
      )}
      {flight.seatNumber && (
        <Text style={styles.seat}>Seat: {flight.seatNumber}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 12
  },
  headerInfo: {
    flex: 1
  },
  airline: {
    fontSize: 16,
    fontWeight: '600'
  },
  flightNumber: {
    fontSize: 14,
    color: '#666'
  },
  status: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  airport: {
    flex: 1,
    alignItems: 'center'
  },
  airportCode: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  airportName: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8
  },
  gate: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4
  },
  arrow: {
    marginHorizontal: 16
  },
  confirmation: {
    fontSize: 12,
    color: '#666',
    marginTop: 8
  },
  seat: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  }
});
```

---

## 7. GraphQL Schema Updates

**File:** `/amplify/backend/api/wishlistAPI/schema.graphql`

```graphql
# Add new types for flight data
type FlightAirline {
  name: String!
  iataCode: String!
  icaoCode: String!
}

type FlightAirport {
  code: String!
  name: String!
  city: String!
  timezone: String
  gate: String
  terminal: String
}

type FlightSchedule {
  departureScheduled: AWSDateTime!
  departureEstimated: AWSDateTime
  departureActual: AWSDateTime
  arrivalScheduled: AWSDateTime!
  arrivalEstimated: AWSDateTime
  arrivalActual: AWSDateTime
}

type FlightStatus {
  text: String!
  cancelled: Boolean!
  diverted: Boolean!
  progressPercent: Int
}

type FlightInfo {
  flightId: String!
  flightNumber: String!
  airline: FlightAirline!
  origin: FlightAirport!
  destination: FlightAirport!
  schedule: FlightSchedule!
  status: FlightStatus!
}

type FlightReservation {
  instanceId: ID!
  flightInfo: FlightInfo!
  confirmationNumber: String
  seatNumber: String
  notes: String
  addedAt: AWSDateTime!
}

# Update Trip type to include flights
type Trip @model {
  tripId: ID!
  # ... existing fields
  flights: [FlightReservation]
  # ... existing fields
}
```

---

## 8. Cost Optimization Strategies (Simplified)

### Caching Strategy
1. **AsyncStorage Only:** Cache user's recent flight searches (2-hour TTL)
   - Each user caches their own searches locally
   - Automatic cleanup of stale entries
   - No server-side storage costs

2. **No DynamoDB:** Skip server-side caching entirely
   - Flights rarely searched by multiple users simultaneously
   - Fresh data is better (gates/delays change frequently)
   - Simpler architecture, fewer moving parts

### API Usage Optimization
1. **Free Tier:** 500 calls/month = ~16 calls/day
2. **Client-Side Cache:** Reduces redundant API calls for same user
3. **Airline Data:** Bundle airline codes dataset with app (zero API calls)
4. **Smart Loading:** Only fetch flight data when explicitly requested

### Cost Projection
- **Average user:** 2-3 flights per trip
- **Average trips/month:** 100 active users × 2 trips = 200 trips
- **Flight lookups:** 200 trips × 2.5 flights = 500 lookups/month
- **Cache hit rate:** ~30% (user re-checks same flight)
- **Actual API calls:** 500 × 0.7 = ~350 calls/month
- **Conclusion:** Well within free tier (500 calls/month) ✅

### Monthly Cost Estimate
- **Lambda:** FREE (within free tier, simple function)
- **API Gateway:** FREE (1M requests/month free)
- **FlightAware API:** FREE (under 500 calls/month)
- **DynamoDB:** $0 (not using)
- **AsyncStorage:** FREE (local device storage)
- **Total:** **$0/month** 🎉

---

## 9. Implementation Checklist (Simplified)

### Phase 1: Backend Setup
- [ ] Create `getFlightInfo` Lambda function directory
- [ ] Implement Lambda handler (simplified, no DynamoDB)
- [ ] Add node-fetch dependency to Lambda package.json
- [ ] Set up FlightAware API key in environment variables
- [ ] Configure API Gateway endpoint for Lambda
- [ ] Deploy backend with `amplify push`
- [ ] Test Lambda with sample flights (AA100, DL123, UA456)

**Estimated Time:** 1 hour

### Phase 2: Data & Services
- [ ] Download airlines.json from npow/airline-codes GitHub
- [ ] Save to `/src/data/airlines.json`
- [ ] Create `/src/types/flight.types.ts` (TypeScript interfaces)
- [ ] Create `/src/services/flightService.ts`
  - [ ] Airline search autocomplete
  - [ ] Flight info API call
  - [ ] AsyncStorage caching logic
- [ ] Test airline search locally

**Estimated Time:** 1 hour

### Phase 3: AddFlightModal Component
- [ ] Create `/src/components/explore/AddFlightModal.tsx`
  - [ ] Airline search section (no logos, just icons)
  - [ ] Flight number input section
  - [ ] Flight details display card
  - [ ] Loading states
  - [ ] Error handling
- [ ] Style matching AddHotelStayModal design patterns
- [ ] Test modal independently

**Estimated Time:** 2-3 hours

### Phase 4: Integration
- [ ] Update `/src/components/explore/AutocompleteModal.jsx`
  - [ ] Add "Add Flights" button next to hotel button
  - [ ] Add showFlightModal state
  - [ ] Add handleAddFlight handler
  - [ ] Include AddFlightModal component
- [ ] Update `/app/trip-view/trip-view_main.tsx`
  - [ ] Update handleSaveSearchResults signature
  - [ ] Add handleAddFlightToTrip function
- [ ] Test end-to-end flow

**Estimated Time:** 1 hour

### Phase 5: Testing & QA
- [ ] Test airline search (AA, American, United, Delta)
- [ ] Test flight lookup with real flights
- [ ] Test invalid flight numbers (error handling)
- [ ] Test AsyncStorage caching (search same flight twice)
- [ ] Test flight added to correct trip day
- [ ] Test flight deletion from trip
- [ ] Test offline mode (cached data still loads)
- [ ] Test API errors (network failure, 404, etc.)
- [ ] Monitor FlightAware API usage

**Estimated Time:** 1 hour

### Phase 6: Polish & Documentation
- [ ] Add inline code comments
- [ ] Update CLAUDE.md with flight feature notes
- [ ] Create user-facing documentation
- [ ] Add troubleshooting guide

**Estimated Time:** 30 minutes

---

**Total Estimated Time: 6-8 hours** (down from 12-15 hours with logos/caching)

---

## 10. Future Enhancements

### Phase 2 Features
1. **Flight Status Notifications:** Push notifications for delays/gate changes
2. **Multi-Leg Flights:** Support for flights with connections
3. **Flight Tracking:** Real-time flight position on map
4. **Price Tracking:** Integration with flight booking APIs
5. **Calendar Integration:** Add flights to device calendar
6. **Boarding Pass Storage:** Store and display mobile boarding passes
7. **Airport Information:** Terminal maps, amenities, lounge access
8. **Alternative Flights:** Suggest alternative flights if original is cancelled

### API Alternatives (Backup Plans)
1. **AviationStack:** Lower cost but less comprehensive data
2. **AeroDataBox:** Another FlightAware competitor
3. **Amadeus Flight Status API:** Enterprise-grade solution
4. **OpenSky Network:** Free community-driven flight tracking (limited features)

---

## 11. Resources & References

### API Documentation
- [FlightAware AeroAPI Documentation](https://www.flightaware.com/aeroapi/portal/documentation)
- [FlightAware AeroAPI Portal](https://www.flightaware.com/aeroapi/portal)
- [FlightAware AeroAPI GitHub Examples](https://github.com/flightaware/aeroapps)

### Datasets
- [npow/airline-codes on GitHub](https://github.com/npow/airline-codes)
- [imgmongelli/airlines-logos-dataset on GitHub](https://github.com/imgmongelli/airlines-logos-dataset)
- [OpenFlights Data](https://openflights.org/data)

### CDN Resources
- FlightRadar24 Logos: `https://images.flightradar24.com/assets/airlines/logotypes/{IATA}_{ICAO}.png`
- RadarBox Logos: `https://cdn.radarbox.com/airlines/{ICAO}.png`

### Comparison Articles
- [Top Flight APIs 2025](https://medium.com/@rameshchauhan0089/top-5-flight-tracking-apis-developers-should-know-in-2025-d7f4d9be58d5)
- [Best Flight Data APIs](https://geekflare.com/dev/flight-data-api/)
- [Affordable Flight APIs](https://aerodatabox.com/flight-api-2024/)

---

## Summary

This **simplified** implementation plan provides a fast, cost-effective roadmap for adding flight reservation functionality to the Atelic app using:

1. **FlightAware AeroAPI v4** for flight data (500 free calls/month)
2. **npow/airline-codes** for airline autocomplete information
3. **Simple airplane icons** instead of airline logos (cleaner, faster)
4. **AsyncStorage caching** for user's recent searches (no DynamoDB needed)
5. **AWS Lambda** for API key security (direct FlightAware API calls)
6. **React Native components** matching existing modal patterns

### Key Simplifications:
- ❌ No airline logos → Faster implementation, no image loading complexity
- ❌ No DynamoDB caching → Simpler architecture, $0 storage costs
- ✅ AsyncStorage only → Client-side caching sufficient
- ✅ Clean icon-based UI → Consistent, professional appearance

### Benefits:
- **Cost:** $0/month (all within free tiers)
- **Speed:** 6-8 hours total implementation time
- **Simplicity:** Fewer dependencies, easier maintenance
- **Performance:** No external image loading, faster UI
- **Reliability:** Fresh data (no stale cache issues)

The approach is cost-effective, scalable, and follows the existing architectural patterns in the Atelic codebase while minimizing complexity.

---

**Last Updated:** 2026-01-03
**Version:** 2.0 (Simplified - No Logos, No DynamoDB)
