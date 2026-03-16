import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CitySavedPlacesModal } from '../src/components/saved-places/CitySavedPlacesModal';

export const CITY_PLACES_TEMP_KEY = '@atelic/city_places_temp';

export default function SavedPlacesCityPage() {
  const router = useRouter();
  const [data, setData] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(CITY_PLACES_TEMP_KEY).then(stored => {
      if (stored) setData(JSON.parse(stored));
    });
  }, []);

  if (!data) return null;

  return (
    <CitySavedPlacesModal
      cityName={data.cityName}
      places={data.places}
      isCountry={data.isCountry}
      onClose={() => router.back()}
      onPlaceDeleted={() => {}}
    />
  );
}
