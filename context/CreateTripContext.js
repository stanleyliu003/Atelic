import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { v4 as uuidv4 } from 'uuid'; // Commented out for now

// Define the shape of our context data
const CreateTripContext = createContext();

// Cache keys for trip creation flow
const CACHE_KEYS = {
    SELECTED_CITY: 'create_trip_selected_city',
    CITY_PHOTO_REF: 'create_trip_city_photo_ref',
    CITY_CATEGORIES: 'create_trip_city_categories'
};

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
    const [activities, setActivities] = useState([]); // Each activity now supports formatted_address
    const [wishlistText, setWishlistText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [createdAt, setCreatedAt] = useState(null);
    const [isCreatingTrip, setIsCreatingTrip] = useState(false);
    const [selectedCity, setSelectedCity] = useState('');
    const [tripLength, setTripLength] = useState(null);
    const [cityCategories, setCityCategories] = useState(null);
    const [selectedCategories, setSelectedCategories] = useState([]);
    
    // Add logging to setTripLength
    const setTripLengthWithLog = (length) => {
        setTripLength(length);
    };

    // Add logging when tripLength changes
    useEffect(() => {
    }, [tripLength]);

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
        setDayActivities(activitiesByDay);
    };

    // Direct setter for dayActivities (if used elsewhere)
    const setDayActivitiesWithLog = (newVal) => {
        setDayActivities(newVal);
    };

    // Restore all trip state from a trip object
    const restoreTripFromObject = (trip) => {
        setTripId(trip.tripId);
        updateActivities(trip.wishlist);
        setAllDayActivities(trip.days);
        setAllDayPolylines(trip.days);
        // Restore tripLength if available, otherwise derive from days
        if (trip.tripLength) {
            setTripLength(trip.tripLength);
        } else if (trip.days && trip.days.length > 0) {
            // Derive tripLength from the number of days if not explicitly stored
            setTripLength(trip.days.length);
        }
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

    // Reset all trip state for a new trip
    const resetTrip = () => {
        setTripId('');
        setActivities([]);
        setWishlistText('');
        setDayPolylines({});
        setDayActivities({});
        // Note: Don't reset selectedCity and tripLength during create trip flow
        // setSelectedCity('');
        // setTripLength(null);
    };

    // Clear cached trip creation data
    const clearTripCreationCache = async () => {
        try {
            await AsyncStorage.multiRemove([CACHE_KEYS.SELECTED_CITY, CACHE_KEYS.CITY_PHOTO_REF, CACHE_KEYS.CITY_CATEGORIES]);
            // Don't immediately clear selectedCity from context state
            // Let the individual components handle their own state clearing
        } catch (error) {
            console.error('Error clearing trip creation cache:', error);
        }
    };

    // Complete reset for starting a brand new trip
    const completeReset = async () => {
        // Clear cached data first
        await clearTripCreationCache();
        
        // Then reset all context state
        setTripId('');
        setActivities([]);
        setWishlistText('');
        setDayPolylines({});
        setDayActivities({});
        setSelectedCity('');
        setTripLength(null);
        setCityCategories(null);
        setSelectedCategories([]);
    };

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
        setDayPolylinesDeleteDay: setDayPolylines,
        setAllDayPolylines,
        dayActivities,
        setAllDayActivities,
        restoreTripFromObject,
        setDayActivities: setDayActivitiesWithLog,
        resetTrip,
        completeReset,
        clearTripCreationCache,
        createdAt,
        setCreatedAt,
        isCreatingTrip,
        setIsCreatingTrip,
        selectedCity,
        setSelectedCity,
        tripLength,
        setTripLength: setTripLengthWithLog,
        cityCategories,
        setCityCategories,
        selectedCategories,
        setSelectedCategories,
        CACHE_KEYS,
    };

    return (
        <CreateTripContext.Provider value={value}>
            {children}
        </CreateTripContext.Provider>
    );
};