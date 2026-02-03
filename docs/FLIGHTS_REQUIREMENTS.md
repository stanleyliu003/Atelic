# Flight Reservations - Requirements

## What's Already Built (Context)

The following components are already implemented and working:

**Frontend:**
- `src/components/explore/AddFlightModal.tsx` - Full modal UI (~1,043 lines) with airline autocomplete search, calendar date picker, flight number input, flight details display card with status color coding, and optional confirmation/seat number fields
- `src/types/flight.types.ts` - Complete TypeScript type definitions (Airline, FlightInfo, FlightReservation, FlightAirport, FlightSchedule, FlightStatus, FlightDelays, FlightAircraft, ParsedFlightNumber, FlightCacheEntry, FlightCache)
- `src/services/flightService.ts` - Flight service with airline search (searchAirlines, getAirlineByIATA), flight info fetching via Lambda REST API, AsyncStorage caching (2-hour TTL), flight number parsing, and helper formatters
- `src/data/airlines.json` - Local airline dataset (~6,000+ airlines) from npow/airline-codes with IATA/ICAO codes, used for autocomplete

**Backend:**
- `amplify/backend/function/getFlightInfo/src/index.js` - Lambda function (~372 lines) that authenticates with Amadeus API via OAuth2, calls Amadeus v2 Schedule Flights endpoint, and transforms the response into the app's FlightInfo format. Returns departure/arrival airports, times, terminals, gates, aircraft type, and flight status
- `amplify/backend/function/getFlightInfo/src/airlines.json` - Mirror copy of airline dataset for Lambda-side airline name lookups
- Environment variables: `Amadeus_API_Key`, `Amadeus_API_Secret_Key` (configured in Lambda)

---

## Requirements

### Step 1: Enable the "Add Flight" button
Inside the AutocompleteModal (the search/explore screen), there is an "Add Hotel/Stay" button. Next to it, there is an "Add Flight" button that is currently **commented out** (lines 357-365). Uncomment this button so users can tap it to open the AddFlightModal.
- `src/components/explore/AutocompleteModal.jsx` (uncomment the Add Flight button and its onPress handler)

