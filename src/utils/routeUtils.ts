// Utility functions for formatting route data

export function formatDistance(meters: number): string {
  // Convert meters to miles (1 mile = 1609.34 meters)
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

export function formatDuration(duration: string): string {
  // Google returns duration in format like "225s" (seconds)
  // Convert to minutes format only (round up)
  const secondsMatch = duration.match(/(\d+)s/);
  if (secondsMatch) {
    const totalSeconds = parseInt(secondsMatch[1]);
    return formatDurationFromSecondsMinutesOnly(totalSeconds);
  }
  
  // Fallback: try to parse other formats like "15m 30s" or 2h 15m
  const timeMatch = duration.match(/(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1] || '0');
    const minutes = parseInt(timeMatch[2] || '0');
    const seconds = parseInt(timeMatch[3] || '0');
    
    const totalMinutes = hours * 60 + minutes;
    
    // Round up if there are any seconds
    const finalMinutes = seconds > 0 ? totalMinutes + 1 : totalMinutes;
    
    if (finalMinutes > 0) {
      return `${finalMinutes} min`;
    } else {
      return "1m"; // Minimum 1 minute for any duration
    }
  }
  return duration; // Fallback to original format
}

export function formatDurationFromSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    if (remainingSeconds > 0) {
      return `${minutes} min ${remainingSeconds}s`;
    } else {
      return `${minutes} min`;
    }
  } else {
    return `${remainingSeconds}s`;
  }
}

export function formatDurationFromSecondsMinutesOnly(seconds: number): string {
  // Round up to the next minute if there are any seconds
  const minutes = Math.ceil(seconds / 60);
  
  // Ensure minimum of 1 minute
  const finalMinutes = Math.max(minutes, 1);
  
  return `${finalMinutes} min`;
} 