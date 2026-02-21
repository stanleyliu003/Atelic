// src/types/city.types.ts

/**
 * Represents a city in a multi-city trip
 */
export type TripCity = {
  cityId: string;            
  name: string;              
  location: Location;        // Lat/lng for map centering
  order: number;             // Sequence in trip (0, 1, 2...)
  startDate: string;         // ISO format
  endDate: string;           // ISO format
  photoReference?: string;   
  travelToNext?: TravelSegment; // How to get to next city
};

/**
 * Geographic location
 */
export type Location = {
  lat: number;
  lng: number;
  placeId?: string;          // Google Place ID
};

/**
 * Travel information between cities
 */
export type TravelSegment = {
  mode: TravelMode;          // Transportation method
  duration?: number;         // Travel time in minutes
  distance?: number;         
  departureTime?: string;    
  arrivalTime?: string;      
  notes?: string;            // User notes (e.g., "Book Eurostar")
};

/**
 * Available travel modes between cities
 */
export type TravelMode = 'FLIGHT' | 'TRAIN' | 'CAR' | 'BUS' | 'FERRY';

/**
 * Result from travel routing service
 */
export type TravelOptions = {
  options: TravelSegment[];
  recommended: TravelMode;
};