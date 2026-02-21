import { createContext, useContext, useState, useEffect, startTransition } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { retrieveTripFromCloud, listUserTripsFromCloud } from '../src/services/lambdaService';
import { generateCategoryActivities as generateCategoryActivitiesGraphQL } from '../src/services/generateCategoryActivities';
import { ensureActivitiesHaveInstanceIds } from '../src/utils/activityInstanceId';
import { TripCity, Location, TravelSegment } from '../src/types/city.types';

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
    const [tripTitle, setTripTitle] = useState(null);
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

    // Lodging/Hotel state - Track lodging activities per day
    // Format: { [dayNumber]: { checkIn: Activity | null, checkOut: Activity | null } }
    const [dayLodgings, setDayLodgings] = useState({});

    // Track deleted saved places to prevent re-addition from SavedPlacesStorage
    // Stores savedPlaceIds that user has explicitly deleted from this trip
    const [deletedSavedPlaceIds, setDeletedSavedPlaceIds] = useState(new Set());

    // Multi-city state
    const [cities, setCities] = useState([]); // Array of TripCity objects
    const [activeCityId, setActiveCityId] = useState(null); // Currently viewing city
    const [dayCity, setDayCity] = useState({}); // { [dayNumber]: cityId } — maps each day to its city


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
    // Store travel modes per day per leg: { [dayNumber]: { [legIndex]: TravelMode } }
    const [dayTravelModes, setDayTravelModes] = useState({});

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
        const citiesMap = {};
        days.forEach(day => {
            // Keep activities in their original order when restoring from cloud
            activitiesByDay[day.dayNumber] = { activities: day.activities || [] };
            // Build dayCity map from days that have a cityId (multi-city trips)
            if (day.cityId) {
                citiesMap[day.dayNumber] = day.cityId;
            }
        });
        setDayActivities(activitiesByDay);
        setDayCity(citiesMap);
    };

    // Direct setter for dayActivities (if used elsewhere)
    const setDayActivitiesWithLog = (newVal) => {
        setDayActivities(newVal);
    };

    // Setter for a specific leg's travel mode
    const setLegTravelMode = (dayNumber, legIndex, travelMode) => {
        setDayTravelModes(prev => ({
            ...prev,
            [dayNumber]: {
                ...(prev[dayNumber] || {}),
                [legIndex]: travelMode
            }
        }));
    };

    // Setter for all travel modes for a day
    const setDayTravelModesForDay = (dayNumber, modesObj) => {
        setDayTravelModes(prev => ({
            ...prev,
            [dayNumber]: modesObj
        }));
    };

    // Setter for all day travel modes at once (for restoration from cloud)
    const setAllDayTravelModes = (days) => {
        const travelModesByDay = {};
        days.forEach(day => {
            if (day.travelModes) {
                // Parse JSON string if it's a string, otherwise use directly
                try {
                    const modes = typeof day.travelModes === 'string'
                        ? JSON.parse(day.travelModes)
                        : day.travelModes;
                    travelModesByDay[day.dayNumber] = modes;
                } catch (error) {
                    console.error('[CreateTripContext] Error parsing travelModes for day', day.dayNumber, error);
                }
            }
        });
        setDayTravelModes(travelModesByDay);
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

    // Helper functions for managing deleted saved places
    const addToDeletedSavedPlaces = (savedPlaceId) => {
        if (!savedPlaceId) {
            console.warn('[CreateTripContext] Cannot add to deleted saved places: savedPlaceId is null/undefined');
            return;
        }
        console.log('[CreateTripContext] Marking savedPlaceId as deleted:', savedPlaceId);
        setDeletedSavedPlaceIds(prev => new Set([...prev, savedPlaceId]));
    };

    const removeFromDeletedSavedPlaces = (savedPlaceId) => {
        if (!savedPlaceId) return;
        console.log('[CreateTripContext] Removing savedPlaceId from deleted list:', savedPlaceId);
        setDeletedSavedPlaceIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(savedPlaceId);
            return newSet;
        });
    };

    const clearDeletedSavedPlaces = () => {
        console.log('[CreateTripContext] Clearing all deleted saved places');
        setDeletedSavedPlaceIds(new Set());
    };

    const isDeletedSavedPlace = (savedPlaceId) => {
        return savedPlaceId && deletedSavedPlaceIds.has(savedPlaceId);
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
            setAllDayTravelModes(daysWithInstanceIds);

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

            // Restore trip title and selected city
            console.log('[CreateTripContext] Restoring tripTitle:', trip.tripTitle);
            console.log('[CreateTripContext] tripTitle type:', typeof trip.tripTitle);
            console.log('[CreateTripContext] tripTitle is null?:', trip.tripTitle === null);
            console.log('[CreateTripContext] tripTitle is undefined?:', trip.tripTitle === undefined);
            setTripTitle(trip.tripTitle || null);
            console.log('[CreateTripContext] ✅ Set tripTitle to:', trip.tripTitle || null);
            if (trip.selectedCity) {
                setSelectedCity(trip.selectedCity);
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

            // Restore deleted saved places list
            // NOTE: If field doesn't exist in cloud (pre-deployment), preserve in-memory state
            if (trip.deletedSavedPlaceIds !== undefined) {
                if (Array.isArray(trip.deletedSavedPlaceIds) && trip.deletedSavedPlaceIds.length > 0) {
                    console.log('[CreateTripContext] Restoring', trip.deletedSavedPlaceIds.length, 'deleted saved place IDs from cloud');
                    setDeletedSavedPlaceIds(new Set(trip.deletedSavedPlaceIds));
                } else {
                    console.log('[CreateTripContext] No deleted saved places in cloud data');
                    setDeletedSavedPlaceIds(new Set());
                }
            } else {
                // Field doesn't exist in cloud (pre-deployment) - preserve existing in-memory state
                console.log('[CreateTripContext] deletedSavedPlaceIds field not in cloud data (pre-deployment) - preserving in-memory state');
                // Don't call setDeletedSavedPlaceIds - keep current state
            }

            // Restore multi-city state
            if (trip.cities && trip.cities.length > 0) {
                console.log('[CreateTripContext] Restoring', trip.cities.length, 'cities from cloud');
                // Backfill: if the first city has no dates but the trip does, inherit them
                const citiesWithDates = trip.cities.map((c, idx) => ({
                    ...c,
                    startDate: c.startDate || (idx === 0 ? trip.startDate || null : null),
                    endDate: c.endDate || (idx === 0 ? trip.endDate || null : null),
                }));
                setCities(citiesWithDates);
                setActiveCityId(citiesWithDates[0].cityId);
            } else if (trip.selectedCity) {
                // Backfill: legacy single-city trip — synthesize a TripCity so the UI stays consistent
                const legacyCityId = randomUUID();
                const legacyCity = {
                    cityId: legacyCityId,
                    name: trip.selectedCity,
                    location: { lat: null, lng: null, placeId: null },
                    order: 0,
                    startDate: trip.startDate || null,
                    endDate: trip.endDate || null,
                    photoReference: Array.isArray(trip.tripPhotoReference) ? trip.tripPhotoReference[0] || null : null,
                    travelToNext: null,
                };
                setCities([legacyCity]);
                setActiveCityId(legacyCityId);
                console.log('[CreateTripContext] Backfilled legacy city:', trip.selectedCity, 'id:', legacyCityId);
            } else {
                setCities([]);
                setActiveCityId(null);
            }

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
        const newTripId = randomUUID();
        setTripId(newTripId);
        console.log('[CreateTripContext] Generated new trip ID:', newTripId);
        return newTripId;
    };

    // Reset all trip state for a new trip
    const resetTrip = () => {
        setTripId('');
        setActivities([]);
        setWishlistText('');
        setDayPolylines({});
        setDayActivities({});
        setDayTravelModes({});
        setTripPhotoReference([]);
        setCollaborators([]);
        setCurrentUserRole(null);
        setStartDate(null);
        setEndDate(null);
        setTripTitle(null);
        // Reset new fields for future features
        setNotes(null);
        setDuration(null);
        setArrivalTime(null);
        setPhotos(null);
        setHotel(null);
        setFlight(null);
        setSavedActivities(null);
        setRecentSearches([]);
        setDeletedSavedPlaceIds(new Set());
        // Note: Don't reset selectedCity and tripLength during create trip flow
        // setSelectedCity('');
        // setTripLength(null);
    };


    // Complete reset for starting a brand new trip
    const completeReset = async () => {
        
        // Reset ALL context state
        setTripId('');
        setActivities([]);
        setWishlistText('');
        setDayPolylines({});
        setDayActivities({});
        setDayTravelModes({});
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
        setTripTitle(null);
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
        setDeletedSavedPlaceIds(new Set());

        // Clear cached city selection data
        try {
            await AsyncStorage.multiRemove([
                'create_trip_selected_city',
                'create_trip_city_photo_ref',
                'create_trip_city_categories'
            ]);
        } catch (error) {
            console.error('[CreateTripContext] Error clearing cache:', error);
        }

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
        // In multi-city trips use the active city's name; fall back to selectedCity for single-city trips
        const activeCity = activeCityId ? cities.find(c => c.cityId === activeCityId) : null;
        const cityForGeneration = activeCity?.name || selectedCity;

        if (!cityForGeneration) {
            console.error('[CreateTripContext] Cannot generate activities: no city selected');
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

            console.log(`[CreateTripContext] Generating ${count} activities for category: ${category} in ${cityForGeneration}`);
            console.log(`[CreateTripContext] Existing wishlist activities (${existingWishlistActivities.length}/${ACTIVITY_GENERATION_LIMIT}):`, existingActivityNames);

            // Call GraphQL mutation to generateCategoryActivities Lambda function
            const response = await generateCategoryActivitiesGraphQL(
                cityForGeneration,
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

    // Lodging/Hotel helper functions

    /**
     * Check if an activity is a lodging activity
     */
    const isActivityLodging = (activity) => {
        return activity?.isLodging === true || activity?.primaryType === 'lodging';
    };

    /**
     * Set lodging for a specific day
     * @param {number} dayNumber - The day number to set lodging for
     * @param {Activity} lodgingActivity - The lodging activity (hotel/accommodation)
     * @param {Date} checkInDate - Check-in date
     * @param {Date} checkOutDate - Check-out date
     */
    const setDayLodging = (dayNumber, lodgingActivity, checkInDate, checkOutDate) => {
        setDayLodgings(prev => ({
            ...prev,
            [dayNumber]: {
                checkIn: lodgingActivity,
                checkOut: lodgingActivity // Same activity for both check-in and check-out
            }
        }));
    };

    /**
     * Remove lodging from a specific day
     * @param {number} dayNumber - The day number to remove lodging from
     */
    const removeDayLodging = (dayNumber) => {
        setDayLodgings(prev => {
            const updated = { ...prev };
            delete updated[dayNumber];
            return updated;
        });
    };

    /**
     * Get lodging for specific day
     * @param {number} dayNumber - The day number to get lodging for
     * @returns {{ checkIn: Activity | null, checkOut: Activity | null } | null}
     */
    const getDayLodging = (dayNumber) => {
        return dayLodgings[dayNumber] || null;
    };

    /**
     * Get the default trip title if no custom title is set
     * @returns {string} Default trip title in format "X Day [City] Trip"
     */
    const getDefaultTripTitle = () => {
        if (tripTitle) return tripTitle;
        const dayCount = tripLength || Object.keys(dayActivities).length || 0;
        const cityName = selectedCity || 'Trip';
        return `${dayCount} Day ${cityName} Trip`;
    };

    // Add a new city to the trip — returns the new cityId for callers
    const addCity = (cityData) => {
        const cityId = randomUUID();
        const newCity = {
            cityId,
            name: cityData.name,
            location: {
                lat: cityData.lat,
                lng: cityData.lng,
                placeId: cityData.place_id
            },
            order: cities.length,
            startDate: cityData.startDate || null,
            endDate: cityData.endDate || null,
            photoReference: cityData.photo_reference || null,
            travelToNext: null
        };

        setCities(prev => [...prev, newCity]);
        console.log('[CreateTripContext] Added city:', newCity.name, 'id:', cityId);
        return cityId;
    };


    // Remove a city from the trip
    const removeCity = (cityId) => {
        setCities(cities.filter(c => c.cityId !== cityId));
        // Reorder remaining cities
        updateCityOrders();
        console.log('[CreateTripContext] Removed city:', cityId);
    };

    // Update city orders after reordering/removing
    const updateCityOrders = () => {
        setCities(prevCities => 
            prevCities.map((city, index) => ({
                ...city,
                order: index
            }))
        );
    };

    // Update dates for a specific city — also syncs trip-level startDate/endDate/tripLength
    const updateCityDates = (cityId, newStart, newEnd) => {
        // Use a functional updater so this chains correctly after addCity's own functional
        // setCities call — a direct assignment would overwrite it and drop the new city.
        setCities(prevCities => {
            const updatedCities = prevCities.map(c =>
                c.cityId === cityId ? { ...c, startDate: newStart, endDate: newEnd } : c
            );

            // Sync trip-level dates: earliest city start → trip start, latest city end → trip end
            const allStarts = updatedCities.map(c => c.startDate).filter(Boolean);
            const allEnds   = updatedCities.map(c => c.endDate).filter(Boolean);

            if (allStarts.length > 0) {
                const earliest = [...allStarts].sort()[0];
                const latest   = allEnds.length > 0 ? [...allEnds].sort().reverse()[0] : earliest;
                setStartDate(earliest);
                setEndDate(latest);
                const diffMs = new Date(latest).getTime() - new Date(earliest).getTime();
                setTripLength(Math.round(diffMs / 86400000) + 1);
            }

            return updatedCities;
        });
        console.log('[CreateTripContext] Updated dates for city:', cityId);
    };

    // Assign a specific day number to a city
    const assignDayToCity = (dayNumber, cityId) => {
        setDayCity(prev => ({ ...prev, [dayNumber]: cityId }));
        console.log('[CreateTripContext] Assigned day', dayNumber, 'to city:', cityId);
    };

    // Get all day numbers that belong to a given city
    const getDaysForCity = (cityId) => {
        return Object.keys(dayCity)
            .filter(d => dayCity[d] === cityId)
            .map(Number);
    };

    // Update the travelToNext segment on a city (how to reach the next city)
    const updateTravelToNext = (cityId, travelData) => {
        setCities(prev => prev.map(c =>
            c.cityId === cityId
            ? { ...c, travelToNext: { ...(c.travelToNext || {}), ...travelData } }
            : c
        ));
        console.log('[CreateTripContext] Updated travelToNext for city:', cityId);
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
        dayTravelModes,
        setDayTravelModes,
        setLegTravelMode,
        setDayTravelModesForDay,
        setAllDayTravelModes,
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
        tripTitle,
        setTripTitle,
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
        getDefaultTripTitle,
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
        // Lodging/Hotel management
        dayLodgings,
        setDayLodging,
        removeDayLodging,
        getDayLodging,
        isActivityLodging,
        // Deleted saved places tracking
        deletedSavedPlaceIds,
        addToDeletedSavedPlaces,
        removeFromDeletedSavedPlaces,
        clearDeletedSavedPlaces,
        isDeletedSavedPlace,
        // Multi-city support
        cities,
        setCities,
        activeCityId,
        setActiveCityId,
        addCity,
        removeCity,
        updateCityDates,
        updateCityOrders,
        updateTravelToNext,
        dayCity,
        setDayCity,
        assignDayToCity,
        getDaysForCity,
    };

    return (
    <CreateTripContext.Provider value={value}>
        {children}
    </CreateTripContext.Provider>
);
};