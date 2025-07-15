import { createContext, useContext, useState } from "react";
import { v4 as uuidv4 } from 'uuid';

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
    const [tripId, setTripId] = useState(null); // Add tripId state
    const [activities, setActivities] = useState([]);
    const [wishlistText, setWishlistText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Store polylines per day: { [dayNumber]: encodedPolyline }
    const [dayPolylines, setDayPolylines] = useState({});

    // Setter for a day's polyline
    const setDayPolyline = (dayNumber, encodedPolyline) => {
        setDayPolylines(prev => ({
            ...prev,
            [dayNumber]: encodedPolyline,
        }));
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

    const clearTripData = () => {
        setActivities([]);
        setWishlistText('');
        setTripId(null); // Clear tripId when clearing trip data
        setDayPolylines({}); // Clear polylines as well
    };

    // Helper to generate and set a new tripId (UUID)
    const generateTripId = () => {
        const newId = uuidv4();
        setTripId(newId);
        return newId;
    };

    const value = {
        tripId,
        setTripId,
        generateTripId, // Expose helper to generate a new tripId
        activities,
        wishlistText,
        isLoading,
        updateActivities,
        removeActivities,
        updateWishlistText,
        setIsLoading,
        clearTripData,
        dayPolylines,
        setDayPolyline,
    };

    return (
        <CreateTripContext.Provider value={value}>
            {children}
        </CreateTripContext.Provider>
    );
};