import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CountrySavedPlacesModal } from '../src/components/saved-places/CountrySavedPlacesModal';

export const COUNTRY_PLACES_TEMP_KEY = '@atelic/country_places_temp';

export default function SavedPlacesCountryPage() {
  const router = useRouter();
  const [data, setData] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(COUNTRY_PLACES_TEMP_KEY).then(stored => {
      if (stored) setData(JSON.parse(stored));
    });
  }, []);

  if (!data) return null;

  return (
    <CountrySavedPlacesModal
      countryName={data.countryName}
      places={data.places}
      onClose={() => router.back()}
      onPlaceDeleted={() => {}}
    />
  );
}
