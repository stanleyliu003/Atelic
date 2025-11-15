/**
 * Formats a day tab label based on the start date and day number.
 *
 * @param startDate - ISO date string (e.g., "2025-11-13") or null
 * @param dayNumber - Day number starting from 1
 * @returns Formatted string like "Thu 11/13" if startDate exists, otherwise "Day X"
 */
export function formatDayTab(startDate: string | null, dayNumber: number): string {
  // Fallback to generic day label if no start date
  if (!startDate) {
    return `Day ${dayNumber}`;
  }

  try {
    // Parse the ISO date string and treat it as local time (not UTC)
    // This prevents timezone shift issues when date string is in YYYY-MM-DD format
    const [year, month, day] = startDate.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn(`[dateFormatting] Invalid startDate: ${startDate}, falling back to Day ${dayNumber}`);
      return `Day ${dayNumber}`;
    }

    // Add (dayNumber - 1) days to get the current day
    date.setDate(date.getDate() + (dayNumber - 1));

    // Get weekday abbreviation
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekday = weekdays[date.getDay()];

    // Get month and day
    const displayMonth = date.getMonth() + 1; // JavaScript months are 0-indexed
    const displayDay = date.getDate();

    return `${weekday} ${displayMonth}/${displayDay}`;
  } catch (error) {
    console.error(`[dateFormatting] Error formatting date for day ${dayNumber}:`, error);
    return `Day ${dayNumber}`;
  }
}

/**
 * Formats a full date for display.
 *
 * @param dateString - ISO date string (e.g., "2025-11-13")
 * @returns Formatted string like "Thursday, November 13, 2025"
 */
export function formatFullDate(dateString: string | null): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return '';
    }

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('[dateFormatting] Error formatting full date:', error);
    return '';
  }
}
