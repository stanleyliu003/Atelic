import { TabType } from '../types/activity.types';

// iOS-inspired subtle color palette for different days
export const MAP_MARKER_COLORS = {
  wishlist: '#FF3B30',  // iOS Red
  day1: '#007AFF',      // iOS Blue
  day2: '#AF52DE',      // iOS Purple
  day3: '#34C759',      // iOS Green
  day4: '#FF9500',      // iOS Orange
  day5: '#FF2D55',      // iOS Pink
  day6: '#5856D6',      // iOS Indigo
  day7: '#5AC8FA',      // iOS Teal
} as const;

// Fallback colors for days beyond 7 - subtle, iOS-inspired palette
const FALLBACK_COLORS = [
  '#007AFF',  // Blue
  '#AF52DE',  // Purple
  '#34C759',  // Green
  '#FF9500',  // Orange
  '#FF2D55',  // Pink
  '#5856D6',  // Indigo
  '#5AC8FA',  // Teal
  '#FFCC00',  // Yellow
  '#FF3B30',  // Red
  '#8E8E93',  // Gray
];

export const getMarkerColor = (activeTab: TabType): string => {
  // Check if we have a predefined color for this tab
  if (activeTab in MAP_MARKER_COLORS) {
    return MAP_MARKER_COLORS[activeTab as keyof typeof MAP_MARKER_COLORS];
  }
  
  // For days beyond 7, cycle through colors
  if (activeTab.startsWith('day')) {
    const dayNumber = parseInt(activeTab.replace('day', ''));
    return FALLBACK_COLORS[(dayNumber - 1) % FALLBACK_COLORS.length];
  }
  
  // Default fallback
  return MAP_MARKER_COLORS.wishlist;
}; 