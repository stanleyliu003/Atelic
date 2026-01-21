/**
 * Utility for matching city names with fuzzy logic
 * Handles cases like "Rome" matching "Rome, Metropolitan City of Rome Capital, Italy"
 */

/**
 * Normalize city name by removing common suffixes and formatting
 */
function normalizeCityName(cityName: string): string {
  if (!cityName) return '';
  
  // Convert to lowercase and trim
  let normalized = cityName.toLowerCase().trim();
  
  // Remove common suffixes and country names
  const patternsToRemove = [
    /,.*$/,  // Remove everything after comma
    /\s+(city|metropolitan|province|region|state|county|district|area).*$/i,
  ];
  
  for (const pattern of patternsToRemove) {
    normalized = normalized.replace(pattern, '');
  }
  
  return normalized.trim();
}

/**
 * Check if two city names match
 * @param city1 - First city name (e.g., "Rome" from Gemini)
 * @param city2 - Second city name (e.g., "Rome, Metropolitan City of Rome Capital, Italy" from Google)
 * @returns true if cities match, false otherwise
 */
export function citiesMatch(city1: string, city2: string): boolean {
  if (!city1 || !city2) return false;
  
  // Exact match (case insensitive)
  if (city1.toLowerCase().trim() === city2.toLowerCase().trim()) {
    return true;
  }
  
  // Normalize both city names
  const normalized1 = normalizeCityName(city1);
  const normalized2 = normalizeCityName(city2);
  
  // Check if normalized names match
  if (normalized1 === normalized2) {
    return true;
  }
  
  // Check if one city name is contained within the other (after normalization)
  if (normalized1 && normalized2) {
    if (normalized2.includes(normalized1) || normalized1.includes(normalized2)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter saved places by city
 * @param savedPlaces - Array of saved places from getSavedPlaces query
 * @param targetCity - Target city to match (e.g., selectedCity from trip)
 * @returns Filtered array of saved places that match the target city
 */
export function filterSavedPlacesByCity(
  savedPlaces: any[],
  targetCity: string
): any[] {
  if (!savedPlaces || !targetCity) return [];
  
  return savedPlaces.filter((savedPlace) => {
    const placeCity = savedPlace.city || savedPlace.activity?.city;
    return placeCity && citiesMatch(placeCity, targetCity);
  });
}
