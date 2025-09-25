import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { retrieveTripFromCloud, listUserTripsFromCloud } from '../src/services/lambdaService';
import { generateCategoryActivities as generateCategoryActivitiesGraphQL } from '../src/services/generateCategoryActivities';

// Define the shape of our context data
const CreateTripContext = createContext();

// Cache keys for trip creation flow
const CACHE_KEYS = {
    SELECTED_CITY: 'create_trip_selected_city',
    CITY_PHOTO_REF: 'create_trip_city_photo_ref',
    CITY_CATEGORIES: 'create_trip_city_categories'
};

// Activity generation limit per category
const ACTIVITY_GENERATION_LIMIT = 8;

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

    // Category activities state
    const [categoryActivities, setCategoryActivities] = useState({}); // {categoryName: [activities]}
    const [selectedActivityIds, setSelectedActivityIds] = useState([]); // User selections
    const [loadingCategories, setLoadingCategories] = useState({}); // Loading states per category

    // Collaboration state
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [collaborators, setCollaborators] = useState([]);

    // Permission helpers
    const canEdit = () => ['owner','editor'].includes(currentUserRole);
    const canInviteEditors = () => currentUserRole === 'owner';
    const canInviteViewers = () => ['owner','editor'].includes(currentUserRole);
    const isOwner = () => currentUserRole === 'owner';

    // Helper functions
    const getOwner = () => collaborators.find(c => c.role === 'owner');
    const getCurrentUser = (currentUserID) => collaborators.find(c => c.userID === currentUserID);
    const getUserRoleInTrip = (trip, userID) => {
        const collaborator = trip.collaborators?.find(c => c.userID === userID);
        return collaborator?.role || null;
    };

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
    const restoreTripFromObject = (trip, currentUserID = null) => {
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
        // Restore collaboration state
        setCollaborators(trip.collaborators || []);
        if (currentUserID) {
            const userRole = getUserRoleInTrip(trip, currentUserID);
            setCurrentUserRole(userRole);
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
        setCollaborators([]);
        setCurrentUserRole(null);
        // Note: Don't reset selectedCity and tripLength during create trip flow
        // setSelectedCity('');
        // setTripLength(null);
    };


    // Complete reset for starting a brand new trip
    const completeReset = async () => {
        console.log('[CreateTripContext] completeReset called - clearing all cached data');
        
        // Always clear essential cached data for create_trip steps 1-4
        try {
            await AsyncStorage.multiRemove([CACHE_KEYS.SELECTED_CITY, CACHE_KEYS.CITY_PHOTO_REF, CACHE_KEYS.CITY_CATEGORIES]);
            console.log('[CreateTripContext] AsyncStorage cache cleared successfully');
        } catch (error) {
            console.error('Error clearing essential trip creation cache:', error);
        }

        // Reset ALL context state
        setTripId('');
        setActivities([]);
        setWishlistText('');
        setDayPolylines({});
        setDayActivities({});
        setSelectedCity('');
        setTripLength(null);
        setCityCategories(null);
        setSelectedCategories([]);
        setCategoryActivities({});
        setSelectedActivityIds([]);
        setLoadingCategories({});
        setTripPhotoReference('');
        setCollaborators([]);
        setCurrentUserRole(null);
        console.log('[CreateTripContext] All context state cleared successfully');
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

    // Helper function to check if activity generation limit is reached for a category
    const isActivityLimitReached = (category) => {
        const existingActivities = categoryActivities[category] || [];
        return existingActivities.length >= ACTIVITY_GENERATION_LIMIT;
    };

    // Category Management Functions
    const generateActivitiesForCategory = async (category, count = 4) => {
        if (!selectedCity) {
            console.error('[CreateTripContext] Cannot generate activities: selectedCity is required');
            return;
        }

        // Check if activity limit is reached for this category
        if (isActivityLimitReached(category)) {
            console.log(`[CreateTripContext] Activity generation limit reached for category: ${category}`);
            throw new Error(`Activity generation limit reached for ${category} category`);
        }

        // Set loading state for this category
        setLoadingCategories(prev => ({ ...prev, [category]: true }));

        try {
            // Get existing activities for this category to avoid duplicates
            const existingCategoryActivities = categoryActivities[category] || [];
            const existingActivityNames = existingCategoryActivities.map(activity => activity.name);

            console.log(`[CreateTripContext] Generating ${count} activities for category: ${category} in ${selectedCity}`);
            console.log(`[CreateTripContext] Existing activities (${existingCategoryActivities.length}/${ACTIVITY_GENERATION_LIMIT}):`, existingActivityNames);

            // Call GraphQL mutation to generateCategoryActivities Lambda function
            const response = await generateCategoryActivitiesGraphQL(
                selectedCity,
                category,
                existingActivityNames
            );

            if (!response) {
                throw new Error('No response from generateCategoryActivities service');
            }

            console.log(`[CreateTripContext] Generated ${response.activities.length} activities for ${category}`);

            // Ensure primary_type_display_name is set to category for all activities (handles cached activities)
            const activitiesWithCategory = response.activities.map(activity => ({
                ...activity,
                primary_type_display_name: category
            }));

            // Update categoryActivities state - append new activities to existing ones
            setCategoryActivities(prev => ({
                ...prev,
                [category]: [...existingCategoryActivities, ...activitiesWithCategory]
            }));

            return activitiesWithCategory;
        } catch (error) {
            console.error(`[CreateTripContext] Error generating activities for category ${category}:`, error);
            throw error;
        } finally {
            // Clear loading state for this category
            setLoadingCategories(prev => ({ ...prev, [category]: false }));
        }
    };

    const toggleActivitySelection = (activityId) => {
        setSelectedActivityIds(prev => {
            if (prev.includes(activityId)) {
                // Remove from selection
                return prev.filter(id => id !== activityId);
            } else {
                // Add to selection
                return [...prev, activityId];
            }
        });
    };

    const getSelectedActivities = () => {
        const allActivities = [];

        // Collect all activities from all categories
        Object.values(categoryActivities).forEach(activities => {
            allActivities.push(...activities);
        });

        // Filter by selectedActivityIds and return complete activity objects
        return allActivities.filter(activity =>
            selectedActivityIds.includes(activity.place_id)
        );
    };

    const unselectActivitiesFromCategory = (categoryName) => {
        // Get all activities from the specified category
        const categoryActivitiesList = categoryActivities[categoryName] || [];
        const categoryActivityIds = categoryActivitiesList.map(activity => activity.place_id).filter(Boolean);
        
        // Remove these activity IDs from selectedActivityIds
        setSelectedActivityIds(prev => 
            prev.filter(activityId => !categoryActivityIds.includes(activityId))
        );
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
        categoryActivities,
        setCategoryActivities,
        selectedActivityIds,
        setSelectedActivityIds,
        loadingCategories,
        setLoadingCategories,
        generateActivitiesForCategory,
        toggleActivitySelection,
        getSelectedActivities,
        unselectActivitiesFromCategory,
        isActivityLimitReached,
        ACTIVITY_GENERATION_LIMIT,
        tripPhotoReference,
        setTripPhotoReference,
        getFirstActivityPhotoRef,
        CACHE_KEYS,
        // Collaboration state and functions
        currentUserRole,
        setCurrentUserRole,
        collaborators,
        setCollaborators,
        canEdit,
        canInviteEditors,
        canInviteViewers,
        isOwner,
        getOwner,
        getCurrentUser,
        getUserRoleInTrip,
    };

    return (
        <CreateTripContext.Provider value={value}>
            {children}
        </CreateTripContext.Provider>
    );
};