/**
 * Flight Service for Atelic App
 * Handles airline autocomplete, flight info API calls, and AsyncStorage caching
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API } from 'aws-amplify';
import { randomUUID } from 'expo-crypto';
import airlines from '../data/airlines.json';
import type {
  Airline,
  FlightInfo,
  FlightReservation,
  FlightCache,
  ParsedFlightNumber,
} from '../types/flight.types';

const FLIGHT_CACHE_KEY = '@flight_cache';
const CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Get airline information by IATA code
 */
export const getAirlineByIATA = (iataCode: string): Airline | undefined => {
  return (airlines as Airline[]).find(
    (airline) => airline.iata === iataCode?.toUpperCase()
  );
};

/**
 * Get airline information by name or ICAO
 */
export const getAirlineByNameOrICAO = (search: string): Airline | undefined => {
  const searchLower = search.toLowerCase();
  return (airlines as Airline[]).find(
    (airline) =>
      airline.name?.toLowerCase() === searchLower ||
      airline.icao?.toLowerCase() === searchLower
  );
};

/**
 * Search for airlines by name or code
 * Used for autocomplete in flight search (NO LOGOS - uses airplane icons)
 */
export const searchAirlines = (query: string): Airline[] => {
  if (!query || query.length < 1) return [];

  const searchTerm = query.toLowerCase();

  return (airlines as Airline[])
    .filter(
      (airline) =>
        airline.active === 'Y' &&
        (airline.name?.toLowerCase().includes(searchTerm) ||
          airline.iata?.toLowerCase().includes(searchTerm) ||
          airline.icao?.toLowerCase().includes(searchTerm))
    )
    .slice(0, 5); // Limit to 5 results
};

/**
 * Get flight information from backend Lambda via REST API
 * Includes AsyncStorage caching for recent user searches
 * @param flightIdent - Flight identifier (e.g., "AA100", "DL123")
 * @param flightDate - Date of the flight (optional, used for filtering specific flight on a date)
 */
export const getFlightInfo = async (flightIdent: string, flightDate?: Date): Promise<FlightInfo> => {
  try {
    // Create cache key with date if provided
    const cacheKey = flightDate
      ? `${flightIdent}_${flightDate.toISOString().split('T')[0]}`
      : flightIdent;

    // Check AsyncStorage cache first
    const cachedData = await getFlightFromCache(cacheKey);
    if (cachedData) {
      console.log('[flightService] Using cached flight data');
      return cachedData;
    }

    console.log('[flightService] Fetching flight from API:', flightIdent, flightDate);

    const dateStr = flightDate ? flightDate.toISOString() : new Date().toISOString();

    // Call Lambda via GraphQL @function
    const query = /* GraphQL */ `
      query GetFlightInfo($flightIdent: String!, $flightDate: String!) {
        getFlightInfo(flightIdent: $flightIdent, flightDate: $flightDate)
      }
    `;

    const result = await API.graphql({
      query,
      variables: {
        flightIdent: flightIdent.toUpperCase(),
        flightDate: dateStr,
      },
      authMode: 'API_KEY',
    });

    const parsed = JSON.parse((result as any).data.getFlightInfo);

    if (!parsed.success) {
      throw new Error(parsed.error || 'Failed to fetch flight');
    }

    const flightData: FlightInfo = parsed.flight;

    // Cache the result
    await cacheFlightData(cacheKey, flightData);

    return flightData;
  } catch (error: any) {
    console.error('[flightService] Error fetching flight:', error.message || error);

    throw new Error(error.message || 'Failed to fetch flight information');
  }
};

/**
 * Cache flight data in AsyncStorage
 */
const cacheFlightData = async (
  flightIdent: string,
  flightData: FlightInfo
): Promise<void> => {
  try {
    const cacheEntry = {
      flightIdent,
      data: flightData,
      timestamp: Date.now(),
    };

    // Get existing cache
    const existingCache = await AsyncStorage.getItem(FLIGHT_CACHE_KEY);
    const cache: FlightCache = existingCache ? JSON.parse(existingCache) : {};

    // Add new entry
    cache[flightIdent.toUpperCase()] = cacheEntry;

    // Clean old entries (older than 2 hours)
    const now = Date.now();
    Object.keys(cache).forEach((key) => {
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
const getFlightFromCache = async (
  flightIdent: string
): Promise<FlightInfo | null> => {
  try {
    const cacheData = await AsyncStorage.getItem(FLIGHT_CACHE_KEY);
    if (!cacheData) return null;

    const cache: FlightCache = JSON.parse(cacheData);
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
export const clearFlightCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(FLIGHT_CACHE_KEY);
    console.log('[flightService] Cache cleared');
  } catch (error) {
    console.error('[flightService] Error clearing cache:', error);
  }
};

/**
 * Parse flight number input
 * Supports formats: "AA100", "AA 100", "AA-100", "B6123", "DL477"
 * Prioritizes 2-char IATA codes (standard), falls back to 3-char if needed
 */
export const parseFlightNumber = (input: string): ParsedFlightNumber | null => {
  if (!input) return null;

  const trimmed = input.trim().toUpperCase().replace(/[-\s]/g, '');

  // Try 2-character airline code first (standard IATA: AA, B6, DL, etc.)
  let match = trimmed.match(/^([A-Z0-9]{2})(\d+)$/);

  // If no match, try 3-character code (ICAO or extended: AAL, DAL, etc.)
  if (!match) {
    match = trimmed.match(/^([A-Z0-9]{3})(\d+)$/);
  }

  if (match) {
    return {
      airlineCode: match[1],
      flightNumber: match[2],
      fullFlightNumber: `${match[1]}${match[2]}`,
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

/**
 * Create a new FlightReservation object from FlightInfo
 */
export const createFlightReservation = (
  flightInfo: FlightInfo,
  options?: {
    confirmationNumber?: string;
    seatNumber?: string;
    notes?: string;
  }
): FlightReservation => {
  return {
    instanceId: randomUUID(),
    flightInfo,
    confirmationNumber: options?.confirmationNumber,
    seatNumber: options?.seatNumber,
    notes: options?.notes,
    addedAt: new Date().toISOString(),
  };
};

/**
 * Format flight time for display
 * @param isoString - ISO date string from API
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export const formatFlightTime = (isoString: string | null | undefined): string => {
  if (!isoString) return '--:--';

  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '--:--';
  }
};

/**
 * Format flight date for display
 * @param isoString - ISO date string from API
 * @returns Formatted date string (e.g., "Jan 5, 2026")
 */
export const formatFlightDate = (isoString: string | null | undefined): string => {
  if (!isoString) return '';

  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

/**
 * Get flight status color for UI
 */
export const getFlightStatusColor = (status: string): string => {
  const statusLower = status?.toLowerCase() || '';

  if (statusLower.includes('cancel')) return '#DC2626'; // Red
  if (statusLower.includes('delay')) return '#F59E0B'; // Orange
  if (statusLower.includes('land') || statusLower.includes('arriv')) return '#10B981'; // Green
  if (statusLower.includes('board') || statusLower.includes('gate')) return '#3B82F6'; // Blue
  if (statusLower.includes('in air') || statusLower.includes('en route')) return '#8B5CF6'; // Purple

  return '#6B7280'; // Gray for scheduled/unknown
};

