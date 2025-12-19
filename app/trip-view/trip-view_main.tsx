import { Colors } from '../../constants/Colors';
import { useNavigation, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert, AppState, Animated, PanResponder, Dimensions, ActivityIndicator } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { encodePolyline } from '../../src/utils/polyline';
import { DaySchedule, TabBar, WishlistActivities } from '../../src/components/trip-view';
import { TripMapView } from '../../src/components/trip-view/map_view';
import { TransferActivitiesModal } from '../../src/components/trip-view/transfer_activities_modal';
import { TransferButtonContainer } from '../../src/components/trip-view/transfer_delete_button_containor';
import { ShareTripModal } from '../../src/components/trip-view/collaboration';
import { ActivityDetailView } from '../../src/components/trip-view/description_card';
import { SearchBar } from '../../src/components/explore/SearchBar';
import { AutocompleteModal } from '../../src/components/explore/AutocompleteModal';
import { CategoryModal } from '../../src/components/explore/CategoryModal';
import { useActivitySelection } from '../../src/hooks/use_activity_selection';
import { useDayActivities } from '../../src/hooks/use_day_activities';
import { useTransferActivities } from '../../src/hooks/use_transfer_activities';
import { fetchRoutePolyline, fetchRoutePolylineWithMode, RouteData } from '../../src/services/getRoute_graphQL_call';
import { optimizeRouteWithHaversine } from '../../src/components/trip-view/logic/optimize_route';
import { Activity, TabType, TravelMode, EnhancedRouteLeg, RouteLegModeData } from '../../src/types/activity.types';
import TransportationSettingsModal from '../../src/components/trip-view/transportation_settings_modal';
import { decodePolyline } from '../../src/utils/polyline';
import { API, Auth, graphqlOperation } from 'aws-amplify';
import { createTrip } from '../../src/graphql/mutations';
import { retrieveTripFromCloud } from '../../src/services/lambdaService';
import Entypo from '@expo/vector-icons/Entypo';
import { duplicateActivity } from '../../src/utils/activityInstanceId';

// GraphQL subscription for real-time trip updates
const onTripUpdated = /* GraphQL */ `
    subscription OnTripUpdated($tripId: String!) {
        onTripUpdated(tripId: $tripId) {
            tripId
            version
            updatedAt
            lastUpdatedBy
            collaborators {
                email
                fullName
                userID
                role
                addedBy
            }
        }
    }
`;


