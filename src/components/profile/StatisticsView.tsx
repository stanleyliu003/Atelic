import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { TravelGlobe } from './TravelGlobe';

interface Trip {
  tripId: string;
  selectedCity?: string;
  selectedCityLocation?: {
    lat: number;
    lng: number;
  };
  country?: string;
  startDate?: string;
  endDate?: string;
}

interface StatisticsViewProps {
  trips: Trip[];
  pastTrips: Trip[];
  upcomingTrips: Trip[];
  countriesVisited: number;
  citiesVisited: number;
  followersCount: number;
  followingCount: number;
  currentUserID?: string;
}

// City coordinates lookup
const CITY_COORDINATES: { [key: string]: { lat: number; lng: number } } = {
  // USA
  'new york': { lat: 40.7128, lng: -74.0060 },
  'new york city': { lat: 40.7128, lng: -74.0060 },
  'nyc': { lat: 40.7128, lng: -74.0060 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'la': { lat: 34.0522, lng: -118.2437 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'miami': { lat: 25.7617, lng: -80.1918 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'sf': { lat: 37.7749, lng: -122.4194 },
  'las vegas': { lat: 36.1699, lng: -115.1398 },
  'vegas': { lat: 36.1699, lng: -115.1398 },
  'boston': { lat: 42.3601, lng: -71.0589 },
  'seattle': { lat: 47.6062, lng: -122.3321 },
  'denver': { lat: 39.7392, lng: -104.9903 },
  'nashville': { lat: 36.1627, lng: -86.7816 },
  'austin': { lat: 30.2672, lng: -97.7431 },
  'atlanta': { lat: 33.7490, lng: -84.3880 },
  'orlando': { lat: 28.5383, lng: -81.3792 },
  'hawaii': { lat: 19.8968, lng: -155.5828 },
  'honolulu': { lat: 21.3069, lng: -157.8583 },
  'maui': { lat: 20.7984, lng: -156.3319 },
  'portland': { lat: 45.5152, lng: -122.6784 },
  'san diego': { lat: 32.7157, lng: -117.1611 },
  'houston': { lat: 29.7604, lng: -95.3698 },
  'dallas': { lat: 32.7767, lng: -96.7970 },
  'phoenix': { lat: 33.4484, lng: -112.0740 },
  'new orleans': { lat: 29.9511, lng: -90.0715 },
  'washington': { lat: 38.9072, lng: -77.0369 },
  'washington dc': { lat: 38.9072, lng: -77.0369 },
  'dc': { lat: 38.9072, lng: -77.0369 },
  'philadelphia': { lat: 39.9526, lng: -75.1652 },
  'savannah': { lat: 32.0809, lng: -81.0912 },
  'charleston': { lat: 32.7765, lng: -79.9311 },
  'aspen': { lat: 39.1911, lng: -106.8175 },
  'key west': { lat: 24.5551, lng: -81.7800 },
  'napa': { lat: 38.2975, lng: -122.2869 },
  'tampa': { lat: 27.9506, lng: -82.4572 },
  'fort lauderdale': { lat: 26.1224, lng: -80.1373 },
  // Mexico
  'cancun': { lat: 21.1619, lng: -86.8515 },
  'mexico city': { lat: 19.4326, lng: -99.1332 },
  'cabo san lucas': { lat: 22.8905, lng: -109.9167 },
  'cabo': { lat: 22.8905, lng: -109.9167 },
  'los cabos': { lat: 22.8905, lng: -109.9167 },
  'playa del carmen': { lat: 20.6296, lng: -87.0739 },
  'tulum': { lat: 20.2114, lng: -87.4654 },
  'puerto vallarta': { lat: 20.6534, lng: -105.2253 },
  // Canada
  'toronto': { lat: 43.6532, lng: -79.3832 },
  'vancouver': { lat: 49.2827, lng: -123.1207 },
  'montreal': { lat: 45.5017, lng: -73.5673 },
  'banff': { lat: 51.1784, lng: -115.5708 },
  'whistler': { lat: 50.1163, lng: -122.9574 },
  // Europe
  'london': { lat: 51.5074, lng: -0.1278 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'barcelona': { lat: 41.3874, lng: 2.1686 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'lisbon': { lat: 38.7223, lng: -9.1393 },
  'prague': { lat: 50.0755, lng: 14.4378 },
  'vienna': { lat: 48.2082, lng: 16.3738 },
  'dublin': { lat: 53.3498, lng: -6.2603 },
  'florence': { lat: 43.7696, lng: 11.2558 },
  'venice': { lat: 45.4408, lng: 12.3155 },
  'milan': { lat: 45.4642, lng: 9.1900 },
  'munich': { lat: 48.1351, lng: 11.5820 },
  'santorini': { lat: 36.3932, lng: 25.4615 },
  'mykonos': { lat: 37.4467, lng: 25.3289 },
  'ibiza': { lat: 38.9067, lng: 1.4206 },
  'amalfi': { lat: 40.6340, lng: 14.6027 },
  'positano': { lat: 40.6280, lng: 14.4850 },
  // Asia
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'bangkok': { lat: 13.7563, lng: 100.5018 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  'seoul': { lat: 37.5665, lng: 126.9780 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'bali': { lat: -8.3405, lng: 115.0920 },
  'kyoto': { lat: 35.0116, lng: 135.7681 },
  'phuket': { lat: 7.8804, lng: 98.3923 },
  // Australia & Oceania
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'melbourne': { lat: -37.8136, lng: 144.9631 },
  'auckland': { lat: -36.8485, lng: 174.7633 },
  'fiji': { lat: -17.7134, lng: 178.0650 },
  'bora bora': { lat: -16.5004, lng: -151.7415 },
  // South America
  'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
  'rio': { lat: -22.9068, lng: -43.1729 },
  'buenos aires': { lat: -34.6037, lng: -58.3816 },
  'lima': { lat: -12.0464, lng: -77.0428 },
  'cartagena': { lat: 10.3910, lng: -75.4794 },
  'cusco': { lat: -13.5319, lng: -71.9675 },
  'machu picchu': { lat: -13.1631, lng: -72.5450 },
  // Africa
  'cape town': { lat: -33.9249, lng: 18.4241 },
  'cairo': { lat: 30.0444, lng: 31.2357 },
  'marrakech': { lat: 31.6295, lng: -7.9811 },
  // Caribbean
  'puerto rico': { lat: 18.2208, lng: -66.5901 },
  'san juan': { lat: 18.4655, lng: -66.1057 },
  'jamaica': { lat: 18.1096, lng: -77.2975 },
  'bahamas': { lat: 25.0343, lng: -77.3963 },
  'aruba': { lat: 12.5211, lng: -69.9683 },
  'punta cana': { lat: 18.5601, lng: -68.3725 },
  'turks and caicos': { lat: 21.6940, lng: -71.7979 },
  'st barts': { lat: 17.9000, lng: -62.8333 },
  'cayman islands': { lat: 19.3133, lng: -81.2546 },
};

const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s,]/g, '')
    .trim();
};

const getCityCoordinates = (cityName: string): { lat: number; lng: number } | null => {
  if (!cityName) return null;
  const normalized = normalizeString(cityName);
  const firstPart = normalized.split(',')[0].trim();

  if (CITY_COORDINATES[normalized]) return CITY_COORDINATES[normalized];
  if (CITY_COORDINATES[firstPart]) return CITY_COORDINATES[firstPart];

  const withoutSuffix = firstPart.replace(/ (city|beach|island|islands|area|metro|county)$/i, '').trim();
  if (CITY_COORDINATES[withoutSuffix]) return CITY_COORDINATES[withoutSuffix];

  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (normalized.includes(key) || firstPart.includes(key) || key.includes(firstPart)) {
      return coords;
    }
  }

  const words = firstPart.split(' ');
  for (const word of words) {
    if (word.length > 3 && CITY_COORDINATES[word]) {
      return CITY_COORDINATES[word];
    }
  }

  console.warn('[StatisticsView] No coordinates found for city:', cityName);
  return null;
};

export function StatisticsView({
  pastTrips,
  upcomingTrips,
}: StatisticsViewProps) {
  const visitedCities = useMemo(() => {
    const cities: { name: string; lat: number; lng: number }[] = [];
    const seenCities = new Set<string>();

    [...pastTrips, ...upcomingTrips].forEach(trip => {
      if (trip.selectedCity) {
        const normalizedName = normalizeString(trip.selectedCity);
        if (!seenCities.has(normalizedName)) {
          seenCities.add(normalizedName);
          if (trip.selectedCityLocation?.lat && trip.selectedCityLocation?.lng) {
            cities.push({
              name: trip.selectedCity,
              lat: trip.selectedCityLocation.lat,
              lng: trip.selectedCityLocation.lng,
            });
          } else {
            const coords = getCityCoordinates(trip.selectedCity);
            if (coords) {
              cities.push({ name: trip.selectedCity, ...coords });
            }
          }
        }
      }
    });
    console.log('[Globe] Total cities:', cities.length, cities.map(c => c.name));
    return cities;
  }, [pastTrips, upcomingTrips]);

  return (
    <View style={styles.container}>
      <View style={styles.globeSection}>
        <TravelGlobe cities={visitedCities} size={300} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  globeSection: {
    alignItems: 'center',
  },
});
