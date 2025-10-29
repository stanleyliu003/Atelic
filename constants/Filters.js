/**
 * Explore page filter definitions
 * These filters are used to refine search and category results
 */

// Filters for users under 18
export const FILTERS_UNDER_18 = [
  { id: 'kid_friendly', label: 'Family Friendly', emoji: '🎈' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎮' },
  { id: 'outdoor', label: 'Outdoor', emoji: '🌳' },
  { id: 'scenic', label: 'Scenic Photospots', emoji: '📸' },
  { id: 'local_favorite', label: 'Local Favorites', emoji: '⭐' },
  { id: 'group_friendly', label: 'Group Friendly', emoji: '👥' },
];

// Filters for users 18 and over
export const FILTERS_OVER_18 = [
  { id: 'outdoor', label: 'Outdoor', emoji: '🌳' },
  { id: 'culture', label: 'Culture', emoji: '🎭' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🌃' },
  { id: 'romantic', label: 'Romantic', emoji: '❤️' },
  { id: 'scenic', label: 'Scenic Photospots', emoji: '📸' },
  { id: 'local_favorite', label: 'Local Favorites', emoji: '⭐' },
];

// Legacy export for backwards compatibility (defaults to over 18)
export const EXPLORE_FILTERS = FILTERS_OVER_18;