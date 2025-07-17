import { createContext, useContext, useState } from "react";
// import { v4 as uuidv4 } from 'uuid'; // Commented out for now

// Define the shape of our context data
const CreateTripContext = createContext();

// Custom hook to use the context
export const useCreateTrip = () => {
    const context = useContext(CreateTripContext);
    if (!context) {
        throw new Error('useCreateTrip must be used within a CreateTripProvider');
    }
    return context;
};

// Provider component
export const CreateTripProvider = ({ children }) => {
    // const [tripId, setTripId] = useState(null); // Commented out for now
    const [tripId, setTripId] = useState('test-trip-id'); // Use fixed tripId for testing
    console.log('[CreateTripContext] tripId initialized:', tripId);
    const [activities, setActivities] = useState([]);
    const [wishlistText, setWishlistText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Store polylines per day: { [dayNumber]: encodedPolyline }
    const [dayPolylines, setDayPolylines] = useState({});
    // Add dayActivities state for restoring days
    const [dayActivities, setDayActivities] = useState({});

    // Setter for a day's polyline
    const setDayPolyline = (dayNumber, encodedPolyline) => {
        setDayPolylines(prev => ({
            ...prev,
            [dayNumber]: encodedPolyline,
        }));
    };

    // Setter for all day polylines at once
    const setAllDayPolylines = (days) => {
        const polylines = {};
        days.forEach(day => {
            if (day.encodedPolyline) {
                polylines[day.dayNumber] = day.encodedPolyline;
            }
        });
        setDayPolylines(polylines);
    };

    // Setter for all day activities at once
    const setAllDayActivities = (days) => {
        const activitiesByDay = {};
        days.forEach(day => {
            activitiesByDay[day.dayNumber] = { activities: day.activities };
        });
        console.log('[CONTEXT] setAllDayActivities called. New value:', activitiesByDay);
        setDayActivities(activitiesByDay);
    };

    // Direct setter for dayActivities (if used elsewhere)
    const setDayActivitiesWithLog = (newVal) => {
        console.log('[CONTEXT] setDayActivities called. New value:', newVal);
        setDayActivities(newVal);
    };

    // Restore all trip state from a trip object
    const restoreTripFromObject = (trip) => {
        console.log('[CONTEXT] restoreTripFromObject called with:', trip);
        setTripId(trip.tripId);
        updateActivities(trip.wishlist);
        setAllDayActivities(trip.days);
        setAllDayPolylines(trip.days);
    };

    const updateActivities = (newActivities) => {
        setActivities(newActivities);
    };

    const removeActivities = (activityIds) => {
        setActivities(prevActivities => 
            prevActivities.filter(activity => 
                !activity.place_id || !activityIds.includes(activity.place_id)
            )
        );
    };

    const updateWishlistText = (text) => {
        setWishlistText(text);
    };

    const setTripIdWithLog = (id) => {
        console.log('[CreateTripContext] setTripId called with:', id);
        setTripId(id);
    };

    // Helper to generate and set a new tripId (UUID)
    // const generateTripId = () => {
    //     const newId = uuidv4();
    //     setTripId(newId);
    //     return newId;
    // };

    const value = {
        tripId,
        setTripId: setTripIdWithLog,
        // generateTripId, // Commented out for now
        activities,
        wishlistText,
        isLoading,
        updateActivities,
        removeActivities,
        updateWishlistText,
        setIsLoading,
        dayPolylines,
        setDayPolyline,
        setAllDayPolylines,
        dayActivities,
        setAllDayActivities,
        restoreTripFromObject,
        setDayActivities: setDayActivitiesWithLog,
    };

    return (
        <CreateTripContext.Provider value={value}>
            {children}
        </CreateTripContext.Provider>
    );
};