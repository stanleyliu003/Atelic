// Utility functions for formatting route data

export function formatDistance(meters: number): string {
  // Convert meters to miles (1 mile = 1609.34 meters)
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)}mi`;
}

export function formatDuration(duration: string): string {
  // Google returns duration in format like "225s" (seconds)
  // Convert to minutes and seconds format
  const secondsMatch = duration.match(/(\d+)s/);
  if (secondsMatch) {
    const totalSeconds = parseInt(secondsMatch[1]);
    return formatDurationFromSeconds(totalSeconds);
  }
  
  // Fallback: try to parse other formats like "15m 30s" or "2h 15m"
  const timeMatch = duration.match(/(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1] || '0');
    const minutes = parseInt(timeMatch[2] || '0');
    const seconds = parseInt(timeMatch[3] || '0');
    
    const totalMinutes = hours * 60 + minutes;
    const totalSeconds = seconds;
    
    if (totalMinutes > 0) {
      if (totalSeconds > 0) {
        return `${totalMinutes}m ${totalSeconds}s`;
      } else {
        return `${totalMinutes}m`;
      }
    } else {
      return `${totalSeconds}s`;
    }
  }
  return duration; // Fallback to original format
}

export function formatDurationFromSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    if (remainingSeconds > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${minutes}m`;
    }
  } else {
    return `${remainingSeconds}s`;
  }
} 