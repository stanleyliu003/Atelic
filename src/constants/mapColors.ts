import { TabType } from '../types/activity.types';

// Color scheme for different days - using vibrant, distinguishable colors
export const MAP_MARKER_COLORS = {
  wishlist: 'red', // Coral red for wishlist
  day1: 'blue',   
  day2: 'purple',     
  day3: 'green',    
  day4: 'orange',     
  day5: 'magenta',     
  day6: 'brown',   
  day7: 'cyan',     
} as const;

// Fallback colors for days beyond 7
const FALLBACK_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFEAA7', '#8B0000', '#DDA0DD', '#98D8C8'];

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