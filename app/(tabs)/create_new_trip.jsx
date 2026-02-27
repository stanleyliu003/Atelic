import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useCreateTrip } from '../../context/CreateTripContext';
import CreateTrip1City from '../create-trip/create_trip_1_city';

export default function Create_New_Trip() {
  const { completeReset } = useCreateTrip();
  const params = useLocalSearchParams();


  useEffect(() => {
    // Always clear cached data when this tab opens
    const performReset = async () => {
      await completeReset();
    };
    performReset();
  }, [params.ts]); // Empty dependency array - only run on mount

  // Render the city selection component directly within this tab
  // Pass prefilledCity and fromSavedPlaces props if they exist in params
  return <CreateTrip1City 
    showBackButton={false} 
    prefilledCity={params.prefilledCity}
    fromSavedPlaces={params.fromSavedPlaces}
  />;
}