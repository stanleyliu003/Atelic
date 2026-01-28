// Define types for complex place data

export type TimeOfDay = {
  day?: number;
  time?: string;
  date?: string;
  truncated?: boolean;
};

export type OpeningPeriod = {
  open?: TimeOfDay;
  close?: TimeOfDay;
};

export type OpeningHours = {
  open_now?: boolean;
  periods?: OpeningPeriod[];
  weekday_text?: string[];
};

export type PlaceReview = {
  author_name?: string;
  rating?: number;
  text?: string;
  time?: number;
  author_url?: string;
  profile_photo_url?: string;
};

// Define a type for our activity data for better type safety
export type Activity = {
  instanceId?: string; // Unique identifier for each activity instance (allows duplicates of same place)
  savedPlaceId?: string; // Unique identifier from SavedPlaces DynamoDB table (for Instagram-saved places)
  name: string;
  city?: string;
  lat: number | null;
  lng: number | null;
  place_id?: string;
  rating?: number;
  types?: string[]; // Deprecated: Use primaryType instead, kept for backward compatibility
  primaryType?: string;
  photo_reference?: string;
  formatted_address?: string;
  user_ratings_total?: number;
  is_recommended?: boolean;
  // New enhanced fields
  display_name?: string;
  website_uri?: string;
  regular_opening_hours?: OpeningHours;
  reviews?: PlaceReview[];
  editorial_summary?: string;
  primary_type_display_name?: string;
  international_phone_number?: string;
  // Activity notes and time tracking
  notes?: string;
  startTime?: string; // Format: "HH:mm" (e.g., "09:30")
  endTime?: string;   // Format: "HH:mm" (e.g., "17:45")

  // Lodging/Hotel specific fields
  isLodging?: boolean; // Flag to identify lodging activities (hotels, accommodations)
  lodgingCheckIn?: string; // ISO date string for check-in date
  lodgingCheckOut?: string; // ISO date string for check-out date
  lodgingTime?: { // Check-in and check-out times
    checkIn: string; // Format: "HH:mm" (e.g., "15:00")
    checkOut: string; // Format: "HH:mm" (e.g., "11:00")
  };

  // Source tracking (from SavedPlaces)
  source?: string; // Source platform (e.g., "instagram", "google", etc.)
  sourceUrl?: string; // Original URL from the source platform

  // Real-time collaboration timestamps
  lastModified?: number; // Timestamp when this activity was last modified
  modifiedBy?: string; // UserID who last modified
  lastReordered?: number; // Timestamp when this activity was last reordered

  // Category association (from city category exploration)
  category?: string; // Category this activity belongs to (e.g., "Academic Hubs", "Historic Footsteps")
};

// Tab type for navigation between overview, wishlist and different days
export type TabType = 'overview' | 'wishlist' | `day${number}`;

// Types for activity selection and management
export type ActivitySelectionState = {
  selectedActivities: string[]; // Array of instanceIds (not place_ids, to support duplicates)
  isSelectionMode: boolean;
};

export type ActivityTransferAction = {
  type: 'TRANSFER_TO_DAY' | 'TRANSFER_TO_WISHLIST';
  activityIds: string[];
  targetDay?: number;
};

export type ActivityCardVariant = 'default' | 'selectable' | 'transferable' | 'readonly';

// Types for activity lists in different contexts
export type ActivityListProps = {
  activities: Activity[];
  selectedActivities?: string[];
  onActivitySelect?: (activityId: string) => void;
  onActivityDeselect?: (activityId: string) => void;
  variant?: ActivityCardVariant;
  disabled?: boolean;
};

// Types for day-based activity management
export type DayActivities = {
  [dayNumber: number]: Activity[];
};

export type ActivityDayAssignment = {
  activityId: string;
  dayNumber: number;
  position?: number; // For ordering within the day
}; 

// New type for day with encoded polyline
export type DayWithPolyline = {
  dayNumber: number;
  activities: Activity[];
  encodedPolyline?: string; // Store the encoded polyline for the day's route
};

// New type for the full trip data model
export type TripData = {
  tripId: string;
  days: DayWithPolyline[];
  wishlist: Activity[];
  wishlistText: string;
};

// Transportation mode types
export type TravelMode = 'WALK' | 'DRIVE' | 'TRANSIT';

export interface RouteLegModeData {
  distance: number;
  duration: string;
  polyline: string;
}

export interface EnhancedRouteLeg {
  // Cached data for all modes
  modeData: {
    DRIVE?: RouteLegModeData;
    WALK?: RouteLegModeData;
    TRANSIT?: RouteLegModeData;
  };
  // Currently selected mode
  selectedMode: TravelMode;
  // Loading states
  loadingModes: TravelMode[];
}

export interface RouteData {
  polyline: any[]; // Combined polyline from all legs
  legs: EnhancedRouteLeg[];
  totalDistance: number;
  totalDuration: string;
  travelMode: string; // For backward compatibility
}