### Step 2: User taps "Add Flight" and the AddFlightModal opens
The AddFlightModal is already fully built. When it opens, the user is prompted "Which airline are you flying?" and can search by full airline name or the 2-letter IATA code (e.g., "AA" for American Airlines, "DL" for Delta). Autocomplete results are filtered from the local `airlines.json` dataset (~6,000+ airlines). The search function `searchAirlines()` returns up to 5 matching active airlines.
- `src/components/explore/AddFlightModal.tsx` (already implemented - modal UI)
- `src/services/flightService.ts` (already implemented - `searchAirlines()` function)
- `src/data/airlines.json` (already implemented - airline dataset from https://github.com/npow/airline-codes)

### Step 3: User selects an airline, picks a date, and enters their flight number
After selecting an airline, the user picks a flight date from a calendar picker (constrained to the trip's start/end dates) and enters their flight number (e.g., "100"). The modal auto-formats this into a flight identifier by combining the airline's IATA code + flight number (e.g., "AA100").
- `src/components/explore/AddFlightModal.tsx` (already implemented - calendar picker, flight number input)
- `src/services/flightService.ts` (already implemented - `parseFlightNumber()` validates and formats the identifier)

### Step 4: Flight info is fetched from the Amadeus API via Lambda
When the user submits the flight number, `flightService.getFlightInfo()` is called. It first checks AsyncStorage for a cached result (2-hour TTL). On cache miss, it makes a REST API call to the `getFlightInfo` Lambda. The Lambda authenticates with Amadeus via OAuth2 (token cached in memory across invocations), calls the Amadeus v2 Schedule Flights endpoint with the carrier code, flight number, and date, then transforms the response into the app's `FlightInfo` format.

The returned data includes: flight number, airline name, origin/destination airports (code, name, city), departure/arrival times (scheduled, estimated, actual), terminals, gates, aircraft type, and flight status (Scheduled, On Time, Delayed, Cancelled, Landed, etc.).
- `src/services/flightService.ts` (already implemented - `getFlightInfo()` with caching)
- `amplify/backend/function/getFlightInfo/src/index.js` (already implemented - Lambda with Amadeus API integration)
- `src/types/flight.types.ts` (already implemented - `FlightInfo`, `FlightAirport`, `FlightSchedule`, `FlightStatus` types)

### Step 5: Flight details are displayed in the modal
The fetched flight details are displayed as a card in the AddFlightModal with color-coded status badges (green = landed, orange = delayed, red = cancelled, blue = boarding, purple = en route). The user can optionally enter a confirmation number and seat number. The user then taps "Add Flight" to confirm.

When confirmed, the modal calls `flightService.createFlightReservation()` which wraps the FlightInfo + optional fields into a `FlightReservation` object with a unique `instanceId` (UUID) and timestamp.
- `src/components/explore/AddFlightModal.tsx` (already implemented - display card, confirmation/seat fields, Add Flight button)
- `src/services/flightService.ts` (already implemented - `createFlightReservation()`, `getFlightStatusColor()`)
- `src/types/flight.types.ts` (already implemented - `FlightReservation` type)

### Step 6: Flight data is passed from AutocompleteModal to trip-view
The `handleAddFlight()` callback in AutocompleteModal receives the `FlightReservation` object from the modal and passes it to the parent (trip-view) via `onSaveActivities([], [], null, flightData)` — the fourth parameter is reserved for flight data.

In `trip-view_main.tsx`, the `handleSaveSearchResults()` function receives this flight data. Currently this handler has a **TODO** (lines 2886-2892) that just logs the data and returns early. **This needs to be implemented** to call `addFlight(flightData)` from the context.
- `src/components/explore/AutocompleteModal.jsx` (already implemented - `handleAddFlight()` callback, lines 272-283)
- `app/trip-view/trip-view_main.tsx` (needs implementation - replace TODO in `handleSaveSearchResults()` at line 2888-2891)

### Step 7: Rename `flight` to `flights` array and add management functions to CreateTripContext
A trip can have multiple flights (outbound, return, connections). The current `flight` / `setFlight` state (line 69) is a single value. Rename it to `flights` / `setFlights` and initialize as an empty array `useState([])`. Add the following flight management functions:
- `addFlight(flightReservation)` — append a FlightReservation to the flights array
- `removeFlight(instanceId)` — remove a flight by its instanceId
- `updateFlight(instanceId, updatedFields)` — update a specific flight's confirmation number, seat number, or notes
- Update `restoreTripFromObject()` (line ~383) to restore `flights` from saved trip data — parse from JSON string since DynamoDB stores it as a String
- Update `resetTripState()` (line ~484) and `clearTrip()` (line ~534) to reset flights to `[]`
- Export all new functions (`flights`, `setFlights`, `addFlight`, `removeFlight`, `updateFlight`) from the context provider value object (line ~953-954)
- `context/CreateTripContext.js`

### Step 8: Update the GraphQL schema to rename `flight` to `flights`
Rename the `flight: String` field to `flights: String` in both locations:
- `Trip` type (line 448)
- `CreateTripInput` (line 580)

The field stays as `String` type since it stores a JSON-stringified array of FlightReservation objects (consistent with how other complex nested data like `hotel` is stored in this schema).
- `amplify/backend/api/WishListAPI/schema.graphql`

### Step 9: Include `flights` in the save payload
In `trip-view_main.tsx`, the `saveTripToBackend()` function builds a `tripInput` object (lines 678-696) that gets sent to the CreateTripStorage Lambda. Add the `flights` field to this object, JSON-stringifying the flights array from context:
```
flights: JSON.stringify(flights || [])
```
- `app/trip-view/trip-view_main.tsx` (add `flights` to the `tripInput` object in `saveTripToBackend()`)

### Step 10: Update AWS Lambda functions to handle `flights`
Rename `flight` to `flights` in the Lambda functions that read/write trip data:

1. **CreateTripStorage** — update the trip input mapping (line 84) and trip output mapping (line 206) to use `flights` instead of `flight`
   - `amplify/backend/function/CreateTripStorage/src/index.js`

2. **getUserTrips** — update the trip response objects (lines 600 and 713) to return `flights` instead of `flight`
   - `amplify/backend/function/getUserTrips/src/index.js`

3. **getTripIDs** — currently has no flight reference. Add `flights` to the trip summary fields if flight count info is needed in the trip list view.
   - `amplify/backend/function/getTripIDs/src/index.js`

### Step 11: Display flights in the trip view UI
Inside `trip-view_main.tsx`, add a Flights section where users can see all their added flight reservations for the trip. Each flight card should display:
- Airline name and flight number (e.g., "American Airlines AA100")
- Origin and destination airports with city names (e.g., "LAX Los Angeles → JFK New York")
- Departure and arrival times (use `formatFlightTime()` and `formatFlightDate()` from flightService.ts)
- Flight status with color-coded badge (use `getFlightStatusColor()` from flightService.ts)
- Confirmation number and seat number if provided
- A delete button (swipe-to-delete or trash icon) that calls `removeFlight(instanceId)` from context
- Tapping a flight card opens a detail view or allows editing the confirmation number / seat number (calls `updateFlight()` from context)
- `app/trip-view/trip-view_main.tsx` (new flights section UI)
- `src/services/flightService.ts` (existing helpers: `formatFlightTime()`, `formatFlightDate()`, `getFlightStatusColor()`)

### Step 12 (Future Enhancement): Real-time flight status updates
Currently flight info is fetched once when the user adds it. In the future, use AviationStack API for real-time status updates (departure delays, gate changes, cancellations). This is NOT required for the initial implementation.

---

## Notes
- The Amadeus API is used (not FlightAware as mentioned in some older docs). The docs in `docs/FLIGHTS_IMPLEMENTATION_PLAN.md` reference FlightAware but the actual implementation uses Amadeus.
- Flights use `instanceId` (UUID) as their primary key, same pattern as activities, allowing duplicate flights without conflicts.
- The `function-parameters.json` for getFlightInfo has duplicate environment variable entries (4 instead of 2) — cosmetic but could be cleaned up.
- NEVER run `amplify push` yourself. Always tell Stanley to run it manually after schema/Lambda changes.
