/**
 * Flight Types for Atelic App
 * Types for flight data from FlightAware AeroAPI
 */

export interface Airline {
  id: string;
  name: string;
  alias?: string;
  iata: string;
  icao: string;
  callsign?: string;
  country: string;
  active: string;
}

export interface FlightAirline {
  name: string;
  iataCode: string;
  icaoCode?: string;
}

export interface FlightAirport {
  code: string;
  name: string;
  city: string;
  timezone?: string;
  gate?: string | null;
  terminal?: string | null;
}

export interface FlightSchedule {
  departureScheduled: string;
  departureEstimated?: string | null;
  departureActual?: string | null;
  arrivalScheduled: string;
  arrivalEstimated?: string | null;
  arrivalActual?: string | null;
}

export interface FlightStatus {
  text: string;
  cancelled: boolean;
  diverted: boolean;
  progressPercent?: number;
}

export interface FlightDelays {
  departure?: number | null;
  arrival?: number | null;
}

export interface FlightAircraft {
  type?: string | null;
  registration?: string | null;
}

export interface FlightInfo {
  flightId: string;
  flightNumber: string;
  airline: FlightAirline;
  aircraft?: FlightAircraft;
  origin: FlightAirport;
  destination: FlightAirport;
  schedule: FlightSchedule;
  status: FlightStatus;
  delays?: FlightDelays;
}

export interface FlightReservation {
  instanceId: string; // UUID, similar to Activity instanceId
  flightInfo: FlightInfo;
  confirmationNumber?: string;
  seatNumber?: string;
  notes?: string;
  addedAt: string;
}

export interface ParsedFlightNumber {
  airlineCode: string;
  flightNumber: string;
  fullFlightNumber: string;
}

export interface FlightCacheEntry {
  flightIdent: string;
  data: FlightInfo;
  timestamp: number;
}

export interface FlightCache {
  [flightIdent: string]: FlightCacheEntry;
}

