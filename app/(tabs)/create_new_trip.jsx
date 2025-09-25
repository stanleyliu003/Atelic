import { useEffect } from 'react';
import { useCreateTrip } from '../../context/CreateTripContext';
import CreateTrip1City from '../create-trip/create_trip_1_city';

export default function Create_New_Trip() {
  const { completeReset } = useCreateTrip();

  useEffect(() => {
    const initializeNewTrip = async () => {
      // Reset all trip data and cache before starting fresh
      await completeReset();
    };

    initializeNewTrip();
  }, []);

  // Render the city selection component directly within this tab
  return <CreateTrip1City showBackButton={false} />;
}