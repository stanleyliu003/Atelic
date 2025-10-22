// Array of avatar background colors
export const avatarColors = [
  '#007AFF', // Blue
  '#FF6B35', // Orange
  '#9C27B0', // Purple
  '#800080', // Light Blue
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#FFC107', // Amber
  '#FF0000', // Red
  '#ED68B6', // Red Pink
  '#8BC34A', // Light Green
];

/**
 * Hash function to consistently assign colors based on user identifier
 * @param identifier - Unique identifier for the user (typically email)
 * @returns Hex color code
 */
export const getAvatarColor = (identifier: string): string => {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
};
