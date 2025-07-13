import { createContext, useContext, useState } from "react";

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
    const [activities, setActivities] = useState([]);
    const [wishlistText, setWishlistText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
    };

    const value = {
        activities,
        wishlistText,
        isLoading,
        updateActivities,
        removeActivities,
        updateWishlistText,
        setIsLoading,
        clearTripData
    };

    return (
        <CreateTripContext.Provider value={value}>
            {children}
        </CreateTripContext.Provider>
    );
};