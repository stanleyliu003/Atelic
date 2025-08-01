// Define a type for our activity data for better type safety
export type Activity = {
  name: string;
  city?: string;
  lat: number | null;
  lng: number | null;
  place_id?: string;
  rating?: number;
  types?: string[];
  photo_reference?: string;
  formatted_address?: string;
  user_ratings_total?: number;
  is_recommended?: boolean;
};

// Tab type for navigation between wishlist and different days
export type TabType = 'wishlist' | `day${number}`;

// Types for activity selection and management
export type ActivitySelectionState = {
  selectedActivities: string[]; // Array of place_ids
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