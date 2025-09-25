import { useEffect } from 'react';
import { useCreateTrip } from '../../context/CreateTripContext';
import CreateTrip1City from '../create-trip/create_trip_1_city';

export default function Create_New_Trip() {
  const { completeReset } = useCreateTrip();

  useEffect(() => {
    // Always clear cached data when this tab opens
    const performReset = async () => {
      await completeReset();
    };
    performReset();
  }, []); // Empty dependency array - only run on mount

  // Render the city selection component directly within this tab
  return <CreateTrip1City showBackButton={false} />;
}