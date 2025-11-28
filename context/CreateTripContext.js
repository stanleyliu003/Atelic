import { createContext, useContext, useState, useEffect, startTransition } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { retrieveTripFromCloud, listUserTripsFromCloud } from '../src/services/lambdaService';
import { generateCategoryActivities as generateCategoryActivitiesGraphQL } from '../src/services/generateCategoryActivities';
import { ensureActivitiesHaveInstanceIds } from '../src/utils/activityInstanceId';

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
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [isCreatingTrip, setIsCreatingTrip] = useState(false);
    const [selectedCity, setSelectedCity] = useState('');
    // Store the selected city's coordinates for map centering before activities exist
    const [selectedCityLocation, setSelectedCityLocation] = useState(null); // { lat, lng } | null
    const [tripLength, setTripLength] = useState(null);
    const [cityCategories, setCityCategories] = useState(null);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [tripPhotoReference, setTripPhotoReference] = useState([]);

    // Category activities state
    const [categoryActivities, setCategoryActivities] = useState({}); // {categoryName: [activities]}
    const [selectedActivityIds, setSelectedActivityIds] = useState([]); // User selections
    const [loadingCategories, setLoadingCategories] = useState({}); // Loading states per category

    // Collaboration state
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [collaborators, setCollaborators] = useState([]);

    // Version tracking for optimistic locking
    const [version, setVersion] = useState(1);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [lastUpdatedBy, setLastUpdatedBy] = useState(null);

    // New fields for future features (empty for now)
    const [notes, setNotes] = useState(null);
    const [duration, setDuration] = useState(null);
    const [arrivalTime, setArrivalTime] = useState(null);
    const [photos, setPhotos] = useState(null);
    const [hotel, setHotel] = useState(null);
    const [flight, setFlight] = useState(null);
    const [savedActivities, setSavedActivities] = useState(null);

    // Recent searches state
    const [recentSearches, setRecentSearches] = useState([]);

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

    // Helper function to add a place to recent searches
    const addToRecentSearches = (place) => {
        setRecentSearches(prev => {
            // Remove if already exists (to move it to front)
            const filtered = prev.filter(item => item.place_id !== place.place_id);

            // Add to front and limit to 7
            const updated = [{
                place_id: place.place_id,
                name: place.name,
                address_info: place.address_info || place.formatted_address || '',
                timestamp: new Date().toISOString()
            }, ...filtered].slice(0, 7);

            return updated;
        });
    };

    // Helper function to collect up to 5 unique photo references from activities
    // Returns array of strings for GraphQL compatibility.
    // Each string is either:
    //   - a raw photo_reference (legacy data), or
    //   - a JSON string: {"photo_reference":"...","place_id":"..."}
    const getTripPhotoReferences = () => {
        const photoRefs = [];
        const seenPhotoRefs = new Set(); // Track seen photo_references to avoid duplicates

        // Strategy: Collect photos from activities across all days + wishlist
        // Priority: Day 1 → Day 2 → Day 3 → ... → Wishlist activities

        // 1. Iterate through dayActivities (days 1, 2, 3, etc.)
        const dayNumbers = Object.keys(dayActivities).sort((a, b) => Number(a) - Number(b));

        for (const dayNumber of dayNumbers) {
            const dayData = dayActivities[dayNumber];
            if (dayData?.activities && Array.isArray(dayData.activities)) {
                for (const activity of dayData.activities) {
                    if (activity.photo_reference && photoRefs.length < 5) {
                        // Avoid duplicates based on the raw photo_reference string
                        if (!seenPhotoRefs.has(activity.photo_reference)) {
                            const payload = {
                                photo_reference: activity.photo_reference,
                                place_id: activity.place_id || null
                            };
                            photoRefs.push(JSON.stringify(payload));
                            seenPhotoRefs.add(activity.photo_reference);
                        }
                    }
                }
            }
        }

        // 2. If still < 5 photos, pull from wishlist activities
        if (photoRefs.length < 5 && activities && Array.isArray(activities)) {
            for (const activity of activities) {
                if (activity.photo_reference && photoRefs.length < 5) {
                    if (!seenPhotoRefs.has(activity.photo_reference)) {
                        const payload = {
                            photo_reference: activity.photo_reference,
                            place_id: activity.place_id || null
                        };
                        photoRefs.push(JSON.stringify(payload));
                        seenPhotoRefs.add(activity.photo_reference);
                    }
                }
            }
        }

        // Return array of up to 5 unique photo reference strings
        return photoRefs.slice(0, 5);
    };

    // Auto-update tripPhotoReference when activities or dayActivities change
    useEffect(() => {
        const photoRefs = getTripPhotoReferences();
        setTripPhotoReference(photoRefs);
    }, [activities, dayActivities]);

    // Restore all trip state from a trip object
    const restoreTripFromObject = (trip, currentUserID = null) => {
        console.log('[CreateTripContext] restoreTripFromObject: incoming tripId:', trip?.tripId);

        // Ensure backward compatibility - add instanceIds to activities without them
        const wishlistWithInstanceIds = ensureActivitiesHaveInstanceIds(trip.wishlist || []);
        const daysWithInstanceIds = (trip.days || []).map(day => ({
            ...day,
            activities: ensureActivitiesHaveInstanceIds(day.activities || [])
        }));

        console.log('[CreateTripContext] Ensured instanceIds for', wishlistWithInstanceIds.length, 'wishlist activities and', daysWithInstanceIds.length, 'days');

        // Batch all state updates together to minimize re-renders
        startTransition(() => {
            setTripId(trip.tripId);
            updateActivities(wishlistWithInstanceIds);
            setAllDayActivities(daysWithInstanceIds);
            setAllDayPolylines(daysWithInstanceIds);

            // Restore city categories from cloud (if provided)
            if (trip.cityCategories) {
                console.log('[CreateTripContext] Restoring cityCategories from cloud. Count:', Array.isArray(trip.cityCategories) ? trip.cityCategories.length : 'null');
                setCityCategories(trip.cityCategories);
            } else {
                console.log('[CreateTripContext] No cityCategories on cloud trip. Clearing local cityCategories');
                setCityCategories(null);
            }

            // Restore tripLength if available, otherwise derive from days
            if (trip.tripLength) {
                setTripLength(trip.tripLength);
            } else if (trip.days && trip.days.length > 0) {
                // Derive tripLength from the number of days if not explicitly stored
                setTripLength(trip.days.length);
            }

            // Restore tripPhotoReference if available (should be an array from backend)
            if (trip.tripPhotoReference) {
                // Backend should always return array, but handle safely
                const photoRefs = Array.isArray(trip.tripPhotoReference)
                    ? trip.tripPhotoReference
                    : [trip.tripPhotoReference];
                setTripPhotoReference(photoRefs);
            } else {
                setTripPhotoReference([]);
            }

            // Restore createdAt timestamp
            if (trip.createdAt) {
                setCreatedAt(trip.createdAt);
            }

            // Restore trip dates
            if (trip.startDate) {
                setStartDate(trip.startDate);
            }
            if (trip.endDate) {
                setEndDate(trip.endDate);
            }

            // Restore collaboration state
            setCollaborators(trip.collaborators || []);
            if (currentUserID) {
                const userRole = getUserRoleInTrip(trip, currentUserID);
                setCurrentUserRole(userRole);
            }

            // Restore version tracking fields
            setVersion(trip.version || 1);
            setUpdatedAt(trip.updatedAt || null);
            setLastUpdatedBy(trip.lastUpdatedBy || null);

            // Restore new fields for future features
            setNotes(trip.notes || null);
            setDuration(trip.duration || null);
            setArrivalTime(trip.arrivalTime || null);
            setPhotos(trip.photos || null);
            setHotel(trip.hotel || null);
            setFlight(trip.flight || null);
            setSavedActivities(trip.savedActivities || null);

            // Restore recent searches
            setRecentSearches(trip.recentSearches || []);

            console.log('[CreateTripContext] Restored trip - createdAt:', trip.createdAt, 'version:', trip.version || 1);
        });
    };

    const updateActivities = (newActivities) => {
        setActivities(newActivities);
    };

    const removeActivities = (activityInstanceIds) => {
        setActivities(prevActivities =>
            prevActivities.filter(activity =>
                !activity.instanceId || !activityInstanceIds.includes(activity.instanceId)
            )
        );
    };

    // Helper to update a single activity's notes/times across wishlist and days
    const updateActivityNotes = (instanceId, updates) => {
        console.log('[CreateTripContext] Updating activity notes for instanceId:', instanceId, 'with:', updates);

        // Update in wishlist
        setActivities(prev => prev.map(activity =>
            activity.instanceId === instanceId
                ? { ...activity, ...updates }
                : activity
        ));

        // Update in dayActivities
        setDayActivities(prev => {
            const newDayActivities = { ...prev };
            Object.keys(newDayActivities).forEach(dayNum => {
                newDayActivities[dayNum] = {
                    ...newDayActivities[dayNum],
                    activities: newDayActivities[dayNum].activities.map(activity =>
                        activity.instanceId === instanceId
                            ? { ...activity, ...updates }
                            : activity
                    )
                };
            });
            return newDayActivities;
        });
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
        setTripPhotoReference([]);
        setCollaborators([]);
        setCurrentUserRole(null);
        setStartDate(null);
        setEndDate(null);
        // Reset new fields for future features
        setNotes(null);
        setDuration(null);
        setArrivalTime(null);
        setPhotos(null);
        setHotel(null);
        setFlight(null);
        setSavedActivities(null);
        setRecentSearches([]);
        // Note: Don't reset selectedCity and tripLength during create trip flow
        // setSelectedCity('');
        // setTripLength(null);
    };


    // Complete reset for starting a brand new trip
    const completeReset = async () => {
        
        // Always clear essential cached data for create_trip steps 1-4
        try {
            await AsyncStorage.multiRemove([CACHE_KEYS.SELECTED_CITY, CACHE_KEYS.CITY_PHOTO_REF, CACHE_KEYS.CITY_CATEGORIES]);
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
        setSelectedCityLocation(null);
        setTripLength(null);
        setCityCategories(null);
        setSelectedCategories([]);
        setCategoryActivities({});
        setSelectedActivityIds([]);
        setLoadingCategories({});
        setTripPhotoReference([]);
        setCollaborators([]);
        setCurrentUserRole(null);
        setStartDate(null);
        setEndDate(null);
        setVersion(1);
        setUpdatedAt(null);
        setLastUpdatedBy(null);
        // Reset new fields for future features
        setNotes(null);
        setDuration(null);
        setArrivalTime(null);
        setPhotos(null);
        setHotel(null);
        setFlight(null);
        setSavedActivities(null);
        setRecentSearches([]);
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
            // Get existing wishlist activities for this category to avoid duplicates
            const existingWishlistActivities = categoryActivities[category] || [];
            const existingActivityNames = existingWishlistActivities.map(activity => activity.name);

            console.log(`[CreateTripContext] Generating ${count} activities for category: ${category} in ${selectedCity}`);
            console.log(`[CreateTripContext] Existing wishlist activities (${existingWishlistActivities.length}/${ACTIVITY_GENERATION_LIMIT}):`, existingActivityNames);

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
                [category]: [...existingWishlistActivities, ...activitiesWithCategory]
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

    // Add activities to wishlist - allow duplicates with unique instanceIds
    const addToWishlist = (newActivities) => {
        // Ensure all new activities have instanceIds (generate if missing)
        const activitiesWithInstanceIds = ensureActivitiesHaveInstanceIds(newActivities);

        if (activitiesWithInstanceIds.length > 0) {
            updateActivities([...activities, ...activitiesWithInstanceIds]);
        }

        return {
            added: activitiesWithInstanceIds.length,
            duplicates: 0 // No longer preventing duplicates
        };
    };

    // Search for activities using search query and filters
    // Uses the same Lambda as generateCategoryActivities but in search mode
    const searchActivities = async (searchQuery, filters = [], existingActivities = []) => {
        try {
            console.log(`[CreateTripContext] Searching for activities: "${searchQuery}" in ${selectedCity}`);
            console.log(`[CreateTripContext] Filters:`, filters);
            console.log(`[CreateTripContext] Existing activities to avoid:`, existingActivities);

            // Import the GraphQL query
            const { API } = await import('aws-amplify');
            const { graphqlOperation } = await import('aws-amplify');

            const result = await API.graphql(graphqlOperation(`
                query SearchActivities(
                    $selectedCity: String!
                    $searchQuery: String!
                    $filters: [String!]
                    $existingWishlistActivities: [String!]
                ) {
                    searchActivities(
                        selectedCity: $selectedCity
                        searchQuery: $searchQuery
                        filters: $filters
                        existingWishlistActivities: $existingWishlistActivities
                    ) {
                        query
                        activities {
                            name
                            city
                            lat
                            lng
                            rating
                            user_ratings_total
                            formatted_address
                            types
                            primaryType
                            place_id
                            photo_reference
                            is_recommended
                            display_name
                            website_uri
                            editorial_summary
                            primary_type_display_name
                            international_phone_number
                            regular_opening_hours {
                                open_now
                                periods {
                                    open {
                                        day
                                        time
                                        date
                                        truncated
                                    }
                                    close {
                                        day
                                        time
                                        date
                                        truncated
                                    }
                                }
                                weekday_text
                            }
                            reviews {
                                author_name
                                rating
                                text
                                time
                                author_url
                                profile_photo_url
                            }
                        }
                    }
                }
            `, {
                selectedCity,
                searchQuery,
                filters,
                existingWishlistActivities: existingActivities
            }));

            console.log(`[CreateTripContext] Search results:`, result?.data?.searchActivities);

            return result?.data?.searchActivities?.activities ?? [];
        } catch (error) {
            console.error(`[CreateTripContext] Error searching for activities:`, error);
            throw error;
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
        updateActivityNotes,
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
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        isCreatingTrip,
        setIsCreatingTrip,
        selectedCity,
        setSelectedCity,
        selectedCityLocation,
        setSelectedCityLocation,
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
        addToWishlist,
        searchActivities,
        isActivityLimitReached,
        ACTIVITY_GENERATION_LIMIT,
        tripPhotoReference,
        setTripPhotoReference,
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
        // Version tracking for optimistic locking
        version,
        setVersion,
        updatedAt,
        setUpdatedAt,
        lastUpdatedBy,
        setLastUpdatedBy,
        // New fields for future features
        notes,
        setNotes,
        duration,
        setDuration,
        arrivalTime,
        setArrivalTime,
        photos,
        setPhotos,
        hotel,
        setHotel,
        flight,
        setFlight,
        savedActivities,
        setSavedActivities,
        // Recent searches
        recentSearches,
        setRecentSearches,
        addToRecentSearches,
    };

    return (
        <CreateTripContext.Provider value={value}>
            {children}
        </CreateTripContext.Provider>
    );
};