export default function TripViewMain() {
    const router = useRouter();
    const navigation = useNavigation();
    const params = useLocalSearchParams();
    const { restoreTrip } = params;
    const {
        activities,
        removeActivities,
        setDayPolyline,
        tripId,
        wishlistText,
        dayPolylines,
        dayTravelModes,
        updateActivities,
        setTripId,
        restoreTripFromObject,
        createdAt,
        setCreatedAt,
        startDate,
        endDate,
        tripLength,
        setTripLength,
        setDayPolylinesDeleteDay,
        selectedCity,
        generateTripId,
        tripPhotoReference,
        collaborators,
        currentUserRole,
        setCollaborators,
        isOwner,
        version,
        setVersion,
        updatedAt,
        setUpdatedAt,
        lastUpdatedBy,
        setLastUpdatedBy,
        cityCategories,
        generateActivitiesForCategory,
        categoryActivities,
        addToWishlist,
        recentSearches,
        selectedCityLocation,
    } = useCreateTrip();
    const [activeTab, setActiveTab] = useState<TabType>('wishlist');
    const [shouldScrollToActive, setShouldScrollToActive] = useState(false);
    const [routeData, setRouteData] = useState<RouteData>({
        polyline: [],
        legs: [],
        totalDistance: 0,
        totalDuration: '',
        travelMode: 'DRIVE'
    });
    const [routeLoading, setRouteLoading] = useState(false);
    const routeCache = useRef<{ [tab: string]: { activitiesHash: string, routeData: RouteData } }>({});

    // State for SearchBar and AutocompleteModal
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [isAutocompleteAddingPlace, setIsAutocompleteAddingPlace] = useState(false);
    const [isShareModalVisible, setIsShareModalVisible] = useState(false);
    const [currentUserID, setCurrentUserID] = useState<string>('');

    // State for CategoryModal
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [loadingCategoryActivities, setLoadingCategoryActivities] = useState(false);
    const [loadingMoreCategoryActivities, setLoadingMoreCategoryActivities] = useState(false);

    // State for activity detail view
    const [selectedActivityForDetail, setSelectedActivityForDetail] = useState<Activity | null>(null);
    const [showActivityDetail, setShowActivityDetail] = useState(false);
    
    // State for selected marker
    const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
    
    // State for scroll positions per day
    const [dayScrollPositions, setDayScrollPositions] = useState<{ [key: number]: number }>({});
    const [shouldRestoreScrollPositions, setShouldRestoreScrollPositions] = useState<{ [key: number]: boolean }>({});

    // State for transportation settings modal
    const [settingsModalVisible, setSettingsModalVisible] = useState(false);
    const [selectedLegIndex, setSelectedLegIndex] = useState<number | null>(null);
    const [modalOriginActivity, setModalOriginActivity] = useState<Activity | undefined>(undefined);
    const [modalDestinationActivity, setModalDestinationActivity] = useState<Activity | undefined>(undefined);

    // State for draggable bottom section with 3 discrete states
    const screenHeight = Dimensions.get('window').height;
    const MIN_HEIGHT = 0.30; // 30% of screen height (minimum)
    const DEFAULT_HEIGHT = 0.65; // 65% of screen height (default)
    const MAX_HEIGHT = 0.90; // 90% of screen height (maximum)
    
    // Current height state (0 = min, 1 = default, 2 = max)
    const [currentHeightState, setCurrentHeightState] = useState(1); // Start at default
    const [bottomHeight] = useState(new Animated.Value(DEFAULT_HEIGHT));
    
    // Ref to track current state for pan responder (avoids stale closure)
    const currentHeightStateRef = useRef(1);
    
    // Array of height states for easy access
    const heightStates = [MIN_HEIGHT, DEFAULT_HEIGHT, MAX_HEIGHT];
    
    // Function to programmatically change height state
    const changeHeightState = (newState: number) => {
        if (newState >= 0 && newState < heightStates.length && newState !== currentHeightState) {
            setCurrentHeightState(newState);
            Animated.spring(bottomHeight, {
                toValue: heightStates[newState],
                useNativeDriver: false,
                tension: 80,
                friction: 8,
            }).start();
        }
    };

    // Save-in-progress lock to prevent concurrent saves and duplicate tripID generation
    const [isSaving, setIsSaving] = useState(false);
    const isSavingRef = useRef(false);

    // Ref for immediate tripID access (avoids async state update issues)
    const tripIdRef = useRef(tripId);

    // Version ref for immediate access (avoids async state issues)
    const versionRef = useRef<number>(version);

    // Autosave interval ref
    const autosaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Track last save time to prevent duplicate rapid-fire saves
    const lastSaveTimeRef = useRef<number>(0);

    // Minimum time between autosaves (in milliseconds) - 5 seconds
    const MIN_AUTOSAVE_INTERVAL = 5000;

    // Debounce timeout for state-change-triggered saves
    const saveDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Track if currently reloading from subscription to prevent autosave
    const isReloadingRef = useRef(false);

    // Track screen focus state for subscription management
    const [isScreenFocused, setIsScreenFocused] = useState(true);

    // Keep tripIdRef in sync with tripId state
    useEffect(() => {
        tripIdRef.current = tripId;
    }, [tripId]);

    // Reset height to default state on component mount/reload
    useEffect(() => {
        setCurrentHeightState(1); // Reset to default state
        currentHeightStateRef.current = 1; // Also reset the ref
        bottomHeight.setValue(DEFAULT_HEIGHT);
    }, []); // Empty dependency array means this runs only on mount

    // Keep ref in sync with state
    useEffect(() => {
        currentHeightStateRef.current = currentHeightState;
    }, [currentHeightState]);


    // Track screen focus to control subscription
    useFocusEffect(
        useCallback(() => {
            console.log('[trip-view_main] Screen focused - enabling subscription');
            setIsScreenFocused(true);

            return () => {
                console.log('[trip-view_main] Screen unfocused - disabling subscription');
                setIsScreenFocused(false);
            };
        }, [])
    );

    // Keep versionRef in sync with context version
    useEffect(() => {
        versionRef.current = version;
        console.log('[trip-view_main] Version ref synced:', version);
    }, [version]);

    // Handler for scroll position changes
    const handleScrollPositionChange = (dayNumber: number, position: number) => {
        setDayScrollPositions(prev => ({
            ...prev,
            [dayNumber]: position
        }));
    };

    // Pan responder for swipe gestures between discrete states
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only respond to significant vertical movement
                return Math.abs(gestureState.dy) > 10;
            },
            onPanResponderGrant: () => {
                // Stop any ongoing animation
                bottomHeight.stopAnimation();
            },
            onPanResponderMove: () => {
                // Don't update position during move - we'll snap on release
            },
            onPanResponderRelease: (_, gestureState) => {
                // More sensitive thresholds for better responsiveness
                const swipeThreshold = 20; // Reduced from 50 to 20 for more sensitive distance detection
                const swipeVelocityThreshold = 0.2; // Reduced from 0.5 to 0.2 for more sensitive velocity detection

                const currentState = currentHeightStateRef.current; // Use ref for current value
                let newState = currentState;

                // Check for swipe up (negative dy) - go one step higher
                // Accept EITHER sufficient distance OR sufficient velocity
                if (gestureState.dy < -swipeThreshold || gestureState.vy < -swipeVelocityThreshold) {
                    newState = Math.min(currentState + 1, 2); // Max state is 2
                }
                // Check for swipe down (positive dy) - go one step lower
                // Accept EITHER sufficient distance OR sufficient velocity
                else if (gestureState.dy > swipeThreshold || gestureState.vy > swipeVelocityThreshold) {
                    newState = Math.max(currentState - 1, 0); // Min state is 0
                }

                // Animate to the new state if it changed
                if (newState !== currentState) {
                    setCurrentHeightState(newState);
                    Animated.spring(bottomHeight, {
                        toValue: heightStates[newState],
                        useNativeDriver: false,
                        tension: 80,
                        friction: 8,
                    }).start();
                }
            },
        })
    ).current;

    // Hooks for activity and day management
    const {
        selectedActivities,
        isSelectionMode,
        toggleActivitySelection,
        clearSelection,
        getSelectedActivities,
    } = useActivitySelection();

    const {
        dayActivities,
        transferActivitiesToDay,
        transferActivitiesToWishlist,
        removeActivitiesFromAllDays,
        getDayActivities,
        getDayCount,
        addNewDay,
        addMultipleDays,
        reorderDayActivities,
        deleteDayAndRenumber,
        addActivityToDay,
    } = useDayActivities();

    // Refs to track latest trip data for autosave (avoid stale closures)
    const latestTripDataRef = useRef({
        activities,
        dayActivities,
        dayPolylines,
        dayTravelModes,
        tripLength,
        selectedCity,
        tripPhotoReference,
        createdAt,
        recentSearches,
    });

    // Keep latestTripDataRef in sync with the latest values
    useEffect(() => {
        latestTripDataRef.current = {
            activities,
            dayActivities,
            dayPolylines,
            dayTravelModes,
            tripLength,
            selectedCity,
            tripPhotoReference,
            createdAt,
            recentSearches,
        };
    }, [activities, dayActivities, dayPolylines, dayTravelModes, tripLength, selectedCity, tripPhotoReference, createdAt, recentSearches]);

    // Initialize days based on tripLength (only for new trips, not existing ones)
    const [hasInitialized, setHasInitialized] = useState(false);
    useEffect(() => {
        // Only initialize days once when the component first mounts
        if (!hasInitialized) {
            if (tripLength && tripLength > 0 && getDayCount() === 0) {
                // Create all days at once based on tripLength
                addMultipleDays(tripLength);
            } else if (!tripLength && getDayCount() === 0) {
                // Fallback: create day 1 if tripLength is not set
                addNewDay();
            }
            setHasInitialized(true);
        }
    }, [tripLength, getDayCount, addNewDay, addMultipleDays, hasInitialized]);

    // Define handleTabChange before using it in the hook
    const handleTabChange = (tab: TabType) => {
        // Check if we have selected activities and are switching to a different tab
        if (isSelectionMode && selectedActivities.length > 0 && tab !== activeTab) {
            // Get the selected activities
            const selectedActivitiesList = getSelectedActivities(getActivitiesForTab(activeTab));

            if (selectedActivitiesList.length > 0) {
                // Transfer to the selected tab
                if (tab === 'wishlist') {
                    // Transfer to wishlist from the current day
                    let currentDayNumber = 1;
                    if (activeTab.startsWith('day')) {
                        currentDayNumber = parseInt(activeTab.replace('day', ''));
                    }
                    const activityIds = selectedActivitiesList
                        .map(a => a.instanceId)
                        .filter((id): id is string => typeof id === 'string');

                    const transferredActivities = transferActivitiesToWishlist(activityIds, currentDayNumber);

                    // Add the transferred activities back to the wishlist
                    if (transferredActivities.length > 0) {
                        addActivitiesToWishlist(transferredActivities);
                    }
                } else if (tab.startsWith('day')) {
                    // Transfer to the selected day
                    const dayNumber = parseInt(tab.replace('day', ''));
                    transferActivitiesToDay(selectedActivitiesList, dayNumber);
                }

                // Clear selection after transfer
                clearSelection();
            }
        } else {
            // No selected activities, just clear selection
            clearSelection();
        }

        setActiveTab(tab);
        // Don't auto-scroll for manual tab selection
        setShouldScrollToActive(false);
        // Clear selected marker when switching tabs
        setSelectedMarker(null);

        // Trigger scroll restoration for the new active tab if it's a day tab
        if (tab.startsWith('day')) {
            const dayNumber = parseInt(tab.replace('day', ''));
            setShouldRestoreScrollPositions(prev => ({
                ...prev,
                [dayNumber]: true
            }));
            // Reset the flag after restoration
            setTimeout(() => {
                setShouldRestoreScrollPositions(prev => ({
                    ...prev,
                    [dayNumber]: false
                }));
            }, 100);
        }
    };

    // Get all activities from the entire trip (wishlist + all days)
    const getAllActivitiesFromTrip = () => {
        const wishlistActivities = activities || [];
        const allDayActivities = Object.values(dayActivities || {})
            .flatMap(dayObj => Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : []);
        return [...wishlistActivities, ...allDayActivities];
    };

    // Get activities for the current tab
    const getActivitiesForTab = (tab: TabType) => {
        if (tab === 'wishlist') {
            // Filter out activities that are already in days (by instanceId)
            const dayActivityInstanceIds = Object.values(dayActivities || {})
                .flatMap(dayObj => Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : [])
                .map((activity: Activity) => activity.instanceId)
                .filter(Boolean);

            return (activities || []).filter((activity: Activity) =>
                !activity.instanceId || !dayActivityInstanceIds.includes(activity.instanceId)
            );
        } else {
            // Extract day number from tab (e.g., 'day2' -> 2)
            const dayNumber = parseInt(tab.replace('day', ''));
            return getDayActivities(dayNumber) || [];
        }
    };

    // Function to add activities back to the wishlist
    const addActivitiesToWishlist = (newActivities: Activity[]) => {
        // Combine new activities first, then existing ones, to prioritize new data
        const combinedActivities = [...newActivities, ...(activities || [])];
        const deduplicatedActivities = combinedActivities.filter((activity, index, arr) => {
            // Use instanceId for deduplication (allows duplicate places with different instanceIds)
            if (!activity.instanceId) return true; // Keep activities without instanceId (backward compat)
            // Keep only the first occurrence of each instanceId (now from newActivities)
            return arr.findIndex(a => a.instanceId === activity.instanceId) === index;
        });

        updateActivities(deduplicatedActivities);
    };

    // Handler for duplicating an activity
    const handleDuplicateActivity = useCallback((activity: Activity, targetDayNumber?: number) => {
        console.log('[trip-view_main] Duplicating activity:', activity.name);

        // Create duplicate with new instanceId but same place_id
        const duplicatedActivity = duplicateActivity(activity);

        if (targetDayNumber !== undefined && targetDayNumber !== null) {
            // Duplicate within a specific day – insert directly after the original
            const currentDayActivities = getDayActivities(targetDayNumber) || [];

            // Find original activity index (prefer instanceId, fall back to place_id + name)
            const originalIndex = currentDayActivities.findIndex(a => {
                if (activity.instanceId && a.instanceId) {
                    return a.instanceId === activity.instanceId;
                }
                if (activity.place_id && a.place_id) {
                    return a.place_id === activity.place_id && a.name === activity.name;
                }
                return false;
            });

            let newOrder: Activity[];
            if (originalIndex >= 0) {
                newOrder = [
                    ...currentDayActivities.slice(0, originalIndex + 1),
                    duplicatedActivity,
                    ...currentDayActivities.slice(originalIndex + 1),
                ];
            } else {
                // Fallback: append to end if we can't find the original
                newOrder = [...currentDayActivities, duplicatedActivity];
            }

            reorderDayActivities(targetDayNumber, newOrder);
            console.log(
                '[trip-view_main] Activity duplicated to day',
                targetDayNumber,
                'at index',
                originalIndex >= 0 ? originalIndex + 1 : newOrder.length - 1,
                'with instanceId:',
                duplicatedActivity.instanceId
            );
        } else {
            // Duplicate within wishlist – insert directly after the original
            updateActivities((prev: Activity[]) => {
                const prevActivities = Array.isArray(prev) ? prev : [];

                const originalIndex = prevActivities.findIndex(a => {
                    if (activity.instanceId && a.instanceId) {
                        return a.instanceId === activity.instanceId;
                    }
                    if (activity.place_id && a.place_id) {
                        return a.place_id === activity.place_id && a.name === activity.name;
                    }
                    return false;
                });

                const nextActivities = [...prevActivities];
                if (originalIndex >= 0) {
                    nextActivities.splice(originalIndex + 1, 0, duplicatedActivity);
                } else {
                    // Fallback: append to end if original isn't found
                    nextActivities.push(duplicatedActivity);
                }

                return nextActivities;
            });
            console.log('[trip-view_main] Activity duplicated in wishlist with instanceId:', duplicatedActivity.instanceId);
        }
    }, [getDayActivities, reorderDayActivities, updateActivities]);

    // Handler for deleting a single activity
    const handleDeleteActivity = useCallback((activity: Activity, targetDayNumber?: number) => {
        console.log('[trip-view_main] Deleting activity:', activity.name);

        if (targetDayNumber !== undefined && targetDayNumber !== null) {
            // Delete from a specific day
            const currentDayActivities = getDayActivities(targetDayNumber) || [];

            // Filter out the activity (prefer instanceId, fall back to place_id + name)
            const newOrder = currentDayActivities.filter(a => {
                if (activity.instanceId && a.instanceId) {
                    return a.instanceId !== activity.instanceId;
                }
                if (activity.place_id && a.place_id) {
                    return !(a.place_id === activity.place_id && a.name === activity.name);
                }
                return true;
            });

            reorderDayActivities(targetDayNumber, newOrder);
            console.log('[trip-view_main] Activity deleted from day', targetDayNumber);
        } else {
            // Delete from wishlist
            updateActivities((prev: Activity[]) => {
                const prevActivities = Array.isArray(prev) ? prev : [];

                return prevActivities.filter(a => {
                    if (activity.instanceId && a.instanceId) {
                        return a.instanceId !== activity.instanceId;
                    }
                    if (activity.place_id && a.place_id) {
                        return !(a.place_id === activity.place_id && a.name === activity.name);
                    }
                    return true;
                });
            });
            console.log('[trip-view_main] Activity deleted from wishlist');
        }
    }, [getDayActivities, reorderDayActivities, updateActivities]);

    // Remove local state and handlers for transfer modal and related logic
    // Use the custom hook for all transfer modal and activity transfer logic
    const {
        isModalVisible,
        setIsModalVisible,
        selectedDay,
        daysArray,
        handleOpenTransferModal,
        handleTransferToWishlist,
        handleDaySelection,
    } = useTransferActivities({
        activities: getActivitiesForTab(activeTab), // Pass current tab's activities instead of just wishlist
        activeTab,
        getSelectedActivities,
        transferActivitiesToDay,
        transferActivitiesToWishlist,
        clearSelection,
        getDayCount,
        onTabChange: handleTabChange, // Pass the tab change handler
        updateWishlistActivities: addActivitiesToWishlist, // Pass function to add activities back to wishlist
    });

    // Helper to hash activities for cache key
    function hashActivities(activities: Activity[]): string {
        // Simple hash: JSON stringify names/lat/lng only, sorted for determinism
        return JSON.stringify(
            activities
                .map(a => ({ name: a.name, lat: a.lat, lng: a.lng }))
                .sort((a, b) => a.name.localeCompare(b.name))
        );
    }

    // Fetch route data when activities or activeTab changes
    useEffect(() => {
        setRouteData({
            polyline: [],
            legs: [],
            totalDistance: 0,
            totalDuration: '',
            travelMode: 'DRIVE'
        });
        if (!activeTab.startsWith('day')) {
            setRouteLoading(false);
            return;
        }
        setRouteLoading(true);
        const fetchRoute = async () => {
            const currentTabActivities = getActivitiesForTab(activeTab);
            const activitiesHash = hashActivities(currentTabActivities);
            const cached = routeCache.current[activeTab];
            if (cached && cached.activitiesHash === activitiesHash) {
                setRouteData(cached.routeData);
                setRouteLoading(false);
                // Store encoded polyline in context if available
                if (cached.routeData.polyline && cached.routeData.polyline.length > 1) {
                    const dayNumber = parseInt(activeTab.replace('day', ''));
                    const encoded = encodePolyline(cached.routeData.polyline);
                    setDayPolyline(dayNumber, encoded);
                }
                return;
            }
            // Fetch initial route with DRIVE mode (default)
            const basicRouteData = await fetchRoutePolyline(currentTabActivities);

            // Transform legs into EnhancedRouteLeg structure with DRIVE data only
            const enhancedLegs: EnhancedRouteLeg[] = basicRouteData.legs.map((leg: any) => ({
                modeData: {
                    DRIVE: {
                        distance: leg.distance,
                        duration: leg.duration,
                        polyline: leg.polyline
                    }
                },
                selectedMode: 'DRIVE' as TravelMode,
                loadingModes: []
            }));

            const newRouteData: RouteData = {
                polyline: basicRouteData.polyline,
                legs: enhancedLegs,
                totalDistance: basicRouteData.totalDistance,
                totalDuration: basicRouteData.totalDuration,
                travelMode: 'DRIVE'
            };

            setRouteData(newRouteData);
            // Update cache
            routeCache.current[activeTab] = {
                activitiesHash,
                routeData: newRouteData,
            };
            // Store encoded polyline in context if available
            if (newRouteData.polyline && newRouteData.polyline.length > 1) {
                const dayNumber = parseInt(activeTab.replace('day', ''));
                const encoded = encodePolyline(newRouteData.polyline);
                setDayPolyline(dayNumber, encoded);
            }
            setRouteLoading(false);
        };
        fetchRoute();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, activities, dayActivities]);

    // Invalidate cache for a day if its activities change
    useEffect(() => {
        // For each day tab, check if activities changed
        daysArray.forEach((d) => {
            if (typeof d === 'number') {
                const tab = `day${d}`;
                const acts = getDayActivities(d);
                const hash = hashActivities(acts);
                const cached = routeCache.current[tab];
                if (cached && cached.activitiesHash !== hash) {
                    delete routeCache.current[tab];
                }
            }
        });
    }, [dayActivities, activities, daysArray]);

    // Get all available days as an array, and add 'wishlist' as the last option
    const dayCount = getDayCount();

    // Prepare tab order: wishlist first, then all days
    const tabLabels: TabType[] = [
        'wishlist',
        ...daysArray.filter((d): d is number => typeof d === 'number').map(d => `day${d}` as TabType)
    ];

    // Placeholder: implement this to call your backend or Google Places API
    async function fetchActivityDetailsByPlaceId(place_id: string) {
        // TODO: Replace with actual API call to your backend or Google Places API
        // Return an object with at least: rating, photo_reference, and any other fields you want to refresh
        return {};
    }

    const handleOptimizeRoute = async (dayNumber: number) => {
        try {
            setRouteLoading(true);
            // 1. Get current day's activities
            const currentActivities = getDayActivities(dayNumber);
            if (!currentActivities || currentActivities.length < 2) {
                setRouteLoading(false);
                return;
            }
            // 2. Use local Haversine optimization (FREE)
            const { result: reordered, wasCached } = optimizeRouteWithHaversine(currentActivities);
            if (!Array.isArray(reordered) || reordered.length < 2) {
                setRouteLoading(false);
                return;
            }
            // 3. Use the optimized activities array directly.
            //    IMPORTANT: This preserves duplicate stops of the same place
            //    (each with its own instanceId), avoiding key collisions.
            let reorderedFull = reordered;

            // 4. For any activity missing rating or photo_reference, fetch latest details
            reorderedFull = await Promise.all(reorderedFull.map(async (act) => {
                if (act.place_id && (act.rating == null || !act.photo_reference)) {
                    const details = await fetchActivityDetailsByPlaceId(act.place_id);
                    return { ...act, ...details };
                }
                return act;
            }));
            // 5. Update the activities for this day
            reorderDayActivities(dayNumber, reorderedFull);
            // 6. Call getRoute Lambda via GraphQL for the new order
            const basicRouteData = await fetchRoutePolyline(reorderedFull);

            // Transform legs into EnhancedRouteLeg structure with DRIVE data only
            const enhancedLegs: EnhancedRouteLeg[] = basicRouteData.legs.map((leg: any) => ({
                modeData: {
                    DRIVE: {
                        distance: leg.distance,
                        duration: leg.duration,
                        polyline: leg.polyline
                    }
                },
                selectedMode: 'DRIVE' as TravelMode,
                loadingModes: []
            }));

            const newRouteData: RouteData = {
                polyline: basicRouteData.polyline,
                legs: enhancedLegs,
                totalDistance: basicRouteData.totalDistance,
                totalDuration: basicRouteData.totalDuration,
                travelMode: 'DRIVE'
            };

            // 7. Update the route cache for this day regardless of active tab
            const dayTab = `day${dayNumber}`;
            const activitiesHash = hashActivities(reorderedFull);
            routeCache.current[dayTab] = {
                activitiesHash,
                routeData: newRouteData,
            };
            // 8. Update the route data if this is the currently active tab
            if (activeTab === dayTab) {
                setRouteData(newRouteData);
            }
            // 9. Store encoded polyline in context for the optimized route
            if (newRouteData.polyline && newRouteData.polyline.length > 1) {
                const encoded = encodePolyline(newRouteData.polyline);
                setDayPolyline(dayNumber, encoded);
            }
            setRouteLoading(false);
        } catch (err) {
            setRouteLoading(false);
            console.error('Error optimizing route:', err);
            // Optionally show a user-facing error message here
        }
    };

    const handleAddDay = () => {
        const newDayNumber = addNewDay();
        // Update tripLength to reflect the new day count
        setTripLength(getDayCount());
        // Switch to the newly created day
        setActiveTab(`day${newDayNumber}`);
        // Trigger auto-scroll to the new day
        setShouldScrollToActive(true);
    };

    const handleDeleteDay = () => {
        // Only allow deletion if activeTab is a day (not wishlist)
        if (!activeTab.startsWith('day')) return;

        const dayToDelete = parseInt(activeTab.replace('day', ''));

        // Check if the day has any activities
        const dayActivitiesForDelete = getDayActivities(dayToDelete);
        const hasActivities = dayActivitiesForDelete && dayActivitiesForDelete.length > 0;

        // Function to perform the deletion
        const performDeletion = () => {
            // Delete the day and get its activities to move back to wishlist
            const deletedDayActivities = deleteDayAndRenumber(dayToDelete);

            // Add deleted day activities back to wishlist (with deduplication)
            if (deletedDayActivities.length > 0) {
                const combinedActivities = [...(activities || []), ...deletedDayActivities];

                // Remove duplicates based on instanceId
                const deduplicatedActivities = combinedActivities.filter((activity, index, arr) => {
                    if (!activity.instanceId) return true; // Keep activities without instanceId (backward compat)
                    // Keep only the first occurrence of each instanceId
                    return arr.findIndex(a => a.instanceId === activity.instanceId) === index;
                });

                updateActivities(deduplicatedActivities);
            }

            // Clear route cache for days that got renumbered
            Object.keys(routeCache.current).forEach(cacheKey => {
                if (cacheKey.startsWith('day')) {
                    const cachedDayNum = parseInt(cacheKey.replace('day', ''));
                    if (cachedDayNum >= dayToDelete) {
                        delete routeCache.current[cacheKey];
                    }
                }
            });

            // Update dayPolylines to renumber the keys
            setDayPolylinesDeleteDay(prev => {
                const newPolylines: { [key: number]: string } = {};
                Object.entries(prev).forEach(([dayStr, polyline]) => {
                    const dayNum = Number(dayStr);
                    if (dayNum < dayToDelete) {
                        // Keep days before the deleted day as-is
                        newPolylines[dayNum] = polyline as string;
                    } else if (dayNum > dayToDelete) {
                        // Renumber days after the deleted day
                        newPolylines[dayNum - 1] = polyline as string;
                    }
                    // Skip the deleted day (dayNum === dayToDelete)
                });
                return newPolylines;
            });

            // Switch to appropriate tab after deletion
            const remainingDayCount = getDayCount() - 1; // Count after deletion
            // Update tripLength to reflect the new day count
            setTripLength(remainingDayCount);
            if (remainingDayCount === 0 || dayToDelete === 1) {
                // If no days left or deleting day 1, go to wishlist
                setActiveTab('wishlist');
            } else {
                // If deleting any other day, go to the previous day
                setActiveTab(`day${dayToDelete - 1}`);
            }
        };

        // Only show confirmation dialog if the day has activities
        if (hasActivities) {
             Alert.alert(
                 'Delete Day',
                 `Are you sure you want to delete Day ${dayToDelete}?`,
                 [
                     {
                         text: 'Cancel',
                         style: 'cancel'
                     },
                     {
                         text: 'Delete',
                         style: 'destructive',
                         onPress: performDeletion
                     }
                 ]
             );
        } else {
            // No activities, delete immediately without confirmation
            performDeletion();
        }
    };

    const handleDeleteActivities = () => {
        if (selectedActivities.length === 0) return;

        // Remove from CreateTripContext (master list)
        removeActivities(selectedActivities);

        // Remove from all days
        removeActivitiesFromAllDays(selectedActivities);

        // Clear selection
        clearSelection();
    };

    // Handle reordering activities within a day via drag and drop
    const handleDayActivityReorder = async (dayNumber: number, newOrder: Activity[]) => {
        try {
            // Update the activities for this day using the existing reorderDayActivities function
            reorderDayActivities(dayNumber, newOrder);

            // Clear the route cache for this day to trigger route recalculation
            const dayTab = `day${dayNumber}`;
            delete routeCache.current[dayTab];

            // If this is the currently active tab, trigger route recalculation
            if (activeTab === dayTab) {
                setRouteLoading(true);
                const basicRouteData = await fetchRoutePolyline(newOrder);

                // Transform legs into EnhancedRouteLeg structure with DRIVE data only
                const enhancedLegs: EnhancedRouteLeg[] = basicRouteData.legs.map((leg: any) => ({
                    modeData: {
                        DRIVE: {
                            distance: leg.distance,
                            duration: leg.duration,
                            polyline: leg.polyline
                        }
                    },
                    selectedMode: 'DRIVE' as TravelMode,
                    loadingModes: []
                }));

                const newRouteData: RouteData = {
                    polyline: basicRouteData.polyline,
                    legs: enhancedLegs,
                    totalDistance: basicRouteData.totalDistance,
                    totalDuration: basicRouteData.totalDuration,
                    travelMode: 'DRIVE'
                };

                setRouteData(newRouteData);

                // Update the route cache for this day
                const activitiesHash = hashActivities(newOrder);
                routeCache.current[dayTab] = {
                    activitiesHash,
                    routeData: newRouteData,
                };

                // Store encoded polyline in context
                if (newRouteData.polyline && newRouteData.polyline.length > 1) {
                    const encoded = encodePolyline(newRouteData.polyline);
                    setDayPolyline(dayNumber, encoded);
                }

                setRouteLoading(false);
            }
        } catch (error) {
            console.error('Error reordering activities:', error);
            setRouteLoading(false);
        }
    };

    // Helper to parse duration string like "15m 30s" to seconds
    const parseDuration = (durationStr: string): number => {
        const parts = durationStr.trim().split(' ');
        let totalSeconds = 0;
        parts.forEach(part => {
            if (part.endsWith('h')) {
                totalSeconds += parseInt(part) * 3600;
            } else if (part.endsWith('m')) {
                totalSeconds += parseInt(part) * 60;
            } else if (part.endsWith('s')) {
                totalSeconds += parseInt(part);
            }
        });
        return totalSeconds;
    };

    // Helper to format seconds to "Xm" or "Xh Ym" format
    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        }
        return `${minutes}m`;
    };

    // Handler for opening transportation settings modal
    const handleOpenSettings = async (legIndex: number) => {
        if (!activeTab.startsWith('day')) return;

        const currentDayNumber = parseInt(activeTab.replace('day', ''));
        const dayActivities = getActivitiesForTab(activeTab);

        if (legIndex < 0 || legIndex >= dayActivities.length - 1) return;

        // Store the origin and destination activities in state
        const origin = dayActivities[legIndex];
        const destination = dayActivities[legIndex + 1];

        console.log('[handleOpenSettings] Setting modal activities:', {
            legIndex,
            hasOrigin: !!origin,
            hasDestination: !!destination,
            originName: origin?.name,
            destinationName: destination?.name,
            originLat: origin?.lat,
            originLng: origin?.lng,
            destLat: destination?.lat,
            destLng: destination?.lng,
        });

        setModalOriginActivity(origin);
        setModalDestinationActivity(destination);
        setSelectedLegIndex(legIndex);
        setSettingsModalVisible(true);

        // Get the current leg
        const currentLeg = routeData.legs[legIndex] as EnhancedRouteLeg | undefined;

        // Lazy load missing modes
        const missingModes: TravelMode[] = [];
        if (!currentLeg?.modeData?.WALK) missingModes.push('WALK');
        if (!currentLeg?.modeData?.DRIVE) missingModes.push('DRIVE');
        if (!currentLeg?.modeData?.TRANSIT) missingModes.push('TRANSIT');

        if (missingModes.length > 0 && currentLeg) {
            // Mark modes as loading
            const updatedLegs = [...routeData.legs];
            updatedLegs[legIndex] = {
                ...currentLeg,
                loadingModes: [...(currentLeg.loadingModes || []), ...missingModes]
            };
            setRouteData(prev => ({ ...prev, legs: updatedLegs }));

            // Fetch missing modes in parallel
            const legActivities = [dayActivities[legIndex], dayActivities[legIndex + 1]];
            const fetchPromises = missingModes.map(async (mode) => {
                try {
                    const result = await fetchRoutePolylineWithMode(legActivities, mode);
                    return { mode, data: result.legs[0] };
                } catch (error) {
                    console.error(`Error fetching ${mode} mode:`, error);
                    return { mode, data: null };
                }
            });

            const results = await Promise.all(fetchPromises);

            // Update leg with fetched data
            const updatedLeg = { ...currentLeg };
            results.forEach(({ mode, data }) => {
                if (data) {
                    updatedLeg.modeData[mode] = data;
                }
            });
            updatedLeg.loadingModes = [];

            const finalLegs = [...routeData.legs];
            finalLegs[legIndex] = updatedLeg;
            setRouteData(prev => ({ ...prev, legs: finalLegs }));
        }
    };

    // Handler for selecting a transportation mode
    const handleSelectMode = async (mode: TravelMode) => {
        if (!activeTab.startsWith('day') || selectedLegIndex === null) return;

        const dayActivities = getActivitiesForTab(activeTab);
        const currentDayNumber = parseInt(activeTab.replace('day', ''));

        // Update the selected mode for this leg
        const updatedLegs = [...routeData.legs];
        const currentLeg = updatedLegs[selectedLegIndex] as EnhancedRouteLeg;
        updatedLegs[selectedLegIndex] = {
            ...currentLeg,
            selectedMode: mode
        };

        // Recalculate polyline based on all selected modes
        let newPolylineCoords: { latitude: number; longitude: number }[] = [];
        for (let i = 0; i < updatedLegs.length; i++) {
            const leg = updatedLegs[i] as EnhancedRouteLeg;
            const modeData = leg.modeData[leg.selectedMode];
            if (modeData?.polyline) {
                const legCoords = decodePolyline(modeData.polyline);
                newPolylineCoords = [...newPolylineCoords, ...legCoords];
            }
        }

        // Calculate new total distance and duration
        let totalDistance = 0;
        let totalDurationSeconds = 0;
        updatedLegs.forEach((leg) => {
            const enhancedLeg = leg as EnhancedRouteLeg;
            const modeData = enhancedLeg.modeData[enhancedLeg.selectedMode];
            if (modeData) {
                totalDistance += modeData.distance || 0;
                totalDurationSeconds += parseDuration(modeData.duration || '0m');
            }
        });

        // Update route data with new polyline and totals
        const newRouteData = {
            ...routeData,
            polyline: newPolylineCoords,
            legs: updatedLegs,
            totalDistance,
            totalDuration: formatDuration(totalDurationSeconds)
        };

        setRouteData(newRouteData);

        // Update cache
        const activitiesHash = hashActivities(dayActivities);
        routeCache.current[activeTab] = {
            activitiesHash,
            routeData: newRouteData
        };

        // Store encoded polyline in context
        if (newPolylineCoords.length > 1) {
            const encoded = encodePolyline(newPolylineCoords);
            setDayPolyline(currentDayNumber, encoded);
        }
    };

    // Handler for activity description card selection
    const handleActivityDescriptionCardSelect = (activity: Activity) => {
        setSelectedActivityForDetail(activity);
        setShowActivityDetail(true);
        // Set selected marker when opening detail view
        if (activity.place_id) {
            setSelectedMarker(activity.place_id);
        }
    };

    // Handler for closing activity detail view
    const handleCloseActivityDetail = () => {
        setShowActivityDetail(false);
        setSelectedActivityForDetail(null);
        // Clear selected marker when closing detail view
        setSelectedMarker(null);
        // Trigger scroll position restore for the current active tab only
        if (activeTab.startsWith('day')) {
            const currentDayNumber = parseInt(activeTab.replace('day', ''));
            setShouldRestoreScrollPositions(prev => ({
                ...prev,
                [currentDayNumber]: true
            }));
            // Reset the flag immediately after next render
            setTimeout(() => {
                setShouldRestoreScrollPositions(prev => ({
                    ...prev,
                    [currentDayNumber]: false
                }));
            }, 0);
        }
    };

    // Handler for SearchBar press
    const handleSearchPress = () => {
        setShowAutocomplete(true);
    };

    // Handler for search query change
    const handleSearchQueryChange = (text: string) => {
        setSearchQuery(text);
    };

    // Handler for filter toggle
    const handleFilterToggle = (filterId: string) => {
        setSelectedFilters((prev) => {
            if (prev.includes(filterId)) {
                return prev.filter((id) => id !== filterId);
            } else {
                return [...prev, filterId];
            }
        });
    };

    // Handler for saving search results (new direct flow)
    const handleSaveSearchResults = (selectedActivities: Activity[], wishlistActivityIds?: string[]) => {
        if (selectedActivities.length === 0) {
            return;
        }

        // If wishlistActivityIds are provided, we're moving activities from wishlist to current tab
        if (wishlistActivityIds && wishlistActivityIds.length > 0) {
            // Remove from wishlist
            removeActivities(wishlistActivityIds);

            // Add to the current tab
            if (activeTab === 'wishlist') {
                // Already on wishlist, no need to move
                return;
            } else if (activeTab.startsWith('day')) {
                // Add to the specific day
                const dayNumber = parseInt(activeTab.replace('day', ''));
                selectedActivities.forEach(activity => {
                    addActivityToDay(activity, dayNumber);
                });
            }
        } else {
            // Normal flow: adding new activities from search
            if (activeTab === 'wishlist') {
                // Add to wishlist
                updateActivities([...(activities || []), ...selectedActivities]);
            } else if (activeTab.startsWith('day')) {
                // Add to the specific day
                const dayNumber = parseInt(activeTab.replace('day', ''));
                selectedActivities.forEach(activity => {
                    addActivityToDay(activity, dayNumber);
                });
            } else {
                // Fallback to wishlist
                updateActivities([...(activities || []), ...selectedActivities]);
            }
        }

        // Modal auto-closes in AutocompleteModal component
        setShowAutocomplete(false);
        setSearchQuery('');
    };

    // ===== CATEGORY FLOW HANDLERS =====

    // Debug log: city categories and UI conditions (REMOVED - causing excessive re-renders)
    // useEffect(() => {
    //     console.log('[trip-view_main] cityCategories updated:', Array.isArray(cityCategories) ? cityCategories.length : cityCategories);
    //     if (Array.isArray(cityCategories)) {
    //         console.log('[trip-view_main] cityCategories sample:', cityCategories[0]);
    //     }
    //     console.log('[trip-view_main] selectedCity:', selectedCity);
    // }, [cityCategories, selectedCity]);

    // Handler for category card press
    const handleCategoryPress = async (category: any) => {
        setSelectedCategory(category.category);
        setShowCategoryModal(true);

        // Check if we already have cached activities for this category in context
        if (categoryActivities[category.category] && categoryActivities[category.category].length > 0) {
            // Activities already exist in context, no need to fetch
            return;
        }

        // If not cached, fetch new activities
        setLoadingCategoryActivities(true);

        try {
            // Generate activities for this category (this updates context's categoryActivities)
            await generateActivitiesForCategory(category.category);
        } catch (error) {
            console.error('[trip-view_main] Error generating category activities:', error);
            // Alert.alert('Error', 'Failed to load activities. Please try again.');
            setShowCategoryModal(false);
        } finally {
            setLoadingCategoryActivities(false);
        }
    };

    // Handler for saving category activities
    const handleSaveCategoryActivities = (selectedActivities: Activity[], deselectedWishlistActivityIds: string[] = []) => {
        // Remove deselected wishlist activities
        if (deselectedWishlistActivityIds.length > 0) {
            removeActivities(deselectedWishlistActivityIds);
        }

        // Add newly selected activities
        if (selectedActivities.length > 0) {
            addToWishlist(selectedActivities);
        }

        setShowCategoryModal(false);
    };

    // Handler for generating more category activities
    const handleGenerateMoreCategoryActivities = async (categoryName: string) => {
        setLoadingMoreCategoryActivities(true);

        try {
            // Generate more activities for this category (updates context automatically)
            await generateActivitiesForCategory(categoryName);
        } catch (error: any) {
            // Check if this is a limit reached error
            if (error.message && error.message.includes('Activity generation limit reached')) {
                throw error; // Re-throw to let CategoryModal handle the alert
            } else {
                throw error; // Re-throw to let CategoryModal handle the alert
            }
        } finally {
            setLoadingMoreCategoryActivities(false);
        }
    };

    // Handler to reload trip with latest changes from remote
    const handleReloadTrip = async () => {
        try {
            // Set reloading flag to prevent autosave during reload
            isReloadingRef.current = true;

            // Get owner's userID from collaborators
            const owner = collaborators.find(c => c.role === 'owner');
            if (!owner) {
                isReloadingRef.current = false;
                return;
            }

            // Fetch latest trip data
            const updatedTrip = await retrieveTripFromCloud(owner.userID, tripId);

            if (updatedTrip) {
                // Restore trip data into context
                restoreTripFromObject(updatedTrip, currentUserID);

                // Update version tracking
                versionRef.current = updatedTrip.version || 1;

                console.log('[trip-view_main] Trip reloaded');
            }

            // Clear reloading flag after a delay to allow state to settle
            setTimeout(() => {
                isReloadingRef.current = false;
            }, 2000);
        } catch (error) {
            console.error('[trip-view_main] Error reloading trip:', error);
            isReloadingRef.current = false;
        }
    };


    // Reset shouldScrollToActive after it's been used
    React.useEffect(() => {
        if (shouldScrollToActive) {
            setShouldScrollToActive(false);
        }
    }, [shouldScrollToActive]);

    // Helper function to sanitize activity objects for GraphQL input
    const sanitizeActivity = (activity: Activity & { __typename?: string }) => {
        const {
            __typename,
            regular_opening_hours,
            reviews,
            ...sanitized
        } = activity;

        // Clean regular_opening_hours if it exists
        let cleanOpeningHours = null;
        if (regular_opening_hours) {
            const { __typename: openingTypename, periods, ...openingHoursRest } = regular_opening_hours as any;
            cleanOpeningHours = {
                ...openingHoursRest,
                ...(periods && {
                    periods: periods.map((period: any) => {
                        const { __typename: periodTypename, open, close, ...periodRest } = period;
                        const cleanPeriod: any = { ...periodRest };

                        if (open) {
                            const { __typename: openTypename, ...openRest } = open;
                            cleanPeriod.open = openRest;
                        }

                        if (close) {
                            const { __typename: closeTypename, ...closeRest } = close;
                            cleanPeriod.close = closeRest;
                        }

                        return cleanPeriod;
                    })
                })
            };
        }

        // Clean reviews if they exist
        let cleanReviews = null;
        if (reviews && Array.isArray(reviews)) {
            cleanReviews = reviews.map((review: any) => {
                const { __typename: reviewTypename, ...reviewRest } = review;
                return reviewRest;
            });
        }

        return {
            ...sanitized,
            ...(cleanOpeningHours && { regular_opening_hours: cleanOpeningHours }),
            ...(cleanReviews && { reviews: cleanReviews })
        };
    };

    // Helper to sanitize recent searches for GraphQL input
    const sanitizeRecentSearch = (recentSearch: any) => {
        const { __typename, ...rest } = recentSearch || {};
        return {
            place_id: rest.place_id,
            name: rest.name,
            address_info: rest.address_info,
            timestamp: rest.timestamp,
        };
    };

    // Serialize trip data for saving
    const saveTrip = async () => {
        // Check if save is already in progress using ref for immediate access
        if (isSavingRef.current) {
            console.log('[trip-view_main] Save already in progress, skipping duplicate save');
            return;
        }

        isSavingRef.current = true;
        setIsSaving(true);

        try {
            // Use latest values from ref to avoid stale closures
            const {
                activities: latestActivities,
                dayActivities: latestDayActivities,
                dayPolylines: latestDayPolylines,
                dayTravelModes: latestDayTravelModes,
                selectedCity: latestSelectedCity,
                tripPhotoReference: latestTripPhotoReference,
                createdAt: latestCreatedAt,
                recentSearches: latestRecentSearches,
            } = latestTripDataRef.current;

            // Gather days and their activities (sanitize activities for GraphQL input)
            const days = Object.keys(latestDayActivities).map(dayNumber => ({
                dayNumber: Number(dayNumber),
                activities: latestDayActivities[dayNumber].activities.map(sanitizeActivity),
                encodedPolyline: latestDayPolylines[dayNumber] || null,
                travelModes: latestDayTravelModes[dayNumber] ? JSON.stringify(latestDayTravelModes[dayNumber]) : null,
            }));
            // Gather wishlist activities (not assigned to any day) and sanitize them
            const dayActivityInstanceIds = days.flatMap(day => day.activities.map(a => a.instanceId)).filter(Boolean);
            const wishlist = (latestActivities || [])
                .filter((activity) => !activity.instanceId || !dayActivityInstanceIds.includes(activity.instanceId))
                .map(sanitizeActivity);
            // Compose trip data object
            // Generate tripId if it doesn't exist (first time save)
            // Use tripIdRef for immediate access to avoid race conditions
            // IMPORTANT: Check context tripId first (may have been set from create_trip_1_city)
            let currentTripId = tripIdRef.current;
            if (!currentTripId) {
                // Only generate a new tripId if one doesn't exist in context
                currentTripId = generateTripId();
                console.log('[trip-view_main] Generated new tripId:', currentTripId);
                // Immediately update ref to prevent duplicate generation
                tripIdRef.current = currentTripId;
                // Also update context state
                setTripId(currentTripId);
            } else {
                console.log('[trip-view_main] Using existing tripId from context:', currentTripId);
            }

            // Preserve original createdAt for existing trips, generate only for new trips
            let tripCreatedAt = latestCreatedAt;
            if (!tripCreatedAt) {
                tripCreatedAt = new Date().toISOString();
                setCreatedAt(tripCreatedAt);
                console.log('[trip-view_main] Generated new createdAt:', tripCreatedAt);
            }

            // Sanitize cityCategories to only include allowed fields per GraphQL input
            const cleanCityCategories = Array.isArray(cityCategories)
                ? cityCategories.map((c: any) => ({
                    category: c?.category,
                    category_items: Array.isArray(c?.category_items) ? c.category_items : [],
                    ...(typeof c?.emoji === 'string' ? { emoji: c.emoji } : {})
                }))
                : null;

            // Sanitize recentSearches for GraphQL input
            const cleanRecentSearches = Array.isArray(latestRecentSearches)
                ? latestRecentSearches.map(sanitizeRecentSearch)
                : [];

            const tripData = {
                tripId: currentTripId,
                days,
                wishlist,
                tripLength: days.length, // Use tripLength state variable, fallback to days.length
                selectedCity: latestSelectedCity,
                tripPhotoReference: Array.isArray(latestTripPhotoReference)
                    ? latestTripPhotoReference
                    : (latestTripPhotoReference ? [String(latestTripPhotoReference)] : []),
                createdAt: tripCreatedAt,
                startDate: startDate || null,
                endDate: endDate || null,
                cityCategories: cleanCityCategories || null, // Save city categories for restoration
                recentSearches: cleanRecentSearches,
            };

            // Get current user information
            let currentUserID;
            let currentUserEmail;
            let currentUserName;
            let currentUsername;
            const currentUser = await Auth.currentAuthenticatedUser();
            // Use username (not sub) for consistency with collaborator storage
            currentUserID = currentUser.username;
            currentUserEmail = currentUser.attributes?.email || '';
            currentUserName = currentUser.attributes?.name || '';
            currentUsername = currentUser.attributes?.preferred_username || currentUser.username || currentUserEmail.split('@')[0];

            // Handle collaborators and determine the owner's userID
            let collaboratorsToSave;
            let ownerUserID; // This will be used as the partition key in DynamoDB

            // Check if this is a truly NEW trip (no tripId in DB AND no collaborators in context)
            // Note: tripId might exist in context if set from create_trip_1_city, but not saved to DB yet
            const isBrandNewTrip = !tripId && collaborators.length === 0;

            if (isBrandNewTrip) {
                // NEW TRIP (created directly in trip-view_main): Current user becomes owner
                ownerUserID = currentUserID;
                collaboratorsToSave = [{
                    email: currentUserEmail,
                    fullName: currentUserName,
                    username: currentUsername,
                    userID: currentUserID,
                    role: 'owner',
                    addedBy: currentUserName
                }];
                console.log('[trip-view_main] New trip - current user set as owner');
            } else if (collaborators.length > 0) {
                // EXISTING TRIP or TRIP WITH COLLABORATORS (set from create_trip_1_city): Preserve ALL collaborators

                // Find the owner's userID
                const owner = collaborators.find(c => c.role === 'owner');
                if (!owner) {
                    console.error('[trip-view_main] No owner found in collaborators');
                    return;
                }
                ownerUserID = owner.userID; // Always use owner's userID as partition key

                // Use existing collaborators (sanitized) - PRESERVE ALL
                collaboratorsToSave = collaborators.map(collaborator => ({
                    email: collaborator.email,
                    fullName: collaborator.fullName,
                    username: collaborator.username || collaborator.email.split('@')[0], // Fallback for legacy data
                    userID: collaborator.userID,
                    role: collaborator.role,
                    addedBy: collaborator.addedBy
                }));
                console.log('[trip-view_main] Using existing collaborators from context (may be from create_trip_1_city)');
            } else {
                // FALLBACK: Trip has tripId but no collaborators (edge case)
                // This shouldn't happen in normal flow, but handle it gracefully
                ownerUserID = currentUserID;
                collaboratorsToSave = [{
                    email: currentUserEmail,
                    fullName: currentUserName,
                    username: currentUsername,
                    userID: currentUserID,
                    role: 'owner',
                    addedBy: currentUserName
                }];
                console.warn('[trip-view_main] Trip has tripId but no collaborators - setting current user as owner');
            }

            // Add OWNER's userID and collaborators to trip data
            // This ensures we always use the owner's userID as the partition key in DynamoDB
            const nextVersion = versionRef.current + 1;

            // IMMEDIATELY update versionRef to prevent race conditions
            // This prevents concurrent saves from using the same version number
            versionRef.current = nextVersion;

            const tripDataWithUser = {
                ...tripData,
                userID: ownerUserID, // Always use owner's userID, not current user's userID
                collaborators: collaboratorsToSave,
                version: nextVersion,
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: currentUserEmail
            };

            // Make the API call (now using public auth)
            const result: any = await API.graphql({
                query: createTrip,
                variables: { input: tripDataWithUser }
            });

            // Update local state after successful save
            if (result.data?.createTrip?.version) {
                setVersion(result.data.createTrip.version);
                setUpdatedAt(result.data.createTrip.updatedAt);
                setLastUpdatedBy(result.data.createTrip.lastUpdatedBy);
                // versionRef already updated above, but sync with server response for safety
                versionRef.current = result.data.createTrip.version;
            }

            // ALWAYS update tripId if it wasn't set (prevents duplicate generation on next save)
            if (!tripId) {
                setTripId(currentTripId);
            }

            // ALWAYS update createdAt if it wasn't set (prevents re-generating on next save)
            if (!createdAt) {
                setCreatedAt(tripCreatedAt);
            }

            // Update local collaborators state after successful save
            // Only update if this was a brand new trip without any collaborators
            // If collaborators exist (from create_trip_1_city), keep them as-is
            if (isBrandNewTrip) {
                setCollaborators(collaboratorsToSave);
                console.log('[trip-view_main] Collaborators initialized after first save');
            } else {
                console.log('[trip-view_main] Keeping existing collaborators (may include invites from create_trip_1_city)');
            }

        } catch (error: any) {
            console.error('[trip-view_main] Error saving trip:', error);

            // Rollback version on failure to maintain consistency for retry
            // Since we optimistically incremented at line 1075, we need to decrement on failure
            versionRef.current = versionRef.current - 1;

            throw error;
        } finally {
            // Release save lock (both state and ref)
            isSavingRef.current = false;
            setIsSaving(false);
        }
    };

    useEffect(() => {
        navigation.setOptions({
          headerShown: false
        });
    }, []);

    // AppState listener for autosave when app goes to background
    // COMMENTED OUT - Autosave disabled
    // useEffect(() => {
    //     const handleAppStateChange = (nextAppState: string) => {
    //         if (nextAppState === 'background') {
    //             console.log('[trip-view_main] App going to background - checking autosave eligibility');

    //             // Only autosave for owners and editors, NOT viewers
    //             if (currentUserRole === 'viewer') {
    //                 console.log('[trip-view_main] User is viewer, skipping autosave');
    //                 return;
    //             }

    //             console.log('[trip-view_main] User has edit permissions, scheduling autosave');

    //             // Clear any pending autosave
    //             if (saveTimeoutRef.current) {
    //                 clearTimeout(saveTimeoutRef.current);
    //             }

    //             // Debounce autosave by 500ms to prevent rapid duplicate saves
    //             saveTimeoutRef.current = setTimeout(() => {
    //                 // Only autosave if we have a trip with activities or days
    //                 if (tripIdRef.current || activities.length > 0 || Object.keys(dayActivities).length > 0) {
    //                     console.log('[trip-view_main] Executing debounced autosave');
    //                     saveTrip().catch(error => {
    //                         console.error('[trip-view_main] Autosave failed on app background:', error);
    //                     });
    //                 }
    //             }, 500);
    //         }
    //     };

    //     const subscription = AppState.addEventListener('change', handleAppStateChange);

    //     return () => {
    //         // Clean up timeout on unmount
    //         if (saveTimeoutRef.current) {
    //             clearTimeout(saveTimeoutRef.current);
    //         }
    //         subscription?.remove();
    //     };
    // }, [tripId, activities, dayActivities, dayPolylines, tripLength, selectedCity, tripPhotoReference, createdAt, currentUserRole]);

    // Autosave with multiple triggers
    useEffect(() => {
        // Only autosave for owners and editors (viewers can't edit)
        if (currentUserRole === 'viewer') {
            return;
        }

        // Only enable periodic autosave if we have a tripId
        if (!tripId) {
            return;
        }


        // Trigger 1: Periodic autosave every 5 minutes
        autosaveIntervalRef.current = setInterval(() => {
            const now = Date.now();
            const timeSinceLastSave = now - lastSaveTimeRef.current;

            // Prevent saves during reload from subscription
            if (isReloadingRef.current) {
                // console.log('[trip-view_main] Skipping periodic autosave (reloading)');
                return;
            }

            // Check if already saving using ref
            if (isSavingRef.current) {
                // console.log('[trip-view_main] Skipping periodic autosave (save in progress)');
                return;
            }

            // Prevent duplicate saves within MIN_AUTOSAVE_INTERVAL
            if (timeSinceLastSave < MIN_AUTOSAVE_INTERVAL) {
                // console.log('[trip-view_main] Skipping periodic autosave (too soon)');
                return;
            }

            // console.log('[trip-view_main] Periodic autosave triggered');

            saveTrip()
                .then(() => {
                    lastSaveTimeRef.current = Date.now();
                })
                .catch(error => {
                    console.error('[trip-view_main] Autosave failed:', error);
                });
        }, 300000); // 5 minutes

        return () => {
            // Clean up periodic autosave
            if (autosaveIntervalRef.current) {
                clearInterval(autosaveIntervalRef.current);
            }
            if (saveDebounceTimeoutRef.current) {
                clearTimeout(saveDebounceTimeoutRef.current);
            }
        };
    }, [tripId, currentUserRole]); // Don't include isSaving - use refs instead

    // Trigger 2: App going inactive (before background suspension) - ALWAYS enabled, even for new trips
    useEffect(() => {
        // Only autosave for owners and editors (viewers can't edit)
        if (currentUserRole === 'viewer') {
            console.log('[trip-view_main] Background autosave disabled - user is viewer');
            return;
        }

        let inactiveSaveTimeout: NodeJS.Timeout | null = null;
        const handleAppStateChange = (nextAppState: string) => {
            console.log('[trip-view_main] AppState changed to:', nextAppState);

            // Trigger on 'inactive' to save before full suspension
            if (nextAppState === 'inactive') {
                // Clear any pending save
                if (inactiveSaveTimeout) {
                    clearTimeout(inactiveSaveTimeout);
                }

                // Save immediately when going inactive
                inactiveSaveTimeout = setTimeout(() => {
                    const now = Date.now();
                    const timeSinceLastSave = now - lastSaveTimeRef.current;

                    console.log('[trip-view_main] Inactive save check - isSavingRef:', isSavingRef.current, 'isReloadingRef:', isReloadingRef.current, 'timeSinceLastSave:', timeSinceLastSave);

                    if (isReloadingRef.current) {
                        console.log('[trip-view_main] Skipping inactive save (reloading)');
                        return;
                    }

                    if (isSavingRef.current) {
                        console.log('[trip-view_main] Skipping inactive save (save in progress)');
                        return;
                    }

                    // Check if there's any trip data worth saving
                    const hasContent = tripIdRef.current ||
                                      (latestTripDataRef.current.activities && latestTripDataRef.current.activities.length > 0) ||
                                      Object.keys(latestTripDataRef.current.dayActivities || {}).length > 0;

                    if (!hasContent) {
                        console.log('[trip-view_main] Skipping inactive save (no trip content)');
                        return;
                    }

                    if (timeSinceLastSave < MIN_AUTOSAVE_INTERVAL) {
                        console.log('[trip-view_main] Skipping inactive save (too soon, last save was', timeSinceLastSave, 'ms ago)');
                        return;
                    }

                    console.log('[trip-view_main] App going inactive - autosaving immediately...');

                    saveTrip()
                        .then(() => {
                            lastSaveTimeRef.current = Date.now();
                            console.log('[trip-view_main] Inactive autosave completed successfully');
                        })
                        .catch(error => {
                            console.error('[trip-view_main] Inactive autosave failed:', error);
                        });
                }, 0);
            }
        };

        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            // Clean up
            if (inactiveSaveTimeout) {
                clearTimeout(inactiveSaveTimeout);
            }
            appStateSubscription?.remove();
        };
    }, [currentUserRole]); // Only depends on user role, not tripId

    // Real-time subscription for trip updates
    useEffect(() => {
        // Only subscribe if we have a tripId AND screen is focused
        if (!tripId) {
            console.log('[trip-view_main] Skipping subscription - no tripId');
            return;
        }

        if (!isScreenFocused) {
            console.log('[trip-view_main] Skipping subscription - screen not focused');
            return;
        }

        console.log('[trip-view_main] Subscribing to real-time updates for trip:', tripId);

        const subscription = (API.graphql(
            graphqlOperation(onTripUpdated, { tripId })
        ) as any).subscribe({
            next: ({ value }: any) => {
                const updatedTrip = value?.data?.onTripUpdated;

                // Ignore if no data or if it's our own update
                if (!updatedTrip || updatedTrip.lastUpdatedBy === currentUserID) {
                    return;
                }

                console.log('[trip-view_main] Trip updated by another user - reloading...');

                // Update version tracking
                setVersion(updatedTrip.version);
                setUpdatedAt(updatedTrip.updatedAt);
                setLastUpdatedBy(updatedTrip.lastUpdatedBy);
                versionRef.current = updatedTrip.version;

                // Auto-reload to get latest changes
                handleReloadTrip();
            },
            error: (error: any) => {
                console.error('[trip-view_main] Subscription error:', error);
            }
        });

        return () => {
            console.log('[trip-view_main] Unsubscribing from trip updates');
            subscription.unsubscribe();
        };
    }, [tripId, currentUserID, currentUserRole, isScreenFocused]);

    // Get current user ID for collaboration features
    useEffect(() => {
        const getCurrentUser = async () => {
            try {
                const user = await Auth.currentAuthenticatedUser();
                const userID = user.username;
                setCurrentUserID(userID);
            } catch (error) {
                console.error('[trip-view_main] Error getting current user:', error);
            }
        };

        getCurrentUser();
    }, []);


    // Handle collaboration modal
    const handleShareTrip = async () => {

        // For new trips (no tripId yet), initialize collaborators with current user as owner
        if (!tripId && collaborators.length === 0) {
            try {
                const currentUser = await Auth.currentAuthenticatedUser();
                const currentUserID = currentUser.attributes?.sub || currentUser.username;
                const currentUserEmail = currentUser.attributes?.email || '';
                const currentUserName = currentUser.attributes?.name || '';
                const currentUsername = currentUser.attributes?.preferred_username || currentUser.username || currentUserEmail.split('@')[0];

                const ownerCollaborator = {
                    email: currentUserEmail,
                    fullName: currentUserName,
                    username: currentUsername,
                    userID: currentUserID,
                    role: 'owner',
                    addedBy: currentUserName
                };

                setCollaborators([ownerCollaborator]);
            } catch (error) {
                console.error('[trip-view_main] Error getting current user for collaborators:', error);
                // Alert.alert('Error', 'Unable to load user information for sharing');
                return;
            }
        }

        setIsShareModalVisible(true);
    };

    const handleCollaboratorsUpdate = (updatedCollaborators: any[]) => {
        setCollaborators(updatedCollaborators);
    };


    // Log getDayActivities for each day
    useEffect(() => {
        if (dayActivities) {
            Object.keys(dayActivities).forEach(dayNumber => {
                const acts = getDayActivities(Number(dayNumber));
            });
        }
    }, [dayActivities]);

    return (
        <>
            <TripMapView
                activities={getActivitiesForTab(activeTab)}
                activeTab={activeTab}
                routeCoordinates={
                  activeTab.startsWith('day') && getActivitiesForTab(activeTab).length > 0
                    ? routeData.polyline
                    : []
                }
                routeLoading={routeLoading}
                selectedActivities={selectedActivities}
                onMarkerPress={handleActivityDescriptionCardSelect}
                selectedMarker={selectedMarker}
                currentHeightState={currentHeightState}
                heightStates={heightStates}
                allActivities={getAllActivitiesFromTrip()}
                selectedCityLocation={selectedCityLocation || undefined}
                onShareTrip={async () => {
                    if (!tripId) {
                        // Save trip first if it doesn't exist
                        try {
                            await saveTrip();
                            // Update timestamp only after successful save
                            lastSaveTimeRef.current = Date.now();
                        } catch (error) {
                            console.error('[trip-view_main] Save before share failed:', error);
                            // Still allow sharing even if save failed (trip might exist)
                        }
                    }
                    handleShareTrip();
                }}
            />

            <Animated.View style={[
                styles.container,
                {
                    height: bottomHeight.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                    }),
                }
            ]}>
                {/* Draggable indicator bar */}
                <View {...panResponder.panHandlers} style={styles.dragIndicatorContainer}>
                    <View style={styles.dragIndicator} />
                </View>

                {!showActivityDetail && (
                    <TabBar
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        dayCount={getDayCount()}
                        onAddDay={handleAddDay}
                        onDeleteDay={handleDeleteDay}
                        shouldScrollToActive={shouldScrollToActive}
                        tabLabels={tabLabels}
                        currentUserRole={currentUserRole}
                        startDate={startDate}
                    />
                )}

                {/* Tab Content */}
                <View style={styles.tabContent}>
                {showActivityDetail && selectedActivityForDetail ? (
                    <ActivityDetailView
                        activity={selectedActivityForDetail}
                        onClose={handleCloseActivityDetail}
                        showDragIndicator={false}
                        onDuplicate={(activity) => handleDuplicateActivity(activity, activeTab.startsWith('day') ? parseInt(activeTab.replace('day', '')) : undefined)}
                        onDelete={(activity) => handleDeleteActivity(activity, activeTab.startsWith('day') ? parseInt(activeTab.replace('day', '')) : undefined)}
                    />
                ) : (
                    <>
                        {activeTab === 'wishlist' && (() => {
                            const wishlistActivities = getActivitiesForTab('wishlist');
                            const activitiesByCity = wishlistActivities.reduce((acc: { [key: string]: Activity[] }, activity) => {
                                const city = activity.city || 'Unknown City';
                                if (!acc[city]) acc[city] = [];
                                acc[city].push(activity);
                                return acc;
                            }, {} as { [key: string]: Activity[] });

                            return (
                                <ScrollView
                                    style={styles.wishlistContainer}
                                    contentContainerStyle={styles.wishlistContent}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {wishlistActivities.length === 0 ? (
                                        <View>
                                            {selectedCity && (
                                                <Text style={styles.cityTitle}>{selectedCity}</Text>
                                            )}
                                            {/* SearchBar hide for viewers */}
                                            {currentUserRole !== 'viewer' && (
                                                <View style={{ marginTop: 0, marginBottom: 0 }}>
                                                    <SearchBar
                                                        value={searchQuery}
                                                        onChangeText={handleSearchQueryChange}
                                                        onPress={handleSearchPress}
                                                        placeholder="Add more activities"
                                                    />
                                                </View>
                                            )}

                                            {/* Category Cards - hide for viewers */}
                                            {currentUserRole !== 'viewer' && (
                                                <View style={styles.categoriesSection}>
                                                    <Text style={styles.categoriesTitle}>Browse by Category</Text>
                                                        {Array.isArray(cityCategories) && cityCategories.length > 0 ? (
                                                        <View style={styles.categoriesGrid}>
                                                            {cityCategories.map((category: any, index: number) => (
                                                                <TouchableOpacity
                                                                    key={index}
                                                                    style={styles.categoryCard}
                                                                    onPress={() => handleCategoryPress(category)}
                                                                    activeOpacity={0.7}
                                                                >
                                                                    <View style={styles.categoryContent}>
                                                                        {category.emoji && (
                                                                            <View style={styles.emojiContainer}>
                                                                                <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                                                                            </View>
                                                                        )}
                                                                        <Text style={styles.categoryName}>{category.category}</Text>
                                                                        <Text style={styles.categoryItems} numberOfLines={1}>
                                                                            {category.category_items[0]}
                                                                        </Text>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    ) : (
                                                        <View style={styles.loadingContainer}>
                                                            <ActivityIndicator size="large" color={Colors.PRIMARY} />
                                                            <Text style={styles.loadingText}>
                                                                Loading categories for {selectedCity}...
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    ) : (
                                        <>
                                            {Object.entries(activitiesByCity).map(([city, cityActivities]: [string, Activity[]]) => (
                                                <View key={`wishlist-${city}`} style={styles.citySection}>
                                                    <Text style={styles.cityTitle}>{city}</Text>
                                                    <WishlistActivities
                                                        activities={cityActivities}
                                                        selectedActivities={selectedActivities}
                                                        onActivitySelect={currentUserRole !== 'viewer' ? toggleActivitySelection : undefined}
                                                        onActivityDeselect={currentUserRole !== 'viewer' ? toggleActivitySelection : undefined}
                                                        onDescriptionCardPress={handleActivityDescriptionCardSelect}
                                                        showSelectionIndicator={isSelectionMode && currentUserRole !== 'viewer'}
                                                        onDuplicate={currentUserRole !== 'viewer' ? handleDuplicateActivity : undefined}
                                                        activeTab={activeTab}
                                                        currentUserRole={currentUserRole}
                                                    />
                                                </View>
                                            ))}

                                            {/* Loading indicator while activity is being added from AutocompleteModal */}
                                            {isAutocompleteAddingPlace && (
                                                <View style={styles.autocompleteLoadingContainer}>
                                                    <ActivityIndicator size="small" color={Colors.PRIMARY} />
                                                    <Text style={styles.autocompleteLoadingText}>Activity Loading</Text>
                                                </View>
                                            )}

                                            {/* SearchBar after all activities - hide for viewers */}
                                            {currentUserRole !== 'viewer' && (
                                                <View
                                                    style={{
                                                        marginTop: isAutocompleteAddingPlace ? 0 : -30,
                                                        marginBottom: 30,
                                                    }}
                                                >
                                                    <SearchBar
                                                        value={searchQuery}
                                                        onChangeText={handleSearchQueryChange}
                                                        onPress={handleSearchPress}
                                                        placeholder="Add more activities"
                                                    />
                                                </View>
                                            )}

                                            {/* Category Cards - hide for viewers */}
                                            {currentUserRole !== 'viewer' && (
                                                <View style={styles.categoriesSection}>
                                                    <Text style={styles.categoriesTitle}>Browse by Category</Text>
                                                        {Array.isArray(cityCategories) && cityCategories.length > 0 ? (
                                                        <View style={styles.categoriesGrid}>
                                                            {cityCategories.map((category: any, index: number) => (
                                                                <TouchableOpacity
                                                                    key={index}
                                                                    style={styles.categoryCard}
                                                                    onPress={() => handleCategoryPress(category)}
                                                                    activeOpacity={0.7}
                                                                >
                                                                    <View style={styles.categoryContent}>
                                                                        {category.emoji && (
                                                                            <View style={styles.emojiContainer}>
                                                                                <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                                                                            </View>
                                                                        )}
                                                                        <Text style={styles.categoryName}>{category.category}</Text>
                                                                        <Text style={styles.categoryItems} numberOfLines={1}>
                                                                            {category.category_items[0]}
                                                                        </Text>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    ) : (
                                                        <View style={styles.loadingContainer}>
                                                            <ActivityIndicator size="large" color={Colors.PRIMARY} />
                                                            <Text style={styles.loadingText}>
                                                                Loading categories for {selectedCity}...
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </>
                                    )}
                                </ScrollView>
                            );
                        })()}
                        
                        {activeTab.startsWith('day') && (() => {
                            const currentDayNumber = parseInt(activeTab.replace('day', ''));
                            return (
                                <DaySchedule
                                    dayNumber={currentDayNumber}
                                    activities={getActivitiesForTab(activeTab)}
                                    selectedActivities={selectedActivities}
                                    onActivitySelect={currentUserRole !== 'viewer' ? toggleActivitySelection : undefined}
                                    onActivityDeselect={currentUserRole !== 'viewer' ? toggleActivitySelection : undefined}
                                    onDescriptionCardPress={handleActivityDescriptionCardSelect}
                                    onTransferToWishlist={handleTransferToWishlist}
                                    onOptimizeRoute={currentUserRole !== 'viewer' ? handleOptimizeRoute : undefined}
                                    showSelectionIndicator={isSelectionMode && currentUserRole !== 'viewer'}
                                    routeLegs={routeData.legs}
                                    onAddPlace={currentUserRole !== 'viewer' ? handleSearchPress : undefined}
                                    searchQuery={searchQuery}
                                    onSearchQueryChange={handleSearchQueryChange}
                                    scrollPosition={dayScrollPositions[currentDayNumber] || 0}
                                    onScrollPositionChange={(position) => handleScrollPositionChange(currentDayNumber, position)}
                                    shouldRestorePosition={shouldRestoreScrollPositions[currentDayNumber] || false}
                                    travelMode={routeData.travelMode}
                                    onReorder={currentUserRole !== 'viewer' ? handleDayActivityReorder : undefined}
                                    routeLoading={routeLoading}
                                    onGoToWishlist={() => handleTabChange('wishlist')}
                                    onDuplicate={currentUserRole !== 'viewer' ? handleDuplicateActivity : undefined}
                                    isAddingPlaceFromAutocomplete={isAutocompleteAddingPlace}
                                    activeTab={activeTab}
                                    currentUserRole={currentUserRole}
                                    onOpenSettings={currentUserRole !== 'viewer' ? handleOpenSettings : undefined}
                                />
                            );
                        })()}
                    </>
                )}
                </View>

                {/* Transfer Button Container */}
                <TransferButtonContainer
                activeTab={activeTab}
                isSelectionMode={isSelectionMode}
                selectedActivities={selectedActivities}
                onTransferPress={handleOpenTransferModal}
                onDeletePress={handleDeleteActivities}
                currentUserRole={currentUserRole}
                />

                {/* Transfer Modal */}
                <TransferActivitiesModal
                visible={isModalVisible}
                daysArray={daysArray}
                selectedDay={selectedDay}
                onSelectDay={handleDaySelection}
                onClose={() => setIsModalVisible(false)}
                startDate={startDate}
                />
            </Animated.View>

            {/* AutocompleteModal for searching activities - new direct flow */}
            <AutocompleteModal
                visible={showAutocomplete}
                query={searchQuery}
                filters={selectedFilters}
                selectedCity={selectedCity || ''}
                onClose={() => {
                    setShowAutocomplete(false);
                    setSearchQuery('');
                }}
                onFilterToggle={handleFilterToggle}
                onQueryChange={handleSearchQueryChange}
                onSaveActivities={handleSaveSearchResults}
                showAddingPlaceLoading={false}
                onAddingPlaceChange={setIsAutocompleteAddingPlace}
                wishlistActivities={activities || []}
                activeTab={activeTab}
            />

            {/* CategoryModal for browsing activities by category */}
            <CategoryModal
                visible={showCategoryModal}
                category={selectedCategory}
                activities={categoryActivities[selectedCategory] || []}
                loading={loadingCategoryActivities}
                loadingMore={loadingMoreCategoryActivities}
                onSave={handleSaveCategoryActivities}
                onClose={() => setShowCategoryModal(false)}
                onGenerateMore={handleGenerateMoreCategoryActivities}
                wishlistActivities={getActivitiesForTab('wishlist')}
                dayActivities={Object.values(dayActivities || {}).flatMap(dayObj =>
                    Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : []
                )}
            />

            {/* Share Trip Modal */}
            {currentUserID && (
                <ShareTripModal
                    visible={isShareModalVisible && !!tripId}
                    onClose={() => setIsShareModalVisible(false)}
                    tripId={tripId || ''}
                    collaborators={collaborators || []}
                    currentUserRole={currentUserRole || 'owner'}
                    currentUserID={currentUserID}
                    selectedCity={selectedCity}
                    onCollaboratorsUpdate={handleCollaboratorsUpdate}
                />
            )}

            {/* Transportation Settings Modal */}
            {selectedLegIndex !== null && (
                <TransportationSettingsModal
                    visible={settingsModalVisible}
                    onClose={() => {
                        setSettingsModalVisible(false);
                        setSelectedLegIndex(null);
                        setModalOriginActivity(undefined);
                        setModalDestinationActivity(undefined);
                    }}
                    onSelectMode={handleSelectMode}
                    currentMode={(routeData.legs[selectedLegIndex] as EnhancedRouteLeg)?.selectedMode || 'DRIVE'}
                    modeData={(routeData.legs[selectedLegIndex] as EnhancedRouteLeg)?.modeData || {}}
                    loadingModes={(routeData.legs[selectedLegIndex] as EnhancedRouteLeg)?.loadingModes || []}
                    originActivity={modalOriginActivity}
                    destinationActivity={modalDestinationActivity}
                />
            )}

            <TouchableOpacity
                style={styles.homeButton}
                onPress={async () => {
                    const dayCountVal = getDayCount();

                    // Only save if user has edit permissions (owner or editor)
                    if (currentUserRole !== 'viewer') {
                        try {
                            await saveTrip();
                            // Update timestamp only after successful save
                            lastSaveTimeRef.current = Date.now();
                        } catch (error) {
                            console.error('[trip-view_main] Manual save failed:', error);
                            // Could show an alert to the user here if desired
                        }
                    } else {
                        console.log('[trip-view_main] Viewer navigating home - skipping save');
                    }

                    // Check if this is an existing trip (loaded from cloud) or a new trip
                    const isExistingTrip = tripId;

                    if (isExistingTrip) {
                        // This trip was loaded from cloud storage, go back to profile
                        let lastActivityPhotoRef = '';
                        const day1Activities = getDayActivities(1);
                        if (day1Activities && day1Activities.length > 0) {
                            lastActivityPhotoRef = day1Activities[0]?.photo_reference || '';
                        } else if (activities && Array.isArray(activities) && activities.length > 0) {
                            lastActivityPhotoRef = activities[0]?.photo_reference || '';
                        }
                        router.push({
                            pathname: '/profile',
                            params: {
                                photoReference: lastActivityPhotoRef,
                                dayCount: dayCountVal.toString(),
                            }
                        });
                    } else {
                        // This is a new trip, show publish success page
                        router.push({
                            pathname: '/trip-view/publish_success',
                            params: {
                                dayCount: dayCountVal.toString(),
                            }
                        });
                    }
                }}
            >
                <Entypo name="home" size={30} color={Colors.PRIMARY} />
            </TouchableOpacity>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.WHITE,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 0,
    },
    dragIndicatorContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 12,
        paddingTop: 8,
    },
    dragIndicator: {
        width: 40,
        height: 5,
        backgroundColor: '#D1D5DB',
        borderRadius: 3,
    },
    homeButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        zIndex: 1, // Ensure it's above the map
        backgroundColor: 'white',
        borderRadius: 25,
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    shareButton: {
        position: 'absolute',
        top: 60,
        left: 80, // Position next to home button
        zIndex: 1,
        backgroundColor: 'white',
        borderRadius: 25,
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    tabContent: {
        flex: 1,
        marginTop: 0,
        marginHorizontal: 8, // Reduced from 20 to 5
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20, // Reduced from 20 to 
        marginBottom: 40, // Space for transfer button
    },
    citySection: {
        marginBottom: 5,
    },
    cityTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        marginTop: 0,
        textAlign: 'center',
        marginBottom: 13,
        color: '#1a1a1a',
    },
    wishlistContainer: {
        flex: 1,
    },
    wishlistContent: {
        paddingBottom: 20,
    },
    categoriesSection: {
        marginTop: -10,
        marginBottom: 20,
    },
    categoriesTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 18,
        color: '#333',
        marginBottom: 15,
        textAlign: 'center',
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    categoryCard: {
        width: '48%',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e9ecef',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#e9ecef',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    categoryEmoji: {
        fontSize: 24,
        textAlign: 'center',
    },
    categoryName: {
        fontFamily: 'outfit-bold',
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
        marginBottom: 5,
    },
    categoryItems: {
        fontFamily: 'outfit',
        fontSize: 10,
        color: '#666',
        lineHeight: 16,
        textAlign: 'center',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#666',
        marginTop: 10,
    },
    autocompleteLoadingContainer: {
        marginTop: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    autocompleteLoadingText: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#666',
        marginLeft: 8,
    },
});