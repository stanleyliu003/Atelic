import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { retrieveTripFromCloud, listUserTripsFromCloud } from '../src/services/lambdaService';

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
    const [tripId, setTripId] = useState(null);
    const [activities, setActivities] = useState([]); // Each activity now supports formatted_address
    const [wishlistText, setWishlistText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [createdAt, setCreatedAt] = useState(null);
    const [isCreatingTrip, setIsCreatingTrip] = useState(false);
    const [selectedCity, setSelectedCity] = useState('');
    const [tripLength, setTripLength] = useState(null);
    const [cityCategories, setCityCategories] = useState(null);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [tripPhotoReference, setTripPhotoReference] = useState('');
    
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

    // Helper function to get first activity photo reference (from publish_success.tsx logic)
    const getFirstActivityPhotoRef = () => {
        const day1Activities = dayActivities[1]?.activities;
        const firstDayActivity = day1Activities && day1Activities.length > 0 ? day1Activities[0] : null;
        const firstWishlistActivity = (!firstDayActivity && activities && activities.length > 0) ? activities[0] : null;

        return firstDayActivity?.photo_reference || firstWishlistActivity?.photo_reference || '';
    };

    // Auto-update tripPhotoReference when activities or dayActivities change
    useEffect(() => {
        const photoRef = getFirstActivityPhotoRef();
        setTripPhotoReference(photoRef);
    }, [activities, dayActivities]);

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
        // Restore tripPhotoReference if available
        if (trip.tripPhotoReference) {
            setTripPhotoReference(trip.tripPhotoReference);
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
    const generateTripId = () => {
        const newId = randomUUID();
        setTripId(newId);
        return newId;
    };

    // Reset all trip state for a new trip
    const resetTrip = () => {
        setTripId('');
        setActivities([]);
        setWishlistText('');
        setDayPolylines({});
        setDayActivities({});
        setTripPhotoReference('');
        // Note: Don't reset selectedCity and tripLength during create trip flow
        // setSelectedCity('');
        // setTripLength(null);
    };


    // Complete reset for starting a brand new trip
    const completeReset = async () => {
        // Clear essential cached data for create_trip steps 1-4
        try {
            await AsyncStorage.multiRemove([CACHE_KEYS.SELECTED_CITY, CACHE_KEYS.CITY_PHOTO_REF, CACHE_KEYS.CITY_CATEGORIES]);
        } catch (error) {
            console.error('Error clearing essential trip creation cache:', error);
        }

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
        setTripPhotoReference('');
    };

    // Load trip from cloud storage
    const loadTripFromCloud = async (userID, tripID) => {
        try {
            setIsLoading(true);
            console.log('[CreateTripContext] Loading trip from cloud:', { userID, tripID });

            const cloudTrip = await retrieveTripFromCloud(userID, tripID);

            if (cloudTrip) {
                console.log('[CreateTripContext] Successfully loaded trip from cloud:', cloudTrip);
                restoreTripFromObject(cloudTrip);
                return cloudTrip;
            } else {
                throw new Error('Trip not found in cloud storage');
            }
        } catch (error) {
            console.error('[CreateTripContext] Error loading trip from cloud:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // List all user trips from cloud storage (summary data only)
    const listUserTrips = async (userID) => {
        try {
            setIsLoading(true);
            console.log('[CreateTripContext] Loading user trips from cloud:', { userID });

            const tripSummaries = await listUserTripsFromCloud(userID);
            console.log('[CreateTripContext] Successfully loaded trip summaries:', tripSummaries);
            return tripSummaries;
        } catch (error) {
            console.error('[CreateTripContext] Error loading user trips from cloud:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // Check if trip exists in cloud storage
    const checkTripExistsInCloud = async (userID, tripID) => {
        try {
            const cloudTrip = await retrieveTripFromCloud(userID, tripID);
            return !!cloudTrip;
        } catch (error) {
            console.log('[CreateTripContext] Trip does not exist in cloud:', error.message);
            return false;
        }
    };

    const value = {
        tripId,
        setTripId: setTripIdWithLog,
        generateTripId,
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
        loadTripFromCloud,
        listUserTrips,
        checkTripExistsInCloud,
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
        tripPhotoReference,
        setTripPhotoReference,
        getFirstActivityPhotoRef,
        CACHE_KEYS,
    };

    return (
        <CreateTripContext.Provider value={value}>
            {children}
        </CreateTripContext.Provider>
    );
};