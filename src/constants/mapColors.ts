import { TabType } from '../types/activity.types';

// Color scheme for different days - using vibrant, distinguishable colors
export const MAP_MARKER_COLORS = {
  wishlist: 'red', // Coral red for wishlist
  day1: 'blue',   
  day2: 'orange',     
  day3: 'purple',    
  day4: 'yellow',     
  day5: 'green',     
  day6: 'pink',   
  day7: 'cyan',     
} as const;

// Fallback colors for days beyond 7
const FALLBACK_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

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